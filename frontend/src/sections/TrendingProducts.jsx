import React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { useApiData } from '../hooks/useApiData.js'
import ProductCard from '../features/shops/ProductCard.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SkeletonCard from '../components/SkeletonCard.jsx'

function TrendingProducts() {
  const navigate = useNavigate()
  const { data: products, loading, error } = useApiData(() => api.get('/api/products'), [])

  return (
    <section className="section" id="trending-products">
      <div className="container">
        <SectionHeading
          title="Trending Products"
          subtitle="Best prices, spotted near you"
          actionLabel="View All"
          onAction={() => navigate('/search?type=product')}
        />

        {error ? (
          <p className="detail-empty">Couldn't load products</p>
        ) : (
          <div className="grid grid-4 product-grid">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </div>
    </section>
  )
}

export default TrendingProducts
