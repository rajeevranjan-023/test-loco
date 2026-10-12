// Service Provider business schema: analytics module, no shop-only modules (no database needed).
import assert from 'node:assert/strict'
import { schemaFor, publicBusiness, navOf } from '../utils/businessSchema.js'
let n = 0; const t = (m, f) => { f(); n++; console.log('✅', m) }

const svc = publicBusiness('service', {}), shop = publicBusiness('shop', {}), study = publicBusiness('study_center', {})
t('service analytics uses the billing-summary module', () => { assert.equal(svc.modules.analytics, 'billingAnalytics'); assert.equal(svc.analytics.provider, 'billing') })
t('shop analytics is unchanged', () => { assert.equal(shop.modules.analytics, 'analytics'); assert.equal(shop.analytics.provider, 'shop') })
t('study analytics is unchanged', () => { assert.equal(study.modules.analytics, 'configAnalytics'); assert.equal(study.analytics.provider, 'study') })
t('service does not expose Offers / Messages modules (API is shop-only)', () => { assert.ok(!('offers' in svc.modules) && !('messages' in svc.modules)); assert.ok('offers' in shop.modules && 'messages' in shop.modules) })
t('service user menu has no Offers / Messages entries', () => { const l = svc.userMenu.map(([x]) => x.toLowerCase()); assert.ok(!l.some((x) => /offer|message/.test(x))) })
t('service keeps billing, dues, inventory, customers, settings', () => { for (const k of ['billing', 'udhar', 'inventory', 'customer', 'settings', 'bill', 'products']) assert.ok(svc.modules[k], k) })
t('every service nav entry resolves to a module (no dead tab)', () => { for (const x of navOf('service', {})) if (x.sub) assert.ok(svc.modules[x.sub], x.sub) })
t('service navigation unchanged', () => assert.deepEqual(navOf('service', {}).map((x) => x.sub), ['', 'dashboard', 'billing', 'udhar', 'analytics', 'inventory', 'customer', 'add']))
t('shop-only modules are absent from the study schema too', () => { for (const k of ['offers', 'messages', 'products', 'udhar']) assert.ok(!(k in study.modules), k) })
t('unknown sellerType still falls back to the service schema', () => assert.equal(schemaFor('x').analytics.provider, 'billing'))
console.log(`\n${n} service schema tests passed`)
