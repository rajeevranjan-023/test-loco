import axios from 'axios'
import { BASE_URL } from './api.js'
import { getToken } from './session.js'

/**
 * Uploads a single image/video File to POST /api/media/upload.
 * `folder` organizes the asset in Cloudinary (e.g. "avatars", "products").
 * `onProgress(percent)` is called as the upload streams, for a progress bar.
 */
export async function uploadMedia(file, folder, onProgress) {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  try {
    const res = await axios.post(`${BASE_URL}/api/media/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return
        onProgress(Math.round((event.loaded / event.total) * 100))
      },
    })
    return res.data
  } catch (err) {
    throw new Error(err.response?.data?.message || 'Upload failed. Please try again.')
  }
}
