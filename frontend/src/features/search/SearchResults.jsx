import React from 'react'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import ProductList from './ProductList.jsx'
import ServiceCard from '../services/ServiceCard.jsx'
import ShopCard from '../shops/ShopCard.jsx'
import SectionHeading from '../../components/SectionHeading.jsx'
import SkeletonCard from '../../components/SkeletonCard.jsx'

// Calls the real backend: GET /api/search?q=... . 
function SearchResults({ query }) {
  const { data, loading, error } = useApiData(
    () => api.get(`/api/search?q=${encodeURIComponent(query)}`),
    [query]
  )

  if (loading) {
    return (
      <div className="grid grid-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="detail-empty">Couldn't reach the search API — is the backend running?</div>
  }

  const { products, services, shops } = data
  const hasResults = products.length + services.length + shops.length > 0

  if (!hasResults) {
    return (
      <div className="detail-empty">
        <p>No results for "{query}". Try a different search term.</p>
      </div>
    )
  }

  return (
    <div className="search-results">
      {products.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <SectionHeading title="Products" subtitle="Sorted by price, lowest first" />
          <ProductList products={products} />
        </div>
      )}

      {services.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <SectionHeading title="Services" subtitle="Top-rated professionals near you" />
          <div className="grid grid-4">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      )}

      {shops.length > 0 && (
        <div>
          <SectionHeading title="Shops" subtitle="Nearby stores that match" />
          <div className="grid grid-4">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchResults
