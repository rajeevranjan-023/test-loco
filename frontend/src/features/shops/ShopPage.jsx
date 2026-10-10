import React from 'react'
import { Link, useParams } from 'react-router-dom'
import shops from '../../data/shops.json'
import products from '../../data/products.json'
import StarRating from '../../components/StarRating.jsx'
import { formatDistance, formatPrice } from '../../utils/format.js'
import { sortByPriceAsc, getCheapestId } from '../../utils/sort.js'
import '../../css/ShopService.css'

function ShopPage() {
  const { shopId } = useParams()
  const shop = shops.find((s) => s.id === shopId)

  if (!shop) {
    return (
      <section className="section">
        <div className="container detail-not-found">
          <h2>Shop not found</h2>
          <p>We couldn't find the shop you were looking for.</p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </section>
    )
  }

  const shopProducts = sortByPriceAsc(products.filter((p) => p.shopId === shop.id))
  const cheapestId = getCheapestId(shopProducts)

  return (
    <section className="section">
      <div className="container">
        <div className="detail-header card">
          <span className="detail-icon">{shop.icon}</span>
          <div>
            <h1>{shop.name}</h1>
            <p className="detail-address">{shop.address}</p>
            <div className="detail-meta">
              <StarRating rating={shop.rating} reviews={shop.reviews} />
              <span>{formatDistance(shop.distanceKm)} away</span>
            </div>
            <div className="detail-tags">
              {shop.tags?.map((tag) => (
                <span key={tag} className="detail-tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="section-heading" style={{ textAlign: 'left', marginTop: '48px' }}>
          <h2>Products at this shop</h2>
          <p style={{ margin: 0 }}>Sorted by price, lowest first.</p>
        </div>

        {shopProducts.length === 0 ? (
          <p className="detail-empty">No products listed for this shop yet.</p>
        ) : (
          <div className="product-list">
            {shopProducts.map((product) => (
              <div
                key={product.id}
                className={`product-list-row card ${product.id === cheapestId ? 'product-card-highlight' : ''}`}
              >
                <span className="product-thumb">{product.icon}</span>
                <span className="product-list-name">{product.name}</span>
                {product.id === cheapestId && <span className="badge badge-success">Cheapest</span>}
                <span className="product-list-price">{formatPrice(product.price)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default ShopPage
