import express from 'express'
import { upload } from '../middleware/upload.js'
import { uploadMedia, deleteMedia, testCloudinaryConfig } from '../controllers/mediaController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// Wrap multer so a rejected file (bad type or too large) becomes a normal JSON error
// response (via the central error handler) instead of an unhandled exception.
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => (err ? next(err) : next()))
}

// Public on purpose — a quick way to sanity-check your .env from a browser or curl without a login token.
// In production it only reports ok / not ok: which variables are missing and Cloudinary's own error text stay in the
// server log (that text can contain account identifiers). The detailed answer is for development only.
router.get('/test-config', testCloudinaryConfig)

router.post('/upload', protect, handleUpload, uploadMedia)
router.delete('/:publicId', protect, deleteMedia)

export default router
