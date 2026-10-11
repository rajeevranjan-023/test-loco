import { useEffect } from 'react'

// Closes a popup menu on an outside press and on Escape (Escape also hands focus back to the button that opened it).
export function useDismiss(open, onClose, rootRef, returnFocusRef) {
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') { onClose(); returnFocusRef?.current?.focus?.() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onClose, rootRef, returnFocusRef])
}
