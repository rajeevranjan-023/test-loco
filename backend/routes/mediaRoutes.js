import express from 'express'
import { upload } from '../middleware/upload.js'
import { uploadMedia, deleteMedia, testCloudinaryConfig } from '../controllers/mediaController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => (err ? next(err) : next()))
}

router.get('/test-config', testCloudinaryConfig)

router.post('/upload', protect, handleUpload, uploadMedia)
router.delete('/:publicId', protect, deleteMedia)

export default router
