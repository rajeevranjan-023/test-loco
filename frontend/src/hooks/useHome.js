import { useEffect, useRef, useState } from 'react'
import { fetchHome } from '../services/homeApi.js'

const CITY_KEY = 'lf_home_city'
const read = () => { try { return localStorage.getItem(CITY_KEY) || '' } catch { return '' } }
const write = (c) => { try { localStorage.setItem(CITY_KEY, c) } catch { /* private mode */ } }

// Loads the homepage for the selected city. Changing the city refetches in place — the previous content stays on
// screen (no page reload, no layout jump) and `refreshing` is true until the new data lands.
export function useHome() {
  const [city, setCityState] = useState(read)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    setLoading(true)
    fetchHome(city)
      .then((d) => {
        if (id !== seq.current) return // a newer request superseded this one
        setData(d)
        setError(null)
        if (!city && d.city) write(d.city)
      })
      .catch((e) => id === seq.current && setError(e))
      .finally(() => id === seq.current && setLoading(false))
  }, [city, tick])

  const setCity = (name) => { write(name); setCityState(name) }
  return { data, error, loading, refreshing: loading && !!data, city: data?.city || city, setCity, retry: () => setTick((n) => n + 1) }
}
