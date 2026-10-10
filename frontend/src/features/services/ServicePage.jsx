import React from 'react'
import { Link, useParams } from 'react-router-dom'
import commonServices from '../../data/commonServices.json'
import StarRating from '../../components/StarRating.jsx'
import Badge from '../../components/Badge.jsx'
import { formatPrice } from '../../utils/format.js'
import '../../css/ShopService.css'

function ServicePage() {
  const { id } = useParams()
  const provider = commonServices.find((s) => String(s.id) === id)

  if (!provider) {
    return (
      <section className="section">
        <div className="container detail-not-found">
          <h2>Service provider not found</h2>
          <p>We couldn't find the profile you were looking for.</p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="container">
        <div className="detail-header card">
          <span className="detail-icon">{provider.icon}</span>
          <div>
            <h1>{provider.name}</h1>
            <p className="detail-address">{provider.profession} · {provider.location}</p>
            <div className="detail-meta">
              <StarRating rating={provider.rating} reviews={provider.reviews} />
              <span>{provider.experience} experience</span>
              <Badge tone={provider.availability?.includes('Today') ? 'success' : 'neutral'}>
                {provider.availability}
              </Badge>
            </div>
          </div>
        </div>

        <div className="detail-body card" style={{ marginTop: '24px' }}>
          <h2>Pricing</h2>
          <p className="service-price" style={{ fontSize: '1.15rem' }}>
            Starting at <strong>{formatPrice(provider.priceFrom)}</strong>
          </p>

          <h2 style={{ marginTop: '28px' }}>Services offered</h2>
          <ul className="detail-list">
            <li>{provider.profession} consultation &amp; diagnosis</li>
            <li>On-site {provider.profession.toLowerCase()} repair</li>
            <li>Installation &amp; maintenance</li>
          </ul>

          <a className="btn btn-primary" style={{ marginTop: '24px' }} href={`tel:${provider.phone.replace(/\s/g, '')}`}>
            📞 Contact {provider.name.split(' ')[0]}
          </a>
        </div>
      </div>
    </section>
  )
}

export default ServicePage
