import React, { useEffect, useState } from 'react'
import { getConnectivity, reportReachable, reportUnreachable, subscribeConnectivity } from '../services/connectivity.js'
import { MESSAGES } from '../services/apiError.js'

// One calm notice when the app cannot reach the server (offline, backend down, database down). It is a single shared state, so ten
// failed requests show ONE banner; it disappears by itself when a request succeeds or the browser comes back online. It never logs
// anyone out and it does not retry writes — pages decide whether a "Try again" is safe (ApiError.retryable).
const TEXT = { offline: MESSAGES.offline, network: MESSAGES.network, timeout: MESSAGES.network, unavailable: MESSAGES.unavailable }

export default function ConnectionBanner() {
  const [state, setState] = useState(getConnectivity)
  useEffect(() => {
    const unsub = subscribeConnectivity(setState)
    const off = () => reportUnreachable('offline')
    const on = () => { if (getConnectivity().kind === 'offline') reportReachable() }
    window.addEventListener('offline', off); window.addEventListener('online', on)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) off()
    return () => { unsub(); window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [])
  if (!state.down) return null
  return (
    <div role="status" aria-live="polite" style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#fff4e5', color: '#7a4a00', borderBottom: '1px solid #f5d39a', padding: '8px 16px', fontSize: '0.9rem', textAlign: 'center' }}>
      {TEXT[state.kind] || MESSAGES.network}
    </div>
  )
}
