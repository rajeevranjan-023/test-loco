import { useRef, useCallback } from 'react'

export function useLongPress(onLongPress, onClick, duration = 550) {
  const timerRef = useRef(null)
  const triggeredRef = useRef(false)

  const start = useCallback(() => {
    triggeredRef.current = false
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true
      onLongPress()
    }, duration)
  }, [onLongPress, duration])

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleClick = useCallback((e) => {
    if (triggeredRef.current) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }, [onClick])

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onClick: handleClick,
  }
}
