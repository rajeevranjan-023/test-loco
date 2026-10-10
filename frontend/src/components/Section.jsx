import React from 'react'

export default function Section({ title, action = 'View All', onAction, children, className = '' }) {
  return (
    <section className={`min-w-0 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">{title}</h2>
        {action && <button type="button" onClick={onAction} className="text-xs font-medium text-orange-600 hover:underline">{action}</button>}
      </div>
      {children}
    </section>
  )
}
