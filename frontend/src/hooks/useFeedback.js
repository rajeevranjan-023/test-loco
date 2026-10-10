import { useCallback, useRef, useState } from 'react'

export function useFeedback() {
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message }
  const timerRef = useRef(null)

  const showSuccess = useCallback((message) => {
    clearTimeout(timerRef.current)
    setFeedback({ type: 'success', message })
    timerRef.current = setTimeout(() => setFeedback(null), 3000)
  }, [])

  const showError = useCallback((message) => {
    clearTimeout(timerRef.current)
    setFeedback({ type: 'error', message })
  }, [])

  const clear = useCallback(() => {
    clearTimeout(timerRef.current)
    setFeedback(null)
  }, [])

  return { feedback, showSuccess, showError, clear }
}
