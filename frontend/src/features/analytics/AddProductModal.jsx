import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X, ImagePlus } from 'lucide-react'
import { call, Modal, Btn } from './kit.jsx'
import { userMessage } from '../../services/apiError.js'

// kg | liter | unit — shown the same way everywhere
export const UNITS = ['kg', 'liter', 'unit']
const ctl = 'h-10 w-full rounded-xl border bg-white px-3 text-[14px] outline-none focus:border-[#1F6FEB]'
const dec = (v) => { const x = v.replace(/[^0-9.]/g, ''); const i = x.indexOf('.'); return i < 0 ? x : x.slice(0, i + 1) + x.slice(i + 1).replace(/\./g, '') } // digits + one dot, so "-5" can't be typed
const blank = { name: '', stock: '', costPrice: '', sellingPrice: '', image: '' }
const normName = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()

// Small photo → ≤360px JPEG data URL (keeps the product list light and the request small)
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, 360 / Math.max(img.width, img.height)), c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')) }
    img.src = url
  })
}

function Err({ id, msg }) { return msg ? <p id={id} role="alert" className="mt-1 text-[12px] text-red-600">{msg}</p> : null }

// Stays open after every add. Closes only via the Close button (or ✕).
export default function AddProductModal({ products, onClose, onSaved }) {
  const [f, setF] = useState(blank)
  const [unit, setUnit] = useState('kg')
  const [touched, setTouched] = useState({})
  const [serverErr, setServerErr] = useState({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [recent, setRecent] = useState([])
  const nameRef = useRef(null), fileRef = useRef(null), timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Same name already in this shop? → we will add a batch, so lock the unit to the existing one.
  const match = useMemo(() => { const n = normName(f.name); return n ? products.find((p) => normName(p.name) === n) : null }, [f.name, products])
  const effUnit = match ? match.priceUnit || 'unit' : unit

  const errors = useMemo(() => {
    const e = {}, stock = f.stock === '' ? NaN : +f.stock, cost = f.costPrice === '' ? NaN : +f.costPrice, sell = f.sellingPrice === '' ? NaN : +f.sellingPrice
    if (!f.name.trim()) e.name = 'Product name is required.'
    if (f.stock === '') e.stock = 'Enter the total stock.'
    else if (!(stock > 0)) e.stock = 'Stock must be greater than 0.'
    else if (effUnit === 'unit' && !Number.isInteger(stock)) e.stock = 'Units must be a whole number.'
    if (f.costPrice === '') e.costPrice = 'Enter the cost price.'
    else if (!(cost >= 0)) e.costPrice = 'Enter a valid cost price.'
    if (f.sellingPrice === '') e.sellingPrice = 'Enter the selling price.'
    else if (!(sell > 0)) e.sellingPrice = 'Selling price must be greater than 0.'
    return e
  }, [f, effUnit])
  const show = (k) => (touched[k] ? errors[k] : '') || serverErr[k] || ''
  const lossWarn = +f.sellingPrice > 0 && f.costPrice !== '' && +f.sellingPrice < +f.costPrice

  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setServerErr({}) }
  const notify = (text, tone = 'ok') => { clearTimeout(timer.current); setToast({ text, tone }); timer.current = setTimeout(() => setToast(null), 3200) }
  const reset = () => { setF(blank); setUnit('kg'); setTouched({}); setServerErr({}); if (fileRef.current) fileRef.current.value = ''; nameRef.current?.focus() }

  const pickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try { set('image')(await shrink(file)) } catch (err) { notify(userMessage(err, 'We could not read that image. Please try a different one.'), 'err') }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setTouched({ name: 1, stock: 1, costPrice: 1, sellingPrice: 1 })
    if (Object.keys(errors).length) { document.querySelector('[data-invalid="1"]')?.focus(); return }
    setBusy(true); setServerErr({})
    try {
      const r = await call('post', '/api/seller/inventory/add', { name: f.name, stock: +f.stock, unit: effUnit, costPrice: +f.costPrice, sellingPrice: +f.sellingPrice, imageUrl: f.image || undefined })
      onSaved(r)                                   // inventory list updates instantly (no refetch)
      setRecent((l) => [{ code: r.product.productCode, name: r.product.name, qty: +f.stock, unit: effUnit, created: r.created }, ...l].slice(0, 6))
      notify(r.message)
      setF((x) => ({ ...blank }))                  // clear everything except the unit type…
      setTouched({}); if (fileRef.current) fileRef.current.value = ''
      nameRef.current?.focus()                     // …and put the cursor back on Product Name
    } catch (err) {
      const fe = err.response?.data?.errors
      if (fe) setServerErr(fe)
      notify(err.message || 'Could not save the product.', 'err')
    } finally { setBusy(false) }
  }

  const bad = (k) => !!show(k)
  const field = (k, label, props) => (
    <div>
      <label htmlFor={`ap-${k}`} className="mb-1 block text-[12.5px] font-medium text-gray-600">{label}</label>
      <input id={`ap-${k}`} {...props} data-invalid={bad(k) ? '1' : undefined} aria-invalid={bad(k)} aria-describedby={bad(k) ? `ap-${k}-e` : undefined}
        onBlur={() => setTouched((t) => ({ ...t, [k]: 1 }))} className={`${ctl} ${bad(k) ? 'border-red-400' : 'border-gray-200'}`} />
      <Err id={`ap-${k}-e`} msg={show(k)} />
    </div>
  )

  return (
    <Modal title="Add New Product" onClose={onClose} persistent>
      <form onSubmit={submit} noValidate className="space-y-3">
        {toast && <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] ${toast.tone === 'err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{toast.tone === 'err' ? <X size={15} /> : <Check size={15} />}<span>{toast.text}</span></div>}

        <div>
          <label htmlFor="ap-name" className="mb-1 block text-[12.5px] font-medium text-gray-600">Product name</label>
          <input id="ap-name" ref={nameRef} autoFocus autoComplete="off" maxLength={80} placeholder="e.g. Basmati Rice" value={f.name} onChange={(e) => set('name')(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: 1 }))}
            data-invalid={bad('name') ? '1' : undefined} aria-invalid={bad('name')} className={`${ctl} ${bad('name') ? 'border-red-400' : 'border-gray-200'}`} />
          <Err msg={show('name')} />
          {match && <p className="mt-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[12px] text-blue-700">Already in your inventory as <b>{match.productCode || 'this product'}</b> ({+Number(match.stock).toFixed(3)} {match.priceUnit || 'unit'}). Saving adds a <b>new batch</b> with its own cost — nothing is overwritten, and the selling price below becomes the live price.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field('stock', `Total stock (${effUnit})`, { inputMode: 'decimal', placeholder: effUnit === 'unit' ? 'e.g. 50' : 'e.g. 50', value: f.stock, onChange: (e) => set('stock')(dec(e.target.value)) })}
          <div>
            <label htmlFor="ap-unit" className="mb-1 block text-[12.5px] font-medium text-gray-600">Unit type</label>
            <select id="ap-unit" value={effUnit} disabled={!!match} onChange={(e) => setUnit(e.target.value)} className={`${ctl} border-gray-200 disabled:bg-gray-50 disabled:text-gray-500`}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <p className="mt-1 text-[11.5px] text-gray-400">{match ? 'Locked to this product\'s unit' : 'kg | liter | unit'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field('costPrice', `Cost price (₹ per ${effUnit})`, { inputMode: 'decimal', placeholder: '70', value: f.costPrice, onChange: (e) => set('costPrice')(dec(e.target.value)) })}
          {field('sellingPrice', `Selling price (₹ per ${effUnit})`, { inputMode: 'decimal', placeholder: '85', value: f.sellingPrice, onChange: (e) => set('sellingPrice')(dec(e.target.value)) })}
        </div>
        {lossWarn && <p className="text-[12px] text-amber-600">Selling price is below cost — you'd lose ₹{+(f.costPrice - f.sellingPrice).toFixed(2)} per {effUnit}.</p>}

        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} className="hidden" id="ap-img" />
          {f.image
            ? <><img src={f.image} alt="" className="h-10 w-10 rounded-lg object-cover" /><button type="button" onClick={() => { set('image')(''); if (fileRef.current) fileRef.current.value = '' }} className="text-[12.5px] text-gray-500 underline">Remove photo</button></>
            : <label htmlFor="ap-img" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[12.5px] text-gray-600 hover:border-[#1F6FEB] hover:text-[#1F6FEB]"><ImagePlus size={15} />Photo (optional)</label>}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-2"><Btn type="button" variant="ghost" onClick={reset}>Reset Fields</Btn></div>
          <div className="flex gap-2"><Btn type="button" variant="ghost" onClick={onClose}>Close Form</Btn><Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add Product'}</Btn></div>
        </div>

        {recent.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <div className="mb-1.5 text-[12px] font-medium text-gray-500">Added in this session ({recent.length})</div>
            <ul className="space-y-1">{recent.map((r, i) => <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1 text-[12.5px]"><span><span className="mr-2 text-[11px] tracking-wide text-gray-400">{r.code}</span>{r.name}</span><span className="text-gray-500">{r.created ? '' : '+ batch · '}{r.qty} {r.unit}</span></li>)}</ul>
          </div>
        )}
      </form>
    </Modal>
  )
}
