// Default dummy images shown when a profile hasn't uploaded its own yet.

export const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#e2e8f0"/>' +
    '<circle cx="100" cy="78" r="30" fill="#94a3b8"/>' +
    '<path d="M40 165c8-38 40-58 60-58s52 20 60 58" fill="#94a3b8"/>' +
    '</svg>'
  )

export const DEFAULT_BANNER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#dbeafe"/><stop offset="1" stop-color="#e0f2fe"/>' +
    '</linearGradient></defs>' +
    '<rect width="1200" height="300" fill="url(#g)"/>' +
    '</svg>'
  )
