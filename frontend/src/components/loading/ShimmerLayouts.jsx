import React from 'react'
import Skeleton from './Skeleton.jsx'
import '../../css/Loading.css'

export function ShimmerCard({ variant = 'default' }) {
  return (
    <div className={`skeleton-card skeleton-card-${variant}`}>
      <Skeleton shape="circle" />
      <Skeleton shape="line" width="80%" />
      <Skeleton shape="line" width="50%" />
    </div>
  )
}

export function ShimmerGrid({ count = 4, columns = 'grid-4', variant = 'default' }) {
  return (
    <div className={`grid ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} variant={variant} />
      ))}
    </div>
  )
}

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
