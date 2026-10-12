import mongoose from 'mongoose'
// Stored as-is on Shop / ServiceProvider; always read through utils/billingConfig.js (which applies defaults + validation).
export const billingConfigField = { capabilities: { type: mongoose.Schema.Types.Mixed, default: null } }
