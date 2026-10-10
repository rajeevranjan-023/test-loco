import mongoose from 'mongoose'

// Generic atomic sequence (one doc per key). Used for per-shop product codes (A001, A002, …).
const counterSchema = new mongoose.Schema({ _id: { type: String }, seq: { type: Number, default: 0 } }, { versionKey: false })
export default mongoose.model('Counter', counterSchema)
