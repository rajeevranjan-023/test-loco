import React from 'react'

export const PANEL = 'absolute z-50 mt-2 w-[min(260px,calc(100vw-24px))] rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg'
export function MenuItem({ icon, children, onClick, danger }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition hover:bg-orange-50 focus:bg-orange-50 focus:outline-none ${danger ? 'text-red-600' : 'text-gray-800'}`}>
      <span aria-hidden className="w-5 text-center">{icon}</span>{children}
    </button>
  )
}
export const MenuDivider = () => <div role="separator" className="my-1 h-px bg-gray-100" />
