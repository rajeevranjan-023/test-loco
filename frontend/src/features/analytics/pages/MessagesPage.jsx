import React, { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useSeller, call, State, Empty } from '../kit.jsx'
import { Card } from '../ui.jsx'
import { useOutletContext } from 'react-router-dom'

export default function MessagesPage() {
  const { reloadSummary } = useOutletContext()
  const list = useSeller('/api/seller/messages')
  const [sel, setSel] = useState(null)
  const [thread, setThread] = useState([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const end = useRef(null)
  const open = async (name) => {
    setSel(name); setErr('')
    try { setThread(await call('get', `/api/seller/messages/${encodeURIComponent(name)}`)); list.reload(); reloadSummary?.() } catch (e) { setErr(e.message) }
  }
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [thread])
  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return
    try { const m = await call('post', '/api/seller/messages', { customerName: sel, text }); setThread((t) => [...t, m]); setText(''); list.reload() } catch (er) { setErr(er.message) }
  }
  const chats = list.data || []
  return (
    <State q={list} empty={list.data && !chats.length && 'No conversations yet'}>
      <Card className="grid h-[calc(100vh-190px)] min-h-[440px] overflow-hidden md:grid-cols-[300px_1fr]">
        <ul className={`overflow-y-auto border-r border-gray-100 ${sel ? 'hidden md:block' : ''}`}>
          {chats.map((c) => (
            <li key={c.name}>
              <button type="button" onClick={() => open(c.name)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 ${sel === c.name ? 'bg-[#EAF2FE]' : ''}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 font-semibold text-blue-700">{c.name[0]}</span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{c.name}</span><span className="block truncate text-[13px] text-gray-500">{c.last}</span></span>
                {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#F04438] px-1 text-[11px] text-white">{c.unread}</span>}
              </button>
            </li>))}
        </ul>
        <div className={`flex min-h-0 flex-col ${sel ? '' : 'hidden md:flex'}`}>
          {!sel ? <Empty text="Select a conversation" /> : (
            <>
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 font-medium"><button type="button" onClick={() => setSel(null)} className="text-[#1F6FEB] md:hidden">←</button>{sel}</div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-[#F8FAFD] p-4">
                {thread.map((m) => <div key={m._id} className={`flex ${m.direction === 'out' ? 'justify-end' : ''}`}><span className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[14px] ${m.direction === 'out' ? 'bg-[#1F6FEB] text-white' : 'bg-white shadow-sm'}`}>{m.text}</span></div>)}
                <div ref={end} />
              </div>
              {err && <div className="px-4 pb-1 text-sm text-red-600">{err}</div>}
              <form onSubmit={send} className="flex gap-2 border-t border-gray-100 p-3">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply…" className="h-11 flex-1 rounded-xl border border-gray-200 px-3 text-[14px] outline-none focus:border-[#1F6FEB]" />
                <button type="submit" aria-label="Send" className="grid h-11 w-11 place-items-center rounded-xl bg-[#1F6FEB] text-white transition hover:bg-[#1859c4]"><Send size={18} /></button>
              </form>
            </>)}
        </div>
      </Card>
    </State>
  )
}
