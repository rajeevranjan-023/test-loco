import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'
import express from 'express'
import mongoose from 'mongoose'
const { default: Udhar } = await import('../models/Udhar.js')
const { default: UdharHistory } = await import('../models/UdharHistory.js')
const { default: Customer } = await import('../models/Customer.js')
const { addEntry, entryDetail, customerHistory } = await import('../controllers/udharController.js')
const { udharPhotos } = await import('../middleware/upload.js')
const { errorHandler, requestId } = await import('../middleware/errorHandler.js')
const { __setPhotoStoreForTests } = await import('../utils/udharPhotos.js')
const ok = (c, m) => { assert.ok(c, m); console.log('✅', m) }
const oid = () => new mongoose.Types.ObjectId()

// ───────── in-memory collections ─────────
const db = { customers: [], udhar: [], history: [] }
const matches = (doc, q) => Object.entries(q).every(([k, v]) => String(doc[k]) === String(v))
const chain = (get) => { const p = Promise.resolve().then(get); const c = { sort: () => c, lean: () => p, then: (a, b) => p.then(a, b), catch: (b) => p.catch(b) }; return c }
Customer.findOne = (q) => chain(() => db.customers.find((c) => matches(c, q)) || null)
Customer.findOneAndUpdate = (q, upd) => chain(() => { let c = db.customers.find((x) => x.shopId === q.shopId && x.name === q.name); if (!c) { c = { _id: oid(), ...upd.$setOnInsert }; db.customers.push(c) } if (upd.$set) Object.assign(c, upd.$set); return c })
Customer.updateOne = async () => ({})
Udhar.findOne = (q) => { const raw = db.udhar.find((u) => matches(u, q)); const c = chain(() => (raw ? new Udhar(raw) : null)); c.lean = () => Promise.resolve(raw ? { ...raw } : null); return c }
let failSaveOnce = false
Udhar.prototype.save = async function () { if (failSaveOnce) { failSaveOnce = false; throw new Error('db write failed') } const o = this.toObject(); const i = db.udhar.findIndex((u) => String(u._id) === String(o._id)); i < 0 ? db.udhar.push(o) : (db.udhar[i] = o); return this }
UdharHistory.insertMany = async (docs) => docs.map((d) => { const m = new UdharHistory(d); const e = m.validateSync(); if (e) throw e; const o = m.toObject(); db.history.push(o); return o })
UdharHistory.find = (q) => chain(() => db.history.filter((h) => matches(h, q)))
UdharHistory.findOne = (q) => { const raw = db.history.find((h) => matches(h, q)); const c = chain(() => raw || null); c.lean = () => Promise.resolve(raw || null); return c }

// ───────── Cloudinary stand-in ─────────
const store = { configured: true, uploads: [], destroyed: [], failOn: null, delayMs: 0 }
__setPhotoStoreForTests({
  configured: () => store.configured,
  upload: async (file, shopId) => {
    if (store.delayMs) await new Promise((r) => setTimeout(r, store.delayMs))
    const n = store.uploads.length + 1
    if (store.failOn === n) { store.uploads.push({ failed: true }); throw new Error('cloudinary down') }
    const id = `servop/udhar/${shopId}/p${n}`; store.uploads.push({ id, bytes: file.size })
    return { secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${id}.jpg`, public_id: id, width: 800, height: 600, bytes: file.size, format: 'jpg' }
  },
  destroy: async (id) => { store.destroyed.push(id) },
})
const reset = () => { db.customers.length = db.udhar.length = db.history.length = 0; Object.assign(store, { configured: true, uploads: [], destroyed: [], failOn: null, delayMs: 0 }); failSaveOnce = false }

// ───────── the app: exactly the route wiring from sellerRoutes.js ─────────
const app = express(); app.use(requestId); app.use(express.json())
const SHOP = oid(); app.use((req, res, next) => { req.sellerAccount = { _id: req.headers['x-shop'] ? new mongoose.Types.ObjectId(String(req.headers['x-shop'])) : SHOP }; next() })
app.post('/udhar/entries', udharPhotos, addEntry); app.get('/udhar/entries/:entryId', entryDetail); app.get('/udhar/customers/:id/history', customerHistory)
app.use(errorHandler)
const server = app.listen(0); const base = `http://localhost:${server.address().port}`

const JPEG = (n = 2000) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0]); return b }
const PNG = (n = 2000) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b }
const WEBP = (n = 2000) => { const b = new Uint8Array(n); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return b }
const JUNK = (n = 2000) => new Uint8Array(n).fill(0x41)
const blob = (bytes, type) => new Blob([bytes], { type })
const post = async (fields, files = [], headers = {}) => {
  const fd = new FormData(); Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)))
  files.forEach(([bytes, type, name]) => fd.append('photos', blob(bytes, type), name))
  const r = await fetch(base + '/udhar/entries', { method: 'POST', body: fd, headers }); return { status: r.status, data: await r.json().catch(() => null) }
}
const postJson = async (body, headers = {}) => { const r = await fetch(base + '/udhar/entries', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) } }
const get = async (path) => { const r = await fetch(base + path); return { status: r.status, data: await r.json().catch(() => null) } }
const newCustomer = (name = 'Asha') => { const c = { _id: oid(), shopId: SHOP, name, phone: '9876543210' }; db.customers.push(c); return c }
const balance = (c) => db.udhar.find((u) => String(u.customerId) === String(c._id))?.totalAmount ?? 0
const base1 = (c, over = {}) => ({ customerId: String(c._id), type: 'udhar', amount: 50, note: 'rice', ...over })

// 1 ─ without photos (the original JSON path)
{ reset(); const c = newCustomer()
  const r = await postJson(base1(c)); assert.equal(r.status, 201, JSON.stringify(r.data))
  ok(balance(c) === 50 && db.history.length === 1 && db.history[0].photos.length === 0 && store.uploads.length === 0, 'JSON entry without photos still saves exactly as before (balance ₹50, no upload, photos = [])')
  const r2 = await postJson(base1(c, { amount: 30 })); ok(balance(c) === 80 && r2.data.row.total === 80, 'existing Udhar calculation unchanged (50 + 30 = ₹80)')
  const m = await post(base1(c, { amount: 10 })); ok(m.status === 201 && balance(c) === 90 && db.history[2].photos.length === 0, 'multipart request with zero photos also works')
}
// 2 ─ one photo
{ reset(); const c = newCustomer()
  const r = await post(base1(c, { clientRequestId: 'req-one-0001' }), [[JPEG(), 'image/jpeg', 'bill.jpg']]); assert.equal(r.status, 201, JSON.stringify(r.data))
  const e = db.history[0]
  ok(store.uploads.length === 1 && e.photos.length === 1 && e.photos[0].url.startsWith('https://res.cloudinary.com/') && /^servop\/udhar\//.test(e.photos[0].publicId), 'one photo → uploaded to Cloudinary (servop/udhar/…); entry stores URL + publicId')
  ok(String(e.customerId) === String(c._id) && String(e.shopId) === String(SHOP) && e.type === 'udhar' && balance(c) === 50, 'photo belongs to the right entry, customer and shop; balance ₹50')
  ok(JSON.stringify(e).length < 2000 && !JSON.stringify(e).includes('\u00ff\u00d8'), 'no image bytes stored in the database document (only URL + metadata)')
  const d = await get(`/udhar/entries/${e._id}`); ok(d.status === 200 && d.data.photos.length === 1 && d.data.photos[0].thumb.includes('/upload/c_fill,'), 'entry detail returns the photo (full URL + thumbnail)')
  const h = await get(`/udhar/customers/${c._id}/history`); ok(h.data.entries[0].photos.length === 1, 'customer Udhar history lists the photo (still there on every later load / refresh)')
}
// 3 ─ two photos (mixed formats)
{ reset(); const c = newCustomer()
  const r = await post(base1(c), [[PNG(), 'image/png', 'a.png'], [WEBP(), 'image/webp', 'b.webp']]); assert.equal(r.status, 201, JSON.stringify(r.data))
  ok(db.history[0].photos.length === 2 && store.uploads.length === 2, 'two photos (PNG + WebP) → both saved on the one entry')
}
// 4 ─ third photo refused by the server
{ reset(); const c = newCustomer()
  const r = await post(base1(c), [[JPEG(), 'image/jpeg', '1.jpg'], [PNG(), 'image/png', '2.png'], [WEBP(), 'image/webp', '3.webp']])
  ok(r.status === 400 && /at most 2/.test(r.data.message) , `3 photos → 400 "${r.data.message}"`)
  ok(store.uploads.length === 0 && db.history.length === 0 && balance(c) === 0, 'nothing uploaded, no entry, balance untouched')
}
// 5 ─ file type validation (server side)
{ reset(); const c = newCustomer()
  let r = await post(base1(c), [[JUNK(), 'application/pdf', 'x.pdf']]); ok(r.status === 400 && /JPG, PNG or WebP/.test(r.data.message), 'PDF refused (400)')
  r = await post(base1(c), [[JPEG(), 'image/gif', 'x.gif']]); ok(r.status === 400, 'GIF refused (400)')
  r = await post(base1(c), [[JPEG(), 'image/heic', 'x.heic']]); ok(r.status === 400, 'HEIC refused (400)')
  r = await post(base1(c), [[JUNK(), 'image/jpeg', 'fake.jpg']]); ok(r.status === 400 && /real JPG, PNG or WebP/.test(r.data.message), 'a text file renamed to .jpg (wrong magic bytes) refused (400)')
  r = await post(base1(c), [[PNG(), 'image/jpeg', 'lie.jpg']]); ok(r.status === 400, 'PNG bytes labelled as JPEG refused (400)')
  r = await post(base1(c), [[new Uint8Array(0), 'image/jpeg', 'empty.jpg']]); ok(r.status === 400, 'empty file refused (400)')
  ok(store.uploads.length === 0 && db.history.length === 0, 'none of the rejected requests uploaded anything or created an entry')
}
// 6 ─ size limit
{ reset(); const c = newCustomer()
  let r = await post(base1(c), [[JPEG(5 * 1024 * 1024 + 1), 'image/jpeg', 'big.jpg']]); ok(r.status === 413 && /under 5 MB/.test(r.data.message), `6 MB-ish photo refused (413 "${r.data.message}")`)
  r = await post(base1(c), [[JPEG(5 * 1024 * 1024), 'image/jpeg', 'edge.jpg']]); ok(r.status === 201, 'exactly 5 MB is accepted')
}
// 7 ─ only Udhar entries take photos; bad amount refused before upload
{ reset(); const c = newCustomer()
  let r = await post(base1(c, { type: 'payment' }), [[JPEG(), 'image/jpeg', 'a.jpg']]); ok(r.status === 400 && /only be attached to an Udhar/.test(r.data.message) && store.uploads.length === 0, 'photos on a Payment entry refused')
  r = await post(base1(c, { amount: 0 }), [[JPEG(), 'image/jpeg', 'a.jpg']]); ok(r.status === 400 && store.uploads.length === 0, 'invalid amount refused BEFORE any upload')
  r = await post({ type: 'udhar', amount: 5 }, [[JPEG(), 'image/jpeg', 'a.jpg']]); ok(r.status === 400 && store.uploads.length === 0, 'no customer → refused before any upload')
}
// 8 ─ storage not configured
{ reset(); const c = newCustomer(); store.configured = false
  let r = await post(base1(c), [[JPEG(), 'image/jpeg', 'a.jpg']]); ok(r.status === 503 && db.history.length === 0, 'photos while Cloudinary is not configured → 503, nothing saved (never silently drops the photo)')
  r = await postJson(base1(c)); ok(r.status === 201, 'the same entry WITHOUT photos still saves')
}
// 9 ─ failed upload: all-or-nothing, cleanup, no duplicate on retry
{ reset(); const c = newCustomer(); store.failOn = 2
  const body = base1(c, { clientRequestId: 'retry-key-0001' })
  let r = await post(body, [[JPEG(), 'image/jpeg', '1.jpg'], [PNG(), 'image/png', '2.png']])
  ok(r.status === 502 && /nothing was saved/.test(r.data.message), `second photo fails → 502 "${r.data.message}"`)
  ok(db.history.length === 0 && balance(c) === 0, 'no entry created and balance unchanged (not saved with a missing photo)')
  ok(store.destroyed.length === 1 && store.destroyed[0] === 'servop/udhar/' + SHOP + '/p1', 'the photo that DID upload is deleted from Cloudinary (no orphan)')
  store.failOn = null
  r = await post(body, [[JPEG(), 'image/jpeg', '1.jpg'], [PNG(), 'image/png', '2.png']]); ok(r.status === 201 && db.history.length === 1 && balance(c) === 50, 'retry with the same request id → exactly one entry (₹50)')
}
// 10 ─ idempotent replay of a SUCCESSFUL save (lost response, user taps again)
{ reset(); const c = newCustomer(); const body = base1(c, { clientRequestId: 'replay-key-0001' })
  const a = await post(body, [[JPEG(), 'image/jpeg', 'a.jpg']]); const up = store.uploads.length
  const b = await post(body, [[JPEG(), 'image/jpeg', 'a.jpg']])
  ok(a.status === 201 && b.status === 200 && b.data.replayed === true, 'same request id again → 200 "replayed", no second save')
  ok(db.history.length === 1 && balance(c) === 50 && store.uploads.length === up, 'still ONE entry, balance ₹50 (not ₹100), no extra upload')
  const j = await postJson(base1(c, { clientRequestId: 'replay-key-0002' })); const j2 = await postJson(base1(c, { clientRequestId: 'replay-key-0002' }))
  ok(j.status === 201 && j2.status === 200 && db.history.length === 2 && balance(c) === 100, 'the same protection applies to entries without photos')
  const other = await post(body, [[JPEG(), 'image/jpeg', 'a.jpg']], { 'x-shop': String(oid()) }); ok(other.status === 400, 'another shop can never replay/read this entry (customer not found there)')
}
// 11 ─ two parallel taps with the same id
{ reset(); const c = newCustomer(); store.delayMs = 60; const body = base1(c, { clientRequestId: 'parallel-0001' })
  const [x, y] = await Promise.all([post(body, [[JPEG(), 'image/jpeg', 'a.jpg']]), post(body, [[JPEG(), 'image/jpeg', 'a.jpg']])])
  ok([x.status, y.status].sort().join() === '201,409' && db.history.length === 1 && balance(c) === 50, `double submit in parallel → one 201 and one 409 ("${[x, y].find((q) => q.status === 409).data.message}"); one entry only`)
}
// 12 ─ save failure after upload cleans the uploaded photos
{ reset(); const c = newCustomer(); failSaveOnce = true
  const r = await post(base1(c), [[JPEG(), 'image/jpeg', '1.jpg'], [PNG(), 'image/png', '2.png']])
  ok(r.status >= 500 && db.history.length === 0 && store.destroyed.length === 2, 'ledger write fails after upload → both new files are deleted from Cloudinary, no entry')
}
// 13 ─ new customer + photo; failed upload must not leave a stray customer
{ reset(); store.failOn = 1
  let r = await post({ type: 'udhar', amount: 20, name: 'Ravi', phone: '9123456780', clientRequestId: 'newcust-0001' }, [[JPEG(), 'image/jpeg', '1.jpg']])
  ok(r.status === 502 && db.customers.length === 0, 'new customer + failed upload → nothing created (no stray customer)')
  store.failOn = null
  r = await post({ type: 'udhar', amount: 20, name: 'Ravi', phone: '9123456780', clientRequestId: 'newcust-0001' }, [[JPEG(), 'image/jpeg', '1.jpg']])
  ok(r.status === 201 && db.customers.length === 1 && db.history[0].photos.length === 1, 'new customer + photo saves on retry')
}
// 14 ─ existing records without photos; schema limit
{ reset(); const c = newCustomer(); const legacy = { _id: oid(), shopId: SHOP, customerId: c._id, type: 'udhar', amount: 40, delta: 40, source: 'manual', paymentType: 'cash', note: 'old', balanceAfter: 40, date: new Date(), items: [] }
  db.history.push(legacy); db.udhar.push({ _id: oid(), shopId: SHOP, customerId: c._id, customerName: 'Asha', totalAmount: 40 })
  const d = await get(`/udhar/entries/${legacy._id}`); const h = await get(`/udhar/customers/${c._id}/history`)
  ok(d.status === 200 && Array.isArray(d.data.photos) && d.data.photos.length === 0 && d.data.amount === 40, 'old entry (no photos field in the database) → detail works, photos = []')
  ok(h.status === 200 && h.data.entries.length === 1 && h.data.entries[0].photos.length === 0, 'old entry in customer history works, photos = []')
  const three = new UdharHistory({ shopId: oid(), customerId: oid(), type: 'udhar', amount: 1, photos: [1, 2, 3].map((n) => ({ url: `https://x/${n}`, publicId: `p${n}` })) }).validateSync()
  ok(three && /at most 2 photos/.test(three.message), 'database schema itself also refuses a 3rd photo')
}
server.close(); console.log('\nAll Udhar photo backend checks passed'); process.exit(0)
