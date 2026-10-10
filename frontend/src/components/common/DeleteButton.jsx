import React from 'react'

function DeleteButton({ onClick, label = 'Delete', className = '' }) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-delete ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      🗑️
    </button>
  )
}

export default DeleteButton
