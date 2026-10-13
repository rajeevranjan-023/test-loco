export function assertDisposableDb(uri, who = 'test') {
  const u = String(uri || '')
  const local = /^mongodb:\/\/(?:[^@/]*@)?(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(\/|\?|$)/i.test(u)
  if (!local || /mongodb\+srv:|\.mongodb\.net/i.test(u)) {
    console.error(`BLOCKED (${who}): refusing to run a destructive test against a non-local database. Set MONGODB_URI to a local disposable instance.`)
    process.exit(2)
  }
}
