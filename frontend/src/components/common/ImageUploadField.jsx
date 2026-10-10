import React, { useRef } from 'react'

const MAX_SIZE_MB = 2

/**
 * A single optional photo upload with preview. Since this project has no
 * cloud storage configured, the image is read as a base64 data URL on the
 * client and sent to the backend as a plain string — fine for occasional
 * small photos, but swap this for real object storage (S3/Cloudinary) if
 * volume grows.
 */
function ImageUploadField({ label = 'Upload photo (optional)', value, onChange, maxSizeMb = MAX_SIZE_MB }) {
  const inputRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`Image is too large — please choose one under ${maxSizeMb}MB.`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => onChange(reader.result)
    reader.readAsDataURL(file)
  }

  const clear = () => {
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="image-upload-field">
      <label>{label}</label>
      {value ? (
        <div className="image-upload-preview">
          <img src={value} alt="Upload preview" />
          <button type="button" className="btn btn-outline btn-sm" onClick={clear}>Remove photo</button>
        </div>
      ) : (
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} />
      )}
    </div>
  )
}

export default ImageUploadField
