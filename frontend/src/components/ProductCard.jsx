import React from 'react'
import Card from './Card.jsx'
import Img from './Img.jsx'

function ProductCard({ p, variant = 'price', onOpen }) {
  const trending = variant === 'trending'
  return (
    <Card onClick={() => onOpen?.(p.name)} className="relative flex h-[218px] cursor-pointer w-[140px] shrink-0 snap-start flex-col p-2.5">
      {trending && <span className="absolute left-3 top-3 z-10 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">-{p.off}%</span>}
      <Img src={p.img} className="mb-2 aspect-[4/3] w-full rounded-xl" />
      <div className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-4 text-gray-800">{p.name}</div>
      {trending ? (
        <>
          <div className="mt-auto text-sm font-semibold text-gray-900">₹{p.price} <span className="text-[11px] font-normal text-gray-400 line-through">₹{p.mrp}</span></div>
          <button type="button" className="mt-1.5 w-full rounded-lg border border-orange-500 py-1 text-[11px] font-medium text-orange-600 transition hover:bg-orange-50">View Shops</button>
        </>
      ) : (
        <>
          <div className="mt-auto text-sm font-semibold text-gray-900">{p.price}</div>
          <div className="text-[11px] text-gray-500">in {p.shops} shops</div>
          <div className="mt-1.5 rounded-md bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700">Best {p.best}</div>
        </>
      )}
    </Card>
  )
}
export default React.memo(ProductCard)
