import multer from 'multer'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_VIDEO_BYTES = 20 * 1024 * 1024 // 20MB

const storage = multer.memoryStorage()

function fileFilter(req, file, cb) {
  const isImage = file.mimetype.startsWith('image/')
  const isVideo = file.mimetype.startsWith('video/')
  if (!isImage && !isVideo) {
    return cb(Object.assign(new Error('Only image or video files are allowed.'), { status: 400, expose: true, code: 'UNSUPPORTED_FILE_TYPE' }))
  }
  cb(null, true)
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_BYTES },
})

export function assertWithinSizeLimit(file) {
  const isVideo = file.mimetype.startsWith('video/')
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > limit) {
    const limitMb = limit / (1024 * 1024)
    const kind = isVideo ? 'Videos' : 'Images'
    return `${kind} must be under ${limitMb}MB.`
  }
  return null
}

export { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES }

/* ───────── Udhar proof photos: up to 2 images per entry ───────── */
export const UDHAR_PHOTO_MAX = 2
export const UDHAR_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const UDHAR_PHOTO_FIELD = 'photos'
const bad = (message, code, status = 400) => Object.assign(new Error(message), { status, expose: true, code })

const photoUploader = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES, files: UDHAR_PHOTO_MAX + 1, fields: 20 }, // +1 so a 3rd file is detected (and refused) instead of silently dropped
  fileFilter(req, file, cb) {
    if (!UDHAR_PHOTO_TYPES.includes(file.mimetype)) return cb(bad('Only JPG, PNG or WebP photos can be attached.', 'UNSUPPORTED_FILE_TYPE'))
    cb(null, true)
  },
}).array(UDHAR_PHOTO_FIELD, UDHAR_PHOTO_MAX + 1)

// Real file type from the first bytes — the browser-reported mimetype alone can be faked.
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

// Parses multipart bodies only (a normal JSON request passes straight through untouched). Every rejection is a clear JSON message.
export function udharPhotos(req, res, next) {
  photoUploader(req, res, (err) => {
    if (!err) return next()
    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') return next(bad(`Each photo must be under ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`, 'FILE_TOO_LARGE', 413))
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return next(bad(`You can attach at most ${UDHAR_PHOTO_MAX} photos to an entry.`, 'TOO_MANY_PHOTOS'))
      return next(bad('That upload could not be accepted.', 'UPLOAD_REJECTED'))
    }
    next(err)
  })
}

// Controller-side check of the files multer accepted: count, real type, size.
export function validateUdharPhotos(files) {
  if (files.length > UDHAR_PHOTO_MAX) return `You can attach at most ${UDHAR_PHOTO_MAX} photos to an entry.`
  for (const f of files) {
    if (!f.size) return 'One of the photos is empty. Please choose it again.'
    if (f.size > MAX_IMAGE_BYTES) return `Each photo must be under ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`
    if (!UDHAR_PHOTO_TYPES.includes(f.mimetype) || sniffImage(f.buffer) !== f.mimetype) return 'Only real JPG, PNG or WebP photos can be attached.'
  }
  return null
}
