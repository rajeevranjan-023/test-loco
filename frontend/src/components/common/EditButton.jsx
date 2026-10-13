import React from 'react'

function EditButton({ onClick, label = 'Edit', className = '' }) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-edit ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      ✏️
    </button>
  )
}

export default EditButton
