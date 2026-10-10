import React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { useApiData } from '../hooks/useApiData.js'
import { useLocationContext } from '../context/LocationContext.jsx'
import ShopCard from '../features/shops/ShopCard.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import HorizontalScroller from '../components/HorizontalScroller.jsx'
import SkeletonCard from '../components/SkeletonCard.jsx'
import { haversineKm, REFERENCE_COORDS } from '../utils/geo.js'

function NearbyShops() {
  const navigate = useNavigate()
  const { coords } = useLocationContext()

  const { data: shops, loading, error } = useApiData(
    () => api.get('/api/shops', coords ? { params: { lat: coords.lat, lng: coords.lng } } : {}),
    [coords?.lat, coords?.lng]
  )

  return (
    <section className="section" id="nearby-shops">
      <div className="container">
        <SectionHeading
          title="Nearby Shops"
          subtitle={coords ? 'Sorted by distance from your current location' : 'Verified stores — enable location for distance sorting'}
          actionLabel="View All"
          onAction={() => navigate('/search?type=shop')}
        />

        {error ? (
          <p className="detail-empty">Couldn't load shops</p>
        ) : (
          <HorizontalScroller>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : shops.map((shop) => {
                  const distanceKm =
                    shop.distanceKm ??
                    (shop.location?.lat && shop.location?.lng
                      ? haversineKm(REFERENCE_COORDS.lat, REFERENCE_COORDS.lng, shop.location.lat, shop.location.lng)
                      : undefined)
                  return <ShopCard key={shop.id} shop={shop} distanceKm={distanceKm} />
                })}
          </HorizontalScroller>
        )}
      </div>
    </section>
  )
}

export default NearbyShops
