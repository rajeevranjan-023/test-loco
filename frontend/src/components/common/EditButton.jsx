import React from 'react'

/**
 * Small pencil icon-button used next to any editable row/field
 * (products, credit/udhar entries, sales, profile fields, availability...).
 */
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
