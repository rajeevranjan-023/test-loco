import React from 'react'
import Card from './Card.jsx'
import Img from './Img.jsx'

function ServiceCard({ s, onOpen }) {
  return (
    <Card onClick={() => onOpen?.(s.name)} className="cursor-pointer w-[140px] shrink-0 snap-start overflow-hidden">
      <Img src={s.img} className="aspect-[4/3] w-full" />
      <div className="p-2.5">
        <div className="truncate text-xs font-medium text-gray-900">{s.name}</div>
        <div className="mt-0.5 text-[11px] text-gray-500">Starts at <span className="font-medium text-orange-600">₹{s.from}</span></div>
      </div>
    </Card>
  )
}
export default React.memo(ServiceCard)
