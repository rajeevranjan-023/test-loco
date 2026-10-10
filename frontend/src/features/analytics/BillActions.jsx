import React, { useState } from 'react'
import { Printer, FileText, Share2, MessageCircle, MessageSquare, Send } from 'lucide-react'
import { thermalHtml, a4Html, shareLinks, printHtml } from './billOutput.js'

// [ 80mm Print ] [ A4 Print ] [ Share ▾ ] — used by the billing preview AND the bill page. `getDoc` returns the customer-safe document.
export default function BillActions({ getDoc, size = 'md', onError = () => {} }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false)
  const run = async (fn) => { setBusy(true); try { fn(await getDoc()) } catch (e) { onError(e.message || 'Could not prepare the bill') } finally { setBusy(false) } }
  const h = size === 'sm' ? 'h-9 text-[12.5px] px-3' : 'h-10 text-[13px] px-3.5'
  const base = `flex ${h} items-center gap-1.5 rounded-lg border font-medium transition disabled:opacity-60`
  const share = (name) => run((d) => { const l = shareLinks(d, /iPhone|iPad|iPod/i.test(navigator.userAgent)); if (name === 'SMS') window.location.href = l.SMS; else window.open(l[name], '_blank', 'noopener'); setOpen(false) })
  const opts = [['WhatsApp', MessageCircle, 'text-[#22C55E]'], ['SMS', MessageSquare, 'text-[#2F6FEB]'], ['Telegram', Send, 'text-[#229ED9]']]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => run((d) => printHtml(thermalHtml(d)))} className={`${base} border-gray-200 bg-white text-gray-700 hover:border-orange-300`}><Printer size={15} />80mm Print</button>
      <button type="button" disabled={busy} onClick={() => run((d) => printHtml(a4Html(d)))} className={`${base} border-gray-200 bg-white text-gray-700 hover:border-orange-300`}><FileText size={15} />A4 Print</button>
      <div className="relative">
        <button type="button" disabled={busy} onClick={() => setOpen((o) => !o)} className={`${base} border-[#BFD7FB] bg-[#F5F9FF] text-[#2F6FEB] hover:bg-[#EAF3FF]`}><Share2 size={15} />Share</button>
        {open && <><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} /><div className="absolute bottom-[calc(100%+6px)] right-0 z-20 w-40 rounded-xl border border-gray-100 bg-white p-1 shadow-xl">{opts.map(([n, I, c]) => <button key={n} type="button" onClick={() => share(n)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-gray-50"><I size={15} className={c} />{n}</button>)}</div></>}
      </div>
    </div>
  )
}
