import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Settings, Pencil, Trash2, Plus, ShoppingCart, Banknote, Smartphone, CreditCard, BookOpen, Printer, ChevronDown, ChevronUp, X, Save, Share2, MessageCircle, MessageSquare, Send, FileText, History } from 'lucide-react'
import { useSeller, call, Modal, Field } from '../kit.jsx'
import { useCustomerPanel, CustomerLink } from '../CustomerPanel.jsx'
import { useBusiness } from '../../../context/BusinessContext.jsx'
import StudyBillRow, { STUDY_TYPES, useBillingCatalog } from '../../study/StudyBillRow.jsx'
import BillingOptions from '../BillingOptions.jsx'
import BillActions, { ShareMenu } from '../BillActions.jsx'
import { accountBlock } from '../billOutput.js'
import { computeBill, buildDocument } from '../billCore.js'

/* ───────── helpers ───────── */
const r2 = (n) => Math.round(n * 100) / 100
const rupee = (n) => '₹' + r2(n).toLocaleString('en-IN')
const baseName = (n) => n.replace(/\s*\([^)]*\)\s*$/, '')
const sizeOf = (p) => (p.name.match(/\(([^)]+)\)\s*$/) || [])[1] || (p.priceUnit === 'kg' ? 'per kg' : '')
const PRESETS = [0.1, 0.25, 0.5, 1, 2]
const isKg = (p) => p?.priceUnit === 'kg'
const isLiter = (p) => p?.priceUnit === 'liter'
const fmtQ = (p, q) => (isKg(p) ? (q < 1 ? `${Math.round(q * 1000)}g` : `${q}kg`) : isLiter(p) ? (q < 1 ? `${Math.round(q * 1000)}ml` : `${q}L`) : String(q))
const parseQ = (p, s) => {
  s = String(s).trim().toLowerCase().replace(/\s/g, '')
  if (!s) return NaN
  if (isKg(p)) { if (s.endsWith('kg')) return +s.slice(0, -2); if (s.endsWith('g')) return +s.slice(0, -1) / 1000; const n = +s; return n >= 10 ? n / 1000 : n }
  if (isLiter(p)) { if (s.endsWith('ml')) return +s.slice(0, -2) / 1000; if (s.endsWith('l')) return +s.slice(0, -1); return +s } // litres may be fractional (0.5 = 500 ml)
  return Math.floor(+s)
}
const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
const METHODS = [['Cash', Banknote, 'cash'], ['UPI', Smartphone, 'upi'], ['Card', CreditCard, 'card'], ['Udhar', BookOpen, 'udhar']]
const payBadge = { Cash: 'bg-[#E3F7EC] text-[#12A05C]', UPI: 'bg-[#E6F0FE] text-[#2F6FEB]', Card: 'bg-[#EEF2FF] text-[#4F46E5]', Udhar: 'bg-[#FFF1DC] text-[#E58A00]' }
const statusBadge = { Pending: 'bg-[#FFF1DC] text-[#E58A00]', Partial: 'bg-[#FFF1DC] text-[#E58A00]', Cleared: 'bg-[#E3F7EC] text-[#12A05C]', Advance: 'bg-[#E6F0FE] text-[#2F6FEB]' } // 🟠 Pending · 🟢 Cleared · 🔵 Advance
const StatusPill = ({ s }) => <span className={`inline-block min-w-[58px] rounded-md px-2 py-0.5 text-center text-[12px] font-medium ${statusBadge[s] || statusBadge.Cleared}`}>{s}</span>
const up = (n, step) => Math.ceil(n / step) * step
const ADV_LABEL = 'From Adv. Bal.' // payment-method label for the part of a bill paid out of the customer's Advance Balance
// ── Universal billing: line types + derived transaction type (same rule as the server) ──
const TYPE_LABEL = { product: 'Product', service: 'Service', material: 'Material', labour: 'Labour', other: 'Other Charge' }
const ADD_LABEL = { product: 'Add Product', service: 'Add Service', material: 'Add Material', labour: 'Add Labour', other: 'Other Charge' }
const TYPE_TAG = { service: 'bg-[#E6F0FE] text-[#2F6FEB]', labour: 'bg-[#EEF2FF] text-[#4F46E5]', material: 'bg-[#FFF1DC] text-[#E58A00]', other: 'bg-gray-100 text-gray-600', product: 'bg-[#E3F7EC] text-[#12A05C]' }
const TXN_LABEL = { sale: 'Sale', service: 'Service', labour: 'Labour', mixed: 'Mixed' }
const typeOfItem = (i) => i.type || 'product' // drafts saved before universal billing have no type
const txnOf = (items) => {
  const k = new Set(items.map(typeOfItem).map((t) => (t === 'product' || t === 'material' ? 'sale' : t === 'other' ? null : t)).filter(Boolean))
  return k.size > 1 ? 'mixed' : k.size === 1 ? [...k][0] : 'service'
}
const qtyText = (it) => { const t = typeOfItem(it); return t === 'product' || t === 'material' ? fmtQ({ priceUnit: it.kg ? 'kg' : 'unit' }, it.qty) : t === 'other' || it.pricing === 'fixed' ? '1' : `${it.qty}${it.unit ? ' ' + it.unit : ''}` }
// The shop's default bill discount (Billing options) — only when Discount itself is enabled. It PRE-FILLS the bill's single discount field; it is never a second discount.
const defaultDiscountOf = (c) => { const k = c?.capabilities; return k?.discount && k.defaultDiscountEnabled && Number(k.defaultDiscountValue) > 0 ? { type: k.defaultDiscountType === 'percent' ? 'percent' : 'fixed', value: String(k.defaultDiscountValue) } : null }
const DEFAULT_CFG = { capabilities: { products: true, partialPayment: true, udhar: true, context: [] }, lineTypes: [{ type: 'product', label: 'Product' }] }

// Customer search only starts with enough input: name ≥ 2 characters · phone ≥ 3 digits. Below that → no request at all.
const searchable = (q) => { const t = q.trim(); return /^[\d\s+-]+$/.test(t) ? t.replace(/\D/g, '').length >= 3 : t.length >= 2 }

/* ───────── bill preview · share · print ───────── */
// Every customer-facing output (80mm · A4 · WhatsApp · SMS · Telegram) renders from ONE customer-safe document — see billCore.buildDocument / billOutput.js.
const SECTION_TITLE = { product: 'PRODUCTS', service: 'SERVICES', material: 'MATERIALS', labour: 'LABOUR', other: 'OTHER CHARGES' }
const toCalcLine = (i) => ({ type: typeOfItem(i), qty: i.qty, rate: i.price, charge: i.charge, discountType: i.discountType, discountValue: Number(i.discountValue) || 0 })
const CHARGE_LABEL = { charged: 'Customer pays', included: 'Included in service', internal: 'Internal use (not charged)' }
const focusSoon = (ref, sel) => setTimeout(() => { ref.current?.focus(); if (sel) ref.current?.select?.() }, 0)

const Step = ({ n, title, hint, children }) => (
  <div className="flex items-center gap-3">
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-500 text-[12px] font-semibold text-white">{n}</span>
    <h2 className="text-[14px] font-semibold text-gray-900">{title}</h2>
    {hint && <span className="hidden text-[11.5px] text-gray-400 md:inline">{hint}</span>}
    {children}
  </div>
)
const ClearBtn = ({ onClick }) => <button type="button" onClick={onClick} className="flex items-center gap-1 text-[12px] font-medium text-red-500 transition hover:text-red-600"><Trash2 size={13} />Clear All (Esc)</button>

export default function BillingPage() {
  const { tx, isStudy } = useBusiness()
  const navigate = useOwnerNavigate()
  const ctx = useOutletContext() || {}
  const panel = useCustomerPanel()
  const [sp, setSp] = useSearchParams()
  const recent = useSeller('/api/seller/billing/recent?limit=8')
  const [drafts, setDrafts] = useState([]); const [draftId, setDraftId] = useState(null); const [draftsOpen, setDraftsOpen] = useState(false)
  const [preview, setPreview] = useState(null) // bill preview / share modal
  const lastErr = useRef('')
  const custCache = useRef(new Map()) // typed query → suggestions, so backspacing never re-fetches
  const [products, setProducts] = useState([])
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(null) // null | {name, phone} prefill
  const [detail, setDetail] = useState(null)
  // ── Universal billing: what this business may bill (drives every + Add … button) ──
  const [cfg, setCfg] = useState(DEFAULT_CFG); const [optionsOpen, setOptionsOpen] = useState(false)
  const caps = cfg.capabilities; const types = cfg.lineTypes.map((t) => t.type); const multi = types.length > 1
  const [mode, setMode] = useState('product'); const [services, setServices] = useState([])
  const [studyCat, reloadStudyCat] = useBillingCatalog(isStudy)
  const [discount, setDiscount] = useState(''); const [ctxVals, setCtxVals] = useState({})
  const chargeFocus = useRef(null)
  const [discountType, setDiscountType] = useState('fixed')           // bill discount: ₹ or %
  const [discFromDefault, setDiscFromDefault] = useState(false)       // the field currently holds the shop's default discount (not yet edited)
  const discTouched = useRef(false); const cfgRef = useRef(DEFAULT_CFG); cfgRef.current = cfg // touched = the seller (or a resumed draft) set the discount, so the default must not overwrite it
  const applyDefaultDiscount = useCallback((c) => { if (discTouched.current) return; const d = defaultDiscountOf(c); setDiscount(d ? d.value : ''); setDiscountType(d ? d.type : 'fixed'); setDiscFromDefault(!!d) }, [])
  const [splitOn, setSplitOn] = useState(false); const [splitAmts, setSplitAmts] = useState({ cash: '', upi: '', card: '' })
  const [editKey, setEditKey] = useState(null); const [mCharge, setMCharge] = useState('charged')

  // customer
  const [customer, setCustomer] = useState(null)
  const [cq, setCq] = useState(''); const [cOpen, setCOpen] = useState(false); const [cIdx, setCIdx] = useState(0); const [custList, setCustList] = useState([]); const [custDone, setCustDone] = useState('') // custDone = the query whose results are on screen
  // product row
  const [price, setPrice] = useState(''); const [sel, setSel] = useState(null); const [pq, setPq] = useState(''); const [pOpen, setPOpen] = useState(false); const [pIdx, setPIdx] = useState(-1); const [qty, setQty] = useState('1')
  const [items, setItems] = useState([])
  // payment
  const [compFor, setCompFor] = useState(null) // Return Amount → Compensate: customer id whose change is being used to pay their old udhar (explicit seller action only; never persisted by itself)
  const [advFor, setAdvFor] = useState(null); const [oldPay, setOldPay] = useState(null) // 4th quick button: advFor = customer id whose Advance Balance is applied to this bill · oldPay = { id, amt } collected for that customer's OLD udhar (both keyed by customer, so they can never leak to another customer)
  const [method, setMethod] = useState('Cash'); const [recv, setRecv] = useState(null); const [retMode, setRetMode] = useState('auto'); const [retCustom, setRetCustom] = useState(''); const [notes, setNotes] = useState('')

  const refC = useRef(), refP = useRef(), refPr = useRef(), refQ = useRef(), refR = useRef(), refN = useRef(), listP = useRef(), listC = useRef(), escAt = useRef(0)

  /* ───────── data ───────── */
  const loadProducts = useCallback(() => call('get', '/api/seller/billing/products').then(setProducts).catch(() => {}), [])
  useEffect(() => { loadProducts(); focusSoon(refC) }, [loadProducts])
  const loadServices = useCallback(() => call('get', '/api/seller/billing/services').then(setServices).catch(() => {}), [])
  useEffect(() => { call('get', '/api/seller/billing/config').then((c) => { setCfg(c); applyDefaultDiscount(c); setMode((m) => (c.lineTypes.some((t) => t.type === m) ? m : c.lineTypes[0].type)); if (c.capabilities.services || c.capabilities.labour) loadServices() }).catch(() => {}) }, [loadServices, applyDefaultDiscount])
  // opened from a member's page: /billing?member=<id>[&renew=1] → member pre-selected, and (renew) the next membership period pre-filled
  const preset = useRef(false)
  useEffect(() => {
    const id = sp.get('member'); if (!id || preset.current || !isStudy || !studyCat) return
    preset.current = true
    ;(async () => {
      try {
        const m = await call('get', `/api/seller/study/members/${id}`)
        setCustomer({ id: m.member.customerId, name: m.member.name, phone: m.member.phone, udharDue: m.due?.amount || 0, credit: 0 })
        if (sp.get('renew')) {
          const o = await call('get', `/api/seller/study/members/${id}/renewal-offer`)
          const plan = studyCat.plans.find((p) => p.key === o.planKey)
          addStudy({ type: 'membership', name: `Membership – ${plan?.name || `${o.months} Month${o.months > 1 ? 's' : ''}`} (renewal)`, rate: o.price, meta: { planKey: o.planKey, months: o.months, renewsId: o.renewsId, ...(o.seat ? { seatId: o.seat.seatId, slot: o.seat.slot.fullDay ? { fullDay: true } : { start: o.seat.slot.start, end: o.seat.slot.end } } : {}) } })
        }
        setSp({}, { replace: true })
      } catch (e) { say('err', e.message) }
    })()
  }, [sp, isStudy, studyCat]) // eslint-disable-line react-hooks/exhaustive-deps
  const loadDrafts = useCallback(() => call('get', '/api/seller/billing/drafts').then(setDrafts).catch(() => {}), [])
  useEffect(() => { loadDrafts() }, [loadDrafts])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.kind === 'ok' ? 6000 : 3500); return () => clearTimeout(t) }, [toast])

  // Customer suggestions. NO request until there is enough input (name ≥ 2 chars · phone ≥ 3 digits);
  // debounced, stale replies ignored, repeated queries served from a small cache.
  useEffect(() => {
    if (customer) return
    const q = cq.trim()
    if (!searchable(q)) { setCustList([]); setCustDone(''); return }
    const hit = custCache.current.get(q)
    if (hit) { setCustList(hit); setCustDone(q); return }
    let live = true
    const t = setTimeout(() => call('get', `/api/customers/search?q=${encodeURIComponent(q)}`).then((r) => { custCache.current.set(q, r); if (live) { setCustList(r); setCustDone(q) } }).catch(() => {}), 200)
    return () => { live = false; clearTimeout(t) }
  }, [cq, customer])
  useEffect(() => { setCIdx(cq.trim() ? 0 : -1) }, [cq])

  const cItems = useMemo(() => {
    const q = cq.trim()
    if (!searchable(q)) return [] // nothing typed (or too short) → no suggestions at all
    const a = custList.slice(0, 5).map((c) => ({ t: 'c', c }))
    if (!custList.some((c) => c.name.toLowerCase() === q.toLowerCase() || c.phone === q)) a.push({ t: 'add' })
    return a
  }, [custList, cq])

  const pItems = useMemo(() => {
    const q = pq.trim().toLowerCase()
    const pool = mode === 'material' ? products.filter((p) => !p.unlisted) : products.filter((p) => p.sellable !== false)
    const list = q ? pool.filter((p) => p.name.toLowerCase().includes(q)).sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q))) : pool
    const out = list.slice(0, 40).map((p) => ({ t: 'p', p }))
    if (mode === 'product' && q && !products.some((p) => baseName(p.name).toLowerCase() === q || p.name.toLowerCase() === q)) out.push({ t: 'new' })
    return out
  }, [products, pq, mode])
  useEffect(() => { setPIdx(pq.trim() ? 0 : -1) }, [pq])
  useEffect(() => { listP.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [pIdx, pOpen])
  useEffect(() => { listC.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [cIdx, cOpen])

  /* ───────── totals ───────── */
  // ONE calculation pipeline shared with the server: line totals → subtotal → discounts → tax → grand total
  const calc = computeBill(items.map(toCalcLine), { discount: caps.discount ? { type: discountType, value: Number(discount) || 0 } : 0, taxRate: caps.tax ? caps.taxRate : 0 })
  const { subtotal, taxAmount, total } = calc, disc = calc.discount
  const splitList = ['cash', 'upi', 'card'].map((m) => ({ method: m, amount: Number(splitAmts[m]) || 0 })).filter((x) => x.amount > 0)
  const splitSum = r2(splitList.reduce((a, x) => a + x.amount, 0))
  const txn = txnOf(items)
  const METHODS_ON = METHODS.filter((m) => m[0] !== 'Udhar' || caps.udhar !== false)
  // The customer's account is ONE signed balance (+ owes · − Advance), so udhar and advance never both exist. The 4th quick button follows it:
  //   owes udhar → "+₹udhar" collects the OLD udhar here · holds Advance → "−₹advance" pays this bill from the Advance Balance (never more than the bill).
  const udharPend = customer?.id && customer.udharDue > 0 ? r2(customer.udharDue) : 0
  const advCap = customer?.id && !udharPend ? r2(Math.min(Math.max(customer.credit || 0, 0), total)) : 0
  const advOn = advCap > 0 && advFor === customer.id
  // Advance is applied ONLY when the seller taps "−₹…" (it used to be deducted silently) — one source, so it can never be deducted twice.
  const creditUsed = advOn ? advCap : 0
  const dueNow = r2(total - creditUsed)
  const received = splitOn ? splitSum : recv === null ? (method === 'Udhar' ? 0 : dueNow) : Number(recv) || 0
  // Money collected for the OLD udhar sits inside Amount Received but is NOT a payment of this bill: bill part = received − old-udhar part.
  const oldAsked = oldPay && customer?.id && oldPay.id === customer.id ? oldPay.amt : 0
  const oldBtn = udharPend && !splitOn ? r2(Math.min(oldAsked, received, udharPend)) : 0 // what the 4th button added: collected against the OLD udhar, never counted as payment of this bill
  // Compensate (Return Amount section): only when the seller taps it, the change that would be handed back is used to pay the customer's old udhar instead.
  // Anything beyond the bill + old udhar is still "change" — returned, kept as Advance, or custom — exactly like the normal flow.
  const compOn = udharPend > 0 && !!customer?.id && compFor === customer.id
  const surplus = Math.max(r2(received - dueNow), 0)
  const oldSettle = compOn ? r2(Math.min(Math.max(surplus, oldBtn), udharPend)) : oldBtn
  const billRecv = r2(received - oldSettle)
  const change = Math.max(r2(billRecv - dueNow), 0), balance = Math.max(r2(dueNow - billRecv), 0)
  const plainChange = Math.max(r2(received - oldBtn - dueNow), 0) // the normal (uncompensated) Return Amount
  useEffect(() => { setRetMode('auto') }, [change])
  useEffect(() => { setCompFor(null) }, [customer?.id]) // a different customer never inherits compensation
  const returned = retMode === 'auto' ? change : retMode === 'custom' ? Number(retCustom) || 0 : retMode
  const keptCredit = change > 0 ? Math.max(r2(change - returned), 0) : 0
  const recvChips = [...new Set([dueNow, up(dueNow, 50), up(dueNow, 100), 500, 1000, 2000].filter((v) => v >= dueNow && v > 0))].slice(0, 3)
  const retChips = change > 0 ? [change, 0] : [] // return it all, or keep it as customer credit (0 returned)
  // The customer's account before / after THIS bill — the same arithmetic the server's ledger does (advance used + unpaid added to udhar − extra paid), so the preview matches the saved bill.
  const acctBefore = customer?.id ? (customer.udharDue > 0 ? customer.udharDue : -(customer.credit || 0)) : null
  const netPaid = r2(received - returned), billNet = r2(billRecv - returned), unpaidNow = r2(dueNow - Math.min(billNet, dueNow)), extraNow = r2(Math.max(billNet - dueNow, 0))
  const acctAfter = acctBefore == null ? null : r2(acctBefore + creditUsed + unpaidNow - extraNow - oldSettle)
  // how much of the money paid beyond this bill ends up as NEW Advance Balance (the server pays older udhar first, only the rest is advance)
  const advAddNow = acctBefore == null ? 0 : r2(Math.max((extraNow + oldSettle) - Math.min(extraNow + oldSettle, Math.max(r2(acctBefore + creditUsed + unpaidNow), 0)), 0))

  /* ───────── actions ───────── */
  const say = (kind, text, extra) => setToast({ kind, text, ...extra })
  const resetAll = useCallback((keepToast) => {
    setCustomer(null); setCq(''); setSel(null); setPq(''); setQty('1'); setPrice(''); setItems([]); setMethod('Cash'); setRecv(null); setAdvFor(null); setOldPay(null); setCompFor(null); setRetMode('auto'); setRetCustom(''); setNotes(''); discTouched.current = false; applyDefaultDiscount(cfgRef.current); setSplitOn(false); setSplitAmts({ cash: '', upi: '', card: '' }); setEditKey(null); setMCharge('charged'); setCtxVals({}); setMode(types[0] || 'product'); setCOpen(true); setPOpen(false); setDraftId(null); custCache.current.clear()
    if (!keepToast) setToast(null)
    focusSoon(refC)
  }, [types, applyDefaultDiscount])

  const pickCustomer = (it) => {
    if (!it) return say('err', tx('Select a customer from the list (↓ then Enter)'))
    if (it.t === 'add') { const q = cq.trim(); return setAddOpen(/^\d+$/.test(q) ? { name: '', phone: q } : { name: q, phone: '' }) }
    const c = it.c
    if (c.source === 'global') {
      // exact 10-digit match → let the seller confirm / edit the name first; otherwise save with the most-used name
      if (c.exact) return setAddOpen({ name: c.name, phone: c.phone, globalUserId: c.globalUserId })
      return call('post', '/api/seller/billing/customers/select', { globalUserId: c.globalUserId, name: c.name, phone: c.phone })
        .then((saved) => { setCustomer(saved); setCq(''); setCOpen(false); setPOpen(true); focusSoon(refP) }).catch((e) => say('err', e.message))
    }
    setCustomer(c); setCq(''); setCOpen(false); setPOpen(true); focusSoon(refP)
  }
  const customerText = customer ? [customer.name, customer.phone, customer.udharDue ? `${tx('Udhar')}: ${rupee(customer.udharDue)}` : customer.credit ? `Advance: ${rupee(customer.credit)}` : ''].filter(Boolean).join('  |  ') : cq

  const pickProduct = (it) => {
    if (!it) return
    if (it.t === 'new') { setSel({ id: null, name: pq.trim(), unlisted: true, isNew: true, stock: null, priceUnit: 'unit' }); setPrice(''); setQty('1'); setPOpen(false); return focusSoon(refPr, true) }
    const p = it.p
    if (p.stock !== null && p.stock <= 0) return say('err', `${baseName(p.name)} is out of stock`)
    setSel(p); setPrice(p.unlisted || mode === 'material' ? String(p.price) : ''); setQty(fmtQ(p, mode === 'material' ? 1 : p.topQty || 1)); setPOpen(false); focusSoon(refQ, true)
  }
  const addItem = () => {
    const q = parseQ(sel, qty)
    if (!sel || !(q > 0)) return say('err', 'Enter a valid quantity')
    const notCharged = mode === 'material' && mCharge !== 'charged'
    const repriced = sel.unlisted || mode === 'material' // unlisted till items and materials carry their own rate
    const unit = notCharged ? 0 : repriced ? Number(price) : sel.price
    if (repriced && !notCharged && !(unit > 0)) { say('err', mode === 'material' ? 'Enter a rate' : 'Enter a selling price'); return focusSoon(refPr, true) }
    const key = mode === 'material' ? `m:${sel.id}:${mCharge}` : sel.id || `u:${sel.name.toLowerCase()}`
    const have = items.find((i) => i.key === key)?.qty || 0
    const inBill = sel.id ? items.filter((i) => i.id === sel.id).reduce((a, i) => a + i.qty, 0) : 0 // a product line + a material line of the same item share one stock
    if (sel.stock !== null && r2(inBill + q) > sel.stock) return say('err', `Only ${sel.stock}${isKg(sel) ? ' kg' : isLiter(sel) ? ' L' : ''} of ${baseName(sel.name)} in stock`)
    setItems((list) => (have ? list.map((i) => (i.key === key ? { ...i, qty: r2(i.qty + q), price: unit } : i)) : [...list, { key, type: mode, id: sel.id, name: baseName(sel.name), size: sel.unlisted ? '' : sizeOf(sel), price: unit, qty: q, kg: isKg(sel), unlisted: !!sel.unlisted, ...(mode === 'material' ? { charge: mCharge } : {}) }]))
    setSel(null); setPq(''); setQty('1'); setPrice(''); setMCharge('charged'); setPOpen(true); setPIdx(-1); focusSoon(refP) // new empty product row
  }
  // service · labour · other charge — one row each, never merged
  const addCharge = (c) => { setItems((l) => [...l, { key: `c:${Date.now()}:${l.length}`, type: c.type, name: c.name, price: c.rate, qty: c.qty, unit: c.unit, pricing: c.pricing, serviceId: c.serviceId || null, ...(c.charge && c.charge !== 'charged' ? { charge: c.charge } : {}) }]); chargeFocus.current?.() }
  // study-centre lines (membership · course fee · book · fine …): name + amount (+ plan / seat / slot / course in `meta`) — priced by the same engine
  const addStudy = (c) => { setItems((l) => [...l, { key: `s:${Date.now()}:${l.length}`, type: c.type, name: c.name, price: c.rate, qty: 1, pricing: 'fixed', ...(c.meta ? { meta: c.meta } : {}) }]); chargeFocus.current?.() }
  const patchItem = (key, patch) => setItems((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const switchMode = (t) => { setMode(t); setSel(null); setPq(''); setPrice(''); setQty('1'); if (t === 'product' || t === 'material') { setPOpen(true); focusSoon(refP) } else setTimeout(() => chargeFocus.current?.(), 0) }
  const stepQty = (dir) => {
    if (isKg(sel)) { const cur = parseQ(sel, qty) || 1; const i = PRESETS.reduce((b, v, k) => (Math.abs(v - cur) < Math.abs(PRESETS[b] - cur) ? k : b), 0); setQty(fmtQ(sel, PRESETS[Math.max(0, Math.min(PRESETS.length - 1, i + dir))])) }
    else setQty(String(Math.max(1, (parseQ(sel, qty) || 1) + dir)))
  }
  const cycleMethod = (dir = 1) => setMethod((m) => METHODS_ON[(METHODS_ON.findIndex((x) => x[0] === m) + dir + METHODS_ON.length) % METHODS_ON.length][0])

  // 4th quick button — customer's NET balance is udhar: tapping ADDS that amount to whatever Amount Received already holds (it is never replaced) and marks it as
  // collected against the OLD udhar, not as payment of this bill. Tapping again takes exactly that amount back out.
  const toggleOldUdhar = () => {
    if (!udharPend) return
    if (oldBtn > 0 || oldAsked > 0) { setRecv(String(r2(Math.max(received - oldAsked, 0)))); setOldPay(null) }
    else { if (method === 'Udhar') setMethod('Cash'); setOldPay({ id: customer.id, amt: udharPend }); setRecv(String(r2(received + udharPend))) }
    focusSoon(refR, true)
  }
  // 4th quick button — customer holds Advance: pay (part of) this bill from it. Amount Received becomes exactly what is STILL due after the advance
  // (whatever was typed before, or a bill left on Udhar, is replaced) so nothing is counted twice; tap again to take the advance back off.
  const toggleAdvance = () => {
    if (!advCap) return
    setOldPay(null)
    if (advOn) { setAdvFor(null); setRecv(null) }
    else { if (method === 'Udhar') setMethod('Cash'); setAdvFor(customer.id); setRecv(String(r2(Math.max(total - advCap, 0)))) }
    focusSoon(refR, true)
  }

  const generate = useCallback(async () => {
    if (busy) return
    if (!items.length) { say('err', multi ? 'Add at least one item' : 'Add at least one product'); focusSoon(refP); return }
    if (!customer) { say('err', tx('Select a customer first (F1)')); focusSoon(refC); return }
    setBusy(true)
    try {
      const res = await call('post', '/api/seller/sales', {
        channel: 'offline', customerName: customer?.name || '', customerPhone: customer?.phone || '', paymentMode: 'custom', amountPaid: Math.min(billRecv, dueNow), addRemainingToUdhar: balance > 0, advanceToUse: creditUsed, oldUdharPaid: oldSettle,
        paymentMethod: METHODS.find((m) => m[0] === method)[2], receivedAmount: received, returnedAmount: returned, notes, draftId,
        discount: caps.discount ? { type: discountType, value: Number(discount) || 0 } : 0, context: ctxVals,
        ...(splitOn && splitList.length ? { payments: splitList } : {}),
        items: items.map((i) => {
          const t = typeOfItem(i)
          const x = { ...(i.description ? { description: i.description } : {}), ...(Number(i.discountValue) > 0 ? { discountType: i.discountType || 'fixed', discountValue: Number(i.discountValue) } : {}), ...(i.charge && i.charge !== 'charged' ? { charge: i.charge } : {}) }
          if (t === 'material') return { type: 'material', productId: i.id, quantity: i.qty, rate: i.price, ...x }
          if (t === 'service' || t === 'labour') return { type: t, name: i.name, qty: i.qty, unit: i.unit, rate: i.price, pricing: i.pricing, serviceId: i.serviceId, ...x }
          if (STUDY_TYPES.includes(t) || (t === 'other' && isStudy)) return { type: t, name: i.name, rate: i.price, ...(i.meta ? { meta: i.meta } : {}), ...x }
          if (t === 'other') return { type: 'other', name: i.name, rate: i.price, ...x }
          return i.id ? { productId: i.id, quantity: i.qty, ...(i.unlisted ? { price: i.price } : {}), ...(caps.editRate ? { rate: i.price } : {}), ...x } : { unlisted: true, name: i.name, price: i.price, quantity: i.qty, ...x }
        }),
      })
      const id = `#ORD${String(res.billId).slice(-4).toUpperCase()}`
      const nu = items.filter((i) => i.unlisted).length
      const st = res.settlement || {}
      resetAll(true); say('ok', `Bill ${id} generated · ${rupee(total)} · ${res.status}${st.creditUsed ? ` · Advance ${rupee(st.creditUsed)} used` : ''}${st.advanceAdded ? ` · ${rupee(st.advanceAdded)} added to Advance Balance` : ''}${nu ? ` · ${nu} new item${nu > 1 ? 's' : ''} sent to Inventory` : ''}`, { billId: res.billId })
      recent.reload(); loadProducts(); loadServices(); reloadStudyCat(); if (draftId) loadDrafts()
      return res
    } catch (e) { lastErr.current = e.message || 'Could not save the bill'; say('err', lastErr.current) } finally { setBusy(false) }
  }, [busy, items, balance, customer, received, billRecv, creditUsed, oldSettle, total, disc, discount, discountType, splitOn, splitList, caps, ctxVals, multi, method, returned, notes, draftId, resetAll, recent, loadProducts, loadServices, loadDrafts])

  /* ───────── drafts ───────── */
  const saveDraft = async () => {
    if (busy) return
    if (!items.length && !customer) { say('err', tx('Add a customer or a product first')); return }
    setBusy(true)
    try {
      await call('post', '/api/seller/billing/drafts', { id: draftId, customer: customer && { id: customer.id, name: customer.name, phone: customer.phone }, total, itemCount: items.length, state: { items, method, recv, retMode, retCustom, notes, discount, discountType, split: splitOn ? splitAmts : null, context: ctxVals, mode } })
      resetAll(true); say('ok', 'Draft saved — find it at the top of Drafts'); loadDrafts()
    } catch (e) { say('err', e.message || 'Could not save the draft') } finally { setBusy(false) }
  }
  const resumeDraft = useCallback(async (id) => {
    try {
      const d = await call('get', `/api/seller/billing/drafts/${id}`), st = d.state || {}
      setCustomer(d.customer || null); setCq(''); setCOpen(false); setSel(null); setPq(''); setQty('1'); setPrice('')
      setItems(st.items || []); discTouched.current = true; setDiscFromDefault(false); setDiscount(st.discount ?? ''); setDiscountType(st.discountType || 'fixed'); setSplitOn(!!st.split); setSplitAmts(st.split || { cash: '', upi: '', card: '' }); setEditKey(null); setCtxVals(st.context || {}); if (st.mode && types.includes(st.mode)) setMode(st.mode); setMethod(st.method || 'Cash'); setRecv(st.recv ?? null); setCompFor(null); setRetMode(st.retMode ?? 'auto'); setRetCustom(st.retCustom || ''); setNotes(st.notes || '')
      setDraftId(d.id); setDraftsOpen(false); setPOpen(true); focusSoon(refP)
    } catch (e) { say('err', e.message || 'Could not open the draft') }
  }, [types])
  const removeDraft = async (id) => {
    if (!window.confirm('Delete this draft?')) return
    setDrafts((l) => l.filter((d) => d.id !== id)); if (id === draftId) setDraftId(null)
    call('delete', `/api/seller/billing/drafts/${id}`).catch(() => loadDrafts())
  }
  const wantsDraft = sp.get('draft') // /analytics/billing?draft=<id> (from the Orders list)
  useEffect(() => { if (wantsDraft) { resumeDraft(wantsDraft); setSp({}, { replace: true }) } }, [wantsDraft, resumeDraft, setSp])

  /* ───────── print / share preview ───────── */
  // preview of the bill being typed (not saved yet) — Save in the modal creates it
  const liveDoc = () => {
    if (!items.length) { focusSoon(refP); throw new Error(multi ? 'Add at least one item' : 'Add at least one product') }
    const pays = splitOn ? splitList : method === 'Udhar' ? [] : [{ method: METHODS.find((m) => m[0] === method)[2], amount: Math.min(billRecv, dueNow) }]
    const doc = buildDocument({
      business: cfg.business || { name: ctx.summary?.shop?.name || '' },
      bill: {
        displayId: 'Not saved yet', createdAt: new Date(), customerName: customer?.name || '', customerPhone: customer?.phone || '',
        context: Object.entries(ctxVals).filter(([, v]) => v).map(([k, v]) => ({ label: caps.context.find((f) => f.key === k)?.label || k, value: v })),
        items: items.map((i, k) => ({ type: typeOfItem(i), name: i.name + (i.size ? ` (${i.size})` : ''), description: i.description || '', qty: i.qty, unit: typeOfItem(i) === 'product' || typeOfItem(i) === 'material' ? (i.kg ? 'kg' : '') : i.unit || '', rate: i.price, discount: calc.lines[k].discount, total: calc.lines[k].total, charge: i.charge || 'charged' })),
        subtotal, discount: disc, taxName: caps.taxName, taxRate: caps.taxRate, taxAmount, totalAmount: total,
        paidAmount: r2(creditUsed + Math.min(billRecv, dueNow)), unpaidAmount: balance, status: balance > 0 ? 'udhar' : 'paid', paymentMethod: METHODS.find((m) => m[0] === method)[2], transactionType: txn,
        balanceBefore: acctBefore, balanceAfter: acctAfter, creditUsed, advanceAdded: advAddNow, receivedAmount: received, returnedAmount: returned, // Udhar account block (null balances = walk-in → no block)
      },
      payments: [...pays, ...(creditUsed > 0 ? [{ method: 'advance', amount: creditUsed }] : [])], terms: caps.terms,
    })
    return doc
  }
  const saveFromPreview = async () => {
    if (!customer) throw new Error('Select a customer first — close this and press F1')
    lastErr.current = ''
    const res = await generate()
    if (!res) throw new Error(lastErr.current || 'Could not save the bill')
    setPreview((p) => p && { saved: true, billId: res.billId })
  }

  // global hot-keys: F1 customer · F2 product · F3 amount received · F4 payment method · Ctrl+Enter generate
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F1') { e.preventDefault(); setCOpen(true); focusSoon(refC, true) }
      else if (e.key === 'F2') { e.preventDefault(); if (mode === 'product' || mode === 'material') { setPOpen(true); focusSoon(refP) } else chargeFocus.current?.() }
      else if (e.key === 'F3') { e.preventDefault(); focusSoon(refR, true) }
      else if (e.key === 'F4') { e.preventDefault(); cycleMethod() }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); generate() }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [generate, mode])

  /* ───────── key handlers ───────── */
  const onCustKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCOpen(true); setCIdx((i) => Math.min(i + 1, cItems.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); customer ? (setCOpen(false), focusSoon(refP)) : pickCustomer(cItems[cIdx]) }
    else if (e.key === 'Escape') { e.preventDefault(); cOpen ? setCOpen(false) : escClear() }
  }
  const onProdKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPOpen(true); setPIdx((i) => Math.min(i + 1, pItems.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPIdx((i) => Math.max(i - 1, -1)) }
    else if (e.key === 'ArrowRight' && pIdx >= 0 && e.currentTarget.selectionStart === pq.length) { e.preventDefault(); pickProduct(pItems[pIdx]) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (pIdx >= 0 || pq.trim()) pickProduct(pItems[Math.max(pIdx, 0)])
      else if (items.length) { setPOpen(false); focusSoon(refR, true) } // empty row + Enter → payment
      else say('err', 'Search a product and press Enter')
    } else if (e.key === 'Escape') { e.preventDefault(); pq ? setPq('') : pOpen ? setPOpen(false) : escClear() }
  }
  const onQtyKey = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); addItem() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); stepQty(1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); stepQty(-1) }
    else if (e.key === 'Escape') { e.preventDefault(); setSel(null); setPOpen(true); focusSoon(refP) }
  }
  const onPriceKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); focusSoon(refQ, true) }
    else if (e.key === 'Escape') { e.preventDefault(); setSel(null); setPOpen(true); focusSoon(refP) }
  }
  const onRecvKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); generate() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cycleMethod(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cycleMethod(1) }
    else if (e.key === 'Escape') { e.preventDefault(); setPOpen(true); focusSoon(refP) }
  }
  // Esc on an already-empty field: first press warns, second press clears the whole bill
  const escClear = () => {
    if (!items.length && !customer) return
    if (Date.now() - escAt.current < 1600) { escAt.current = 0; resetAll() } else { escAt.current = Date.now(); say('err', 'Press Esc again to clear this bill') }
  }

  /* ───────── receipts ───────── */
  const openDetail = (billId) => { setDetail({ loading: true }); call('get', `/api/seller/billing/bills/${billId}`).then(setDetail).catch((e) => setDetail({ error: e.message })) }
  // Print on a saved bill → the preview modal (Save / Share / Print) — never a pop-up that can be blocked
  const openSaved = (billId) => setPreview({ saved: true, billId })

  /* ───────── UI (compact POS) ───────── */
  const inp = 'h-9 w-full rounded-lg border bg-white px-3 text-[13px] text-gray-900 outline-none transition placeholder:text-gray-400'
  const dd = 'absolute left-0 top-[calc(100%+3px)] z-30 max-h-[260px] w-full overflow-auto rounded-lg border border-gray-100 bg-white py-1 shadow-xl'
  const chip = (on) => `h-8 rounded-md border px-2.5 text-[12.5px] transition ${on ? 'border-orange-500 bg-orange-500 font-medium text-white' : 'border-gray-200 text-gray-700 hover:border-orange-300'}`

  return (
    <div>
      {toast && (
        <div role="status" className={`fixed right-4 top-16 z-50 flex w-[340px] max-w-[92vw] items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] shadow-lg ${toast.kind === 'ok' ? 'bg-[#E3F7EC] text-[#0E7F4A]' : 'bg-[#FDECEC] text-red-600'}`}>
          <span className="flex-1 font-medium">{toast.text}</span>
          {toast.billId && <><button type="button" onClick={() => openDetail(toast.billId)} className="underline">View</button><button type="button" onClick={() => openSaved(toast.billId)} className="underline">80mm · A4 · Share</button></>}
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}><X size={14} /></button>
        </div>)}

      {/* ── screen 1: the whole bill, no scrolling ── */}
      <div className="flex flex-col gap-2 xl:h-[calc(100vh-104px)] xl:min-h-[540px]">
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_370px]">
          {/* Billing form */}
          <section className="flex min-h-0 flex-col rounded-xl border border-[#E8EEF6] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2.5"><i className="h-6 w-1 rounded bg-orange-500" /><h1 className="text-[18px] font-semibold leading-none text-gray-900">Billing{draftId && <em className="ml-2 rounded bg-[#F1EDFD] px-1.5 py-0.5 align-middle text-[11px] font-medium not-italic text-[#6D5BD0]">Editing draft</em>}</h1><span className="hidden text-[11.5px] text-gray-400 sm:inline">Customer → {multi ? 'Items' : 'Product'} → Payment → Generate · all by keyboard</span></div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setDraftsOpen(true)} className="flex items-center gap-1 text-[12px] font-medium text-[#6D5BD0] transition hover:text-[#5B49BD]"><FileText size={13} />Drafts{drafts.length > 0 && <span className="rounded-full bg-[#F1EDFD] px-1.5 text-[11px]">{drafts.length}</span>}</button>
                <button type="button" onClick={() => setOptionsOpen(true)} title="Billing options" aria-label="Billing options" className="flex items-center gap-1 text-[12px] font-medium text-gray-500 transition hover:text-orange-600"><Settings size={13} />Options</button>
                <ClearBtn onClick={() => resetAll()} />
              </div>
            </div>

            <div className="pt-3">
              <Step n={1} title={tx('Select Customer')} hint="(type name / mobile · ↓ · Enter)" />
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <input ref={refC} 
                    value={customerText} 
                    placeholder={tx('Search customer by name or mobile…')} 
                    autoComplete="off" 
                    aria-label="Customer"
                    onChange={(e) => { if (customer) setCustomer(null); setCq(e.target.value); setCOpen(true) }} onFocus={(e) => { setCOpen(true); customer && e.target.select() }} onBlur={() => setCOpen(false)} onKeyDown={onCustKey}
                  
                  className={`${inp} pr-8 ${customer ? 'border-[#12A05C] bg-[#F4FBF7] font-medium' : cOpen ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200'}`} />
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-[11px] text-gray-500" />
                  {cOpen && !customer && cItems.length > 0 && (
                    <ul ref={listC} className={dd} role="listbox">
                      {custDone === cq.trim() && !custList.length && <li className="px-3 py-1.5 text-[12.5px] text-gray-400">No result found</li>}
                      {cItems.map((it, i) => (
                        <li key={i} role="option" aria-selected={i === cIdx} data-active={i === cIdx} onMouseDown={(e) => { e.preventDefault(); pickCustomer(it) }} onMouseEnter={() => setCIdx(i)}
                          className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-[13px] ${i === cIdx ? 'bg-[#FFF4E8]' : ''}`}>
                          {it.t === 'add' ? 
                          <span className="font-medium text-[#2F6FEB]">+ {tx('Create new customer')}{cq.trim() ? ` “${cq.trim()}”` : ''}</span>
                            : <><span className="flex-1 font-medium">{it.c.name}</span>
                            <span className="text-gray-500">{it.c.phone}</span>
                            {it.c.source === 'global' && <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[11px] text-[#4F46E5]" title="Found in the global directory — saved to your shop when you pick it">Global · {it.c.usageCount}× used</span>}
                            {it.c.udharDue > 0 && <span className="rounded bg-[#FFF1DC] px-1.5 py-0.5 text-[11px] text-[#E58A00]">{tx('Udhar')} {rupee(it.c.udharDue)}</span>}
                            {it.c.credit > 0 && <span className="rounded bg-[#E6F0FE] px-1.5 py-0.5 text-[11px] text-[#2F6FEB]">Advance {rupee(it.c.credit)}</span>}</>}
                        </li>))}
                    </ul>)}
                  
                </div>
                {customer?.id && <button type="button" onClick={() => panel.open(customer.id)} title={`${tx('Customer')} history`} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[13px] font-medium text-gray-700 transition hover:border-orange-300 hover:text-orange-600"><History size={15} />History</button>}
                <button type="button" onClick={() => setAddOpen({ name: '', phone: '' })} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#BFD7FB] bg-[#F5F9FF] px-3.5 text-[13px] font-medium text-[#2F6FEB] transition hover:bg-[#EAF3FF]"><Plus size={15} />Add {tx('Customer')}</button>
              </div>
            </div>

            {caps.context?.length > 0 && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {caps.context.map((f) => (
                  <input key={f.key} value={ctxVals[f.key] || ''} maxLength={120} aria-label={f.label} placeholder={`${f.label}${f.required ? ' *' : ' (optional)'}`} onChange={(e) => setCtxVals((v) => ({ ...v, [f.key]: e.target.value }))} className={`${inp} border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100`} />))}
              </div>)}

            <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-gray-100 pt-3">
              <Step n={2} title={multi ? 'Add Item' : 'Add Product'} hint={multi ? '(pick what to add · Enter add — next row opens automatically)' : '(search · Enter select · Enter add — next row opens automatically)'}>
                {multi && <div className="ml-1 flex flex-wrap gap-1.5">{types.map((t) => <button key={t} type="button" onClick={() => switchMode(t)} className={`flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] transition ${mode === t ? 'border-orange-500 bg-orange-500 font-medium text-white' : 'border-gray-200 text-gray-700 hover:border-orange-300'}`}><Plus size={12} />{cfg.lineTypes.find((x) => x.type === t)?.addLabel || ADD_LABEL[t]}</button>)}</div>}
              </Step>
              <div className="mt-2 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                {/* left: product + qty (or service / labour / other-charge row) */}
                <div>
                  {STUDY_TYPES.includes(mode) && <StudyBillRow key={mode} type={mode} catalog={studyCat} focusRef={chargeFocus} onAdd={addStudy} onErr={(m) => say('err', m)} />}
                  {(mode === 'service' || mode === 'labour' || (mode === 'other' && !isStudy)) && <ChargeRow key={mode} type={mode} catalog={services.filter((x) => x.kind === mode)} focusRef={chargeFocus} onAdd={addCharge} onErr={(m) => say('err', m)} onRemoveCatalog={(id) => call('delete', `/api/seller/billing/services/${id}`).then(loadServices).catch(() => {})} />}
                  {(mode === 'product' || mode === 'material') && <>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="relative min-w-[200px] flex-1">
                      <input ref={refP} value={sel ? baseName(sel.name) : pq} placeholder={mode === 'material' ? 'Type material name or press ↓' : 'Type product name or press ↓'} autoComplete="off" aria-label="Product" readOnly={!!sel}
                        onChange={(e) => { setPq(e.target.value); setPOpen(true) }} onFocus={() => !sel && setPOpen(true)} onBlur={() => setPOpen(false)} onKeyDown={onProdKey}
                        className={`${inp} pr-8 ${pOpen ? 'border-orange-400 ring-2 ring-orange-100' : 'border-orange-300'}`} />
                      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-[11px] text-gray-500" />
                      {pOpen && !sel && (
                        <ul ref={listP} className={`${dd} w-[340px] max-w-[88vw]`} role="listbox">
                          {pItems.length === 0 && <li className="px-3 py-2 text-[12.5px] text-gray-400">Start typing to search products</li>}
                          {pItems.map((it, i) => (
                            <li key={it.t === 'new' ? 'new' : it.p.id} role="option" aria-selected={i === pIdx} data-active={i === pIdx} onMouseDown={(e) => { e.preventDefault(); pickProduct(it) }} onMouseEnter={() => setPIdx(i)}
                              className={`cursor-pointer px-3 py-1.5 text-[13px] ${i === pIdx ? 'bg-[#FFF4E8]' : ''} ${it.t === 'p' && it.p.stock !== null && it.p.stock <= 0 ? 'opacity-40' : ''}`}>
                              {it.t === 'new' ? <span className="font-medium text-[#2F6FEB]">+ Add “{pq.trim()}” as unlisted product</span> : (
                                <span className="grid grid-cols-[1fr_54px_62px] items-center gap-2"><span className="truncate">{baseName(it.p.name)}{it.p.unlisted && <em className="ml-1.5 rounded bg-orange-50 px-1 text-[10px] not-italic text-orange-600">unlisted</em>}</span><span className="text-right">{rupee(it.p.price)}</span><span className="text-right text-[12px] text-[#2F86F6]">{it.p.stock !== null && it.p.stock <= 0 ? 'Out' : sizeOf(it.p)}</span></span>)}
                            </li>))}
                        </ul>)}
                    </div>
                    {(sel?.unlisted || (sel && mode === 'material' && mCharge === 'charged')) && (
                      <div className="w-[86px]"><label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">{mode === 'material' ? 'Rate ₹' : 'Price ₹'}</label>
                        <input ref={refPr} value={price} inputMode="decimal" aria-label="Selling price" onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} onKeyDown={onPriceKey} onFocus={(e) => e.target.select()} className={`${inp} border-orange-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100`} /></div>)}
                    <div className="w-[92px]">
                      <label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">Qty {sel && !sel.unlisted && sizeOf(sel) ? `(${sizeOf(sel)})` : ''}</label>
                      <div className="relative">
                        <input ref={refQ} value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={onQtyKey} disabled={!sel} aria-label="Quantity" inputMode="decimal"
                          className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-3 pr-7 text-[13px] outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-400" />
                        <span className="absolute right-1 top-0.5 flex flex-col"><button type="button" tabIndex={-1} disabled={!sel} aria-label="More" onMouseDown={(e) => e.preventDefault()} onClick={() => stepQty(1)} className="text-gray-500 hover:text-orange-500 disabled:opacity-30"><ChevronUp size={14} /></button><button type="button" tabIndex={-1} disabled={!sel} aria-label="Less" onMouseDown={(e) => e.preventDefault()} onClick={() => stepQty(-1)} className="text-gray-500 hover:text-orange-500 disabled:opacity-30"><ChevronDown size={14} /></button></span>
                      </div>
                    </div>
                    {mode === 'material' && sel && <div className="w-[150px]"><label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">Charge customer?</label><select aria-label="Charge" value={mCharge} onChange={(e) => setMCharge(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-[12.5px] outline-none focus:border-orange-400"><option value="charged">Yes — bill it</option><option value="included">Included in service</option><option value="internal">No — internal use</option></select></div>}
                    <button type="button" onClick={addItem} disabled={!sel} className="flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[12.5px] font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"><ShoppingCart size={14} />Add (Enter)</button>
                  </div>
                  {sel && isKg(sel) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">{PRESETS.map((v) => <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQty(fmtQ(sel, v)); focusSoon(refQ, true) }} className={`rounded-md border px-2 py-0.5 text-[11.5px] transition ${fmtQ(sel, v) === qty.replace(/\s/g, '') ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}>{fmtQ(sel, v)}</button>)}</div>)}
                  <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{mode === 'material' ? 'Materials come from your inventory — the same stock and batches as products.' : <>Not in inventory? Type it → <b>+ Add as unlisted</b> → price → Enter. It’s saved to Inventory automatically.</>}<br />F1 customer · F2 {multi ? 'item' : 'product'} · F3 amount · F4 method · Ctrl+Enter bill</p>
                  </>}
                </div>

                {/* right: current items (scrolls inside only if the bill is long) */}
                <div className="flex min-h-0 min-w-0 flex-col lg:border-l lg:border-gray-100 lg:pl-4">
                  <div className="mb-1.5 flex items-center justify-between"><h3 className="text-[14px] font-semibold text-gray-900">Current Bill Items ({items.length}){multi && items.length > 0 && <span className="ml-2 rounded bg-[#EAF3FF] px-1.5 py-0.5 align-middle text-[11px] font-medium text-[#2F6FEB]" title="Worked out automatically from the items">{TXN_LABEL[txn]}</span>}</h3><ClearBtn onClick={() => { setItems([]); focusSoon(refP) }} /></div>
                  <div className="min-h-[120px] flex-1 overflow-auto rounded-md">
                    <table className="w-full text-[12.5px]">
                      <thead className="sticky top-0 bg-[#F5F7FA]"><tr className="text-left text-[11.5px] font-semibold text-gray-700"><th className="w-6 px-1.5 py-1.5">#</th><th className="px-1.5">{multi ? 'Item' : 'Product'}</th><th className="px-1.5">Qty</th><th className="px-1.5 text-right">Price</th><th className="px-1.5 text-right">Total</th><th className="w-7" /></tr></thead>
                      <tbody>
                        {items.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[12px] text-gray-400">No items yet</td></tr>}
                        {items.map((it, i) => { const t = typeOfItem(it), ln = calc.lines[i], nc = it.charge && it.charge !== 'charged'; return (
                          <React.Fragment key={it.key}>
                          <tr className="border-b border-gray-50 align-middle transition hover:bg-[#FFFAF4]">
                            <td className="px-1.5 py-1.5 text-gray-500">{i + 1}</td>
                            <td className="px-1.5 py-1.5 leading-tight">{it.name}{it.size && <span className="text-gray-500"> ({it.size})</span>}{it.unlisted && <em className="ml-1 rounded bg-orange-50 px-1 text-[10px] not-italic text-orange-600">unlisted</em>}{multi && <em className={`ml-1.5 rounded px-1 text-[10px] not-italic ${TYPE_TAG[t]}`}>{TYPE_LABEL[t]}</em>}{nc && <em className="ml-1 rounded bg-gray-100 px-1 text-[10px] not-italic text-gray-600">{it.charge === 'included' ? 'included' : 'not charged'}</em>}{it.description && <div className="text-[11px] text-gray-400">{it.description}</div>}</td>
                            <td className="px-1.5">{qtyText(it)}</td>
                            <td className="px-1.5 text-right">{nc ? '—' : rupee(it.price)}</td><td className="px-1.5 text-right font-medium">{nc ? '—' : <>{ln.discount > 0 && <span className="mr-1 text-[10.5px] font-normal text-gray-400 line-through">{rupee(ln.gross)}</span>}{rupee(ln.total)}</>}</td>
                            <td className="whitespace-nowrap"><button type="button" aria-label={`Edit ${it.name}`} onClick={() => setEditKey((k) => (k === it.key ? null : it.key))} className={`rounded p-1 transition hover:bg-gray-100 ${editKey === it.key ? 'text-orange-600' : 'text-gray-500'}`}><Pencil size={14} /></button><button type="button" aria-label={`Remove ${it.name}`} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} className="rounded p-1 text-red-500 transition hover:bg-red-50"><Trash2 size={14} /></button></td>
                          </tr>
                          {editKey === it.key && (
                            <tr className="border-b border-gray-100 bg-[#FFFAF4]"><td colSpan={6} className="px-2 py-2">
                              <div className="flex flex-wrap items-end gap-2 text-[12px]">
                                <label className="w-[70px]">Qty<input aria-label="Edit quantity" value={it.qty} inputMode="decimal" onChange={(e) => { const v = Number(e.target.value.replace(/[^0-9.]/g, '')); patchItem(it.key, { qty: v > 0 ? v : 0 }) }} className="mt-0.5 h-8 w-full rounded-md border border-gray-200 px-2 text-[12.5px] outline-none focus:border-orange-400" /></label>
                                {(t !== 'product' || caps.editRate || it.unlisted) && !nc && <label className="w-[84px]">Rate ₹<input aria-label="Edit rate" value={it.price} inputMode="decimal" onChange={(e) => patchItem(it.key, { price: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 })} className="mt-0.5 h-8 w-full rounded-md border border-gray-200 px-2 text-[12.5px] outline-none focus:border-orange-400" /></label>}
                                {caps.discount && !nc && <label className="w-[104px]">Discount<span className="mt-0.5 flex"><input aria-label="Edit item discount" value={it.discountValue ?? ''} inputMode="decimal" placeholder="0" onChange={(e) => patchItem(it.key, { discountValue: e.target.value.replace(/[^0-9.]/g, '') })} className="h-8 w-full min-w-0 rounded-l-md border border-gray-200 px-2 text-[12.5px] outline-none focus:border-orange-400" /><select aria-label="Item discount type" value={it.discountType || 'fixed'} onChange={(e) => patchItem(it.key, { discountType: e.target.value })} className="h-8 rounded-r-md border border-l-0 border-gray-200 bg-white px-1 text-[12px]"><option value="fixed">₹</option><option value="percent">%</option></select></span></label>}
                                {(t === 'material' || t === 'labour') && <label>Charge<select aria-label="Edit charge mode" value={it.charge || 'charged'} onChange={(e) => patchItem(it.key, { charge: e.target.value })} className="mt-0.5 block h-8 rounded-md border border-gray-200 bg-white px-1.5 text-[12px]">{['charged', 'included', 'internal'].filter((m) => t === 'material' || m !== 'internal').map((m) => <option key={m} value={m}>{CHARGE_LABEL[m]}</option>)}</select></label>}
                                <label className="min-w-[150px] flex-1">Description<input aria-label="Edit description" value={it.description || ''} maxLength={200} placeholder="optional" onChange={(e) => patchItem(it.key, { description: e.target.value })} className="mt-0.5 h-8 w-full rounded-md border border-gray-200 px-2 text-[12.5px] outline-none focus:border-orange-400" /></label>
                                <button type="button" onClick={() => setEditKey(null)} className="h-8 rounded-md bg-orange-500 px-3 text-[12px] font-medium text-white">Done</button>
                              </div>
                            </td></tr>)}
                          </React.Fragment>) })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="flex min-h-0 flex-col rounded-xl border border-[#E8EEF6] bg-white p-4 shadow-sm">
            <Step n={3} title="Payment" hint="(Enter = generate)" />
            <div className={`mt-3 grid gap-2 ${METHODS_ON.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {METHODS_ON.map(([m, Icon]) => (
                <button key={m} type="button" onClick={() => { setMethod(m); focusSoon(refR, true) }} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] transition ${method === m ? 'border-orange-400 bg-orange-50 font-medium text-orange-600' : 'border-gray-200 text-gray-700 hover:border-orange-300'}`}><Icon size={14} />{m === 'Udhar' ? tx('Udhar') : m}</button>))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3"><span className="text-[14px] font-semibold">Total Bill Amount</span><span className="text-[28px] font-bold leading-none text-[#1F6FEB]">{rupee(total)}</span></div>
            {(disc > 0 || taxAmount > 0) && <div className="mt-1 text-right text-[11.5px] text-gray-500">Subtotal {rupee(subtotal)}{disc > 0 && ` · Discount −${rupee(disc)}`}{taxAmount > 0 && ` · ${caps.taxName || 'Tax'}${caps.taxRate ? ` ${caps.taxRate}%` : ''} +${rupee(taxAmount)}`}</div>}
            {caps.discount && <div className="mt-1.5 flex items-center justify-between text-[12.5px] text-gray-700"><label htmlFor="bill-discount">Discount <span className="text-[11.5px] text-gray-400">(on bill)</span></label><span className="flex"><input id="bill-discount" value={discount} inputMode="decimal" placeholder="0" onChange={(e) => { discTouched.current = true; setDiscFromDefault(false); setDiscount(e.target.value.replace(/[^0-9.]/g, '')) }} className="h-8 w-[84px] rounded-l-md border border-gray-200 px-2 text-right text-[13px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /><select aria-label="Discount type" value={discountType} onChange={(e) => { discTouched.current = true; setDiscFromDefault(false); setDiscountType(e.target.value) }} className="h-8 rounded-r-md border border-l-0 border-gray-200 bg-white px-1.5 text-[12.5px]"><option value="fixed">₹</option><option value="percent">%</option></select></span></div>}
            {caps.discount && discFromDefault && Number(discount) > 0 && <div className="mt-0.5 text-right text-[11px] text-[#12A05C]">Default discount applied — change or clear it before generating</div>}
            {customer && (creditUsed > 0 || customer.udharDue > 0) && <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[11.5px]">{customer.udharDue > 0 ? <span className="text-[#E58A00]">Old {tx('udhar')} {rupee(customer.udharDue)}</span> : <span />}{creditUsed > 0 && <span className="text-[#2F6FEB]">{ADV_LABEL} −{rupee(creditUsed)} · Due now {rupee(dueNow)}</span>}</div>}
            {acctAfter != null && (acctBefore > 0 || acctAfter > 0) && <div className="mt-0.5 text-right text-[11.5px] text-gray-600">{acctBefore > 0 && <>Previous {tx('udhar')} {rupee(acctBefore)} · </>}This bill {rupee(total)} · Paid {rupee(Math.max(netPaid, 0))} → <b className="text-[#D92D20]">Remaining {tx('udhar')} {rupee(Math.max(acctAfter, 0))}</b></div>}
            {oldSettle > 0 && <div className="mt-0.5 text-right text-[11.5px] text-[#E8590C]">Old {tx('udhar')} paid {rupee(oldSettle)} · This bill paid {rupee(Math.min(billRecv, dueNow))}</div>}

            {method !== 'Udhar' && caps.partialPayment !== false && <div className="mt-2 text-right"><button type="button" onClick={() => setSplitOn((o) => !o)} className="text-[12px] font-medium text-[#2F6FEB] hover:underline">{splitOn ? 'Single payment' : 'Split payment'}</button></div>}
            {splitOn && method !== 'Udhar' && <div className="mt-2 grid grid-cols-3 gap-2" data-split>{[['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']].map(([k, l]) => <label key={k} className="text-[12px] text-gray-600">{l}<input aria-label={`${l} amount`} value={splitAmts[k]} inputMode="decimal" placeholder="0" onChange={(e) => setSplitAmts((a) => ({ ...a, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} className="mt-0.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-[14px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>)}<div className="col-span-3 text-right text-[12px] text-gray-500">Received {rupee(splitSum)}{balance > 0 ? ` · ${rupee(balance)} due` : ''}</div></div>}
            <div className={`mt-3 ${splitOn && method !== 'Udhar' ? 'hidden' : ''}`}>
              <label className="text-[12.5px] text-gray-800">
                Amount Received 
                <span className="text-[11.5px] text-gray-400">(F3)</span>
                  </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <div className="relative w-[130px]"><input ref={refR} value={recv ?? String(received)} inputMode="decimal" aria-label="Amount received" onChange={(e) => { setOldPay(null); setRecv(e.target.value.replace(/[^0-9.]/g, '')) }} onFocus={(e) => e.target.select()} onKeyDown={onRecvKey}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-3 pr-7 text-[17px] outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /><span className="absolute right-2.5 top-[9px] text-[15px] text-gray-500">₹</span></div>
                {recvChips.map((v) => <button key={v} type="button" onClick={() => { setOldPay(null); setRecv(String(v)); focusSoon(refR, true) }} className={chip(received === v)}>{rupee(v)}</button>)}
                {udharPend > 0
                  ? <button type="button" onClick={toggleOldUdhar} title={`${tx('Udhar')} pending ${rupee(udharPend)} — add it to Amount Received`} className={`h-8 rounded-md border px-2.5 text-[12.5px] font-medium transition ${oldSettle > 0 ? 'border-red-500 bg-red-500 text-white' : 'border-red-300 bg-orange-50 text-red-600 hover:bg-orange-100'}`}>+{rupee(udharPend)}</button>
                  : advCap > 0
                    ? <button type="button" onClick={toggleAdvance} title={`Pay from Advance Balance (${rupee(customer.credit)} available)`} className={`h-8 rounded-md border px-2.5 text-[12.5px] font-medium transition ${advOn ? 'border-[#2F6FEB] bg-[#2F6FEB] text-white' : 'border-[#BBD2FA] bg-[#E6F0FE] text-[#2F6FEB] hover:bg-[#D6E6FD]'}`}>-{rupee(advCap)}</button>
                    : null}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
              {balance > 0 ? (
                <div><div className="mb-1 text-[12.5px] text-gray-800">{tx('To Udhar')}</div><div className="grid h-10 place-items-center rounded-lg bg-[#FFF1DC] text-[19px] font-semibold text-[#E58A00]">{rupee(balance)}</div></div>
              ) : (
                <div><div className="mb-1 text-[12.5px] text-gray-800">Return Amount</div><div className="grid h-10 place-items-center rounded-lg bg-[#E8F7EF] text-[19px] font-semibold text-[#12A05C]">{rupee(change)}</div></div>)}
              <div>
                <div className="mb-1 text-[12.5px] text-gray-800">Returned by Seller <span className="text-[11px] text-gray-400">(Optional)</span></div>
                {balance > 0 || (change === 0 && !(udharPend > 0 && (plainChange > 0 || compOn))) ? <div className="pt-2 text-[11.5px] text-gray-400">{balance > 0 ? 'Not needed for udhar' : 'No change to return'}</div> : (
                  <div className="flex flex-wrap gap-1.5">
                    {change > 0 && retChips.map((v, i) => <button key={v} type="button" onClick={() => setRetMode(i === 0 ? 'auto' : v)} className={chip((i === 0 && retMode === 'auto') || retMode === v)}>{i === 0 ? rupee(v) : 'Keep as advance'}</button>)}
                    {change > 0 && <button type="button" onClick={() => setRetMode('custom')} className={chip(retMode === 'custom')}>Custom</button>}
                    {udharPend > 0 && <button type="button" aria-pressed={compOn} onClick={() => setCompFor(compOn ? null : customer.id)} title={compOn ? 'Compensation is ON — tap to go back to the normal Return Amount' : `Use the change to pay ${customer?.name || 'the customer'}’s old ${tx('udhar')} (${rupee(udharPend)}) instead of returning it`} className={`h-8 rounded-md border px-2.5 text-[12.5px] font-medium transition ${compOn ? 'border-red-500 bg-red-500 text-white' : 'border-red-300 bg-orange-50 text-red-600 hover:bg-orange-100'}`}>Compensate</button>}
                    {compOn && <span className="basis-full text-[11px] text-[#E8590C]">Compensate ON — {rupee(oldSettle - oldBtn)} of the change pays old {tx('udhar')}{acctAfter > 0 ? ` · ${tx('Udhar')} left ${rupee(acctAfter)}` : ''}. Tap Compensate again for the normal Return Amount.</span>}
                    {keptCredit > 0 && <span className="basis-full text-[11px] text-[#2F6FEB]">{rupee(keptCredit)} will be added to {customer ? `${customer.name}’s` : 'customer'} Advance Balance</span>}
                    {retMode === 'custom' && change > 0 && <input autoFocus value={retCustom} inputMode="decimal" placeholder="₹" onChange={(e) => setRetCustom(e.target.value.replace(/[^0-9.]/g, ''))} className="h-8 w-[84px] rounded-md border border-orange-300 px-2 text-[13px] outline-none focus:ring-2 focus:ring-orange-100" />}
                  </div>)}
              </div>
            </div>

            <div className="mt-3"><label className="text-[12.5px] text-gray-800">Notes <span className="text-[11.5px] text-gray-400">(Optional)</span></label>
              <input ref={refN} value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), generate())} placeholder="Add a note for this bill…" maxLength={300} className={`${inp} mt-1.5 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100`} /></div>

            <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
              <button type="button" onClick={saveDraft} disabled={busy} className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#D9D2F7] bg-[#FAF8FF] text-[13px] font-medium text-[#6D5BD0] transition hover:bg-[#F1EDFD] disabled:opacity-60"><Save size={15} />Save as Draft</button>
              <div className="col-span-2 sm:col-span-1"><BillActions size="sm" getDoc={async () => liveDoc()} onError={(m) => say('err', m)} /></div>
              <button type="button" onClick={generate} disabled={busy} className="col-span-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#12A05C] text-[15px] font-medium text-white shadow-sm transition hover:bg-[#0E8A4E] disabled:opacity-60"><FileText size={18} />{busy ? 'Saving…' : 'Generate Bill (Enter)'}</button>
            </div>
          </section>
        </div>
        <button type="button" onClick={() => document.getElementById('recent-bills')?.scrollIntoView({ behavior: 'smooth' })} className="mx-auto flex shrink-0 items-center gap-1 text-[11.5px] text-gray-400 transition hover:text-orange-500"><ChevronDown size={14} />Scroll for Recent Bills</button>
      </div>

      {/* ── screen 2: recent bills (below the fold) ── */}
      <section id="recent-bills" className="mt-4 scroll-mt-20 rounded-xl border border-[#E8EEF6] bg-white p-5 shadow-sm xl:min-h-[calc(100vh-130px)]">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[18px] font-semibold text-gray-900">Recent Bills</h2><button type="button" onClick={() => navigate('/analytics/orders')} className="text-[13px] font-medium text-[#2F6FEB] hover:underline">View All</button></div>
        {drafts.length > 0 && (
          <div className="mb-4 rounded-xl border border-[#E6E0FA] bg-[#FAF8FF] p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-[#6D5BD0]"><FileText size={14} />Drafts <span className="text-[12px] font-normal text-gray-500">({drafts.length}) · latest first</span></div>
            <ul className="divide-y divide-[#EEEAFB]">{drafts.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                <span className="flex-1 leading-tight"><CustomerLink id={d.customerId} className="font-medium">{d.customerName}</CustomerLink><span className="block text-[11px] text-gray-400">{d.itemCount} item{d.itemCount === 1 ? '' : 's'} · {time(d.updatedAt)}</span></span>
                <span className="font-medium">{rupee(d.total)}</span>
                <button type="button" onClick={() => resumeDraft(d.id)} className="rounded-md bg-[#6D5BD0] px-3 py-1 text-[12px] font-medium text-white transition hover:bg-[#5B49BD]">Resume</button>
                <button type="button" aria-label="Delete draft" onClick={() => removeDraft(d.id)} className="rounded p-1 text-red-500 transition hover:bg-red-50"><Trash2 size={14} /></button>
              </li>))}</ul>
            {drafts.length > 5 && <button type="button" onClick={() => setDraftsOpen(true)} className="mt-1 text-[12px] text-[#6D5BD0] underline">Show all {drafts.length}</button>}
          </div>)}
        {recent.loading && !recent.data ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}</div>
          : recent.error ? <div className="text-sm text-red-600">{recent.error} <button type="button" className="underline" onClick={recent.reload}>Retry</button></div>
          : !recent.data?.length ? <div className="py-10 text-center text-[13px] text-gray-400">No bills yet — your first bill will show up here</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-[13px]">
              <thead className="bg-[#F5F7FA]"><tr className="text-left text-[12px] font-semibold text-gray-700"><th className="px-3 py-2">Bill ID</th><th>{tx('Customer')}</th><th className="text-center">Amount</th><th className="text-center">Payment</th><th className="text-center">Status</th><th className="text-center">Actions</th></tr></thead>
              <tbody>{recent.data.map((r) => (
                <tr key={r.billId} onClick={() => openDetail(r.billId)} title="Open bill details" className="cursor-pointer border-b border-gray-50 transition hover:bg-[#FFFAF4]">
                  <td className="px-3 py-2.5 leading-tight"><span className="font-medium">{r.id}</span><span className="block text-[11px] text-gray-400">{time(r.time)}{multi && ` · ${r.typeLabel || TXN_LABEL[r.transactionType] || 'Sale'}`}</span></td><td><CustomerLink id={r.customerId} className="font-medium">{r.customer}</CustomerLink></td><td className="text-center">{rupee(r.amount)}</td>
                  <td className="text-center"><span className={`inline-block min-w-[64px] rounded-md px-2.5 py-0.5 text-[12px] font-medium ${payBadge[r.payment] || payBadge.Cash}`}>{r.payment}</span></td>
                  <td className="text-center"><StatusPill s={r.status} /></td>
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5"><ShareMenu label="Share" getDoc={() => call('get', `/api/seller/billing/bills/${r.billId}/document`)} onError={(m) => say('err', m)} className="flex items-center gap-1 rounded-md bg-[#EAF3FF] px-3 py-1 text-[12px] font-medium text-[#2F6FEB] transition hover:bg-[#d9eaff] disabled:opacity-60" />
                      <button type="button" onClick={() => openSaved(r.billId)} className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1 text-[12px] text-gray-700 transition hover:border-orange-300"><Printer size={12} />Print</button></span>
                  </td></tr>))}</tbody>
            </table></div>)}
      </section>

      {optionsOpen && <BillingOptions cfg={cfg} onClose={() => setOptionsOpen(false)} onSaved={(c) => { setCfg(c); applyDefaultDiscount(c); setMode((m) => (c.lineTypes.some((t) => t.type === m) ? m : c.lineTypes[0].type)); if (c.capabilities.services || c.capabilities.labour) loadServices(); setOptionsOpen(false) }} />}
      {preview && <BillPreview bill={preview} onClose={() => setPreview(null)} onSave={saveFromPreview} />}
      {draftsOpen && (
        <Modal title={`Drafts (${drafts.length})`} onClose={() => setDraftsOpen(false)}>
          {drafts.length === 0 ? <p className="py-8 text-center text-[13px] text-gray-400">No drafts</p> : (
            <ul className="divide-y divide-gray-100">{drafts.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="flex-1 leading-tight"><span className="block font-medium">{d.customerName}</span><span className="text-[11.5px] text-gray-400">{d.itemCount} item{d.itemCount === 1 ? '' : 's'} · {time(d.updatedAt)}</span></span>
                <span className="font-semibold">{rupee(d.total)}</span>
                <button type="button" onClick={() => resumeDraft(d.id)} className="rounded-md bg-[#6D5BD0] px-3 py-1 text-[12px] font-medium text-white">Resume</button>
                <button type="button" aria-label="Delete draft" onClick={() => removeDraft(d.id)} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
              </li>))}</ul>)}
        </Modal>)}
      {addOpen && <AddCustomer init={addOpen} onClose={() => { setAddOpen(null); focusSoon(refC) }} onDone={(c) => { setAddOpen(null); setCustomer(c); setCq(''); setCOpen(false); focusSoon(refP) }} />}
      {detail && (
        <Modal title={detail.id ? `Bill ${detail.id}` : 'Bill details'} onClose={() => setDetail(null)} wide>
          {detail.loading ? <div className="h-32 animate-pulse rounded-xl bg-gray-100" /> : detail.error ? <p className="text-sm text-red-600">{detail.error}</p> : (
            <div className="text-[13.5px]">
              <div className="mb-3 flex flex-wrap justify-between gap-1 text-gray-600"><span><CustomerLink id={detail.customerId} className="font-medium text-gray-800">{detail.customer}</CustomerLink>{detail.phone ? ` · ${detail.phone}` : ''}</span><span>{new Date(detail.time).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}{detail.transactionType && <em className="ml-2 rounded bg-[#EAF3FF] px-1.5 py-0.5 text-[11px] font-medium not-italic text-[#2F6FEB]">{TXN_LABEL[detail.transactionType]}</em>}</span></div>
              {detail.context?.length > 0 && <div className="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-gray-600">{detail.context.map((c) => <span key={c.key}>{c.label}: <b className="font-medium text-gray-800">{c.value}</b></span>)}</div>}
              <div className="overflow-x-auto">
                {['product', 'service', 'material', 'labour', 'other'].map((k) => { const rows = detail.lines.filter((l) => (l.type || 'product') === k); if (!rows.length) return null; return (
                  <div key={k} className="mb-2"><div className="px-2 pt-1 text-[11px] font-semibold tracking-wide text-[#2F6FEB]">{SECTION_TITLE[k]}</div>
                    <table className="w-full"><thead className="bg-[#F5F7FA] text-left text-[12px]"><tr><th className="px-2 py-1.5">Item</th><th>Qty</th><th className="text-right">Rate</th><th className="text-right">Disc.</th><th className="px-2 text-right">Total</th></tr></thead>
                      <tbody>{rows.map((l, i) => { const nc = l.charge && l.charge !== 'charged'; return <tr key={i} className="border-b border-gray-50 align-top"><td className="px-2 py-1.5">{l.name}{nc && <em className="ml-1.5 rounded bg-gray-100 px-1 text-[10px] not-italic text-gray-600">{l.charge === 'included' ? 'included in service' : 'not charged'}</em>}{l.description && <div className="text-[11.5px] text-gray-400">{l.description}</div>}</td><td className="whitespace-nowrap">{l.qty}{l.unit ? ` ${l.unit}` : ''}</td><td className="text-right">{nc ? '—' : rupee(l.price)}</td><td className="text-right">{l.discount > 0 ? `−${rupee(l.discount)}` : '—'}</td><td className="px-2 text-right font-medium">{nc ? '₹0' : rupee(l.total)}</td></tr> })}</tbody></table></div>) })}
              </div>
              <dl className="mt-3 space-y-0.5 text-right text-gray-700">
                {(detail.discount > 0 || detail.tax > 0) && <div>Subtotal {rupee(detail.subtotal ?? detail.total + detail.discount - detail.tax)}</div>}
                {detail.discount > 0 && <div>Discount −{rupee(detail.discount)}</div>}
                {detail.tax > 0 && <div>{detail.taxName || 'Tax'}{detail.taxRate ? ` (${detail.taxRate}%)` : ''} +{rupee(detail.tax)}</div>}
                <div className="text-[15px] font-semibold text-gray-900">Grand Total {rupee(detail.total)}</div>
                <div>Amount Paid {rupee(detail.paid)}{detail.due > 0 && <b className="ml-3 text-[#D92D20]">Outstanding {rupee(detail.due)}</b>}</div>
                <div className="text-[12.5px] text-gray-500">Payment: {detail.payments?.length ? [...new Set(detail.payments.filter((p) => p.method !== 'advance').map((p) => ({ cash: 'Cash', upi: 'UPI', card: 'Card' }[p.method] || p.method)))].join(' + ') || detail.payment : detail.payment} · Status: <b className="text-gray-800">{detail.paymentStatus || detail.status}</b></div>
                {detail.payments?.length > 1 && <div className="text-[12px] text-gray-500">{detail.payments.map((p, i) => <span key={i} className="ml-2">{{ cash: 'Cash', upi: 'UPI', card: 'Card', advance: ADV_LABEL }[p.method] || p.method} {rupee(p.amount)}</span>)}</div>}
              </dl>
              <div className="mt-4 flex justify-end"><BillActions getDoc={() => call('get', `/api/seller/billing/bills/${detail.billId}/document`)} onError={(m) => say('err', m)} /></div>
            </div>)}
        </Modal>)}
    </div>
  )
}

function AddCustomer({ init, onClose, onDone }) {
  const { tx } = useBusiness()
  const [f, setF] = useState({ name: init?.name || '', phone: init?.phone || '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const fromGlobal = !!init?.globalUserId // exact number found in the global directory → confirm / edit the name, then save to this shop
  const save = async () => { setBusy(true); setErr(''); try { onDone(await call('post', fromGlobal ? '/api/seller/billing/customers/select' : '/api/seller/billing/customers', fromGlobal ? { ...f, globalUserId: init.globalUserId } : f)) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <Modal title={tx(fromGlobal ? 'Confirm Customer' : 'Add Customer')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-3">
        <Field label="Name" autoFocus={!f.name} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        {fromGlobal && <p className="rounded-lg bg-[#EEF2FF] px-3 py-2 text-[12.5px] text-[#4F46E5]">This number is already known on Loco. The most-used name is filled in — change it if your customer goes by another name.</p>}
        <Field label="Mobile number (10 digits)" autoFocus={!!f.name} readOnly={fromGlobal} inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-gray-200 px-4 text-[14px]">Cancel</button><button type="submit" disabled={busy || !f.name.trim()} className="h-10 rounded-xl bg-orange-500 px-5 text-[14px] font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save & use'}</button></div>
      </form>
    </Modal>
  )
}

// Bill preview · Save · [80mm Print] [A4 Print] [Share]. A saved bill is read back from the server's customer-safe document.
function BillPreview({ bill: p, onClose, onSave }) {
  const { tx } = useBusiness()
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(''); const [fetched, setFetched] = useState(null)
  useEffect(() => { if (p.saved && p.billId) call('get', `/api/seller/billing/bills/${p.billId}/document`).then(setFetched).catch((e) => setErr(e.message)) }, [p.saved, p.billId])
  const d = p.saved ? fetched : p.doc
  const save = async () => { setSaving(true); setErr(''); try { await onSave() } catch (e) { setErr(e.message) } finally { setSaving(false) } }
  if (!d) return <Modal title="Bill" onClose={onClose}>{err ? <p className="text-sm text-red-600">{err}</p> : <div className="h-32 animate-pulse rounded-xl bg-gray-100" />}</Modal>
  const T = d.totals, q = (i) => `${i.qty}${i.unit ? ' ' + i.unit : ''}`
  return (
    <Modal title={p.saved ? `Bill #${String(d.billNo).replace(/^#/, '')}` : 'Bill preview'} onClose={onClose} wide>
      <div className="text-[13.5px]">
        <div className="text-center"><div className="text-[16px] font-semibold">{d.business.name || 'Shop'}</div><div className="text-[12px] text-gray-500">{new Date(d.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div>
        <div className="mt-3 flex justify-between border-y border-dashed border-gray-200 py-2"><span className="text-gray-500">{tx('Customer')}</span><span className="font-medium">{d.customer.name}{d.customer.phone ? ` · ${d.customer.phone}` : ''}</span></div>
        {d.context.length > 0 && <div className="mt-2 text-[12.5px] text-gray-600">{d.context.map((c) => <div key={c.label} className="flex justify-between"><span>{c.label}</span><span className="font-medium text-gray-800">{c.value}</span></div>)}</div>}
        <div className="overflow-x-auto">{d.sections.map((s) => (
          <div key={s.key} className="mt-2"><div className="text-[11px] font-semibold tracking-wide text-[#2F6FEB]">{s.title}</div>
            {s.items.map((i, k) => <div key={k} className="flex items-start justify-between gap-3 border-b border-gray-50 py-1"><span className="min-w-0"><span className="block truncate">{i.name}</span><span className="block text-[11.5px] text-gray-400">{i.included ? 'included in service' : `${q(i)} × ${rupee(i.rate)}${i.discount > 0 ? ` − ${rupee(i.discount)}` : ''}`}{i.description ? ` · ${i.description}` : ''}</span></span><span className="whitespace-nowrap font-medium">{i.included ? '—' : rupee(i.total)}</span></div>)}
          </div>))}</div>
        <div className="mt-3 space-y-0.5 text-[12.5px] text-gray-600">
          <div className="flex justify-between"><span>Subtotal</span><span>{rupee(T.subtotal)}</span></div>
          {T.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{rupee(T.discount)}</span></div>}
          {T.tax && <div className="flex justify-between"><span>{T.tax.name}{T.tax.rate ? ` (${T.tax.rate}%)` : ''}</span><span>{rupee(T.tax.amount)}</span></div>}
        </div>
        <div className="mt-2 flex items-center justify-between text-[16px] font-bold"><span>Total</span><span>{rupee(T.total)}</span></div>
        <div className="mt-1 flex justify-between text-[12.5px] text-gray-600"><span>Paid</span><span className="font-medium">{rupee(T.paid)}</span></div>
        {T.due > 0 && <div className="flex justify-between text-[12.5px] font-medium text-[#D92D20]"><span>Due</span><span>{rupee(T.due)}</span></div>}
        <div className="mt-1 flex justify-between text-[12.5px] text-gray-600"><span>Payment</span><span className="font-medium">{d.payment.method} · {d.payment.status}</span></div>
        {d.account && (() => { const a = accountBlock(d); return <div className="mt-3 rounded-lg border border-[#E6E0FA] bg-[#FAF8FF] p-2.5 text-[12.5px]"><div className="mb-1 text-[11px] font-semibold tracking-wide text-[#6D5BD0]">{a.title}</div>{a.rows.map(([l, v, b]) => <div key={l} className={`flex justify-between ${b ? 'font-semibold text-[#D92D20]' : 'text-gray-600'}`}><span>{l}</span><span>{v}</span></div>)}</div> })()}
        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600">{err}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <BillActions getDoc={async () => (p.saved ? fetched || call('get', `/api/seller/billing/bills/${p.billId}/document`) : p.doc)} onError={setErr} />
          {p.saved
            ? <span className="flex h-10 items-center gap-1.5 rounded-lg bg-[#E3F7EC] px-4 text-[13px] font-medium text-[#12A05C]">✓ Saved</span>
            : <button type="button" onClick={save} disabled={saving} className="flex h-10 items-center gap-1.5 rounded-lg bg-[#12A05C] px-4 text-[13px] font-medium text-white transition hover:bg-[#0E8A4E] disabled:opacity-60"><Save size={15} />{saving ? 'Saving…' : 'Save'}</button>}
        </div>
        {!p.saved && <p className="mt-2 text-right text-[11.5px] text-gray-400">Save records the bill (stock, udhar & reports update). You can share before or after saving.</p>}
      </div>
    </Modal>
  )
}

// Service · Labour · Other charge entry. Which fields show follows the pricing model: fixed (rate only) · per unit (qty × rate) · hourly (hours × rate).
function ChargeRow({ type, catalog, focusRef, onAdd, onErr, onRemoveCatalog }) {
  const isOther = type === 'other'
  const [name, setName] = useState(''); const [open, setOpen] = useState(false); const [idx, setIdx] = useState(-1); const [pick, setPick] = useState(null)
  const [pricing, setPricing] = useState(type === 'labour' ? 'hourly' : 'fixed'); const [qty, setQty] = useState('1'); const [unit, setUnit] = useState('unit'); const [rate, setRate] = useState(''); const [charge, setCharge] = useState('charged')
  const rn = useRef(), rq = useRef(), rr = useRef()
  useEffect(() => { focusRef.current = () => { rn.current?.focus(); setOpen(true) }; return () => { focusRef.current = null } }, [focusRef])
  useEffect(() => { setTimeout(() => rn.current?.focus(), 0) }, [])
  const q = name.trim().toLowerCase()
  const list = (q ? catalog.filter((c) => c.name.toLowerCase().includes(q)) : catalog).slice(0, 30)
  const label = type === 'labour' ? 'Labour' : type === 'service' ? 'Service' : 'Charge'
  const choose = (c) => { setPick(c); setName(c.name); setPricing(c.pricing === 'custom' ? 'fixed' : c.pricing); setUnit(c.unit || 'unit'); setRate(c.rate ? String(c.rate) : ''); setQty('1'); setOpen(false); setTimeout(() => (c.pricing === 'fixed' || c.pricing === 'custom' ? rr : rq).current?.focus(), 0) }
  const add = () => {
    const n = name.trim(), r = Number(rate), qn = isOther || pricing === 'fixed' ? 1 : Number(qty)
    if (!n) { onErr(`Enter a ${label.toLowerCase()} name`); return rn.current?.focus() }
    if (!(qn > 0)) { onErr('Enter a valid quantity'); return rq.current?.focus() }
    if (charge === 'charged' && !(r > 0)) { onErr('Enter a rate'); return rr.current?.focus() }
    onAdd({ charge, type, name: n, qty: qn, unit: pricing === 'hourly' ? 'hr' : pricing === 'per_unit' ? unit || 'unit' : '', rate: charge === 'charged' ? r : 0, pricing: isOther ? 'fixed' : pricing, serviceId: pick && pick.name.toLowerCase() === n.toLowerCase() ? pick.id : null })
    setName(''); setPick(null); setRate(''); setQty('1'); setCharge('charged'); setOpen(false); setIdx(-1)
  }
  const onNameKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx((i) => Math.min(i + 1, list.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && idx >= 0 && list[idx]) choose(list[idx]); else if (name.trim()) { setOpen(false); (isOther || pricing === 'fixed' ? rr : rq).current?.focus() } }
  }
  const onFieldKey = (next) => (e) => { if (e.key === 'Enter') { e.preventDefault(); next ? next.current?.focus() : add() } }
  const f = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <input ref={rn} value={name} autoComplete="off" aria-label={label} placeholder={isOther ? 'Charge name (e.g. Cleaning)' : `${label} name${catalog.length ? ' or press ↓' : ''}`}
            onChange={(e) => { setName(e.target.value); setPick(null); setOpen(true); setIdx(-1) }} onFocus={() => !isOther && setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onNameKey} className={`${f} w-full border-orange-300`} />
          {open && !isOther && list.length > 0 && (
            <ul className="absolute left-0 top-[calc(100%+3px)] z-30 max-h-[240px] w-[340px] max-w-[88vw] overflow-auto rounded-lg border border-gray-100 bg-white py-1 shadow-xl" role="listbox">
              {list.map((c, i) => (
                <li key={c.id} role="option" aria-selected={i === idx} onMouseDown={(e) => { e.preventDefault(); choose(c) }} onMouseEnter={() => setIdx(i)} className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] ${i === idx ? 'bg-[#FFF4E8]' : ''}`}>
                  <span className="flex-1 truncate">{c.name}</span><span className="text-gray-500">{c.rate ? rupee(c.rate) : ''}{c.pricing === 'hourly' ? '/hr' : c.pricing === 'per_unit' ? `/${c.unit || 'unit'}` : ''}</span>
                  <button type="button" tabIndex={-1} aria-label={`Remove ${c.name} from saved list`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveCatalog(c.id) }} className="rounded p-0.5 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                </li>))}
            </ul>)}
        </div>
        {!isOther && (
          <div className="w-[104px]"><label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">Charged</label>
            <select value={pricing} aria-label="Pricing" onChange={(e) => setPricing(e.target.value)} className={`${f} w-full px-2`}><option value="fixed">Fixed</option><option value="per_unit">Per unit</option><option value="hourly">Per hour</option></select></div>)}
        {!isOther && pricing !== 'fixed' && (
          <div className="w-[76px]"><label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">{pricing === 'hourly' ? 'Hours' : 'Qty'}</label>
            <input ref={rq} value={qty} inputMode="decimal" aria-label="Quantity" onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} onFocus={(e) => e.target.select()} onKeyDown={onFieldKey(rr)} className={`${f} w-full`} /></div>)}
        {!isOther && pricing === 'per_unit' && (
          <div className="w-[70px]"><label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">Unit</label>
            <input value={unit} maxLength={12} aria-label="Unit" onChange={(e) => setUnit(e.target.value)} className={`${f} w-full`} /></div>)}
        {type === 'labour' && <div className="w-[132px]"><label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">Charge customer?</label><select value={charge} aria-label="Charge" onChange={(e) => setCharge(e.target.value)} className={`${f} w-full px-2`}><option value="charged">Yes — bill it</option><option value="included">Included in service</option></select></div>}
        {charge === 'charged' && <div className="w-[92px]"><label className="mb-0.5 block text-[11.5px] font-medium text-gray-600">{isOther ? 'Amount ₹' : pricing === 'fixed' ? 'Price ₹' : 'Rate ₹'}</label>
          <input ref={rr} value={rate} inputMode="decimal" aria-label="Rate" onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} onFocus={(e) => e.target.select()} onKeyDown={onFieldKey(null)} className={`${f} w-full`} /></div>}
        <button type="button" onClick={add} className="flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[12.5px] font-medium text-white transition hover:bg-orange-600"><Plus size={14} />Add (Enter)</button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{isOther ? 'A one-off charge on this bill (cleaning, visiting, delivery…).' : `Type a new ${label.toLowerCase()} and its rate — it is saved for next time. Pick “Per hour” or “Per unit” when the rate depends on quantity.`}<br />F1 customer · F2 item · F3 amount · F4 method · Ctrl+Enter bill</p>
    </div>
  )
}
