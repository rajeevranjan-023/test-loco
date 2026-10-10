import React, { useEffect, useState, useCallback } from 'react'
import { X, Inbox, AlertCircle } from 'lucide-react'
import { api } from '../../services/api.js'
import { Card, Pulse } from './ui.jsx'

const auth = { requiresAuth: true }
export const call = (m, path, body) => (m === 'get' || m === 'delete' ? api[m](path, auth) : api[m](path, body, auth))

// GET hook with loading / error / reload
export function useSeller(path) {
  const [st, set] = useState({ data: null, loading: true, error: '' })
  const load = useCallback(() => {
    set((s) => ({ ...s, loading: true, error: '' }))
    return call('get', path).then((data) => set({ data, loading: false, error: '' })).catch((e) => set({ data: null, loading: false, error: e.message }))
  }, [path])
  useEffect(() => { load() }, [load])
  return { ...st, reload: load, setData: (fn) => set((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) } // setData = instant local update, no refetch
}

export const PageHead = ({ title, sub, children }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="text-[20px] font-semibold text-gray-900">{title}</h2>{sub && <p className="text-[14px] text-gray-500">{sub}</p>}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
)
export const Btn = ({ variant = 'primary', className = '', ...p }) => (
  <button type="button" {...p} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-medium transition disabled:opacity-50 ${
    variant === 'primary' ? 'bg-[#1F6FEB] text-white hover:bg-[#1859c4]' : variant === 'danger' ? 'border border-[#F5C2C2] bg-[#FDE8E8] text-[#D92D20] hover:bg-[#fbd5d5]' : variant === 'green' ? 'bg-[#0E9F6E] text-white hover:bg-[#0b8a5f]' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'} ${className}`} />
)
export const Field = ({ label, className = '', ...p }) => (
  <label className={`block text-[13px] text-gray-600 ${className}`}>{label}
    <input {...p} className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none focus:border-[#1F6FEB]" />
  </label>
)
export const Tabs = ({ items, value, onChange }) => (
  <div className="mb-4 flex flex-wrap gap-2">
    {items.map((t) => <button key={t} type="button" onClick={() => onChange(t)} className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${value === t ? 'bg-[#1F6FEB] text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#1F6FEB]/40'}`}>{t}</button>)}
  </div>
)
export function Modal({ title, onClose, children, wide = false, persistent = false }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => !persistent && e.target === e.currentTarget && onClose()}>
      <div className={`max-h-[90vh] w-full ${wide ? 'max-w-[860px]' : 'max-w-[520px]'} overflow-auto rounded-2xl bg-white p-5 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-[17px] font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  )
}
export const Empty = ({ text, hint }) => (
  <div className="grid place-items-center gap-2 py-14 text-center text-gray-400"><Inbox size={34} strokeWidth={1.4} /><div className="text-[15px] text-gray-600">{text}</div>{hint && <div className="text-[13px]">{hint}</div>}</div>
)
export const ErrorBox = ({ msg, onRetry }) => (
  <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-[14px] text-red-600"><AlertCircle size={18} /><span className="flex-1">{msg}</span>{onRetry && <button type="button" onClick={onRetry} className="font-medium underline">Retry</button>}</div>
)
// Wraps any fetched block: skeleton → error → empty → content
export function State({ q, empty, children, rows = 6 }) {
  if (q.loading && !q.data) return <div className="space-y-2">{Array.from({ length: rows }, (_, i) => <Pulse key={i} className="h-12" />)}</div>
  if (q.error) return <ErrorBox msg={q.error} onRetry={q.reload} />
  if (empty) return <Empty text={empty} />
  return children
}
export function DataTable({ cols, rows, rowKey }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[14px]">
        <thead className="border-b border-gray-100 bg-gray-50/70"><tr>{cols.map((c) => <th key={c.h} className={`px-4 py-3 text-[13px] font-semibold text-gray-900 ${c.r ? 'text-right' : 'text-left'}`}>{c.h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={rowKey(r, i)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
            {cols.map((c) => <td key={c.h} className={`px-4 py-3 ${c.r ? 'text-right' : ''}`}>{c.cell(r, i)}</td>)}
          </tr>))}</tbody>
      </table>
    </Card>
  )
}
export const Pill = ({ tone = 'gray', children }) => {
  const t = { green: 'bg-[#E3F7EC] text-[#12A05C]', amber: 'bg-[#FFF3DA] text-[#E09A0B]', blue: 'bg-[#E6F0FE] text-[#2F6FEB]', red: 'bg-[#FDE8E8] text-[#D92D20]', gray: 'bg-gray-100 text-gray-600', purple: 'bg-[#F1EEFD] text-[#6D5BD0]' }
  return <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${t[tone]}`}>{children}</span>
}
export const payTone = { Paid: 'green', Pending: 'amber', Udhar: 'purple' }
export const when = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
