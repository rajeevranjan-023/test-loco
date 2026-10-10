import React from 'react'

function HorizontalScroller({ children, className = '' }) {
  return <div className={`h-scroller ${className}`}>{children}</div>
}

export default HorizontalScroller
