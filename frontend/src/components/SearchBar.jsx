import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Chip from './Chip.jsx'
import LocationPicker from './LocationPicker.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { api } from '../services/api.js'

function SearchBar({
  placeholder = 'Search Product or Service...',
  trendingChips = [],
  showLocation = true,
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const navigate = useNavigate()
  const debouncedQuery = useDebouncedValue(query, 250)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([])
      return
    }
    let cancelled = false
    api
      .get(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((data) => {
        if (cancelled) return
        const productHits = data.products.slice(0, 3).map((p) => ({
          id: `product-${p.id}`, label: p.name, type: 'Product', query: p.name,
        }))
        const serviceHits = data.services.slice(0, 3).map((s) => ({
          id: `service-${s.id}`, label: s.name, type: 'Service', query: s.name,
        }))
        const shopHits = data.shops.slice(0, 3).map((s) => ({
          id: `shop-${s.id}`, label: s.name, type: 'Shop', query: s.name,
        }))
        setSuggestions([...productHits, ...serviceHits, ...shopHits].slice(0, 6))
      })
      .catch(() => !cancelled && setSuggestions([]))
    return () => { cancelled = true }
  }, [debouncedQuery])

  const runSearch = (term) => {
    const trimmed = term.trim()
    if (trimmed !== '') {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    runSearch(query)
  }

  return (
    <div className="search-bar-wrap">
      <form className="search-bar" onSubmit={handleSubmit}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
        />
        <button type="submit" className="btn btn-primary search-btn">
          Search
        </button>

        {focused && suggestions.length > 0 && (
          <ul className="search-suggestions">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={() => runSearch(s.query)}
                  className="search-suggestion-item"
                >
                  <span>{s.label}</span>
                  <span className="search-suggestion-type">{s.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {showLocation && (
        <div className="search-location-row">
          <LocationPicker compact />
        </div>
      )}

      {trendingChips.length > 0 && (
        <div className="search-chips">
          <span className="search-chips-label">Trending:</span>
          {trendingChips.map((chip) => (
            <Chip key={chip} label={chip} onClick={() => runSearch(chip)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchBar
