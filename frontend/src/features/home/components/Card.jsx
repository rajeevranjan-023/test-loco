import React from 'react'
import Img from '../../../components/Img.jsx'

function Card({ item, onCall, onWhatsApp, onView }) {
  return (
    <article className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md">
      <div className="relative h-[140px] w-full">
        <Img src={item.image} alt={item.name} placeholder="initial" className="h-full w-full" />
        <button type="button" aria-label="Save" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-sm text-gray-500 hover:text-red-500">♡</button>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-semibold text-gray-900">{item.name}</h3>
        <p className="truncate text-xs text-gray-500">{item.category}</p>
        <p className="text-xs text-gray-700">
          <span className="text-amber-500">★</span>{' '}
          {item.rating != null ? <>{item.rating} <span className="text-gray-400">({item.reviews})</span></> : <span className="text-gray-400">New</span>}
        </p>
        <p className="truncate text-xs text-gray-500">📍 {item.location || '—'}</p>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <button type="button" onClick={() => onCall?.(item)} aria-label="Call" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-50 text-green-600 hover:bg-green-100">📞</button>
          <button type="button" onClick={() => onWhatsApp?.(item)} aria-label="WhatsApp" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-50 text-green-600 hover:bg-green-100">💬</button>
          <button type="button" onClick={() => onView?.(item)} className="min-w-0 flex-1 truncate rounded-lg bg-blue-50 px-1 py-2 text-[11px] font-semibold text-blue-600 hover:bg-blue-100">View Details</button>
        </div>
      </div>
    </article>
  )
}
export default React.memo(Card)
