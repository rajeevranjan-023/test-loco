import React from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/Badge.jsx'
import StarRating from '../../components/StarRating.jsx'
import { formatPrice } from '../../utils/format.js'
import { profilePath } from '../../utils/username.js'

// `highlight` forces the "Cheapest" badge on (used by search results,

function ProductCard({ product, highlight = false }) {
  const navigate = useNavigate()
  const { name, icon, price, rating, shopUsername, shopName, tag } = product
  const badgeLabel = highlight ? 'Cheapest' : tag

  return (
    <div className={`product-card card ${highlight ? 'product-card-highlight' : ''}`}>
      {badgeLabel && (
        <Badge tone={badgeLabel === 'Cheapest' ? 'success' : 'deal'}>{badgeLabel}</Badge>
      )}
      <span className="product-thumb">{icon}</span>
      <h3>{name}</h3>
      <p className="product-price">{formatPrice(price)}</p>
      {typeof rating === 'number' && <StarRating rating={rating} size="sm" />}
      <button
        type="button"
        className="product-shop-link"
        onClick={() => shopUsername && navigate(profilePath(shopUsername))}
        disabled={!shopUsername}
      >
        {shopName} →
      </button>
    </div>
  )
}

export default ProductCard
