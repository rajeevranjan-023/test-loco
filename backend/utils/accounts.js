import Shop from '../models/Shop.js'
import ServiceProvider from '../models/ServiceProvider.js'
import StudyCenter from '../models/StudyCenter.js'

export const ACCOUNT_MODELS = { shop: Shop, service: ServiceProvider, study_center: StudyCenter }
export const accountModel = (sellerType) => ACCOUNT_MODELS[sellerType] || ServiceProvider
export const findAccountByUser = (userId, sellerType) => accountModel(sellerType).findOne({ userId })
export async function findAccountByUsername(username) {
  for (const [sellerType, M] of Object.entries(ACCOUNT_MODELS)) { const account = await M.findOne({ username }); if (account) return { account, sellerType } }
  return null
}
export const accountName = (a) => a?.shopName || a?.centerName || a?.name || ''
export const accountCode = (a) => a?.shopCode || a?.centerCode || ''
