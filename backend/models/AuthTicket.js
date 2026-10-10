import mongoose from 'mongoose'

// Short-lived, single-use hand-off between the Google callback (backend) and the SPA. The callback never puts a session
// token or profile in a URL — only this opaque ticket, which the SPA exchanges via POST.
const authTicketSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    kind: { type: String, enum: ['login', 'link', 'register'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    google: { sub: String, email: String, name: String, picture: String },
    next: { type: String, default: '/' },
    attempts: { type: Number, default: 0 },       // wrong-password tries on a 'link' ticket
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)
authTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('AuthTicket', authTicketSchema)
