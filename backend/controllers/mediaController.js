import streamifier from 'streamifier'
import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js'
import { assertWithinSizeLimit } from '../middleware/upload.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { isProduction } from '../seed/guard.js' // same definition of production as everywhere else (NODE_ENV / RENDER / VERCEL)
import { logger, redactText } from '../utils/logger.js'

export function streamUpload(buffer, options) {
  const cloudinary = getCloudinary()
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error)
      resolve(result)
    })
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

// Cloudinary SDK errors carry useful diagnostic fields, but — this is the
// part that's easy to miss — the SHAPE of the error object is NOT
// consistent across the SDK. Verified directly against the SDK itself:
//   • cloudinary.uploader.upload_stream(...)  -> err = { message, http_code, name }        (flat)
//   • cloudinary.api.ping() / other Admin API -> err = { error: { message, http_code }, ... } (nested under `.error`)
// Reading only `err.message` (as a first draft of this code did) silently
// produces "[object Object]" for the nested shape, which is exactly the
// kind of unhelpful, misleading error you were fighting.
function describeCloudinaryError(err) {
  const inner = err?.error && typeof err.error === 'object' ? err.error : err
  const httpCode = inner?.http_code ?? err?.http_code
  const message =
    typeof inner?.message === 'string' ? inner.message :
    typeof err?.message === 'string' ? err.message :
    'Unknown Cloudinary error'
  let hint = null

  if (httpCode === 401 || /invalid.*api.*key|invalid.*signature/i.test(message)) {
    hint = 'Invalid credentials — double-check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET against the Cloudinary dashboard (regenerate them if unsure).'
  } else if (httpCode === 403 || /unexpected status code - 403/i.test(message)) {
    hint = 'Forbidden — see the 403 checklist below (wrong cloud_name for these keys, disabled/suspended account, restricted upload preset, or a blocked resource type).'
  } else if (/must supply api_key/i.test(message)) {
    hint = 'cloudinary.config() ran before your .env was loaded (or a key is missing/empty) — the credentials never reached the SDK.'
  } else if (httpCode === 420 || httpCode === 429) {
    hint = 'Rate limited — you have hit your Cloudinary plan\'s request limit. Wait and retry, or upgrade your plan.'
  } else if (/enotfound|econnrefused|network/i.test(message)) {
    hint = 'Network/DNS failure reaching Cloudinary — check your server\'s internet access and firewall/proxy egress rules.'
  }

  return { httpCode, message, hint }
}

// _________________________________________________________________________
// =========================================================================
// GET /api/media/test-config  (public) — minimal connectivity check.
// Pings Cloudinary with your configured credentials and reports exactly
// what's wrong, instead of you having to infer it from an upload failure.
export const testCloudinaryConfig = asyncHandler(async (req, res) => {
  const prod = isProduction()
  if (!isCloudinaryConfigured()) {
    logger.warn('cloudinary', 'test-config: Cloudinary credentials are not (fully) configured')
    if (prod) return res.status(503).json({ ok: false, message: 'Media storage is not configured.', code: 'MEDIA_NOT_CONFIGURED' })
    return res.status(503).json({
      ok: false,
      message: 'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are not all set in your .env file (or still have their placeholder values).',
      env: {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'MISSING',
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'set' : 'MISSING',
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'set' : 'MISSING',
      },
    })
  }

  try {
    const cloudinary = getCloudinary()
    const result = await cloudinary.api.ping()
    res.json({ ok: true, message: 'Cloudinary connection is working.', ...(prod ? {} : { result }) })
  } catch (err) {
    const { httpCode, message, hint } = describeCloudinaryError(err)
    logger.error('cloudinary', 'ping failed', { httpCode, message, cloud_name: process.env.CLOUDINARY_CLOUD_NAME })
    if (prod) return res.status(502).json({ ok: false, message: 'The media storage check failed.', code: 'UPLOAD_FAILED' })
    res.status(502).json({ ok: false, message: redactText(message), httpCode, hint })
  }
})

// _________________________________________________________________________
// =========================================================================
// POST /api/media/upload  (protected) — multipart field name: "file"
// Optional body field `folder` (e.g. "avatars", "products", "reviews")
// just organizes the asset in the Cloudinary media library.
export const uploadMedia = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      message: 'Media uploads are not configured yet. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the backend .env file, then restart the server.',
    })
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No file was uploaded (expected multipart field "file").' })
  }

  const sizeError = assertWithinSizeLimit(req.file)
  if (sizeError) {
    return res.status(400).json({ message: sizeError })
  }

  const isVideo = req.file.mimetype.startsWith('video/')
  const folder = `servop/${req.body.folder || 'general'}`

  try {
    const result = await streamUpload(req.file.buffer, {
      folder,
      resource_type: isVideo ? 'video' : 'image',
      // Keep images reasonably sized on the way in — a light, safe
      // compression step per the "compress images before upload" note.
      transformation: isVideo ? undefined : [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }],
    })

    res.status(201).json({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      // Cloudinary auto-generates a JPG thumbnail for videos at the same public_id.
      thumbnailUrl: isVideo
        ? getCloudinary().url(result.public_id, { resource_type: 'video', format: 'jpg' })
        : result.secure_url,
    })
  } catch (err) {
    const { httpCode, message, hint } = describeCloudinaryError(err)

    // The REAL error stays in the server log (redacted: Cloudinary messages can contain account identifiers / the API key).
    logger.error('cloudinary', 'upload failed', {
      httpCode,
      message,
      name: err?.name,
      folder,
      resource_type: isVideo ? 'video' : 'image',
      file: { mimetype: req.file.mimetype, size: req.file.size },
    })

    // Cloudinary's status code is NOT forwarded. A 401/403 from Cloudinary means OUR credentials are wrong — to the user that
    // must never look like "your session expired" or "you lack permission". Map it to what the user can act on.
    const status = httpCode === 400 ? 400 : httpCode === 420 || httpCode === 429 ? 503 : 502
    const text = status === 400 ? 'That file could not be processed. Please try a different image or video.'
      : status === 503 ? 'Uploads are busy right now. Please try again in a few minutes.'
      : 'Upload to cloud storage failed. Please try again.'
    res.status(status).json({
      message: text,
      code: 'UPLOAD_FAILED',
      requestId: req.id,
      ...(!isProduction() ? { debug: redactText(message), hint } : {}),
    })
  }
})

// _________________________________________________________________________
// =========================================================================
// DELETE /api/media/:publicId  (protected) — lets a replace/remove action
// clean up the old asset. publicId is URL-encoded since it contains slashes.
export const deleteMedia = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({ message: 'Media storage is not configured.' })
  }
  const publicId = decodeURIComponent(req.params.publicId)
  const resourceType = req.query.resourceType === 'video' ? 'video' : 'image'

  try {
    const cloudinary = getCloudinary()
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    res.json({ message: 'Media deleted.' })
  } catch (err) {
    const { httpCode, message, hint } = describeCloudinaryError(err)
    logger.error('cloudinary', 'delete failed', { httpCode, message, publicId })
    res.status(502).json({ message: 'Could not remove that file. Please try again.', code: 'UPLOAD_FAILED', requestId: req.id, ...(!isProduction() ? { debug: redactText(message), hint } : {}) })
  }
})
// _________________________________________________________________________
// =========================================================================
