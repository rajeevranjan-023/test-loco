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

// The multer-level limit has to be a single ceiling (the field's exact
// type isn't known until the file arrives), so we allow up to the video
// max here and enforce the tighter 5MB image limit ourselves in the
// controller once we know `file.mimetype`.
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
