import React from 'react'

export default function StoreButtons({ small = false }) {
  const cls = `rounded-lg bg-black text-white font-semibold ${small ? 'px-3 py-1.5 text-[11px]' : 'px-5 py-2.5 text-sm'}`
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={cls}>▶ Google Play</button>
      <button type="button" className={cls}> App Store</button>
    </div>
  )
}
