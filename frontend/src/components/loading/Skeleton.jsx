import React from 'react'
import '../../css/Loading.css'

function Skeleton({ shape = 'line', width, height, style = {} }) {
  const dims = {
    width: width ?? (shape === 'circle' ? 40 : '100%'),
    height: height ?? (shape === 'circle' ? 40 : shape === 'rect' ? 120 : 14),
    ...style,
  }
  return <span className={`lf-skeleton lf-skeleton-${shape}`} style={dims} aria-hidden="true" />
}

export default Skeleton
