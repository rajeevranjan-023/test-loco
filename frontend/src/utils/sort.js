
/**
 * Return a new array of products sorted by price, ascending.
 */
export function sortByPriceAsc(products = []) {
  return [...products].sort((a, b) => a.price - b.price)
}

/**
 * Return the id of the cheapest product in a list, or null if empty.
 */
export function getCheapestId(products = []) {
  if (products.length === 0) return null
  return sortByPriceAsc(products)[0].id
}
