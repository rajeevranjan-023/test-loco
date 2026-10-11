import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import RevokedToken from '../models/RevokedToken.js'
import { findAccountByUser } from '../utils/accounts.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { normalizeUsername } from '../utils/username.js'

// Identity of a logged-out token (its hash — works for every token ever issued, no change to how tokens are made).
export const tokenHash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 40)
export const isRevoked = async (token) => !!(await RevokedToken.exists({ hash: tokenHash(token) }))

// _________________________________________________________________________________
// =================================================================================

export const protect = asyncHandler(async (req, res, next) => {   // is user login or not, if yes then next() else return 401
  const header = req.headers.authorization                       // Get the Authorization header from the req
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, please log in.' })
  }

  try {
    const token = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (await isRevoked(token)) {   // logged out — a stale copy of this token must never restore the session
      return res.status(401).json({ message: 'Session expired or invalid, please log in again.' })
    }
    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' })
    }
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid, please log in again.' })
  }
})

// _________________________________________________________________________________
// =================================================================================

// Like `protect`, but doesn't reject the request if there's no/invalid token —
// it just leaves req.user undefined. Used for public endpoints (like posting a
// requirement) that still want to attach the logged-in user when there is one.
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return next()
  }
  try {
    const token = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = (await isRevoked(token)) ? null : await User.findById(decoded.id)
    if (user) req.user = user
  } catch (err) {
    // Invalid/expired token on a public route — just proceed as a guest.
  }
  next()
})

// _________________________________________________________________________________
// =================================================================================

export const requireSeller = asyncHandler(async (req, res, next) => {     //is user a seller or not
  // Admins may act on any seller's dashboard by sending `x-view-as: <username>` (the frontend does this
  // automatically on /:username/* pages). The header is IGNORED for every non-admin user.
  let owner = req.user
  if (req.user.role === 'admin') {
    const viewAs = normalizeUsername(req.headers['x-view-as'])
    if (!viewAs) {
      return res.status(400).json({ message: 'Admin requests to seller data must include the x-view-as header.' })
    }
    owner = await User.findOne({ username: viewAs })
    if (!owner) return res.status(404).json({ message: 'No account with that username.' })
  }

  if (owner.role !== 'seller') {                   //seller can be,[service provide or shop owner]
    return res.status(403).json({ message: 'Only sellers can access this. Finish "Start Yours" first.' })
  }

  const account = await findAccountByUser(owner._id, owner.sellerType) // sellerType → shop / service / study centre document

  if (!account) {
    return res.status(404).json({ message: 'Seller account not found.' })
  }

  req.sellerAccount = account           //data ko “aage pass” karne ke liye hai 
  req.sellerType = owner.sellerType     // (middleware → controller)
  next() 
})
// _________________________________________________________________________________
// =================================================================================

// Owner guard for any route that carries a username in the URL (e.g. /api/.../:username/...).
// Run AFTER `protect`. Logged-in user's username must equal the route username, otherwise 403 —
// so a visitor can never reach owner-only data just by editing the URL.
export const requireOwner = (param = 'username') => (req, res, next) => {
  if (req.user?.role === 'admin') return next() // admin may open any username's pages
  const target = normalizeUsername(req.params[param])
  if (!req.user?.username || !target || req.user.username !== target) {
    return res.status(403).json({ message: 'Only the owner of this shop can access this.' })
  }
  next()
}

// Route guard for a business module (e.g. the study-centre seat/member APIs): allowed only when this account's business
// schema has that capability switched on. Keyed on capabilities from the schema — never on a name or id.
import { capabilitiesOf } from '../utils/businessSchema.js'
export const requireCapability = (cap) => (req, res, next) => {
  if (!capabilitiesOf(req.sellerType, req.sellerAccount)[cap]) return res.status(403).json({ message: 'This feature is not available for your business type.' })
  next()
}
