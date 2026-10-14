import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js'
import { streamUpload } from '../controllers/mediaController.js'
import { logger, redactText } from './logger.js'

// Udhar proof photos live in Cloudinary (the project's existing media store, same helper as /api/media/upload).
// MongoDB keeps only { url, publicId, width, height, bytes, format }.
const real = {
  configured: () => isCloudinaryConfigured(),
  upload: (file, shopId) => streamUpload(file.buffer, { folder: `servop/udhar/${shopId}`, resource_type: 'image', transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }] }),
  destroy: (publicId) => getCloudinary().uploader.destroy(publicId, { resource_type: 'image' }),
}
let impl = real
export const __setPhotoStoreForTests = (x) => { impl = x || real } // tests only
export const photosConfigured = () => impl.configured()

const fail = (message, status, code) => Object.assign(new Error(message), { status, expose: true, code })

// Best-effort delete of files that never became part of a saved entry.
export async function removePhotos(list) {
  await Promise.all((list || []).map((p) => Promise.resolve().then(() => impl.destroy(p.publicId)).catch((e) => logger.warn('udhar-photos', 'cleanup failed', { publicId: p.publicId, message: redactText(String(e?.message || e)) }))))
}

// Uploads ALL files or none: if any one fails, the ones that already went up are removed and an error is thrown.
export async function storePhotos(files, shopId) {
  const done = [], results = await Promise.allSettled(files.map((f) => impl.upload(f, String(shopId))))
  results.forEach((r) => r.status === 'fulfilled' && done.push({ url: r.value.secure_url, publicId: r.value.public_id, width: r.value.width, height: r.value.height, bytes: r.value.bytes, format: r.value.format }))
  const bad = results.find((r) => r.status === 'rejected')
  if (bad) {
    logger.error('udhar-photos', 'upload failed', { message: redactText(String(bad.reason?.message || bad.reason)) })
    await removePhotos(done)
    throw fail('Photo upload failed, so nothing was saved. Please try again.', 502, 'UPLOAD_FAILED')
  }
  return done
}

// What the API returns to the app: the full image + a small thumbnail (Cloudinary URL transform; other hosts keep the original).
export const publicPhoto = (p) => ({ url: p.url, thumb: /\/upload\//.test(p.url) ? p.url.replace('/upload/', '/upload/c_fill,w_240,h_240,q_auto,f_auto/') : p.url })
export const publicPhotos = (e) => (e.photos || []).map(publicPhoto)
