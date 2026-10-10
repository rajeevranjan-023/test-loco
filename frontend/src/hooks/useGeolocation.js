import { useCallback, useState } from 'react'

export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)

  const requestLocation = useCallback(() => {
    setLoading(true)
    setTimeout(() => {
      setLocation('Sector 12, New Delhi')
      setLoading(false)
    }, 700)
  }, [])

  return { location, loading, requestLocation }
}
