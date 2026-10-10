import express from 'express'
import { upload } from '../middleware/upload.js'
import { uploadMedia, deleteMedia, testCloudinaryConfig } from '../controllers/mediaController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// Wrap multer so a rejected file (bad type or too large) becomes a normal
// JSON 400 response instead of an unhandled exception.
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed.' })
    next()
  })
}

// Public on purpose — a quick way to sanity-check your .env from a browser
// or curl without needing a login token first. It only pings Cloudinary
// (no data read/written), so there's nothing sensitive to protect here.
router.get('/test-config', testCloudinaryConfig)

router.post('/upload', protect, handleUpload, uploadMedia)
router.delete('/:publicId', protect, deleteMedia)

export default router
