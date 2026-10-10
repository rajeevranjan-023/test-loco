import React from 'react'

// Single width rule for the whole page: centered, max 1200px, 16px side padding.
export default function Container({ children, className = '' }) {
  return <div className={`mx-auto box-border w-full max-w-[1200px] px-4 ${className}`}>{children}</div>
}
