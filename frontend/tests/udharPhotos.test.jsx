// @vitest-environment jsdom
// Add Udhar form — optional proof photos (max 2). The REAL EntryModal / EntryDetail / PhotoPicker / api.js run against a fake axios transport.
// Runs under real vitest (`npm test`) and under the sandbox runner:  node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/udharPhotos.test.jsx
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './_support/adapterSwitch.js' // must come before anything that imports services/api.js
import { setOverride } from './_support/adapterSwitch.js'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'

const { EntryModal, EntryDetail } = await import('../src/features/analytics/udhar/parts.jsx')
const { BusinessProvider } = await import('../src/context/BusinessContext.jsx')
const { addPhotos, photoProblem, PHOTO_MAX, PHOTO_MAX_BYTES } = await import('../src/features/analytics/udhar/photos.js')

URL.createObjectURL = () => `blob:preview-${Math.random().toString(36).slice(2)}`; URL.revokeObjectURL = () => {}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const settle = (ms = 30) => act(async () => { await tick(ms) })
const mkFile = (name, type, size = 1000) => new globalThis.File([new Uint8Array(size)], name, { type })
const jpg = (n = 'a.jpg', size) => mkFile(n, 'image/jpeg', size), png = (n = 'b.png') => mkFile(n, 'image/png'), webp = (n = 'c.webp') => mkFile(n, 'image/webp')

let posts, failNext, saved
const transport = (config) => {
  const url = String(config.url).replace(/^https?:\/\/[^/]+/, ''), method = config.method.toUpperCase()
  const ok = (data) => Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config })
  if (method === 'POST' && url === '/api/seller/udhar/entries') {
    posts.push({ data: config.data, headers: config.headers })
    if (failNext) { failNext = false; return Promise.reject(Object.assign(new Error('boom'), { config, response: { status: 502, data: { message: 'Photo upload failed, so nothing was saved. Please try again.' }, headers: {}, config } })) }
    return ok({ row: { id: 'c1' }, entries: [{ id: 'E1' }] })
  }
  if (method === 'GET' && url === '/api/seller/udhar/entries/E1') return ok({ id: 'E1', type: 'udhar', kind: 'udhar', delta: 50, amount: 50, source: 'manual', addedBy: 'Manual (Udhar dashboard)', date: new Date().toISOString(), billId: null, billRef: null, billTotal: null, paymentType: 'cash', note: '', balanceAfter: 50, items: [], photos: saved })
  if (method !== 'GET') return ok({ ok: true })
  return ok([])
}
beforeEach(() => { posts = []; failNext = false; saved = []; setOverride(transport) })
afterEach(() => { cleanup(); setOverride(null) })

const CUST = { id: 'c1', name: 'Asha', phone: '9876543210', total: 0 }
async function openForm(type = 'udhar') {
  const onSaved = []
  render(<MemoryRouter><BusinessProvider><EntryModal init={{ customer: CUST, type }} onClose={() => {}} onSaved={(r) => onSaved.push(r)} /></BusinessProvider></MemoryRouter>)
  await settle(40)
  return onSaved
}
const fileInput = () => document.querySelector('[data-photo-input]')
const choose = async (...files) => { fireEvent.change(fileInput(), { target: { files } }); await settle() }
const amount = async (v) => { fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: v } }); await settle() }
const submitBtn = () => document.querySelector('button[type="submit"]')
const submit = async () => { fireEvent.click(submitBtn()); await settle(60) }
const fd = (p) => p.data
const previews = () => document.querySelectorAll('[data-photo-picker] img')

describe('photo rules (shared by the form)', () => {
  it('accepts JPG / PNG / WebP up to 5 MB; rejects other types, empty and oversized files', () => {
    expect(photoProblem(jpg())).toBe(''); expect(photoProblem(png())).toBe(''); expect(photoProblem(webp())).toBe('')
    expect(photoProblem(mkFile('x.pdf', 'application/pdf'))).toContain('not supported')
    expect(photoProblem(mkFile('x.gif', 'image/gif'))).toContain('not supported')
    expect(photoProblem(mkFile('x.heic', 'image/heic'))).toContain('not supported')
    expect(photoProblem(jpg('e.jpg', 0))).toContain('empty')
    expect(photoProblem(jpg('big.jpg', PHOTO_MAX_BYTES + 1))).toContain('5 MB')
    expect(photoProblem(jpg('edge.jpg', PHOTO_MAX_BYTES))).toBe('')
  })
  it('addPhotos never goes past 2 and explains why', () => {
    const r = addPhotos([], [jpg('1.jpg'), png('2.png'), webp('3.webp')], () => 'blob:x')
    expect(r.photos.length).toBe(PHOTO_MAX); expect(r.message).toContain('at most 2')
  })
})

describe('Add Udhar form — photos', () => {
  it('saves WITHOUT photos exactly as before (plain JSON, no files)', async () => {
    const saved = await openForm(); await amount('50'); await submit()
    expect(posts.length).toBe(1); expect(typeof fd(posts[0]) === 'string' || !(fd(posts[0]) instanceof globalThis.FormData)).toBe(true)
    const body = JSON.parse(fd(posts[0])); expect(body.amount).toBe(50); expect(body.type).toBe('udhar'); expect(body.customerId).toBe('c1'); expect(body.photos).toBeUndefined()
    expect(saved.length).toBe(1)
  })
  it('one photo: preview shown, sent as multipart with 1 file', async () => {
    const saved = await openForm(); await amount('50'); await choose(jpg('bill.jpg'))
    expect(previews().length).toBe(1); expect(screen.getByText('1/2')).toBeTruthy()
    await submit()
    expect(posts.length).toBe(1); const f = fd(posts[0]); expect(f instanceof globalThis.FormData).toBe(true)
    expect(f.getAll('photos').length).toBe(1); expect(f.get('photos').name).toBe('bill.jpg'); expect(f.get('amount')).toBe('50'); expect(f.get('customerId')).toBe('c1'); expect(f.get('clientRequestId')).toBeTruthy()
    expect(saved.length).toBe(1)
  })
  it('two photos: both previewed and sent; the Add photo button disappears', async () => {
    const saved = await openForm(); await amount('50'); await choose(jpg('1.jpg'), png('2.png'))
    expect(previews().length).toBe(2); expect(screen.queryByRole('button', { name: 'Add photo' })).toBeNull()
    await submit(); expect(fd(posts[0]).getAll('photos').length).toBe(2); expect(saved.length).toBe(1)
  })
  it('a third photo cannot be attached — clear message, still 2', async () => {
    await openForm(); await choose(jpg('1.jpg'), png('2.png'), webp('3.webp'))
    expect(previews().length).toBe(2); expect(screen.getByRole('alert').textContent).toContain('at most 2')
    await choose(jpg('4.jpg')); expect(previews().length).toBe(2)
  })
  it('unsupported types and oversized files are refused with a message and nothing is added', async () => {
    await openForm()
    await choose(mkFile('doc.pdf', 'application/pdf')); expect(previews().length).toBe(0); expect(screen.getByRole('alert').textContent).toContain('not supported')
    await choose(jpg('huge.jpg', PHOTO_MAX_BYTES + 10)); expect(previews().length).toBe(0); expect(screen.getByRole('alert').textContent).toContain('5 MB')
  })
  it('each photo has a remove button; removing leaves the other and the entry still saves', async () => {
    const saved = await openForm(); await amount('50'); await choose(jpg('1.jpg'), png('2.png'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' })); await settle()
    expect(previews().length).toBe(1); expect(screen.getByRole('button', { name: 'Add photo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' })); await settle(); expect(previews().length).toBe(0)
    await submit(); expect(posts.length).toBe(1); expect(typeof fd(posts[0])).toBe('string') // no photos left → plain JSON again
    expect(saved.length).toBe(1)
  })
  it('a failed upload keeps the form open with the photos; retry reuses the SAME request id (no duplicate entry)', async () => {
    const saved = await openForm(); await amount('50'); await choose(jpg('1.jpg'))
    failNext = true; await submit()
    expect(saved.length).toBe(0); expect(document.body.textContent).toMatch(/nothing was saved|Your photos are still selected/i)
    expect(previews().length).toBe(1) // photo still selected
    await submit()
    expect(posts.length).toBe(2); expect(fd(posts[0]).get('clientRequestId')).toBe(fd(posts[1]).get('clientRequestId'))
    expect(saved.length).toBe(1)
  })
  it('double-tapping Add Udhar sends only one request', async () => {
    await openForm(); await amount('50'); await choose(jpg('1.jpg'))
    const btn = submitBtn(); fireEvent.click(btn); fireEvent.click(btn); await settle(60)
    expect(posts.length).toBe(1)
  })
  it('the photo section is only offered for Add Udhar, not for Receive Payment', async () => {
    await openForm('payment'); expect(document.querySelector('[data-photo-picker]')).toBeNull()
  })
})

describe('viewing saved photos', () => {
  const open = async () => { render(<MemoryRouter><BusinessProvider><EntryDetail id="E1" onClose={() => {}} /></BusinessProvider></MemoryRouter>); await settle(60) }
  it('an entry with photos shows them (thumbnails) and opens one full size', async () => {
    saved = [{ url: 'https://res.cloudinary.com/x/image/upload/v1/servop/udhar/s/a.jpg', thumb: 'https://res.cloudinary.com/x/image/upload/c_fill,w_240,h_240/v1/servop/udhar/s/a.jpg' }, { url: 'https://res.cloudinary.com/x/image/upload/v1/servop/udhar/s/b.jpg', thumb: 'https://res.cloudinary.com/x/image/upload/c_fill,w_240,h_240/v1/servop/udhar/s/b.jpg' }]
    await open()
    expect(document.querySelectorAll('[data-photo-gallery] img').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 2' })); await settle()
    const big = within(screen.getByRole('dialog', { name: 'Photo' })).getByRole('img'); expect(big.getAttribute('src')).toBe(saved[1].url)
  })
  it('an older entry without photos renders normally (no gallery)', async () => {
    saved = undefined; await open()
    expect(screen.getByText('Udhar Given')).toBeTruthy(); expect(document.querySelector('[data-photo-gallery]')).toBeNull()
  })
})
