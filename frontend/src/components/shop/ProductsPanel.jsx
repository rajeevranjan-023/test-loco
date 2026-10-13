import React, { useEffect, useRef, useState } from 'react'
import { Search, ShoppingCart, Pencil, Eye, LayoutGrid, List, ChevronLeft, ChevronRight, ArrowRight, MoreVertical } from 'lucide-react'
import Img from '../Img.jsx'
import Modal from '../common/Modal.jsx'
import { api } from '../../services/api.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { EditProductModal, AddProductModal } from '../../features/seller/EditProductModal.jsx'
import { Card, Grid, Button, selectCls, slug, priceUnitLabel } from './ui.jsx'

const SORTS = [['latest', 'Sort by: Latest'], ['price_asc', 'Price: Low to High'], ['price_desc', 'Price: High to Low'], ['name', 'Name: A–Z'], ['popular', 'Most Popular']]
const rupee = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const PAGE = 12

// One product card — viewer variant (Add to Cart) and owner variant (Edit / View) share the same frame.
function ProductCard({ p, owner, inCart, onCart, onEdit, onView, list }) {
  const out = !p.available
  return (
    <div className={`flex min-w-0 rounded-xl border border-gray-100 bg-white p-2.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] ${list ? 'flex-row items-center gap-4' : 'flex-col'}`}>
      <div className={`relative overflow-hidden rounded-lg bg-gray-50 ${list ? 'h-20 w-24 shrink-0' : 'aspect-[1.35/1] w-full'}`}>
        <Img src={p.imageUrl || `${slug(p.name)}.png`} alt={p.name} className="h-full w-full !bg-transparent object-contain" />
        {owner && (
          <>
            <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold ${out ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{out ? 'Out of Stock' : 'Available'}</span>
            <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded bg-white/90 text-gray-500"><MoreVertical size={12} /></span>
          </>
        )}
      </div>
      <div className={`min-w-0 ${list ? 'flex-1' : 'mt-2.5'}`}>
        <p className="truncate text-xs font-bold text-gray-900" title={p.name}>{p.name}</p>
        <p className="truncate text-[11px] text-gray-500">{p.category}</p>
        <p className="mt-1.5 text-[13px] font-bold text-gray-900">{rupee(p.price)} <span className="text-[11px] font-normal text-gray-500">/ {priceUnitLabel(p.priceUnit)}</span></p>
        {owner
          ? <p className={`text-[11px] ${out ? 'text-red-500' : 'text-green-600'}`}>Stock: {p.stock}</p>
          : <p className={`text-[11px] font-medium ${out ? 'text-red-500' : 'text-green-600'}`}>{out ? 'Out of Stock' : `In Stock (${p.stock})`}</p>}
      </div>
      <div className={`${list ? 'flex w-44 shrink-0 gap-1.5' : 'mt-2.5 flex gap-1.5'}`}>
        {owner ? (
          <>
            <Button variant="outline" size="sm" icon={Pencil} className="flex-1" onClick={() => onEdit(p)}>Edit</Button>
            <Button variant="blue" size="sm" icon={Eye} className="flex-1" onClick={() => onView(p)}>View</Button>
          </>
        ) : (
          <Button variant={out ? 'soft' : 'outline'} size="sm" icon={ShoppingCart} className="w-full" disabled={out} onClick={() => onCart(p)}>
            {out ? 'Out of Stock' : inCart ? `Added (${inCart})` : 'Add to Cart'}
          </Button>
        )}
      </div>
    </div>
  )
}

// Filters + grid + pagination (owner) / "View All Products" (viewer). All data comes from GET /api/profile/:username/products.
export default function ProductsPanel({ profile, isOwner, categories, presetCategory, refreshKey, onChanged, onToast, cart, onCart }) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [availability, setAvailability] = useState('')
  const [sort, setSort] = useState('latest')
  const [layout, setLayout] = useState('grid')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const dq = useDebouncedValue(q, 300)
  const topRef = useRef(null)

  useEffect(() => { if (presetCategory?.name) { setCategory(presetCategory.name); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }, [presetCategory])
  useEffect(() => { setPage(1) }, [dq, category, availability, sort])

  useEffect(() => {
    let off = false
    setLoading(true); setErr('')
    const qs = new URLSearchParams({ q: dq, category, availability, sort, page, limit: PAGE })
    api.get(`/api/profile/${profile.username}/products?${qs}`, { requiresAuth: true })
      .then((res) => {
        if (off) return
        setMeta({ total: res.total, pages: res.pages })
        setRows((prev) => (!isOwner && res.page > 1 ? [...prev, ...res.items] : res.items))
      })
      .catch((e) => !off && setErr(e.message))
      .finally(() => !off && setLoading(false))
    return () => { off = true }
  }, [profile.username, dq, category, availability, sort, page, refreshKey, isOwner])

  const saved = (msg) => { onToast(msg); setEditing(null); setShowAdd(false); onChanged() }
  const from = meta.total ? (page - 1) * PAGE + 1 : 0
  const to = Math.min(page * PAGE, meta.total)
  const pageNums = Array.from({ length: meta.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === meta.pages || Math.abs(n - page) <= 1)

  return (
    <section ref={topRef} className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="border-l-[3px] border-orange-500 pl-2.5 leading-tight">
          <h2 className="text-xl font-bold text-gray-900">{isOwner ? 'Product Listings' : 'Products'}</h2>
          <p className="text-xs text-gray-500">{isOwner ? 'All products available in your shop' : 'All products available at this shop'}</p>
        </div>
        {isOwner && <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Product</Button>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1 sm:max-w-[320px] md:ml-auto md:flex-none md:basis-[260px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className={`${selectCls} w-full pl-8`} />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls} aria-label="Category">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        {isOwner && (
          <select value={availability} onChange={(e) => setAvailability(e.target.value)} className={selectCls} aria-label="Availability">
            <option value="">Availability</option><option value="in">In Stock</option><option value="out">Out of Stock</option>
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls} aria-label="Sort">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {isOwner && (
          <span className="flex gap-1">
            {[['grid', LayoutGrid], ['list', List]].map(([k, Icon]) => (
              <button key={k} type="button" aria-label={`${k} view`} onClick={() => setLayout(k)} className={`grid h-9 w-9 place-items-center rounded-lg border ${layout === k ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 bg-white text-gray-500'}`}><Icon size={15} /></button>
            ))}
          </span>
        )}
      </div>

      {err ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{err}</p>
        : loading && !rows.length ? <p className="p-8 text-center text-sm text-gray-500">Loading products…</p>
        : !rows.length ? <Card className="p-8 text-center text-sm text-gray-500">{profile.productCount ? 'No products match your filters.' : 'No products listed yet.'}</Card>
        : (
          <Grid cols={layout === 'list' && isOwner ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'}>
            {rows.map((p) => (
              <ProductCard key={p.id} p={p} owner={isOwner} list={layout === 'list' && isOwner} inCart={cart?.[p.id]?.qty}
                onCart={onCart} onEdit={setEditing} onView={setViewing} />
            ))}
          </Grid>
        )}

      {isOwner ? (
        meta.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
            <span>Showing {from}–{to} of {meta.total} products</span>
            <span className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="grid h-7 w-7 place-items-center rounded-md disabled:opacity-30" aria-label="Previous page"><ChevronLeft size={14} /></button>
              {pageNums.map((n, i) => (
                <React.Fragment key={n}>
                  {i > 0 && n - pageNums[i - 1] > 1 && <span>…</span>}
                  <button type="button" onClick={() => setPage(n)} className={`h-7 min-w-7 rounded-md px-2 font-medium ${n === page ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}>{n}</button>
                </React.Fragment>
              ))}
              <button type="button" disabled={page >= meta.pages} onClick={() => setPage(page + 1)} className="grid h-7 w-7 place-items-center rounded-md disabled:opacity-30" aria-label="Next page"><ChevronRight size={14} /></button>
            </span>
          </div>
        )
      ) : (
        page < meta.pages && (
          <div className="mt-5 flex justify-center">
            <Button variant="outline" icon={null} disabled={loading} onClick={() => setPage(page + 1)} className="px-8">{loading ? 'Loading…' : <>View All Products <ArrowRight size={13} /></>}</Button>
          </div>
        )
      )}

      {isOwner && (
        <>
          <AddProductModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={saved} onError={onToast} />
          {editing && <EditProductModal product={{ ...editing, _id: editing.id }} onClose={() => setEditing(null)} onSaved={saved} onError={onToast} />}
        </>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name || 'Product'}>
        {viewing && (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Img src={viewing.imageUrl || `${slug(viewing.name)}.png`} alt={viewing.name} className="aspect-square w-full rounded-xl !bg-gray-50 object-contain" />
            <div className="text-sm text-gray-700">
              <p className="text-xs text-gray-500">{viewing.category}</p>
              <p className="mt-1 text-lg font-bold">{rupee(viewing.price)} <span className="text-xs font-normal text-gray-500">/ {priceUnitLabel(viewing.priceUnit)}</span></p>
              <p className="mt-1 text-xs">Stock: {viewing.stock} · Sold: {viewing.sold}</p>
              {viewing.costPrice != null && <p className="text-xs">Cost price: {rupee(viewing.costPrice)}</p>}
              {viewing.description && <p className="mt-3 text-xs text-gray-500">{viewing.description}</p>}
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
