// Destructive tests (they call dropDatabase()) may only ever run against a local, disposable MongoDB.
// This exists because `import 'dotenv/config'` + a fallback URI could silently pick up the real MONGODB_URI from .env.
export function assertDisposableDb(uri, who = 'test') {
  const u = String(uri || '')
  const local = /^mongodb:\/\/(?:[^@/]*@)?(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(\/|\?|$)/i.test(u)
  if (!local || /mongodb\+srv:|\.mongodb\.net/i.test(u)) {
    console.error(`BLOCKED (${who}): refusing to run a destructive test against a non-local database. Set MONGODB_URI to a local disposable instance.`)
    process.exit(2)
  }
}
