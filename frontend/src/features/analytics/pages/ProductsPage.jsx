import React, { useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useSeller, call, State, DataTable, PageHead, Btn, Field, Modal, Pill } from '../kit.jsx'
import { Thumb, inr } from '../ui.jsx'

const blank = { name: '', category: 'Grocery', price: '', costPrice: '', stock: '', icon: '📦', lowStockAt: 10 }
export const CATEGORIES = ['Grocery', 'Dairy', 'Snacks', 'Beverages', 'Personal Care', 'Others']

export default function ProductsPage() {
  const q = useSeller('/api/seller/products')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const rows = (q.data || []).filter((p) => p.listed !== false && p.name.toLowerCase().includes(search.toLowerCase()))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setBusy(true); setErr('')
    const body = { ...form, price: +form.price, costPrice: +form.costPrice, stock: +form.stock || 0, lowStockAt: +form.lowStockAt || 10 }
    try {
      form._id ? await call('put', `/api/seller/products/${form._id}`, body) : await call('post', '/api/seller/products', body)
      setForm(null); q.reload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const remove = async (p) => { if (window.confirm(`Delete "${p.name}"?`)) { await call('delete', `/api/seller/products/${p._id}`).catch((e) => alert(e.message)); q.reload() } }

  return (
    <>
      <PageHead title="Products" sub={`${(q.data || []).filter((p) => p.listed !== false).length} products in your catalogue`}>
        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="h-10 w-[200px] rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-[14px] outline-none focus:border-[#1F6FEB]" /></div>
        <Btn onClick={() => { setErr(''); setForm(blank) }}><Plus size={16} />Add Product</Btn>
      </PageHead>
      <State q={q} empty={q.data && !rows.length && (search ? 'No matching products' : 'No products yet — add your first one')}>
        <DataTable rows={rows} rowKey={(r) => r._id} cols={[
          { h: 'Product', cell: (r) => <span className="flex items-center gap-3"><Thumb src={r.imageUrl} icon={r.icon} size={34} />{r.name}</span> },
          { h: 'Category', cell: (r) => <Pill tone="blue">{r.category || 'Other'}</Pill> },
          { h: 'Price', r: true, cell: (r) => inr(r.price) },
          { h: 'Cost', r: true, cell: (r) => inr(r.costPrice) },
          { h: 'Stock', r: true, cell: (r) => r.stock },
          { h: 'Sold', r: true, cell: (r) => r.sold },
          { h: '', r: true, cell: (r) => (
            <span className="inline-flex gap-1">
              <button type="button" aria-label="Edit" onClick={() => { setErr(''); setForm(r) }} className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"><Pencil size={16} /></button>
              <button type="button" aria-label="Delete" onClick={() => remove(r)} className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"><Trash2 size={16} /></button>
            </span>) },
        ]} />
      </State>
      {form && (
        <Modal title={form._id ? 'Edit Product' : 'Add Product'} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2" label="Name" value={form.name} onChange={set('name')} />
            <label className="text-[13px] text-gray-600">Category
              <select value={form.category || 'Other'} onChange={set('category')} className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px]">{[...CATEGORIES, 'Other'].map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <Field label="Icon (emoji)" value={form.icon} onChange={set('icon')} />
            <Field label="Selling price (₹)" type="number" min="0" value={form.price} onChange={set('price')} />
            <Field label="Cost price (₹)" type="number" min="0" value={form.costPrice} onChange={set('costPrice')} />
            <Field label="Stock" type="number" min="0" value={form.stock} onChange={set('stock')} />
            <Field label="Low-stock alert at" type="number" min="0" value={form.lowStockAt} onChange={set('lowStockAt')} />
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setForm(null)}>Cancel</Btn><Btn disabled={busy || !form.name || form.price === '' || form.costPrice === ''} onClick={save}>{busy ? 'Saving…' : 'Save'}</Btn></div>
        </Modal>
      )}
    </>
  )
}
