// ==========================================================
// Relative-time formatting for the live activity feed.
// Mock data stores "minutesAgo" as a plain number so this
// stays simple; a real backend would send a timestamp and
// this function would compute the diff from Date.now().
// ==========================================================

export function timeAgo(minutesAgo) {
  if (minutesAgo < 1) return 'just now'
  if (minutesAgo < 60) return `${minutesAgo} min ago`

  const hours = Math.floor(minutesAgo / 60)
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
