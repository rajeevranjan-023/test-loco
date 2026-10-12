import { useEffect, useState } from 'react'

// Like useMockApi, but for real network calls: awaits an async fetcher
// (typically api.get(...)) and exposes {data, loading, error}. Re-runs
// whenever `deps` changes (e.g. a search query).
export function useApiData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0) // bump → run the fetcher again (retry after a failure)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, retry: () => setTick((n) => n + 1) }
}
