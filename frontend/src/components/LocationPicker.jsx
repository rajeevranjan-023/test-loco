import React from 'react'
import { useLocationContext } from '../context/LocationContext.jsx'
import { EXAMPLE_CITIES } from '../utils/cities.js'

function LocationPicker({ compact = false }) {
  const { coords, label, loading, error, requestLocation, setManualCity } = useLocationContext()

  return (
    <div className={compact ? 'location-picker location-picker-compact' : 'location-picker'}>
      <div className="location-picker-row">
        <button type="button" className="btn btn-outline btn-sm" onClick={requestLocation} disabled={loading}>
          {loading ? 'Locating…' : '📍 Use My Location'}
        </button>

        <select
          className="location-picker-select"
          value=""
          onChange={(e) => e.target.value && setManualCity(e.target.value)}
        >
          <option value="">Or choose a city…</option>
          {EXAMPLE_CITIES.map((city) => (
            <option key={city.name} value={city.name}>{city.name}, {city.state}</option>
          ))}
        </select>
      </div>

      {label && <span className="location-picker-label">📍 {label}</span>}
      {error && <p className="location-picker-error">{error}</p>}
    </div>
  )
}

export default LocationPicker
