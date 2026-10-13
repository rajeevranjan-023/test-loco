import React from 'react'
import { useUsernameAvailability } from '../hooks/useUsernameAvailability.js'

const STATUS_COPY = {
  empty: { text: '', color: 'var(--color-text-light)' },
  invalid: { text: '', color: '#e0455f' }, // message comes from the hook itself
  checking: { text: 'Checking availability…', color: 'var(--color-text-light)' },
  available: { text: '✅ Available', color: '#15803d' },
  taken: { text: '⚠️ Already taken', color: '#e0455f' },
  error: { text: '⚠️ Could not check right now', color: '#e0455f' },
}

function UsernameField({ value, onChange, onValidityChange }) {
  const { status, message } = useUsernameAvailability(value)

  React.useEffect(() => {
    onValidityChange?.(status === 'available')
  }, [status])

  const copy = STATUS_COPY[status] || STATUS_COPY.empty

  return (
    <label>
      Username (your public link: localfinder.app/yourname · 5–20 letters & numbers, at least 3 digits)
      <input
        required
        placeholder="@yourname"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={21}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {(copy.text || message) && (
        <span style={{ fontSize: '0.82rem', color: copy.color, fontWeight: 600 }}>
          {message || copy.text}
        </span>
      )}
    </label>
  )
}

export default UsernameField
