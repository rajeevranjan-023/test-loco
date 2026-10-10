import React, { useRef, useState } from 'react'
import { uploadMedia } from '../../services/media.js'
import '../../css/MediaUpload.css'

const DEFAULT_IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#e2e8f0"/>' +
    '<circle cx="100" cy="78" r="30" fill="#94a3b8"/>' +
    '<path d="M40 165c8-38 40-58 60-58s52 20 60 58" fill="#94a3b8"/>' +
    '</svg>'
  )

/**
 * Uploads an image or video to Cloudinary (via the backend) with a live
 * progress bar and instant local preview while the upload streams. Falls
 * back to a generic placeholder graphic when nothing has been uploaded.
 *
 * kind: 'image' | 'video' — controls accepted file types and preview style.
 */
function MediaUploadField({ label, value, onChange, folder = 'general', kind = 'image', optional = true, shape = 'square' }) {
  const inputRef = useRef(null)
  const [localPreview, setLocalPreview] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setProgress(0)

    try {
      const result = await uploadMedia(file, folder, setProgress)
      onChange(result.url)
    } catch (err) {
      setError(err.message)
      setLocalPreview(null)
    } finally {
      setProgress(null)
      URL.revokeObjectURL(objectUrl)
    }
  }

  const clear = () => {
    onChange('')
    setLocalPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const displayUrl = localPreview || value
  const uploading = progress !== null

  return (
    <div className="media-upload-field">
      <label>{label}{optional && <span className="media-upload-optional"> (optional)</span>}</label>

      <div
        className={'media-upload-preview-box media-upload-shape-' + shape + (uploading ? '' : ' media-upload-clickable')}
        onClick={() => { if (!uploading) inputRef.current?.click() }}
        title={uploading ? 'Uploading…' : 'Click to change'}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); inputRef.current?.click() } }}
      >
        {kind === 'video' ? (
          displayUrl ? (
            <div className="media-upload-video-wrap">
              <video src={displayUrl} muted />
              <span className="media-upload-play">▶</span>
            </div>
          ) : (
            <div className="media-upload-empty">🎬<span>No video</span></div>
          )
        ) : (
          <img src={displayUrl || DEFAULT_IMAGE_PLACEHOLDER} alt="" />
        )}

        {uploading && (
          <div className="media-upload-progress-overlay">
            <div className="media-upload-progress-bar">
              <div className="media-upload-progress-fill" style={{ width: progress + '%' }} />
            </div>
            <span>{progress}%</span>
          </div>
        )}
      </div>

      <div className="media-upload-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {displayUrl ? 'Replace ' + kind : 'Upload ' + kind}
        </button>
        {displayUrl && !uploading && (
          <button type="button" className="btn btn-outline btn-sm" onClick={clear}>Remove</button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={kind === 'video' ? 'video/*' : 'image/*'}
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {error && <p className="lf-modal-error">⚠️ {error}</p>}
    </div>
  )
}

export default MediaUploadField
