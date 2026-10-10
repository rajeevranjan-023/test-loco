import mongoose from 'mongoose'
import { billingConfigField } from './billingConfigSchema.js'

// A Study Center / Library account. Same role as Shop / ServiceProvider: one account document per owner, keyed by
// userId, and every shared engine (billing, customers, udhar ledger, bill ids) is scoped by this document's _id.
// Everything that differs between two centres — seats, naming, zones, time slots, plans, fees, rules — is DATA in `config`.
const sub = (shape) => new mongoose.Schema(shape, { _id: false })

const studyCenterSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    username: { type: String, required: true, unique: true, trim: true },

    centerName: { type: String, required: true, trim: true },
    centerCode: { type: String, default: '', trim: true }, // human id shown in the header, e.g. #STU102
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },

    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    images: { type: [String], default: [] },
    features: { type: [String], default: [] },      // facilities: "Free Wi-Fi", "AC", "Locker" …
    studyEnvironment: { type: String, default: '' }, // "Silent zone · 24x7 power backup …"
    socials: { whatsapp: { type: String, default: '' }, instagram: { type: String, default: '' }, facebook: { type: String, default: '' } },
    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    category: { type: String, default: 'Library' },
    subCategory: { type: String, default: 'Study Space', trim: true },

    location: { address: { type: String, default: '' }, state: { type: String, default: '' }, district: { type: String, default: '' }, area: { type: String, default: '' }, lat: { type: Number, default: null }, lng: { type: Number, default: null } },
    timing: { open: { type: String, default: '06:00' }, close: { type: String, default: '22:00' }, openDays: { type: String, default: 'All Week' } },

    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    billing: billingConfigField, // Universal Billing capabilities (utils/billingConfig.js)

    // ── per-centre configuration (initialised from the study_center schema defaults when the account is created) ──
    config: {
      operatingHours: { open: { type: String, default: '06:00' }, close: { type: String, default: '22:00' } },
      zones: { type: [sub({ key: String, name: String })], default: [] },
      seatTypes: { type: [sub({ key: String, name: String })], default: [] },
      timeSlots: { type: [sub({ key: String, label: String, start: String, end: String })], default: [] },
      plans: { type: [sub({ key: String, name: String, months: Number, price: Number, active: { type: Boolean, default: true } })], default: [] },
      chargeTypes: { type: [sub({ key: String, label: String, kind: { type: String, default: 'fine' }, amount: { type: Number, default: 0 } })], default: [] },
      materials: { type: [sub({ key: String, name: String, kind: { type: String, default: 'book' }, price: { type: Number, default: 0 } })], default: [] },
      lastNaming: { type: mongoose.Schema.Types.Mixed, default: null }, // the seat naming pattern last used, pre-fills the "Add Seat" form
      features: { type: mongoose.Schema.Types.Mixed, default: {} },      // explicit capability switches, e.g. { inventory: true }
      memberPrefix: { type: String, default: 'STU' },
      memberCounter: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

studyCenterSchema.methods.toPublicProfile = function toPublicProfile() {
  return {
    type: 'study_center',
    id: this._id,
    username: this.username,
    centerCode: this.centerCode,
    shopCode: this.centerCode, // same field the shared shell reads
    verified: !!this.verified,
    images: this.images || [],
    features: this.features || [],
    studyEnvironment: this.studyEnvironment || '',
    socials: { whatsapp: this.socials?.whatsapp || '', instagram: this.socials?.instagram || '', facebook: this.socials?.facebook || '' },
    name: this.centerName,
    ownerName: this.ownerName,
    phone: this.phone,
    email: this.email,
    logoUrl: this.logoUrl,
    bannerUrl: this.bannerUrl,
    category: this.category,
    subCategory: this.subCategory,
    description: this.description,
    location: this.location,
    timing: this.timing,
    rating: this.rating,
    reviewCount: this.reviewCount,
    followerCount: this.followers?.length || 0,
    createdAt: this.createdAt,
  }
}

export default mongoose.model('StudyCenter', studyCenterSchema)
