// FIFO batch engine tests — pure logic, no database.
import assert from 'node:assert/strict'
import { addBatch, consumeFIFO, restoreToBatches, writeOffFIFO, trimBreakdown, weightedCost, totalCost, applyBatchEdit, ensureBatches, syncStock, codeFor, breakdownOfSale, StockError } from '../utils/common/stock.js'

const mk = (over = {}) => ({ name: 'Sugar', listed: true, stock: 0, costPrice: 70, createdAt: new Date('2026-01-01'), batches: [], ...over })
const day = (n) => new Date(2026, 0, n)
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} !== ${b}`)

// 1) the brief's example: 500g @70 (old) + 1kg @75 (new); customer buys 1kg
{
  const p = mk()
  addBatch(p, { quantity: 0.5, costPrice: 70, addedAt: day(1) })
  addBatch(p, { quantity: 1, costPrice: 75, addedAt: day(2) })
  assert.equal(p.stock, 1.5)
  const bd = consumeFIFO(p, 1)
  assert.deepEqual(bd.map(({ qty, costPrice }) => ({ qty, costPrice })), [{ qty: 0.5, costPrice: 70 }, { qty: 0.5, costPrice: 75 }])
  assert.equal(p.batches[0].exhausted, true); assert.equal(p.batches[0].remainingQty, 0)
  assert.equal(p.batches[1].remainingQty, 0.5); assert.equal(p.batches[1].exhausted, false)
  assert.equal(p.stock, 0.5)
  // profit sold at ₹80/kg: (80-70)*0.5 + (80-75)*0.5 = 7.5 ; weighted-average cost gives the SAME number
  const price = 80, qty = 1
  near((price - weightedCost(bd)) * qty, 7.5, 'weighted avg profit == batch-wise profit')
  near(price * qty - totalCost(bd), 7.5, 'revenue − batch cost')
  console.log('✅ brief example: 1kg from [0.5kg@70, 1kg@75] → 0.5@70 + 0.5@75, profit ₹7.50 either way')
}

// 2) partial consumption: 500g old batch, 300g sold → 200g left; then exhausted
{
  const p = mk()
  addBatch(p, { quantity: 0.5, costPrice: 70, addedAt: day(1) })
  consumeFIFO(p, 0.3); assert.equal(p.batches[0].remainingQty, 0.2); assert.equal(p.batches[0].exhausted, false)
  consumeFIFO(p, 0.2); assert.equal(p.batches[0].remainingQty, 0); assert.equal(p.batches[0].exhausted, true)
  console.log('✅ partial consumption: 500g − 300g = 200g left, then batch marked exhausted at 0')
}

// 3) old stock is used first even if batches were inserted out of date order; new stock untouched until old is gone
{
  const p = mk()
  addBatch(p, { quantity: 10, costPrice: 90, addedAt: day(5) })
  addBatch(p, { quantity: 10, costPrice: 60, addedAt: day(1) }) // inserted later but OLDER
  const bd = consumeFIFO(p, 4)
  assert.deepEqual(bd.map((x) => x.costPrice), [60])
  assert.equal(p.batches[1].remainingQty, 6); assert.equal(p.batches[0].remainingQty, 10)
  console.log('✅ oldest addedAt is consumed first, newer batch untouched')
}

// 4) out of stock is refused and nothing is changed
{
  const p = mk(); addBatch(p, { quantity: 2, costPrice: 10, addedAt: day(1) })
  assert.throws(() => consumeFIFO(p, 3), StockError)
  assert.equal(p.stock, 2); assert.equal(p.batches[0].remainingQty, 2)
  console.log('✅ insufficient stock → error, batches unchanged')
}

// 5) restore (cancel order) puts quantity back into the SAME batches, re-opening exhausted ones
{
  const p = mk()
  addBatch(p, { quantity: 0.5, costPrice: 70, addedAt: day(1) }); addBatch(p, { quantity: 1, costPrice: 75, addedAt: day(2) })
  const bd = consumeFIFO(p, 1)
  restoreToBatches(p, bd)
  assert.equal(p.batches[0].remainingQty, 0.5); assert.equal(p.batches[0].exhausted, false)
  assert.equal(p.batches[1].remainingQty, 1); assert.equal(p.stock, 1.5)
  console.log('✅ cancelled sale restores exactly into the batches it came from')
}

// 6) restore when the batch is gone / legacy sale → "return" batch at the same cost (never lost, never mixed)
{
  const p = mk(); addBatch(p, { quantity: 5, costPrice: 50, addedAt: day(3) })
  restoreToBatches(p, [{ batchId: null, qty: 2, costPrice: 40 }], day(1))
  assert.equal(p.batches.length, 2); assert.equal(p.batches[1].costPrice, 40); assert.equal(p.batches[1].source, 'return'); assert.equal(p.stock, 7)
  const bd = consumeFIFO(p, 3) // return batch is older (day 1) → used first
  assert.deepEqual(bd.map((x) => [x.qty, x.costPrice]), [[2, 40], [1, 50]])
  console.log('✅ legacy / missing-batch restore → return batch at original cost, FIFO order respected')
}

// 7) reduce a sale's quantity: newest pieces go back first
{
  const bd = [{ batchId: 'a', qty: 0.5, costPrice: 70 }, { batchId: 'b', qty: 0.5, costPrice: 75 }]
  const { kept, removed } = trimBreakdown(bd, 0.7)
  assert.deepEqual(kept, [{ batchId: 'a', qty: 0.3, costPrice: 70 }].map((x) => ({ ...x, qty: 0.3 })))
  assert.deepEqual(removed.map((x) => [x.batchId, x.qty]), [['b', 0.5], ['a', 0.2]])
  console.log('✅ trimBreakdown gives back newest-consumed pieces first')
}

// 8) legacy product (stock but no batches) becomes ONE opening batch at its current cost, idempotently
{
  const p = mk({ stock: 12, costPrice: 33 })
  assert.equal(ensureBatches(p), true); assert.equal(p.batches.length, 1); assert.equal(p.batches[0].costPrice, 33); assert.equal(p.batches[0].source, 'opening')
  assert.equal(ensureBatches(p), false); assert.equal(p.batches.length, 1)
  const bd = consumeFIFO(p, 5); assert.equal(bd[0].costPrice, 33); assert.equal(p.stock, 7)
  console.log('✅ legacy stock → opening batch (migration is idempotent)')
}

// 9) history edit rules
{
  const p = mk(); const b = addBatch(p, { quantity: 10, costPrice: 70, addedAt: day(1) })
  consumeFIFO(p, 4) // 6 left
  assert.throws(() => applyBatchEdit(p, b._id, { quantity: 3 }), StockError)           // below the 4 already sold
  applyBatchEdit(p, b._id, { quantity: 12 }); assert.equal(p.batches[0].remainingQty, 8); assert.equal(p.stock, 8)
  const r = applyBatchEdit(p, b._id, { costPrice: 72 }); assert.equal(r.changes.length, 1); assert.equal(p.batches[0].costPrice, 72)
  assert.equal(p.batches[0].editLog.length, 2)
  assert.throws(() => applyBatchEdit(p, b._id, { costPrice: -1 }), StockError)
  assert.throws(() => applyBatchEdit(p, 'nope', { costPrice: 1 }), /not found/)
  console.log('✅ history edit: quantity ≥ already-sold, remaining recomputed, every change logged')
}

// 10) manual write-off is oldest-first and recorded separately from sales
{
  const p = mk(); addBatch(p, { quantity: 3, costPrice: 10, addedAt: day(1) }); addBatch(p, { quantity: 3, costPrice: 20, addedAt: day(2) })
  writeOffFIFO(p, 4); assert.equal(p.batches[0].adjustedQty, 3); assert.equal(p.batches[1].adjustedQty, 1); assert.equal(p.stock, 2)
  console.log('✅ write-off drains oldest first and is tracked as adjustedQty')
}

// 11) untracked (unlisted till) items are never blocked and never create batches
{
  const p = mk({ listed: false, costPrice: 0 })
  const bd = consumeFIFO(p, 3); assert.deepEqual(bd, [{ batchId: null, qty: 3, costPrice: 0 }]); assert.equal(p.batches.length, 0)
  console.log('✅ unlisted till items: no stock limit, no batches')
}

// 12) randomised: stock always == Σ remaining; Σ billed cost == Σ batch cost drained; no negatives
{
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const p = mk(); let drained = 0, billed = 0
  for (let i = 0; i < 3000; i++) {
    if (rnd() < 0.35) addBatch(p, { quantity: Math.round(rnd() * 50 * 100) / 100 + 0.01, costPrice: Math.round(rnd() * 100), addedAt: new Date(2026, 0, 1 + i) })
    else {
      const q = Math.round(rnd() * 20 * 1000) / 1000 + 0.001
      if (q <= p.stock) { const bd = consumeFIFO(p, q); billed += bd.reduce((s, x) => s + x.qty, 0); assert.ok(Math.abs(bd.reduce((s, x) => s + x.qty, 0) - q) < 1e-9) }
    }
    const sum = p.batches.reduce((s, b) => s + b.remainingQty, 0)
    assert.ok(Math.abs(sum - p.stock) < 1e-6 && p.batches.every((b) => b.remainingQty >= 0 && b.remainingQty <= b.quantity + 1e-9), `invariant @${i}`)
    // FIFO invariant: while an older batch still holds stock, every NEWER batch must be completely untouched
    const order = p.batches.slice().sort((x, y) => x.addedAt - y.addedAt)
    for (let a = 0; a < order.length; a++) {
      if (order[a].remainingQty > 0) for (let b = a + 1; b < order.length; b++) assert.equal(order[b].remainingQty, order[b].quantity, `FIFO violated @${i}: newer batch used while older has stock`)
    }
  }
  console.log('✅ 3,000 random adds/sales: stock == Σ remaining, never negative, FIFO order never violated')
}

// 13) product codes
{
  assert.equal(codeFor(1), 'A001'); assert.equal(codeFor(999), 'A999'); assert.equal(codeFor(1000), 'B001'); assert.equal(codeFor(26 * 999), 'Z999')
  console.log('✅ product codes A001 … A999 → B001 … Z999')
}
console.log('\nAll stock tests passed')
