import React, { useEffect, useMemo, useState } from 'react'
import { Search, X, Plus, History, Check, PackagePlus } from 'lucide-react'
import { useSeller, call, State, DataTable, PageHead, Tabs, Btn, Pill, Modal, Field, when, day } from '../kit.jsx'
import { Card, Thumb, inr } from '../ui.jsx'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js'
import AddProductModal from '../AddProductModal.jsx'

const qty = (n) => +Number(n || 0).toFixed(3)
const money = (n) => '₹' + (+Number(n || 0).toFixed(2)).toLocaleString('en-IN')
const box = 'h-9 rounded-lg border border-gray-200 px-2 text-[14px] outline-none focus:border-[#1F6FEB]'
const numOnly = (e) => e.target.value.replace(/[^0-9.]/g, '')

// Wraps every match of `term` in <mark>.
function Highlight({ text, term }) {
  const t = (term || '').trim()
  if (t.length < 2 || !text) return <>{text}</>
  const parts = String(text).split(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
  return <>{parts.map((x, i) => (x.toLowerCase() === t.toLowerCase() ? <mark key={i} className="rounded bg-yellow-200 px-0.5 text-inherit">{x}</mark> : x))}</>
}

// Name that turns into an input on click (Enter / blur saves, Esc cancels).
function EditableName({ p, term, onSave }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(p.name)
  useEffect(() => setV(p.name), [p.name])
  const done = (save) => { setEdit(false); if (save && v.trim() && v.trim() !== p.name) onSave(p, { name: v.trim() }); else setV(p.name) }
  if (edit) return <input autoFocus value={v} maxLength={80} onChange={(e) => setV(e.target.value)} onBlur={() => done(true)} onKeyDown={(e) => (e.key === 'Enter' ? done(true) : e.key === 'Escape' && done(false))} className={`${box} w-[190px]`} aria-label="Product name" />
  return <button type="button" title="Click to rename" onClick={() => setEdit(true)} className="text-left font-medium text-gray-900 hover:text-[#1F6FEB]"><Highlight text={p.name} term={term} /></button>
}

// Price-style input: saves on blur / Enter only when the value really changed.
function MoneyInput({ value, onCommit, label, title }) {
  const [v, setV] = useState(String(value ?? ''))
  useEffect(() => setV(String(value ?? '')), [value])
  const commit = () => { const n = +v; if (v !== '' && n >= 0 && n !== value) onCommit(n); else setV(String(value ?? '')) }
  return <input value={v} inputMode="decimal" aria-label={label} title={title} onChange={(e) => setV(numOnly(e))} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={`${box} w-[84px]`} />
}

export default function InventoryPage() {
  const q = useSeller('/api/seller/products')
  const [tab, setTab] = useState('All')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [term, setTerm] = useState('')
  const [stockFor, setStockFor] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [adding, setAdding] = useState(false)
  const [hits, setHits] = useState({ q: '', results: [], total: 0, loading: false })

  const all = (q.data || []).filter((p) => p.listed !== false).sort((a, b) => a.stock - b.stock)
  const unlisted = (q.data || []).filter((p) => p.listed === false).sort((a, b) => new Date(b.lastBilledAt || 0) - new Date(a.lastBilledAt || 0))
  const low = (p) => p.stock <= (p.lowStockAt ?? 10)

  // ---- search: ≥2 chars, 300 ms debounce, max 10 results ----
  const live = term.trim()
  const dq = useDebouncedValue(live, 300)
  const searching = live.length >= 2
  useEffect(() => {
    if (dq.length < 2) return undefined
    let stale = false
    setHits((h) => ({ ...h, loading: true }))
    call('get', `/api/seller/inventory/search?q=${encodeURIComponent(dq)}&limit=10`)
      .then((d) => !stale && setHits({ q: dq, results: d.results, total: d.total, loading: false }))
      .catch((e) => !stale && (setHits((h) => ({ ...h, loading: false })), setErr(e.message)))
    return () => { stale = true }
  }, [dq])
  // Instant preview from the list we already hold, until the server answer for this exact text arrives.
  const local = useMemo(() => {
    const t = live.toLowerCase()
    return all.filter((p) => p.name.toLowerCase().includes(t) || (p.productCode || '').toLowerCase().includes(t)).slice(0, 10)
  }, [live, q.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const fresh = hits.q === live && !hits.loading
  const byId = new Map((q.data || []).map((p) => [p._id, p]))
  const found = fresh ? hits.results.map((r) => byId.get(r._id) || { ...r, _id: r._id }) : local
  const foundTotal = fresh ? hits.total : local.length

  const rows = searching ? found : all.filter((p) => tab === 'All' || (tab === 'Low stock' && low(p) && p.stock > 0) || (tab === 'Out of stock' && p.stock === 0))
  // Add Product form → update the table instantly from the API response (no page reload, no refetch)
  const onSaved = (r) => q.setData((list) => {
    const rows = list || []
    if (r.created) return [{ ...r.product, realizedProfit: 0, realizedRevenue: 0 }, ...rows]
    return rows.map((x) => (x._id === r.product._id ? { ...x, ...r.product, realizedProfit: x.realizedProfit, realizedRevenue: x.realizedRevenue } : x))
  })
  const patch = async (p, body) => {
    setErr(''); setNote('')
    try {
      await call('put', `/api/seller/products/${p._id}`, body)
      if (body.costPrice !== undefined) setNote(`Cost for "${p.name}" is now ${money(body.costPrice)} — it applies to NEW stock. Existing batches keep the cost they were bought at (see History).`)
      q.reload()
    } catch (e) { setErr(e.message) }
  }
  const stats = [['Total products', all.length], ['Low stock', all.filter((p) => low(p) && p.stock > 0).length], ['Out of stock', all.filter((p) => p.stock === 0).length], ['Stock value (batch cost)', inr(all.reduce((s, p) => s + (p.stockValue ?? p.stock * p.costPrice), 0))]]

  return (
    <>
      <PageHead title="Stock Management" sub="Search, edit prices, and track every purchase batch (oldest stock is sold first)">
        <Btn onClick={() => setAdding(true)}><PackagePlus size={17} />Add Product</Btn>
      </PageHead>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(([l, v]) => <Card key={l} className="p-4"><div className="text-[13px] text-gray-500">{l}</div><div className="text-[22px] font-semibold">{v}</div></Card>)}</div>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search product name or ID (e.g. sugar, A001) — type 2+ letters" aria-label="Search products" autoComplete="off" spellCheck={false}
          className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-11 text-[15px] outline-none focus:border-[#1F6FEB] focus:ring-2 focus:ring-[#1F6FEB]/15" />
        {term && <button type="button" onClick={() => setTerm('')} aria-label="Clear search" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X size={18} /></button>}
      </div>
      {searching && <div className="mb-3 text-[13px] text-gray-500">{hits.loading || !fresh ? 'Searching…' : foundTotal > found.length ? `Showing top ${found.length} of ${foundTotal} matches — keep typing to narrow down` : `${found.length} match${found.length === 1 ? '' : 'es'}`}</div>}

      {unlisted.length > 0 && !searching && <FromBilling rows={unlisted} onSaved={q.reload} onError={setErr} />}
      {!searching && <Tabs items={['All', 'Low stock', 'Out of stock']} value={tab} onChange={setTab} />}
      {err && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</div>}
      {note && <div className="mb-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{note}</div>}
      <State q={q} empty={q.data && !rows.length && (searching ? `No product matches "${live}"` : 'Nothing here — stock looks healthy')}>
        <DataTable rows={rows} rowKey={(r) => r._id} cols={[
          { h: 'Product', cell: (r) => <span className="flex items-center gap-3"><Thumb src={r.imageUrl} icon={r.icon} size={34} /><span className="min-w-0"><EditableName p={r} term={searching ? live : ''} onSave={patch} /><span className="block text-[11.5px] tracking-wide text-gray-400"><Highlight text={r.productCode || '—'} term={searching ? live : ''} /></span></span></span> },
          { h: 'Stock', cell: (r) => <span className="font-medium">{qty(r.stock)} <span className="text-[12px] font-normal text-gray-400">{r.priceUnit || 'unit'}</span>{r.liveBatches > 1 && <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-normal text-gray-500" title="Purchase batches with stock left">{r.liveBatches} batches</span>}</span> },
          { h: 'Selling ₹', cell: (r) => <MoneyInput value={r.price} label="Selling price" title="Selling price (the latest; old bills keep theirs)" onCommit={(n) => n > 0 && patch(r, { price: n })} /> },
          { h: 'Cost ₹', cell: (r) => <MoneyInput value={r.costPrice} label="Cost price" title="Latest cost. Changing it adds a history entry; existing batches keep their own cost." onCommit={(n) => patch(r, { costPrice: n })} /> },
          { h: 'Status', cell: (r) => r.stock === 0 ? <Pill tone="red">Out of stock</Pill> : low(r) ? <Pill tone="amber">Low stock</Pill> : <Pill tone="green">In stock</Pill> },
          { h: 'Alert at', cell: (r) => <input type="number" min="0" defaultValue={r.lowStockAt ?? 10} onBlur={(e) => +e.target.value !== r.lowStockAt && patch(r, { lowStockAt: +e.target.value })} className={`${box} w-[68px]`} /> },
          { h: 'Batches', r: true, cell: (r) => <span className="inline-flex gap-1.5"><Btn variant="danger" className="!h-8 !px-3 !text-[13px]" onClick={() => setStockFor(r)}><Plus size={14} />Stock</Btn><Btn variant="ghost" className="!h-8 !px-3 !text-[13px]" onClick={() => setHistoryFor(r)}><History size={14} />History</Btn></span> },
        ]} />
      </State>
      {adding && <AddProductModal products={q.data || []} onClose={() => setAdding(false)} onSaved={onSaved} />}
      {stockFor && <AddStockModal p={stockFor} onClose={() => setStockFor(null)} onDone={() => { setStockFor(null); q.reload() }} />}
      {historyFor && <HistoryModal p={historyFor} onClose={() => { setHistoryFor(null); q.reload() }} />}
    </>
  )
}

// Restock = a NEW batch with its own cost. Old batches are never touched.
function AddStockModal({ p, onClose, onDone }) {
  const [n, setN] = useState('')
  const [cost, setCost] = useState(String(p.costPrice ?? ''))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    setBusy(true); setErr('')
    try { await call('post', `/api/seller/products/${p._id}/stock`, { quantity: +n, costPrice: +cost }); onDone() } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <Modal title={`Add stock — ${p.name}`} onClose={onClose}>
      <p className="mb-3 text-[13px] text-gray-500">This creates a <b>new batch</b>. Your existing {qty(p.stock)} {p.priceUnit || 'unit'} in stock keeps its old cost, and is sold first.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity received" inputMode="decimal" autoFocus value={n} onChange={(e) => setN(numOnly(e))} placeholder="e.g. 25" />
        <Field label={`Cost price (₹ per ${p.priceUnit || 'unit'})`} inputMode="decimal" value={cost} onChange={(e) => setCost(numOnly(e))} />
      </div>
      {+n > 0 && cost !== '' && <div className="mt-3 rounded-xl bg-gray-50 p-3 text-[13px] text-gray-600">New batch: <b>{qty(+n)}</b> × {money(+cost)} = {money(+n * +cost)} · total stock becomes <b>{qty(p.stock + +n)}</b></div>}
      {err && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={busy || !(+n > 0) || cost === ''} onClick={submit}>{busy ? 'Saving…' : 'Add batch'}</Btn></div>
    </Modal>
  )
}

// Batches oldest → newest, plus cost / price history. Editing an old batch never rewrites a bill.
function HistoryModal({ p, onClose }) {
  const h = useSeller(`/api/seller/products/${p._id}/history`)
  const [edit, setEdit] = useState(null) // { id, cost, qty, recalc }
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const tone = { full: 'blue', partial: 'amber', exhausted: 'gray' }
  const save = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const r = await call('patch', `/api/seller/products/${p._id}/batches/${edit.id}`, { costPrice: edit.cost === '' ? undefined : +edit.cost, quantity: edit.qty === '' ? undefined : +edit.qty, recalculate: edit.recalc })
      setMsg(r.salesUpdated ? `Saved. ${r.salesUpdated} past sale line(s) re-priced — profit reports now use the corrected cost.` : 'Saved. Existing bills were not changed.')
      setEdit(null); h.reload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const d = h.data
  return (
    <Modal title={`Stock history — ${p.name}${p.productCode ? ` (${p.productCode})` : ''}`} onClose={onClose} wide>
      <State q={h} rows={3}>
        {d && (
          <div className="space-y-5">
            <p className="text-[13px] text-gray-500">Oldest batch is sold first. In stock: <b>{qty(d.product.stock)}</b> · worth <b>{money(d.product.stockValue)}</b> at batch cost.</p>
            {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</div>}
            {msg && <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{msg}</div>}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead className="bg-gray-50 text-left text-[12px] font-semibold text-gray-700"><tr><th className="px-3 py-2">Added</th><th>Received</th><th>Sold</th><th>Left</th><th>Cost ₹</th><th>Status</th><th className="px-3 text-right">Edit</th></tr></thead>
                <tbody>
                  {d.batches.map((b) => (
                    <React.Fragment key={b.id}>
                      <tr className="border-t border-gray-50">
                        <td className="px-3 py-2">{day(b.addedAt)}{b.source !== 'restock' && <span className="ml-1 text-[11px] text-gray-400">({b.source})</span>}</td>
                        <td>{qty(b.quantity)}</td><td>{qty(b.soldQty)}{b.adjustedQty > 0 && <span className="text-[11px] text-gray-400"> +{qty(b.adjustedQty)} adj.</span>}</td><td className="font-medium">{qty(b.remainingQty)}</td><td>{money(b.costPrice)}</td>
                        <td><Pill tone={tone[b.status]}>{b.status === 'exhausted' ? 'Exhausted' : b.status === 'partial' ? 'Partly used' : 'Unused'}</Pill>{b.id === d.nextBatchId && <span className="ml-1.5 text-[11px] font-semibold text-[#0E9F6E]">▶ sells next</span>}</td>
                        <td className="px-3 text-right"><button type="button" className="text-[12.5px] font-medium text-[#1F6FEB] hover:underline" onClick={() => { setErr(''); setMsg(''); setEdit({ id: b.id, cost: String(b.costPrice), qty: String(b.quantity), recalc: false }) }}>Edit</button></td>
                      </tr>
                      {edit?.id === b.id && (
                        <tr className="bg-[#F8FAFF]"><td colSpan={7} className="px-3 py-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="text-[12px] text-gray-600">Cost ₹<input value={edit.cost} inputMode="decimal" onChange={(e) => setEdit({ ...edit, cost: numOnly(e) })} className={`${box} mt-1 block w-[100px]`} /></label>
                            <label className="text-[12px] text-gray-600">Quantity received<input value={edit.qty} inputMode="decimal" onChange={(e) => setEdit({ ...edit, qty: numOnly(e) })} className={`${box} mt-1 block w-[110px]`} /></label>
                            <label className="flex items-center gap-2 text-[12.5px] text-gray-700"><input type="checkbox" checked={edit.recalc} onChange={(e) => setEdit({ ...edit, recalc: e.target.checked })} />Also correct profit on past sales from this batch</label>
                            <Btn className="!h-9" disabled={busy} onClick={save}><Check size={15} />Save</Btn><Btn variant="ghost" className="!h-9" onClick={() => setEdit(null)}>Cancel</Btn>
                          </div>
                          <p className="mt-2 text-[11.5px] text-gray-500">Quantity can't go below {qty(b.quantity - b.remainingQty)} (already left this batch). Bills are never rewritten{edit.recalc ? ' — except their cost snapshot, as you ticked above' : ''}.</p>
                        </td></tr>
                      )}
                      {b.editLog.length > 0 && <tr><td colSpan={7} className="px-3 pb-2 text-[11.5px] text-gray-400">{b.editLog.map((e, i) => <span key={i} className="mr-3">✎ {e.field} {qty(e.from)} → {qty(e.to)} · {when(e.at)}{e.recalculated ? ' · past sales re-priced' : ''}</span>)}</td></tr>}
                    </React.Fragment>
                  ))}
                  {!d.batches.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No stock has been added yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <HistoryList title="Cost price history" rows={d.costHistory.map((x) => [x.at, money(x.costPrice)])} />
              <HistoryList title="Selling price history" rows={d.priceHistory.map((x) => [x.at, money(x.price)])} />
            </div>
          </div>
        )}
      </State>
    </Modal>
  )
}
const HistoryList = ({ title, rows }) => (
  <div><h4 className="mb-1.5 text-[13px] font-semibold text-gray-800">{title}</h4>
    {rows.length ? <ul className="space-y-1 text-[13px]">{rows.slice(0, 8).map(([at, v], i) => <li key={i} className="flex justify-between border-b border-gray-50 pb-1"><span className="text-gray-500">{when(at)}</span><span className="font-medium">{v}</span></li>)}</ul> : <p className="text-[13px] text-gray-400">No changes recorded yet.</p>}
  </div>
)

// "Products Added From Billing": items typed at the till that aren't in inventory yet.
function FromBilling({ rows, onSaved, onError }) {
  const save = async (p, body) => { try { await call('put', `/api/seller/products/${p._id}`, body); onSaved() } catch (e) { onError(e.message) } }
  return (
    <Card className="mb-5 overflow-hidden border-orange-200">
      <div className="flex items-center justify-between bg-orange-50 px-4 py-2.5"><h3 className="text-[14px] font-semibold text-gray-900">Products Added From Billing <span className="ml-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] text-white">{rows.length}</span></h3><span className="text-[11.5px] text-gray-500">Price them, add stock, then move to inventory</span></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-[#F5F9FF] text-left text-[11.5px] font-semibold text-gray-700"><tr><th className="px-3 py-2">Product</th><th>Added</th><th>Last used</th><th>💰 Selling ₹</th><th>📊 Market ₹</th><th>➕ Stock</th><th className="px-3 text-right">Inventory</th></tr></thead>
          <tbody>{rows.map((p) => <Row key={p._id + p.updatedAt} p={p} save={save} />)}</tbody>
        </table>
      </div>
    </Card>
  )
}
function Row({ p, save }) {
  const [add, setAdd] = useState('')
  const num = (e) => e.target.value.replace(/[^0-9.]/g, '')
  const box = 'h-8 w-[78px] rounded-md border border-gray-200 px-2 text-[13px] outline-none focus:border-orange-400'
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-[#FFFAF4]">
      <td className="px-3 py-2 font-medium">{p.icon || '🛒'} {p.name}</td>
      <td><span className="rounded-md bg-blue-50 px-2 py-0.5 text-[12px] text-blue-600">{p.billedCount || 0}×</span></td>
      <td className="text-gray-500">{p.lastBilledAt ? when(p.lastBilledAt) : '—'}</td>
      <td><input defaultValue={p.price} inputMode="decimal" aria-label="Selling price" onChange={(e) => (e.target.value = num(e))} onBlur={(e) => +e.target.value > 0 && +e.target.value !== p.price && save(p, { price: +e.target.value })} className={box} /></td>
      <td><input defaultValue={p.costPrice || ''} placeholder="0" inputMode="decimal" aria-label="Market price" onChange={(e) => (e.target.value = num(e))} onBlur={(e) => +e.target.value !== (p.costPrice || 0) && save(p, { costPrice: +e.target.value || 0 })} className={box} /></td>
      <td><span className="flex items-center gap-1.5"><input value={add} placeholder={String(p.stock || 0)} inputMode="numeric" aria-label="Stock to add" onChange={(e) => setAdd(num(e))} onKeyDown={(e) => e.key === 'Enter' && +add > 0 && (save(p, { stock: (p.stock || 0) + +add }), setAdd(''))} className={box} />
        <button type="button" disabled={!(+add > 0)} onClick={() => { save(p, { stock: (p.stock || 0) + +add }); setAdd('') }} className="h-8 rounded-md border border-gray-200 px-2 text-[12px] text-gray-700 transition hover:border-orange-300 disabled:opacity-40">Add</button></span></td>
      <td className="px-3 text-right"><Btn variant="green" className="!h-8 !px-3 !text-[12px]" onClick={() => save(p, { listed: true })}>Add to Inventory</Btn></td>
    </tr>
  )
}
