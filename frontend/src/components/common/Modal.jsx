import React, { useEffect } from 'react'
import '../../css/Modal.css'

/**
 * Generic modal dialog. Pass `footer` for custom action buttons (typically
 * Save/Cancel) — if omitted, a default Cancel button is shown.
 */
function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="lf-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`lf-modal lf-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="lf-modal-header">
          <h3>{title}</h3>
          <button type="button" className="lf-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="lf-modal-body">{children}</div>
        <div className="lf-modal-footer">
          {footer || (
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Modal
