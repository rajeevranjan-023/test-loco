// Unit tests for the bill-id maths. No database needed:
//  - slotFor()        : pure mapping
//  - the Mongo update pipeline is replayed with `mingo` (a JS aggregation engine) and must agree with slotFor()
//    and with the reference algorithm written in the brief (count 101 → 9999 → next letter, count 1).
import assert from 'node:assert/strict'
import { slotFor, formatBillId, formatFullId, dateParts, displayBillId, nextAlphabet, __pipelineForTest } from '../utils/billId.js'

// --- reference algorithm straight from the brief ---------------------------------------------
function* reference() {
  let series = 'A', count = 101
  while (true) {
    yield { series, count }
    count += 1
    if (count > 9999) { series = nextAlphabet(series); count = 1 }
  }
}

// 1) pure mapping vs reference, for 26 series worth of bills
{
  const ref = reference()
  for (let n = 1; n <= 9899 + 9999 * 25; n++) {
    const want = ref.next().value, got = slotFor(n)
    assert.deepEqual(got, want, `slotFor(${n})`)
  }
  assert.throws(() => slotFor(9899 + 9999 * 25 + 1), /limit/)
  console.log('✅ slotFor matches the reference algorithm for all', 9899 + 9999 * 25, 'bills (A0101 … Z9999)')
}

// 2) spec examples + boundaries
{
  assert.deepEqual(slotFor(1), { series: 'A', count: 101 })
  assert.deepEqual(slotFor(2), { series: 'A', count: 102 })
  assert.deepEqual(slotFor(9899), { series: 'A', count: 9999 })
  assert.deepEqual(slotFor(9900), { series: 'B', count: 1 })
  const d = dateParts(new Date('2026-10-03T08:00:00Z'))
  assert.equal(formatBillId({ ...d, ...slotFor(1) }), '261003A0101')
  assert.equal(formatBillId({ ...d, ...slotFor(9899) }), '261003A9999')
  assert.equal(formatBillId({ ...d, ...slotFor(9900) }), '261003B0001')
  assert.equal(formatFullId({ shopRef: 'RAB50', ...d, ...slotFor(1) }), 'RAB50-20261003-A-0101')
  console.log('✅ spec examples: #261003A0101 · #261003A9999 · #261003B0001 · fullId RAB50-20261003-A-0101')
}

// 3) business-timezone date (a UTC server must not date a 00:30 IST bill as "yesterday")
{
  assert.equal(dateParts(new Date('2026-10-03T19:00:00Z')).date, '2026-10-04') // 00:30 IST on the 4th
  assert.equal(dateParts(new Date('2026-10-03T18:00:00Z')).date, '2026-10-03') // 23:30 IST on the 3rd
  console.log('✅ date uses the shop timezone (IST) not the server clock')
}

// 4) display helper
{
  assert.equal(displayBillId('261003A0101'), '#261003A0101')
  assert.equal(displayBillId('65f1c2a9b8d4e3f1a2b3c4d5', '#ORD'), '#ORDC4D5')
  console.log('✅ displayBillId: new ids get "#", legacy ObjectIds keep a short label')
}

// 5) the real MongoDB update pipeline, replayed in JS, must equal slotFor() — across the 101 start, the A→B rollover and B→C
{
  const { Aggregator } = await import('mingo')
  const pipeline = __pipelineForTest()
  let doc = { shopId: 'x', date: '2026-10-03' }
  const t0 = Date.now()
  for (let n = 1; n <= 30000; n++) {
    doc = new Aggregator(pipeline).run([doc])[0]
    const want = slotFor(n)
    if (doc.series !== want.series || doc.count !== want.count || doc.issued !== n || '_idx' in doc) {
      assert.fail(`pipeline mismatch at ${n}: got ${doc.series}${doc.count} want ${want.series}${want.count}`)
    }
  }
  console.log('✅ Mongo update pipeline == slotFor for 30,000 consecutive bills (A0101 → A9999 → B0001 → … → C…)', `${Date.now() - t0}ms`)
}
console.log('\nAll bill-id tests passed')
