import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Img from '../../../components/Img.jsx'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js'
import { fetchSuggestions } from '../../../services/homeApi.js'
import { profilePath } from '../../../utils/username.js'

// Drop-down under the hero search box. Floats over the page (absolute), so the hero layout is untouched.
export default function SearchSuggest({ query, city, onPick, onSearch }) {
  const navigate = useNavigate()
  const q = useDebouncedValue(query.trim(), 250)
  const [res, setRes] = useState(null)
  const [open, setOpen] = useState(true)
  const box = useRef(null)

  useEffect(() => setOpen(true), [query])
  useEffect(() => {
    if (q.length < 2) { setRes(null); return }
    let live = true
    fetchSuggestions(q, city).then((r) => live && setRes(r)).catch(() => live && setRes(null))
    return () => { live = false }
  }, [q, city])
  useEffect(() => {
    const away = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  if (!open || q.length < 2 || !res) return null
  const groups = [['Shops', res.shops], ['Services', res.services], ['Products', res.products]].filter(([, l]) => l.length)

  return (
    <div ref={box} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-2xl bg-white p-2 text-left shadow-xl ring-1 ring-gray-100">
      {groups.length === 0 && <p className="px-3 py-3 text-xs text-gray-500">No matches for “{q}”{city ? ` in ${city}` : ''}.</p>}
      {groups.map(([label, list]) => (
        <div key={label}>
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
          {list.map((it) => (
            <button key={`${label}-${it.id}`} type="button" role="option" onClick={() => { onPick?.(); navigate(profilePath(it.username)) }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-orange-50">
              <Img src={it.image} alt={it.name} placeholder="initial" className="h-9 w-9 shrink-0 rounded-lg !text-base" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900">{it.name}</span><span className="block truncate text-xs text-gray-500">{it.subtitle}</span></span>
            </button>
          ))}
        </div>
      ))}
      <button type="button" onClick={() => onSearch(query.trim())} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50">See all results for “{query.trim()}” →</button>
    </div>
  )
}
