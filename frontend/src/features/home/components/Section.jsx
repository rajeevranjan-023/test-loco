import React from 'react'

// Every homepage block uses this: same bottom spacing, never wider than its parent.
export default function Section({ children, className = '' }) {
  return <section className={`mb-8 w-full min-w-0 ${className}`}>{children}</section>
}
