import React from 'react'
import '../../css/Loading.css'

/**
 * Generic shimmer block — the building brick for custom skeleton layouts
 * (a line of text, an avatar circle, an image rectangle, etc).
 *
 * shape: 'line' | 'circle' | 'rect'
 */
function Skeleton({ shape = 'line', width, height, style = {} }) {
  const dims = {
    width: width ?? (shape === 'circle' ? 40 : '100%'),
    height: height ?? (shape === 'circle' ? 40 : shape === 'rect' ? 120 : 14),
    ...style,
  }
  return <span className={`lf-skeleton lf-skeleton-${shape}`} style={dims} aria-hidden="true" />
}

export default Skeleton
