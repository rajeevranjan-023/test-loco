import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { useAuth } from './AuthContext.jsx'
import { nearestCity } from '../utils/geo.js'
import { EXAMPLE_CITIES } from '../utils/cities.js'

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [coords, setCoords] = useState(null)
  const [source, setSource] = useState(null) 
  const [status, setStatus] = useState('idle') 
  const [error, setError] = useState('')

  const saveIfLoggedIn = useCallback(
    (next) => {
      if (isAuthenticated) {
        api.patch('/api/auth/location', next, { requiresAuth: true }).catch(() => {
        })
      }
    },
    [isAuthenticated]
  )

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      setError('Geolocation is not supported by this browser.')
      return
    }

    setStatus('locating')
    setError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude }
        setCoords(next)
        setSource('gps')
        setStatus('granted')
        saveIfLoggedIn(next)
      },
      (err) => {
        setStatus('denied')
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied.'
            : 'Could not determine your location.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [saveIfLoggedIn])

  const setManualCity = useCallback(
    (cityName) => {
      const city = EXAMPLE_CITIES.find((c) => c.name === cityName)
      if (!city) return
      const next = { lat: city.lat, lng: city.lng }
      setCoords(next)
      setSource('manual')
      setStatus('granted')
      setError('')
      saveIfLoggedIn(next)
    },
    [saveIfLoggedIn]
  )

  // Auto-request once per login session (covers "app opens" and
  // "seller logs in" — both just mean "a user object appeared").
  useEffect(() => {
    // Not while a brand-new account is still onboarding: the signup flow has its own opt-in location screen, and the
    // browser permission prompt must only appear after the person explicitly chooses "Enable Location".
    if (isAuthenticated && user?.onboardingCompleted !== false) {
      requestLocation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Human-readable label derived from whichever coordinates we have —
  // never shows raw lat/lng in the UI.
  const label = useMemo(() => {
    if (!coords) return null
    const match = nearestCity(coords.lat, coords.lng, EXAMPLE_CITIES)
    if (!match) return null
    // Within ~2km, call it exact; otherwise "near <city>".
    return match.distanceKm < 2 ? `${match.city.name}, ${match.city.state}` : `Near ${match.city.name}, ${match.city.state}`
  }, [coords])

  const value = {
    coords,
    label,
    source,
    status,
    error,
    requestLocation,
    setManualCity,
    setCoordsFromOnboarding: (next) => { setCoords(next); setSource('gps'); setStatus('granted') },
    loading: status === 'locating',
  }

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocationContext() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocationContext must be used inside <LocationProvider>')
  return ctx
}
