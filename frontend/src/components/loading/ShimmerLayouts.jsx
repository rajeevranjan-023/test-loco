import React from 'react'
import Skeleton from './Skeleton.jsx'
import '../../css/Loading.css'

/**
 * Shimmering placeholder card, used in grids of shops/products/services
 * while real data loads. Kept visually consistent with SkeletonCard.jsx
 * (same classes/animation) but usable standalone anywhere.
 */
export function ShimmerCard({ variant = 'default' }) {
  return (
    <div className={`skeleton-card skeleton-card-${variant}`}>
      <Skeleton shape="circle" />
      <Skeleton shape="line" width="80%" />
      <Skeleton shape="line" width="50%" />
    </div>
  )
}

/** A row of N shimmer cards — drop-in replacement for a data grid while loading. */
export function ShimmerGrid({ count = 4, columns = 'grid-4', variant = 'default' }) {
  return (
    <div className={`grid ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} variant={variant} />
      ))}
    </div>
  )
}

/** Shimmering table rows — for dashboard tables (products, sales, credit) while loading. */
export function ShimmerTable({ rows = 4, columns = 5 }) {
  return (
    <table className="dashboard-table lf-shimmer-table">
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: columns }).map((__, c) => (
              <td key={c}>
                <Skeleton shape="line" width={c === 0 ? '90%' : '60%'} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Shimmering stacked list items — for feeds like requirement inbox / reviews. */
export function ShimmerList({ count = 3 }) {
  return (
    <div className="lf-shimmer-list">
      {Array.from({ length: count }).map((_, i) => (
        <div className="lf-shimmer-list-item card" key={i}>
          <Skeleton shape="circle" width={44} height={44} />
          <div className="lf-shimmer-list-body">
            <Skeleton shape="line" width="40%" />
            <Skeleton shape="line" width="90%" />
            <Skeleton shape="line" width="70%" />
          </div>
        </div>
      ))}
    </div>
  )
}
