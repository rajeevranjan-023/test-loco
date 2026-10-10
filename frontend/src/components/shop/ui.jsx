import React from 'react'
import { Star } from 'lucide-react'

// Reusable building blocks for the shop profile (Card · Section · Grid · Button) — one look everywhere.

export function Card({ children, className = '', as: Tag = 'div' }) {
  return <Tag className={`min-w-0 rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)] ${className}`}>{children}</Tag>
}

// Title with the orange bar on the left, optional subtitle + right-side action.
export function Section({ title, sub, action, big = false, children, className = '' }) {
  return (
    <section className={`min-w-0 ${className}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="border-l-[3px] border-orange-500 pl-2.5 leading-tight">
          <h2 className={`font-bold text-gray-900 ${big ? 'text-xl' : 'text-[15px]'}`}>{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Grid({ cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6', className = '', children }) {
  return <div className={`grid gap-3 ${cols} ${className}`}>{children}</div>
}

const VARIANTS = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600 border border-orange-500',
  green: 'bg-green-500 text-white hover:bg-green-600 border border-green-500',
  outline: 'bg-white text-orange-600 border border-orange-400 hover:bg-orange-50',
  blue: 'bg-white text-sky-600 border border-sky-300 hover:bg-sky-50',
  ghost: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  soft: 'bg-gray-100 text-gray-400 border border-gray-100 cursor-not-allowed',
}
export function Button({ variant = 'primary', size = 'md', icon: Icon, children, className = '', as: Tag = 'button', ...rest }) {
  const sz = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
  return (
    <Tag type={Tag === 'button' ? 'button' : undefined} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition ${sz} ${VARIANTS[variant]} ${className}`} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2} />}
      {children}
    </Tag>
  )
}

export function Stars({ rating = 0, size = 13 }) {
  const full = Math.round(rating)
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= full ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'} />
      ))}
    </span>
  )
}

export const selectCls = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none focus:border-orange-400'

// ---- small formatters shared by the shop sections ---------------------------------------------
export const slug = (s = '') => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const categoryLabel = (c) => (!c || c === 'Other' ? 'Shop' : /store$/i.test(c) ? c : `${c} Store`)
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
export const fmtTime = (t = '') => {
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export const hoursLabel = (t) => (t ? `${fmtTime(t.open)} – ${fmtTime(t.close)}` : '')
export const daysLabel = (t) => (t?.openDays === 'All Week' ? 'Everyday' : t?.openDays || '')
export const addressLine = (loc = {}) => [loc.address, loc.area, loc.district, loc.state].filter(Boolean).join(', ')
export const shortLocation = (loc = {}) => [loc.area || loc.address, loc.district].filter(Boolean).join(', ')
export const priceUnitLabel = (u) => (u === 'liter' ? 'L' : u === 'kg' ? 'kg' : 'unit')
export const mapsUrl = (loc = {}) =>
  loc.lat != null && loc.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(loc))}`
export const digits = (p = '') => String(p).replace(/\D/g, '')
