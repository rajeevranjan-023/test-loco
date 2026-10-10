import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { isValidUsernameFormat, normalizeUsername, describeUsernameError } from '../utils/username.js'
import { useDebouncedValue } from './useDebouncedValue.js'

export function useUsernameAvailability(rawUsername) {
  const [status, setStatus] = useState('empty')
  const [message, setMessage] = useState('')
  const debounced = useDebouncedValue(rawUsername, 400)

  useEffect(() => {
    if (!debounced || !debounced.trim()) {
      setStatus('empty')
      setMessage('')
      return
    }

    const normalized = normalizeUsername(debounced)

    if (!isValidUsernameFormat(normalized)) {
      setStatus('invalid')
      setMessage(describeUsernameError(normalized))
      return
    }

    let cancelled = false
    setStatus('checking')
    setMessage('')

    api
      .get(`/api/seller/check-username/${encodeURIComponent(normalized)}`, { requiresAuth: true })
      .then((data) => {
        if (cancelled) return
        setStatus(data.available ? 'available' : 'taken')
        setMessage(data.available ? '' : data.message || 'That username is already taken.')
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setMessage(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [debounced])

  return { status, message, normalized: normalizeUsername(rawUsername || '') }
}
