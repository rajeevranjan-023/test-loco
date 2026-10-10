import React from 'react'
import Card from './Card.jsx'
import Img from './Img.jsx'

function ShopCard({ shop, onOpen }) {
  return (
    <Card onClick={() => onOpen?.(shop.name)} className="cursor-pointer flex h-[100px] items-center gap-3 p-2.5">
      <Img src={shop.img} className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="flex h-full min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="truncate text-sm font-medium text-gray-900">{shop.name}</div>
          <div className="text-xs text-gray-500"><span className="text-amber-500">★</span> {shop.rating} ({shop.reviews}) · {shop.km} km</div>
          <div className="mt-0.5 truncate text-[11px] text-gray-400">{shop.tags.join(' · ')}</div>
        </div>
        <button type="button" className="self-end rounded-lg bg-orange-500 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-orange-600">View Shop</button>
      </div>
    </Card>
  )
}
export default React.memo(ShopCard)
