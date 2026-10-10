import React from 'react'

// One place for every responsive grid on the page. No horizontal scroll; columns collapse.
const PRESETS = {
  cards: 'grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4', // 1-2 → 3 → 4
  categories: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',                      // 2 → 3 → 4
  features: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

export default function Grid({ preset = 'cards', className = '', children }) {
  return <div className={`grid w-full min-w-0 gap-4 ${PRESETS[preset]} ${className}`}>{children}</div>
}
