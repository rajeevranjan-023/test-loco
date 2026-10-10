import React from 'react'
import Skeleton from '../loading/Skeleton.jsx'
import { ShimmerGrid } from '../loading/ShimmerLayouts.jsx'

function ProfileSkeleton() {
  return (
    <div className="ig-profile-skeleton" aria-label="Loading profile">
      <div className="ig-profile-header">
        <Skeleton shape="circle" width={96} height={96} />
        <div className="ig-profile-info">
          <div className="ig-profile-top-row">
            <Skeleton shape="line" width={140} height={22} />
            <Skeleton shape="rect" width={100} height={34} style={{ borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 20, margin: '14px 0' }}>
            <Skeleton shape="line" width={70} />
            <Skeleton shape="line" width={70} />
            <Skeleton shape="line" width={70} />
          </div>
          <Skeleton shape="line" width="40%" />
          <Skeleton shape="line" width="65%" style={{ marginTop: 8 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '24px 0' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} shape="rect" width={90} height={36} style={{ borderRadius: 999 }} />
        ))}
      </div>

      <ShimmerGrid count={6} columns="grid-3" />
    </div>
  )
}

export default ProfileSkeleton
