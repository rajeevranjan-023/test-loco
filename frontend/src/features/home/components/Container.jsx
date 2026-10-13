import React from 'react'

export default function Container({ children, className = '' }) {
  return <div className={`mx-auto box-border w-full max-w-[1200px] px-4 ${className}`}>{children}</div>
}
