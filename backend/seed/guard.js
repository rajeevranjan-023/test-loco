// Seed safety rules — ONE place, used by server.js and every seed script.
//
//   1. Development/test seed data (known demo logins, sample bills) is NEVER written to a production database.
//      "Production" = NODE_ENV=production, or a hosting platform that sets RENDER / VERCEL (same signals as assertOtpConfig).
//   2. Seeding at server start is OPT-IN (AUTO_SEED=true). With nothing set, an empty database stays empty and the UI shows
//      its empty states until a developer runs a seed explicitly (npm run seed:demo | seed:study | seed:service).
//   3. Destructive seed scripts refuse to run in production at all (there is no override flag on purpose).

export const isProduction = (env = process.env) =>
  env.NODE_ENV === 'production' || !!env.RENDER || !!env.VERCEL

// Server-start seeding: only when explicitly enabled AND not production.
export const autoSeedEnabled = (env = process.env) => String(env.AUTO_SEED).toLowerCase() === 'true' && !isProduction(env)

// Log-friendly reason when AUTO_SEED=true was requested but ignored.
export const autoSeedBlockedReason = (env = process.env) =>
  String(env.AUTO_SEED).toLowerCase() === 'true' && isProduction(env) ? 'AUTO_SEED=true ignored: production environment detected' : ''

export class SeedBlockedError extends Error {
  constructor(what) {
    super(`${what} refused: this looks like a production environment (NODE_ENV=production / RENDER / VERCEL). Dev seed data must never be written to production.`)
    this.name = 'SeedBlockedError'
  }
}

// Call at the top of every function/script that writes dev seed data.
export function assertDevSeedAllowed(what = 'Seeding', env = process.env) {
  if (isProduction(env)) throw new SeedBlockedError(what)
}

// Never print a connection string with credentials: mongodb+srv://user:pass@host/db → mongodb+srv://***@host/db
export const redactUri = (uri = '') => String(uri).replace(/\/\/[^@/]*@/, '//***@')
