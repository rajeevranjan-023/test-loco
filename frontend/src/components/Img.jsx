import React, { useState, useEffect } from 'react'
import { getImageName, getFileName } from '../utils/imageName.js'

function Img({ src, alt, className = '', eager = false, placeholder = 'file' }) {
  const [error, setError] = useState(false)
  useEffect(() => setError(false), [src]) // new src -> try again

  const name = getImageName(src)
  const file = getFileName(src)

  if (!src || error) {
    return (
      <div
        role="img"
        aria-label={alt || name}
        className={`flex items-center justify-center overflow-hidden bg-gray-200 px-1 text-center text-[10px] font-medium leading-tight text-gray-500 ${className}`}
      >
        {placeholder === 'initial'
          ? <span className="text-2xl font-bold text-gray-400" aria-hidden>{(alt || '?').trim().charAt(0).toUpperCase()}</span>
          : <span className="line-clamp-3 break-all">{file}</span>}
      </div>
    )
  }

  const url = /^(https?:|data:|\/)/.test(src) ? src : `/${src}`
  return (
    <img
      src={url}
      alt={alt || name}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setError(true)}
      className={`bg-gray-100 object-cover ${className}`}
    />
  )
}
export default React.memo(Img)
