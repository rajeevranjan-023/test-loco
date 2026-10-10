import mongoose from 'mongoose'
import { billingConfigField } from './billingConfigSchema.js'

const shopSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    username: { type: String, required: true, unique: true, trim: true },

    // ---------- Basic ----------
    shopName: { type: String, required: true, trim: true },
    shopCode: { type: String, default: '', trim: true }, // human-friendly id shown in the seller header, e.g. #GCR001
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },

    // ---------- Media ----------
    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },

    description: { type: String, default: '' },

    // Gallery shown in "Shop Photos" (first image = "Main"), short highlight tags ("Fresh Products"…), public social links.
    images: { type: [String], default: [] },
    features: { type: [String], default: [] },
    socials: {
      whatsapp: { type: String, default: '', trim: true },
      instagram: { type: String, default: '', trim: true },
      facebook: { type: String, default: '', trim: true },
    },
    verified: { type: Boolean, default: false },

    // Homepage: admins can feature a shop (its banner is used in the hero first); inactive shops are hidden everywhere public.
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    subCategory: { type: String, default: '', trim: true }, // e.g. "Study Space", "Book Rental" — shown under the name

    category: {
      type: String,
      enum: ['Grocery', 'Electronics', 'Medical', 'Hardware', 'Fashion', 'Furniture', 'Mobile Store', 'Bakery', 'Paint', 'Library', 'PG / Hostel', 'Food & Beverages', 'Healthcare', 'Education', 'Other'],
      default: 'Other',
    },

    // ---------- Location ----------
    location: {
      address: { type: String, default: '' }, // full manual address line
      state: { type: String, default: '' },
      district: { type: String, default: '' },
      area: { type: String, default: '' }, // local locality
      lat: { type: Number, default: null }, // auto (GPS), when granted
      lng: { type: Number, default: null },
    },

    // ---------- Business type ----------
    businessType: { type: String, enum: ['Retail', 'Wholesale', 'Both'], default: 'Retail' },
    homeDelivery: { type: Boolean, default: false },

    // ---------- Timing ----------
    timing: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '21:00' },
      openDays: { type: String, enum: ['Mon-Sat', 'All Week'], default: 'Mon-Sat' },
    },

    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },

    billing: billingConfigField, // Universal Billing capabilities (see utils/billingConfig.js)

    // Users following this shop's profile.
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

shopSchema.methods.toPublicProfile = function toPublicProfile() {
  return {
    type: 'shop',
    id: this._id,
    username: this.username,
    shopCode: this.shopCode,
    verified: !!this.verified,
    images: this.images || [],
    features: this.features || [],
    socials: {
      whatsapp: this.socials?.whatsapp || '',
      instagram: this.socials?.instagram || '',
      facebook: this.socials?.facebook || '',
    },
    name: this.shopName,
    ownerName: this.ownerName,
    phone: this.phone,
    email: this.email,
    logoUrl: this.logoUrl,
    bannerUrl: this.bannerUrl,
    category: this.category,
    description: this.description,
    location: this.location,
    businessType: this.businessType,
    homeDelivery: this.homeDelivery,
    timing: this.timing,
    rating: this.rating,
    reviewCount: this.reviewCount,
    followerCount: this.followers?.length || 0,
    createdAt: this.createdAt,
  }
}

export default mongoose.model('Shop', shopSchema)
