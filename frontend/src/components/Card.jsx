import React from 'react'

export default function Card({ children, className = '', onClick }) {
  return <div onClick={onClick} className={`rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md ${className}`}>{children}</div>
}
