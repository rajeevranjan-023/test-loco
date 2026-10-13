import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, FileText, Share2, MessageCircle, MessageSquare, Send, Eye, X } from 'lucide-react'
import { thermalHtml, a4Html, shareLinks, printHtml, viewOnlyHtml } from './billOutput.js'
import { userMessage } from '../../services/apiError.js'

// A small pop-up menu anchored to its button. It is positioned with `fixed`, so it is never clipped by a scrolling table or modal.
function PopMenu({ icon: Icon, label, items, className, disabled }) {
  const [at, setAt] = useState(null); const btn = useRef()
  const toggle = () => {
    if (at) return setAt(null)
    const r = btn.current.getBoundingClientRect(), below = r.bottom + 150 < window.innerHeight
    setAt({ right: Math.max(window.innerWidth - r.right, 8), ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) })
  }
  return (
    <>
      <button ref={btn} type="button" disabled={disabled} onClick={toggle} aria-haspopup="menu" aria-expanded={!!at} className={className}><Icon size={15} />{label}</button>
      {at && <>
        <div className="fixed inset-0 z-[60]" onClick={() => setAt(null)} />
        <div role="menu" style={at} className="fixed z-[61] w-44 rounded-xl border border-gray-100 bg-white p-1 shadow-xl">
          {items.map(([name, I, color, fn]) => <button key={name} type="button" role="menuitem" onClick={() => { setAt(null); fn() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-gray-50"><I size={15} className={color} />{name}</button>)}
        </div>
      </>}
    </>
  )
}

// View Only: shows the customer-safe bill on screen. Nothing is saved, sent or printed from here — there is no Print button, and even Ctrl/⌘+P prints nothing.
export function BillViewer({ doc, kind, onClose }) {
  const thermal = kind === 'thermal'
  const html = thermal ? thermalHtml(doc) : a4Html(doc)
  useEffect(() => {
    const st = Object.assign(document.createElement('style'), { textContent: '@media print{body>*{display:none!important}}' })
    document.head.appendChild(st); return () => st.remove()
  }, [])
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={`${thermal ? '80mm' : 'A4'} bill view`} className={`flex max-h-[94vh] w-full flex-col rounded-2xl bg-white shadow-2xl ${thermal ? 'max-w-[420px]' : 'max-w-[860px]'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
          <h3 className="text-[15px] font-semibold">{thermal ? '80mm receipt' : 'A4 invoice'}<span className="ml-2 text-[12px] font-normal text-gray-400">view only</span></h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-3">
          <iframe title="Bill" sandbox="" srcDoc={viewOnlyHtml(html)} className={`mx-auto block h-[72vh] rounded-md bg-white shadow ${thermal ? 'w-[340px] max-w-full' : 'w-full max-w-[794px]'}`} />
        </div>
      </div>
    </div>, document.body)
}

// Share ▾ (WhatsApp · SMS · Telegram) — one component for the billing screen, the bill pages and the Recent Bills rows.
export function ShareMenu({ getDoc, className, label = 'Share', onError = () => {}, disabled }) {
  const [busy, setBusy] = useState(false)
  const share = async (name) => {
    setBusy(true)
    try { const l = shareLinks(await getDoc(), /iPhone|iPad|iPod/i.test(navigator.userAgent)); if (name === 'SMS') window.location.href = l.SMS; else window.open(l[name], '_blank', 'noopener') }
    catch (e) { onError(userMessage(e, 'Could not prepare the bill')) } finally { setBusy(false) }
  }
  const opts = [['WhatsApp', MessageCircle, 'text-[#22C55E]'], ['SMS', MessageSquare, 'text-[#2F6FEB]'], ['Telegram', Send, 'text-[#229ED9]']]
  return <PopMenu icon={Share2} label={label} disabled={busy || disabled} className={className} items={opts.map(([n, I, c]) => [n, I, c, () => share(n)])} />
}

// [ 80mm ▾ ] [ A4 ▾ ] [ Share ▾ ] — used by the billing screen AND the bill pages. `getDoc` returns the customer-safe document.
// Each size offers:
//  · Save & Print — only when `onSave` is given (a bill that is not saved yet). `onSave()` saves the bill once and resolves with the SAVED bill's document;
//    the print dialog opens straight away, and ONLY if the save succeeded. If it throws, nothing prints.
//  · Print — for a bill that is already saved (no `onSave`): prints directly, nothing is saved again.
//  · View Only — opens the preview with no print option.
export default function BillActions({ getDoc, onSave, size = 'md', onError = () => {} }) {
  const [busy, setBusy] = useState(false); const [view, setView] = useState(null)
  const lock = useRef(false) // synchronous guard: a double click can never start a second save / print
  const h = size === 'sm' ? 'h-9 text-[12.5px] px-3' : 'h-10 text-[13px] px-3.5'
  const base = `flex ${h} items-center gap-1.5 rounded-lg border font-medium transition disabled:opacity-60`
  const run = async (job) => { if (lock.current) return; lock.current = true; setBusy(true); try { await job() } catch (e) { onError(userMessage(e, 'Could not prepare the bill')) } finally { lock.current = false; setBusy(false) } }
  const render = (doc, kind) => (kind === 'thermal' ? thermalHtml(doc) : a4Html(doc))
  const printNow = (kind) => run(async () => printHtml(render(onSave ? await onSave() : await getDoc(), kind)))
  const viewOnly = (kind) => run(async () => setView({ doc: await getDoc(), kind }))
  const fmt = (kind) => [[onSave ? 'Save & Print' : 'Print', Printer, 'text-orange-500', () => printNow(kind)], ['View Only', Eye, 'text-gray-500', () => viewOnly(kind)]]
  const plain = `${base} border-gray-200 bg-white text-gray-700 hover:border-orange-300`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PopMenu icon={Printer} label="80mm" disabled={busy} className={plain} items={fmt('thermal')} />
      <PopMenu icon={FileText} label="A4" disabled={busy} className={plain} items={fmt('a4')} />
      <ShareMenu getDoc={getDoc} onError={onError} disabled={busy} className={`${base} border-[#BFD7FB] bg-[#F5F9FF] text-[#2F6FEB] hover:bg-[#EAF3FF]`} />
      {view && <BillViewer doc={view.doc} kind={view.kind} onClose={() => setView(null)} />}
    </div>
  )
}
