import React from 'react'
import StarRating from '../StarRating.jsx'
import Badge from '../Badge.jsx'
import ContactButton from '../ContactButton.jsx'
import { formatPrice } from '../../utils/format.js'

function HomeSection({ profile }) {
  const isShop = profile.type === 'shop'

  return (
    <div>
      <p style={{ marginBottom: 20 }}>{profile.description || 'No description yet.'}</p>

      {isShop ? (
        <>
          <div className="detail-meta" style={{ marginBottom: 16 }}>
            <Badge tone="neutral">{profile.category}</Badge>
            {profile.homeDelivery && <Badge tone="success">Home Delivery</Badge>}
            <span>Open {profile.timing?.open} – {profile.timing?.close} · {profile.timing?.openDays}</span>
          </div>
          {profile.products?.length > 0 && (
            <>
              <h3 style={{ marginBottom: 12 }}>Top products</h3>
              <div className="grid grid-4 product-grid">
                {profile.products.slice(0, 4).map((p) => (
                  <div key={p.id} className={`product-card card ${p.mostSelling ? 'product-card-highlight' : ''}`}>
                    {p.mostSelling && <Badge tone="success">Most Selling</Badge>}
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="product-thumb-img" /> : <span className="product-thumb">{p.icon}</span>}
                    <h3>{p.name}</h3>
                    <p className="product-price">{formatPrice(p.price)} <span style={{ fontSize: '0.75em', color: 'var(--color-text-light)' }}>/{p.priceUnit}</span></p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="detail-meta" style={{ marginBottom: 16 }}>
            <Badge tone={profile.availability?.includes('Today') ? 'success' : 'neutral'}>
              {profile.availability}
            </Badge>
            <span>{profile.workingDays} · {profile.timeSlots}</span>
          </div>
          <p className="service-price" style={{ fontSize: '1.15rem' }}>
            Starting at <strong>{formatPrice(profile.price?.amount)}</strong> / {profile.price?.unit}
          </p>
          {profile.serviceArea && <p style={{ color: 'var(--color-text-light)' }}>Serves {profile.serviceArea}</p>}
          {profile.videoUrl && (
            <div className="service-showcase-video">
              <h3 style={{ margin: '20px 0 10px' }}>Showcase video</h3>
              <video src={profile.videoUrl} controls style={{ width: '100%', maxWidth: 480, borderRadius: 12 }} />
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 20 }}>
        <StarRating rating={profile.rating} reviews={profile.reviewCount} />
      </div>
      <div style={{ marginTop: 16 }}>
        <ContactButton phone={profile.phone} />
      </div>
    </div>
  )
}

export default HomeSection
