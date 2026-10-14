// Proof photos on an Udhar entry — the same rules the server enforces (it re-checks everything).
export const PHOTO_MAX = 2
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024 // 5 MB, same as the existing image upload limit
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',')

// → error text, or '' when the file is fine
export function photoProblem(file) {
  if (!PHOTO_TYPES.includes(file.type)) return `“${file.name}” is not supported. Please choose a JPG, PNG or WebP photo.`
  if (!file.size) return `“${file.name}” is empty. Please choose it again.`
  if (file.size > PHOTO_MAX_BYTES) return `“${file.name}” is larger than 5 MB. Please choose a smaller photo.`
  return ''
}

// Merge newly picked files into the current list. Returns { photos, message } — never more than PHOTO_MAX, bad files skipped with a message.
export function addPhotos(current, picked, makeUrl = (f) => URL.createObjectURL(f)) {
  const photos = [...current]; const problems = []
  let skippedForLimit = 0
  for (const file of picked) {
    const bad = photoProblem(file)
    if (bad) { problems.push(bad); continue }
    if (photos.length >= PHOTO_MAX) { skippedForLimit++; continue }
    photos.push({ id: `${file.name}-${file.size}-${file.lastModified}-${photos.length}-${Math.random().toString(36).slice(2, 7)}`, file, url: makeUrl(file) })
  }
  if (skippedForLimit) problems.unshift(`You can attach at most ${PHOTO_MAX} photos. Remove one to add another.`)
  return { photos, message: problems.join(' ') }
}
