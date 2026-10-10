import React from 'react'
import '../../css/Loading.css'

/**
 * Small inline spinner for action-level loading (buttons, inline saves).
 * size: 'sm' | 'md' | 'lg'
 */
function Spinner({ size = 'sm', label }) {
  return (
    <span className={`lf-spinner lf-spinner-${size}`} role="status" aria-live="polite">
      <span className="lf-spinner-ring" aria-hidden="true" />
      {label && <span className="lf-spinner-label">{label}</span>}
    </span>
  )
}

export default Spinner
