import React from 'react'
import { useNavigate } from 'react-router-dom'
import StarRating from '../../components/StarRating.jsx'
import { profilePath } from '../../utils/username.js'

// `shop` matches the backend's Shop.toPublicProfile() shape:
// { id, username, name, category, description, phone, location, timing, rating, reviewCount }
// `distanceKm` is computed client-side (see utils/geo.js) and passed in
// separately since the backend doesn't calculate it.
function ShopCard({ shop, distanceKm }) {
  const navigate = useNavigate()
  const { username, name, category, location, rating, reviewCount } = shop

  return (
    <div className="shop-card card">
      <span className="shop-icon">🏬</span>
      <h3>{name}</h3>
      <p className="shop-address">{location?.address || category}</p>
      <div className="shop-meta">
        <StarRating rating={rating} reviews={reviewCount} size="sm" />
        {typeof distanceKm === 'number' && <span className="shop-distance">{distanceKm} km away</span>}
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(profilePath(username))}>
        View Shop
      </button>
    </div>
  )
}

export default ShopCard
