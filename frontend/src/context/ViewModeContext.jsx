import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const ViewModeContext = createContext(null)

export function ViewModeProvider({ children }) {
  const { isSeller } = useAuth()
  // First-time visitors (nothing in localStorage yet) land on the normal
  // consumer homepage — 'seller' is only ever reached by explicitly
  // clicking "Analytic View", at which point it's persisted here.
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('lf_view_mode') || 'consumer')

  useEffect(() => {
    if (isSeller) {
      localStorage.setItem('lf_view_mode', viewMode)
    }
  }, [viewMode, isSeller])

  // Non-sellers can never be in seller mode, regardless of stored state.
  const effectiveMode = isSeller ? viewMode : 'consumer'

  // Explicit, single-purpose setters (used by the "Home" / "Analytic View"
  // nav buttons) rather than a single ambiguous toggle.
  const goHome = () => setViewMode('consumer')
  const goAnalytics = () => setViewMode('seller')

  return (
    <ViewModeContext.Provider value={{ viewMode: effectiveMode, setViewMode, goHome, goAnalytics, isSeller }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext)
  if (!ctx) throw new Error('useViewMode must be used inside <ViewModeProvider>')
  return ctx
}
