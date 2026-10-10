import React from 'react'
import Badge from '../Badge.jsx'
import { formatPrice } from '../../utils/format.js'

function ServicesSection({ profile }) {
  return (
    <div>
      <div className="section-heading" style={{ textAlign: 'left', marginBottom: 24 }}>
        <h2>Service Details</h2>
      </div>

      <div className="detail-body card">
        <h3 style={{ marginBottom: 8 }}>{profile.workType}</h3>
        <p style={{ color: 'var(--color-text-light)', marginBottom: 16 }}>{profile.description}</p>

        {profile.videoUrl && (
          <div className="service-showcase-video">
            <video src={profile.videoUrl} controls />
          </div>
        )}

        <p className="service-price" style={{ fontSize: '1.15rem', marginBottom: 16 }}>
          Starting at <strong>{formatPrice(profile.price?.amount)}</strong> / {profile.price?.unit}
        </p>

        <h4 style={{ marginBottom: 8 }}>Areas served</h4>
        {profile.areas && profile.areas.length > 0 ? (
          <div className="detail-tags" style={{ marginBottom: 16 }}>
            {profile.areas.map((a, i) => (
              <span key={i} className="detail-tag">{a.area || a.district || a.state}</span>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-light)', marginBottom: 16 }}>{profile.serviceArea || 'Not specified'}</p>
        )}

        <h4 style={{ marginBottom: 8 }}>Availability</h4>
        <div className="detail-meta">
          <Badge tone={profile.availability?.includes('Today') ? 'success' : 'neutral'}>
            {profile.availability}
          </Badge>
          <span>{profile.workingDays}</span>
          {profile.timeSlots && <span>{profile.timeSlots}</span>}
        </div>
      </div>
    </div>
  )
}

export default ServicesSection
