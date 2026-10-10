import React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { useApiData } from '../hooks/useApiData.js'
import { useLocationContext } from '../context/LocationContext.jsx'
import ServiceCard from '../features/services/ServiceCard.jsx'
import HorizontalScroller from '../components/HorizontalScroller.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SkeletonCard from '../components/SkeletonCard.jsx'

function CommonServices() {
  const navigate = useNavigate()
  const { coords } = useLocationContext()

  const { data: services, loading, error } = useApiData(
    () => api.get('/api/services', coords ? { params: { lat: coords.lat, lng: coords.lng } } : {}),
    [coords?.lat, coords?.lng]
  )

  return (
    <section className="section" id="common-services">
      <div className="container">
        <SectionHeading
          title="Most Requested Services"
          subtitle={coords ? 'Sorted by distance from your current location' : 'Highly rated professionals available right now'}
          actionLabel="View All"
          onAction={() => navigate('/search?type=service')}
        />

        {error ? (
          <p className="detail-empty">Couldn't load services — is the backend running?</p>
        ) : (
          <HorizontalScroller>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : services.map((service) => <ServiceCard key={service.id} service={service} />)}
          </HorizontalScroller>
        )}
      </div>
    </section>
  )
}

export default CommonServices
