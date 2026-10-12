import assert from 'node:assert/strict'
import { dailySeries, topItems, istDay } from '../utils/billingSeries.js'
let n = 0; const t = (m, f) => { f(); n++; console.log('✅', m) }
const bills = [
  { createdAt: '2026-03-01T19:00:00Z', revenue: { product: 500, service: 300, labour: 200 }, paidAmount: 700, unpaidAmount: 300, totalAmount: 1000, items: [{ type: 'service', name: 'AC Service', qty: 1, total: 300 }, { type: 'product', name: 'Gas ', qty: 1, total: 500 }, { type: 'material', name: 'Tape', qty: 2, total: 0 }] },
  { createdAt: '2026-03-02T03:00:00Z', revenue: { service: 400, registration: 50 }, paidAmount: 450, unpaidAmount: 0, totalAmount: 450, items: [{ type: 'service', name: 'ac service', qty: 1, total: 400 }] },
  { createdAt: '2026-03-02T05:00:00Z', totalAmount: 250, paidAmount: 0, unpaidAmount: 250, items: [] }, // legacy bill: no revenue split
]
t('IST day: 19:00Z is already the next day in India', () => assert.equal(istDay('2026-03-01T19:00:00Z'), '2026-03-02'))
const d = dailySeries(bills)
t('bills group by IST day', () => { assert.equal(d.length, 1); assert.equal(d[0].bills, 3) })
t('revenue = Σ stored revenue + legacy total (no recompute)', () => assert.equal(d[0].revenue, 1000 + 450 + 250))
t('kind split, unknown kinds fold into other, legacy counts as product', () => { assert.equal(d[0].product, 750); assert.equal(d[0].service, 700); assert.equal(d[0].labour, 200); assert.equal(d[0].other, 50) })
t('collected / outstanding sum from the bills', () => { assert.equal(d[0].collected, 1150); assert.equal(d[0].outstanding, 550) })
t('series sorted by date', () => assert.deepEqual(dailySeries([{ ...bills[2], createdAt: '2026-03-10T00:00:00Z' }, bills[0]]).map((r) => r.date), ['2026-03-02', '2026-03-10']))
const top = topItems(bills)
t('top items merge case/space variants and rank by billed value', () => { assert.equal(top[0].name, 'AC Service'); assert.equal(top[0].billed, 700); assert.equal(top[0].bills, 2); assert.equal(top[1].name, 'Gas') })
t('internal zero-value materials are excluded', () => assert.ok(!top.some((i) => i.name === 'Tape')))
t('empty input is safe', () => { assert.deepEqual(dailySeries([]), []); assert.deepEqual(topItems([]), []) })
console.log(`\n${n} billing series tests passed`)
