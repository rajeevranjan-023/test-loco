import React from 'react'

function AboutSection({ profile }) {
  const isShop = profile.type === 'shop'

  return (
    <div className="detail-body card">
      <h3 style={{ marginBottom: 12 }}>About</h3>
      <p style={{ color: 'var(--color-text-light)', marginBottom: 20 }}>
        {profile.description || 'No description provided.'}
      </p>

      {isShop ? (
        <>
          <h4 style={{ marginBottom: 8 }}>Location</h4>
          <p style={{ marginBottom: 4 }}>{profile.location?.address}</p>
          <p style={{ color: 'var(--color-text-light)', marginBottom: 20 }}>
            {[profile.location?.area, profile.location?.district, profile.location?.state].filter(Boolean).join(', ')}
          </p>

          <h4 style={{ marginBottom: 8 }}>Business details</h4>
          <ul className="detail-list">
            <li>Category: {profile.category}</li>
            <li>Business type: {profile.businessType}</li>
            <li>Home delivery: {profile.homeDelivery ? 'Available' : 'Not available'}</li>
            <li>Hours: {profile.timing?.open} - {profile.timing?.close} ({profile.timing?.openDays})</li>
          </ul>
        </>
      ) : (
        <>
          <h4 style={{ marginBottom: 8 }}>Work type</h4>
          <p style={{ marginBottom: 20 }}>{profile.workType}</p>

          <h4 style={{ marginBottom: 8 }}>Availability</h4>
          <ul className="detail-list">
            <li>Working days: {profile.workingDays}</li>
            <li>Time slots: {profile.timeSlots || 'Not specified'}</li>
            <li>Status: {profile.availability}</li>
          </ul>
        </>
      )}
    </div>
  )
}

export default AboutSection
