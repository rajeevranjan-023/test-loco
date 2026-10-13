import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const ViewModeContext = createContext(null)

export function ViewModeProvider({ children }) {
  const { isSeller, epoch } = useAuth()
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('lf_view_mode') || 'consumer')

  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setViewMode(localStorage.getItem('lf_view_mode') || 'consumer')
  }, [epoch])

  useEffect(() => {
    if (isSeller) {
      localStorage.setItem('lf_view_mode', viewMode)
    }
  }, [viewMode, isSeller])

  const effectiveMode = isSeller ? viewMode : 'consumer'

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
