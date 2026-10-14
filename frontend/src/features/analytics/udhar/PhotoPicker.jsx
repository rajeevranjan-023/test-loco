import React, { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { PHOTO_ACCEPT, PHOTO_MAX, addPhotos } from './photos.js'

export default function PhotoPicker({ photos, onChange, disabled = false, progress = null }) {
  const input = useRef(); const [msg, setMsg] = useState('')
  const live = useRef(photos); live.current = photos
  useEffect(() => () => live.current.forEach((p) => URL.revokeObjectURL(p.url)), []) // free the previews when the form closes
  const full = photos.length >= PHOTO_MAX

  const pick = (e) => {
    const files = [...(e.target.files || [])]; e.target.value = '' // allow choosing the same file again later
    if (!files.length) return
    const r = addPhotos(photos, files)
    setMsg(r.message); onChange(r.photos)
  }
  const remove = (p) => { URL.revokeObjectURL(p.url); setMsg(''); onChange(photos.filter((x) => x.id !== p.id)) }

  return (
    <div className="rounded-xl border border-dashed border-gray-200 p-3" data-photo-picker>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-medium text-gray-700">Photos <span className="font-normal text-gray-400">(optional · up to {PHOTO_MAX})</span></div>
        <span className="text-[11.5px] text-gray-400">{photos.length}/{PHOTO_MAX}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {photos.map((p, i) => (
          <div key={p.id} className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-100 bg-gray-50 sm:h-[84px] sm:w-[84px]">
            <img src={p.url} alt={`Selected photo ${i + 1}`} className="h-full w-full object-cover" />
            {!disabled && <button type="button" onClick={() => remove(p)} aria-label={`Remove photo ${i + 1}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"><X size={13} /></button>}
          </div>))}
        {!full && (
          <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-label="Add photo" className="grid aspect-square w-full place-items-center rounded-lg border border-gray-200 bg-[#FAFAFB] text-[11.5px] text-gray-500 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 sm:h-[84px] sm:w-[84px]">
            <span className="grid place-items-center gap-0.5">{photos.length ? <ImagePlus size={20} /> : <Camera size={20} />}Add photo</span>
          </button>)}
      </div>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} multiple={PHOTO_MAX - photos.length > 1} onChange={pick} className="hidden" aria-label="Choose photos" data-photo-input />
      {progress != null && <div className="mt-2"><div className="h-1.5 overflow-hidden rounded bg-gray-100"><div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-1 text-[11.5px] text-gray-500">Uploading photos… {progress}%</div></div>}
      {msg && <p role="alert" className="mt-2 text-[12px] text-red-600">{msg}</p>}
    </div>
  )
}
