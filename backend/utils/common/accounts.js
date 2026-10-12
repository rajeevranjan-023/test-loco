import Shop from '../../models/shop/Shop.js'
import ServiceProvider from '../../models/services/ServiceProvider.js'
import StudyCenter from '../../models/library/StudyCenter.js'

// sellerType → the account model. This is the ONE place that knows which collection holds which kind of business.
// Unknown / null sellerType falls back to ServiceProvider, exactly as the previous `sellerType === 'shop' ? Shop : ServiceProvider` did.
export const ACCOUNT_MODELS = { shop: Shop, service: ServiceProvider, study_center: StudyCenter }
export const accountModel = (sellerType) => ACCOUNT_MODELS[sellerType] || ServiceProvider
export const findAccountByUser = (userId, sellerType) => accountModel(sellerType).findOne({ userId })
// username → { account, sellerType } across every business type (public profile lookups)
export async function findAccountByUsername(username) {
  for (const [sellerType, M] of Object.entries(ACCOUNT_MODELS)) { const account = await M.findOne({ username }); if (account) return { account, sellerType } }
  return null
}
export const accountName = (a) => a?.shopName || a?.centerName || a?.name || ''
export const accountCode = (a) => a?.shopCode || a?.centerCode || ''
