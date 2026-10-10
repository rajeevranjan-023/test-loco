import React from 'react'
import Img from '../../../components/Img.jsx'
import { PROMO_TONES } from '../config.js'

// Content (title, points, button, image, colour) comes from the PromoCard collection — editable by an admin.
export default function PromoCard({ promo, onClick }) {
  return (
    <aside className={`relative flex h-full min-h-[200px] w-full flex-col justify-between gap-4 overflow-hidden rounded-xl bg-gradient-to-br p-5 shadow-sm ring-1 ring-gray-100 ${PROMO_TONES[promo.tone] || PROMO_TONES.orange}`}>
      <div className="relative z-10 max-w-[60%]">
        <h3 className="text-lg font-bold text-gray-900">{promo.title}</h3>
        <p className="text-lg font-bold leading-tight text-orange-500">{promo.highlight}</p>
        <ul className="mt-3 space-y-1 text-xs text-gray-700">
          {promo.points.map((p) => <li key={p}>✓ {p}</li>)}
        </ul>
      </div>
      {promo.image && <Img src={promo.image} alt={promo.title} className="absolute bottom-0 right-0 h-3/5 w-2/5 rounded-tl-3xl" />}
      <button type="button" onClick={onClick} className="relative z-10 w-fit rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600">{promo.cta} →</button>
    </aside>
  )
}
