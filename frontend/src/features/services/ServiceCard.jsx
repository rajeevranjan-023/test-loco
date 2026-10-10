import React from 'react'
import { useNavigate } from 'react-router-dom'
import StarRating from '../../components/StarRating.jsx'
import Badge from '../../components/Badge.jsx'
import { formatPrice } from '../../utils/format.js'
import { profilePath } from '../../utils/username.js'

function ServiceCard({ service }) {
  const navigate = useNavigate()
  const { username, name, workType, serviceArea, price, rating, reviewCount, availability, distanceKm } = service

  return (
    <div className="service-card card">
      <div className="service-card-top">
        <span className="service-icon">🛠️</span>
        {availability && (
          <Badge tone={availability.includes('Today') ? 'success' : 'neutral'}>
            {availability}
          </Badge>
        )}
      </div>
      <h3>{workType}</h3>
      <p className="service-provider">{name}</p>
      {serviceArea && <p className="service-provider">Serves {serviceArea}</p>}
      <StarRating rating={rating} reviews={reviewCount} />
      {typeof distanceKm === 'number' && <p className="shop-distance">{distanceKm} km away</p>}
      <p className="service-price">
        Starting at <strong>{formatPrice(price?.amount)}</strong> / {price?.unit}
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(profilePath(username))}>
        Book Now
      </button>
    </div>
  )
}

export default ServiceCard
