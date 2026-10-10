import React from 'react'

function Chip({ label, onClick, active = false }) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'chip-active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default Chip
