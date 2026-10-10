import GlobalUser from '../models/GlobalUser.js'

export const PHONE_RE = /^\d{10}$/
export const mostUsedName = (g) => [...(g?.names || [])].sort((a, b) => b.count - a.count)[0]?.name || ''
export const totalUses = (g) => (g?.names || []).reduce((s, n) => s + (n.count || 0), 0)

// Register one use of `name` for `phone` (creates the global user on first sight). inc = 0 just makes sure it exists.
export async function touchGlobalUser(phone, name, inc = 1, retry = true) {
  name = String(name || '').trim()
  if (!PHONE_RE.test(phone || '') || !name) return null
  const key = name.toLowerCase()
  const bumped = await GlobalUser.findOneAndUpdate({ phone, 'names.key': key }, { $inc: { 'names.$.count': inc } }, { new: true })
  if (bumped) return bumped
  try {
    return await GlobalUser.findOneAndUpdate({ phone }, { $push: { names: { name, key, count: inc } } }, { upsert: true, new: true })
  } catch (e) {
    if (e.code === 11000 && retry) return touchGlobalUser(phone, name, inc, false) // two shops created the same phone at once
    throw e
  }
}
