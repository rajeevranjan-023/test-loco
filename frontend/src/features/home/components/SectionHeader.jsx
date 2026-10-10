import React from 'react'

// Title + subtitle on the left, "View All" on the right.
export default function SectionHeader({ icon, title, subtitle, action = 'View All', onAction }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-xl" aria-hidden>{icon}</span>}
        <div>
          <h2 className="text-lg font-bold leading-tight text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <button type="button" onClick={onAction} className="shrink-0 text-xs font-semibold text-blue-600 hover:underline">{action} →</button>}
    </div>
  )
}
