
/**
 * Format a number as an Indian Rupee price string, e.g. 42999 -> "₹42,999"
 */
export function formatPrice(amount) {
  if (typeof amount !== 'number') return amount
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * Format a distance in kilometers, e.g. 1.2 -> "1.2 km"
 */
export function formatDistance(km) {
  if (typeof km !== 'number') return km
  return `${km} km`
}

/**
 * Clamp a rating to one decimal place for display, e.g. 4.567 -> "4.6"
 */
export function formatRating(rating) {
  if (typeof rating !== 'number') return rating
  return rating.toFixed(1)
}
