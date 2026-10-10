

function matches(text, query) {
  return text?.toLowerCase().includes(query.trim().toLowerCase())
}

/**
 * Search products by name or shop name.
 */
export function searchProducts(products, query) {
  if (!query) return products
  return products.filter(
    (p) => matches(p.name, query) || matches(p.shopName, query)
  )
}

/**
 * Search services by provider name or profession.
 */
export function searchServices(services, query) {
  if (!query) return services
  return services.filter(
    (s) => matches(s.name, query) || matches(s.profession, query)
  )
}

/**
 * Search shops by name or address.
 */
export function searchShops(shops, query) {
  if (!query) return shops
  return shops.filter((s) => matches(s.name, query) || matches(s.address, query))
}

/**
 * Build a small list of quick suggestions (used for the search bar's
 * live dropdown) from products, services and shops combined.
 */
export function getSuggestions({ products = [], services = [], shops = [] }, query, limit = 6) {
  if (!query || query.trim().length < 1) return []

  const productHits = searchProducts(products, query).map((p) => ({
    id: `product-${p.id}`,
    label: p.name,
    type: 'Product',
    query: p.name,
  }))
  const serviceHits = searchServices(services, query).map((s) => ({
    id: `service-${s.id}`,
    label: `${s.name} · ${s.profession}`,
    type: 'Service',
    query: s.profession,
  }))
  const shopHits = searchShops(shops, query).map((s) => ({
    id: `shop-${s.id}`,
    label: s.name,
    type: 'Shop',
    query: s.name,
  }))

  return [...productHits, ...serviceHits, ...shopHits].slice(0, limit)
}
