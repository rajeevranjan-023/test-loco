// Straight-line (haversine) distance in km between two lat/lng points.
// Used as a client-side fallback for "X km away" when the backend
// couldn't compute a distance itself (e.g. the shop has no stored
// coordinates). When real coordinates are available (LocationContext),
// they're passed straight to the backend instead — see sections/NearbyShops.jsx.
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

// Matches the seed script's demo shop location (Sector 12, New Delhi).
export const REFERENCE_COORDS = { lat: 28.4089, lng: 77.3178 }

// Finds which of a list of {name, state, lat, lng} cities a given point
// is closest to — used to turn raw GPS coordinates into a human-readable
// "near <city>" label instead of showing latitude/longitude digits.
export function nearestCity(lat, lng, cities) {
  let best = null
  let bestDistance = Infinity
  for (const city of cities) {
    const d = haversineKm(lat, lng, city.lat, city.lng)
    if (d < bestDistance) {
      bestDistance = d
      best = city
    }
  }
  return best ? { city: best, distanceKm: bestDistance } : null
}
