// "images/shop-banner.png" -> "shop banner" (CSS uppercases it). Empty -> "No Image".
export function getImageName(file) {
  if (!file) return 'No Image'
  return file
    .split('?')[0]
    .split('/')
    .pop()
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/[-_]+/g, ' ')   // clean format
    .trim() || 'No Image'
}

// "images/city-central-library.png" -> "city-central-library.png" (shown inside the fallback box)
export function getFileName(file) {
  if (!file) return 'No Image'
  return file.split('?')[0].split('/').pop() || 'No Image'
}
