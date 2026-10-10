import React, { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const defaultRange = () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), 0, 1)), to: iso(n) } }
const PRESETS = [
  ['This month', () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) } }],
  ['Last 30 days', () => { const n = new Date(); return { from: iso(new Date(+n - 29 * 864e5)), to: iso(n) } }],
  ['Last 3 months', () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth() - 2, 1)), to: iso(n) } }],
  ['Last 6 months', () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth() - 5, 1)), to: iso(n) } }],
  ['This year', defaultRange],
  ['Last 12 months', () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth() - 11, 1)), to: iso(n) } }],
]
const d = (s) => new Date(`${s}T00:00:00`)
export const rangeLabel = ({ from, to }) => {
  const a = d(from), b = d(to), long = +b - +a > 45 * 864e5
  const f = (x, o) => x.toLocaleDateString('en-GB', o)
  return long ? `${f(a, { month: 'short', year: 'numeric' })} - ${f(b, { month: 'short', year: 'numeric' })}` : `${f(a, { day: 'numeric', month: 'short' })} - ${f(b, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// Presets + a custom from/to (e.g. Jan → Aug). Shared by the header pill and the chart card.
export default function RangePicker({ value, onChange, className = '', compact = false }) {
  const [open, setOpen] = useState(false)
  const [c, setC] = useState(value)
  const bad = !c.from || !c.to || c.from > c.to
  return (
    <div className={`relative ${className}`}>
      <button type="button" onClick={() => { setC(value); setOpen((o) => !o) }} className={`flex items-center gap-1.5 rounded-md border border-[#E3EAF3] bg-white text-gray-700 transition hover:border-orange-300 ${compact ? 'h-7 px-2 text-[11.5px]' : 'h-9 px-3 text-[12.5px]'}`}>
        <CalendarDays size={compact ? 13 : 15} />{rangeLabel(value)}<ChevronDown size={13} className="text-gray-500" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[270px] rounded-xl border border-gray-100 bg-white p-2 shadow-xl">
            {PRESETS.map(([l, f]) => <button key={l} type="button" onClick={() => { onChange(f()); setOpen(false) }} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition hover:bg-orange-50">{l}</button>)}
            <div className="mt-1 border-t border-gray-100 p-2">
              <div className="mb-1.5 text-[11.5px] font-medium text-gray-500">Custom range</div>
              <div className="flex items-center gap-1.5"><input type="date" value={c.from} max={c.to} onChange={(e) => setC({ ...c, from: e.target.value })} className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-1.5 text-[12px] outline-none focus:border-orange-400" /><span className="text-gray-400">→</span><input type="date" value={c.to} min={c.from} onChange={(e) => setC({ ...c, to: e.target.value })} className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-1.5 text-[12px] outline-none focus:border-orange-400" /></div>
              <button type="button" disabled={bad} onClick={() => { onChange(c); setOpen(false) }} className="mt-2 h-8 w-full rounded-lg bg-orange-500 text-[12.5px] font-medium text-white transition hover:bg-orange-600 disabled:opacity-50">Apply</button>
            </div>
          </div>
        </>)}
    </div>
  )
}
