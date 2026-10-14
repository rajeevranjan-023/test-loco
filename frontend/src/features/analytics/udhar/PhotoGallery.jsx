import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, X } from 'lucide-react'

// Saved photos of an entry: thumbnails; tap one to see it full size.
export function PhotoGallery({ photos = [] }) {
  const [open, setOpen] = useState(null)
  useEffect(() => { if (open == null) return undefined; const h = (e) => e.key === 'Escape' && setOpen(null); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [open])
  if (!photos.length) return null
  return (
    <div className="mt-3" data-photo-gallery>
      <div className="mb-1 text-[12.5px] font-semibold">Photos</div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => <button key={p.url} type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}`} className="h-[96px] w-[96px] overflow-hidden rounded-lg border border-gray-100 bg-gray-50 transition hover:border-orange-300"><img src={p.thumb || p.url} alt={`Entry photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" /></button>)}
      </div>
      {open != null && photos[open] && createPortal(
        <div role="dialog" aria-label="Photo" className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-3" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <button type="button" onClick={() => setOpen(null)} aria-label="Close photo" className="absolute right-3 top-3 rounded-full bg-white/90 p-2"><X size={18} /></button>
          <img src={photos[open].url} alt={`Entry photo ${open + 1}`} className="max-h-[88vh] max-w-full rounded-lg object-contain" />
        </div>, document.body)}
    </div>
  )
}

export const PhotoBadge = ({ photos = [] }) => (photos.length ? <span title={`${photos.length} photo${photos.length > 1 ? 's' : ''} attached`} className="ml-1 inline-flex items-center gap-0.5 rounded bg-[#F1F3F7] px-1 py-0.5 align-middle text-[10.5px] font-medium text-gray-600"><Camera size={10} />{photos.length}</span> : null)
