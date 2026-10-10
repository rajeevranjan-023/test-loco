import React from 'react'

function SectionHeading({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="row-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actionLabel && (
        <button type="button" className="row-heading-action" onClick={onAction}>
          {actionLabel} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}

export default SectionHeading
