import React, { useRef, useState } from 'react'
import { Store, AtSign, Tag, Phone, Mail, MapPin, Languages, Calendar, Clock, Plus, Trash2, Package, LayoutGrid, ShoppingCart, FileText, Star, MessageCircle, Instagram, Facebook } from 'lucide-react'
import Img from '../Img.jsx'
import Modal from '../common/Modal.jsx'
import { api } from '../../services/api.js'
import { uploadMedia } from '../../services/media.js'
import { Card, Button, categoryLabel, fmtDate, hoursLabel, daysLabel, addressLine, mapsUrl } from './ui.jsx'
import { EditPill } from './PublicSections.jsx'

// PATCH /api/seller/account — the one write endpoint for everything on the shop profile.
export const saveAccount = (patch) => api.patch('/api/seller/account', patch, { requiresAuth: true })

// ---------------------------------------------------------------- Stats row (products · categories · orders · revenue · rating)
export function StatsRow({ stats }) {
  const items = [
    { label: 'Total Products', value: stats?.totalProducts, Icon: Package, tone: 'bg-orange-50 text-orange-500' },
    { label: 'Total Categories', value: stats?.totalCategories, Icon: LayoutGrid, tone: 'bg-blue-50 text-blue-500' },
    { label: 'Total Orders', value: stats?.totalOrders, Icon: ShoppingCart, tone: 'bg-green-50 text-green-500' },
    { label: 'Total Revenue', value: stats ? `₹${Number(stats.totalRevenue).toLocaleString('en-IN')}` : undefined, Icon: FileText, tone: 'bg-violet-50 text-violet-500' },
    { label: 'Average Rating', value: stats?.rating, Icon: Star, tone: 'bg-amber-50 text-amber-500', extra: stats ? `(${stats.reviewCount})` : '' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map(({ label, value, Icon, tone, extra }) => (
        <Card key={label} className="flex items-center gap-3 p-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
          <span className="min-w-0 leading-tight"><span className="block text-[11px] text-gray-500">{label}</span><span className="block truncate text-lg font-bold text-gray-900">{value ?? '—'} <span className="text-xs font-normal text-gray-500">{extra}</span></span></span>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Basic Information (editable)
function Row({ icon: Icon, tone, label, children }) {
  return (
    <div className="flex items-start gap-3 py-[7px]">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${tone}`}><Icon size={12} /></span>
      <span className="w-[84px] shrink-0 text-[11px] text-gray-400">{label}</span>
      <div className="min-w-0 break-words text-[12px] font-medium text-gray-800">{children}</div>
    </div>
  )
}
export function BasicInformation({ profile, onEdit }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-[15px] font-bold text-gray-900">Basic Information</h2><EditPill onClick={onEdit} /></div>
      <Row icon={Store} tone="bg-orange-50 text-orange-500" label="Shop Name">{profile.name}</Row>
      <Row icon={AtSign} tone="bg-blue-50 text-blue-500" label="Username">{profile.username?.replace(/^@/, '')}</Row>
      <Row icon={Tag} tone="bg-orange-50 text-orange-500" label="Category">{categoryLabel(profile.category)}</Row>
      <Row icon={Phone} tone="bg-green-50 text-green-500" label="Phone">{profile.phone || '—'}</Row>
      <Row icon={Mail} tone="bg-blue-50 text-blue-500" label="Email">{profile.email || '—'}</Row>
      <Row icon={MapPin} tone="bg-red-50 text-red-500" label="Location">{addressLine(profile.location) || '—'}<a href={mapsUrl(profile.location)} target="_blank" rel="noreferrer" className="block text-[11px] text-orange-500">View on Map</a></Row>
      <Row icon={Languages} tone="bg-gray-100 text-gray-500" label="Bio"><span className="font-normal text-gray-500">{profile.bio || '—'}</span></Row>
      <Row icon={Calendar} tone="bg-blue-50 text-blue-500" label="Joined On">{fmtDate(profile.createdAt)}</Row>
      <Row icon={Clock} tone="bg-green-50 text-green-500" label="Business Hours">{hoursLabel(profile.timing)}<span className="block text-[11px] font-normal text-gray-500">({daysLabel(profile.timing)})</span></Row>
    </Card>
  )
}

// ---------------------------------------------------------------- Shop Images (upload / delete, first = Main)
export function ShopImages({ profile, onSaved, onError }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const images = profile.images || []

  const persist = async (next, msg) => {
    try { await saveAccount({ images: next }); onSaved(msg) } catch (e) { onError(e.message) }
  }
  const add = async (e) => {
    const files = [...(e.target.files || [])].slice(0, Math.max(12 - images.length, 0))
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const urls = []
      for (const f of files) urls.push((await uploadMedia(f, 'shops')).url)
      await persist([...images, ...urls], 'Photos added.')
    } catch (err) { onError(err.message) } finally { setBusy(false) }
  }
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-[15px] font-bold text-gray-900">Shop Images</h2><p className="text-[11px] text-gray-500">Manage your shop photos (visible to customers)</p></div>
        <Button variant="outline" size="sm" icon={Plus} disabled={busy || images.length >= 12} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Add Images'}</Button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={add} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {images.map((src, i) => (
          <div key={src + i} className="relative aspect-[1.4/1] overflow-hidden rounded-xl">
            <Img src={src} alt={`Shop image ${i + 1}`} className="h-full w-full" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-orange-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">Main</span>}
            <button type="button" aria-label="Delete image" onClick={() => persist(images.filter((_, j) => j !== i), 'Photo removed.')} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-white/95 text-gray-600 hover:text-red-500"><Trash2 size={12} /></button>
          </div>
        ))}
        {images.length < 12 && (
          <button type="button" onClick={() => input.current?.click()} className="grid aspect-[1.4/1] place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100"><span className="text-center"><Plus size={18} className="mx-auto" />Add More</span></button>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- Social Links
export function SocialLinks({ profile, onEdit }) {
  const s = profile.socials || {}
  const rows = [
    { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, tone: 'bg-green-500', text: s.whatsapp },
    { key: 'instagram', label: 'Instagram', Icon: Instagram, tone: 'bg-gradient-to-br from-fuchsia-500 to-orange-400', text: s.instagram },
    { key: 'facebook', label: 'Facebook', Icon: Facebook, tone: 'bg-blue-600', text: s.facebook },
  ]
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-bold text-gray-900">Social Links</h2><EditPill onClick={onEdit} /></div>
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map(({ key, label, Icon, tone, text }) => (
          <div key={key} className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 p-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white ${tone}`}><Icon size={18} /></span>
            <span className="min-w-0 leading-tight"><span className="block text-[11px] font-semibold text-gray-800">{label}</span><span className="block truncate text-[10px] text-gray-500">{text || 'Not added'}</span></span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- Edit modals (About + tags, Social links)
function SaveFooter({ onClose, onSave, saving }) {
  return (<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save'}</Button></>)
}
const inputCls = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400'

export function EditAboutModal({ profile, onClose, onSaved, onError }) {
  const [description, setDescription] = useState(profile.description || '')
  const [features, setFeatures] = useState((profile.features || []).join(', '))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await saveAccount({ description, features: features.split(',').map((t) => t.trim()).filter(Boolean) }); onSaved('About updated.') } catch (e) { onError(e.message) } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title="Edit About" footer={<SaveFooter onClose={onClose} onSave={save} saving={saving} />}>
      <label className="block text-xs text-gray-600">Description<textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></label>
      <label className="mt-3 block text-xs text-gray-600">Highlights (comma separated, max 8)<input value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="Fresh Products, Best Prices, Home Delivery" className={inputCls} /></label>
    </Modal>
  )
}

export function EditSocialsModal({ profile, onClose, onSaved, onError }) {
  const [f, setF] = useState({ whatsapp: '', instagram: '', facebook: '', ...profile.socials })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await saveAccount({ socials: f }); onSaved('Social links updated.') } catch (e) { onError(e.message) } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title="Edit Social Links" footer={<SaveFooter onClose={onClose} onSave={save} saving={saving} />}>
      {[['whatsapp', 'WhatsApp number', '+91 98729 34587'], ['instagram', 'Instagram link', 'https://instagram.com/yourshop'], ['facebook', 'Facebook link', 'https://facebook.com/yourshop']].map(([k, l, ph]) => (
        <label key={k} className="mb-3 block text-xs text-gray-600">{l}<input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} className={inputCls} /></label>
      ))}
    </Modal>
  )
}
