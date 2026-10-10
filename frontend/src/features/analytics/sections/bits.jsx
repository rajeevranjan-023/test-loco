import React from 'react'
import { Thumb, inr } from '../ui.jsx'
import { Pill } from '../kit.jsx'

export const Panel = ({ title, right, children, className = '', id }) => (
  <section id={id} className={`scroll-mt-24 rounded-2xl border border-[#E8EEF6] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-md ${className}`}>
    {(title || right) && <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-[13.5px] font-semibold text-gray-900">{title}</h3><div className="flex items-center gap-2">{right}</div></div>}
    {children}
  </section>
)
export const Sel = ({ value, onChange, options, className = '' }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11.5px] text-gray-700 outline-none transition hover:border-orange-300 focus:border-orange-400 ${className}`}>
    {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
  </select>
)
export const MiniTabs = ({ items, value, onChange }) => (
  <div className="flex flex-wrap gap-1">
    {items.map((t) => <button key={t} type="button" onClick={() => onChange(t)} className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${value === t ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-400' : 'text-gray-500 hover:bg-gray-50'}`}>{t}</button>)}
  </div>
)
export const Gr = ({ v }) => <span className={`text-[11px] font-semibold ${v >= 0 ? 'text-[#12A05C]' : 'text-red-500'}`}>{v >= 0 ? '↑' : '↓'} {Math.abs(v)}%</span>
export const NoData = ({ t = 'No data for this period' }) => <div className="grid h-[120px] place-items-center text-[12px] text-gray-400">{t}</div>
export const Th = ({ children, r }) => <th className={`px-2 py-2 text-[11px] font-semibold text-gray-700 ${r ? 'text-right' : 'text-left'}`}>{children}</th>
export const Td = ({ children, r, className = '' }) => <td className={`px-2 py-2 text-[12px] text-gray-800 ${r ? 'text-right' : ''} ${className}`}>{children}</td>
export const Tbl = ({ head, children }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[420px]"><thead className="bg-[#F5F9FF]"><tr>{head.map(([h, r]) => <Th key={h} r={r}>{h}</Th>)}</tr></thead><tbody className="[&>tr]:border-b [&>tr]:border-gray-50 [&>tr:last-child]:border-0 [&>tr:hover]:bg-[#F8FBFF]">{children}</tbody></table></div>
)
export const PName = ({ p }) => <span className="flex items-center gap-2"><Thumb src={p.imageUrl} icon={p.icon} size={24} /><span className="truncate">{p.name}</span></span>
export const ago = (d) => { const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 6e4)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hour${m >= 120 ? 's' : ''} ago` : `${Math.round(m / 1440)} d ago` }
export const statusTone = { New: 'green', Preparing: 'amber', 'Out for Delivery': 'blue', Delivered: 'green', Normal: 'green', 'Low Stock': 'amber', 'Out of Stock': 'red' }
export const StatusPill = ({ s }) => <Pill tone={statusTone[s] || 'gray'}>{s}</Pill>
export { inr }
