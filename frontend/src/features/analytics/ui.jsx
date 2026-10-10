import React from 'react'

export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
export const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-[#EEF0F5] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] ${className}`}>{children}</div>
)
export const CardHead = ({ title, action, onAction, children }) => (
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-[17px] font-semibold text-[#111827]">{title}</h3>
    {children}
    {action && <button type="button" onClick={onAction} className="text-[13px] font-medium text-[#2F6FEB] hover:underline">{action}</button>}
  </div>
)
export const Growth = ({ v }) => (
  <span className={`text-[13px] font-semibold ${v >= 0 ? 'text-[#12B76A]' : 'text-red-500'}`}>{v >= 0 ? '↑' : '↓'} {Math.abs(v)}%</span>
)
export const PayTag = ({ v }) => <span className={`text-[10px] font-medium ${v === 'Paid' ? 'text-[#12A05C]' : v === 'Udhar' ? 'text-[#6D5BD0]' : 'text-[#E09A0B]'}`}>{v}</span>
export const Pulse = ({ className = '' }) => <div className={`animate-pulse rounded-2xl bg-gray-200/70 ${className}`} />
const badge = {
  New: 'bg-[#E3F7EC] text-[#12A05C]', Preparing: 'bg-[#FFF3DA] text-[#E09A0B]',
  'Out for Delivery': 'bg-[#E6F0FE] text-[#2F6FEB]', Delivered: 'bg-[#E3F7EC] text-[#12A05C]',
}
export const StatusBadge = ({ s }) => <span className={`rounded-md px-3 py-1.5 text-xs font-medium ${badge[s] || 'bg-gray-100'}`}>{s}</span>
export const Thumb = ({ src, icon, size = 28 }) =>
  src ? (
    <img src={src} alt="" loading="lazy" style={{ width: size, height: size }} className="shrink-0 rounded-md bg-gray-100 object-cover" />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.6 }} className="grid shrink-0 place-items-center rounded-md bg-gray-100">{icon || '📦'}</span>
  )
