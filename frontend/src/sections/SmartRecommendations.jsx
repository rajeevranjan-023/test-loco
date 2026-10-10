import React, { useMemo } from 'react'
import { api } from '../services/api.js'
import { useApiData } from '../hooks/useApiData.js'
import RecommendationCard from '../features/home/RecommendationCard.jsx'
import SkeletonCard from '../components/SkeletonCard.jsx'

function SmartRecommendations() {
  const { data: services, loading: loadingServices } = useApiData(() => api.get('/api/services'), [])
  const { data: products, loading: loadingProducts } = useApiData(() => api.get('/api/products'), [])
  const loading = loadingServices || loadingProducts

  const recommendations = useMemo(() => {
    if (loading) return []
    const list = []

    const topService = [...services].sort((a, b) => b.rating - a.rating)[0]
    if (topService) {
      list.push({
        id: 'top-service',
        icon: '🔥',
        title: `Popular in your area: ${topService.workType}`,
        subtitle: `${topService.name} is highly rated nearby.`,
        cta: 'Explore',
        query: topService.workType,
      })
    }

    const todayService = services.find((s) => s.availability?.includes('Today') && s !== topService)
    if (todayService) {
      list.push({
        id: 'available-today',
        icon: '⚡',
        title: `${todayService.workType} available today`,
        subtitle: `${todayService.name} can take your job right away.`,
        cta: 'Book Now',
        query: todayService.workType,
      })
    }

    if (products.length > 0) {
      const cheapest = [...products].sort((a, b) => a.price - b.price)[0]
      list.push({
        id: 'best-price',
        icon: '💰',
        title: `Great price on ${cheapest.name}`,
        subtitle: `Available at ${cheapest.shopName}.`,
        cta: 'View Deal',
        query: cheapest.name,
      })

      const other = products.find((p) => p.id !== cheapest.id)
      if (other) {
        list.push({
          id: 'trending-product',
          icon: '🛍️',
          title: `Trending: ${other.name}`,
          subtitle: `From ${other.shopName}.`,
          cta: 'View Product',
          query: other.name,
        })
      }
    }

    return list.slice(0, 4)
  }, [services, products, loading])

  return (
    <section className="section section-alt">
      <div className="container">
        <div className="section-heading">
          <h2>Recommended For You</h2>
          <p>Picks based on what's actually trending on Local Finder right now.</p>
        </div>

        {loading ? (
          <div className="grid grid-4 recommendation-grid">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : recommendations.length === 0 ? (
          <p className="detail-empty">Nothing to recommend yet — check back soon.</p>
        ) : (
          <div className="grid grid-4 recommendation-grid">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        )}
      </div>
    </section> 
  )
}

export default SmartRecommendations
