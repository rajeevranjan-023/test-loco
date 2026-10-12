// CORS allowlist + error-handler production behaviour (no database needed).
import assert from 'node:assert/strict'
const set = (o) => { for (const [k, v] of Object.entries(o)) v === undefined ? delete process.env[k] : (process.env[k] = v) }
const { corsOptions } = await import('../middleware/corsConfig.js')
const check = (origin) => new Promise((res) => corsOptions().origin(origin, (_e, ok) => res(ok)))
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('✅', m) }

set({ NODE_ENV: 'production', RENDER: undefined, VERCEL: undefined, CLIENT_ORIGIN: 'https://app.example.com, https://www.example.com/' })
ok(await check('https://app.example.com') === true, 'production: listed origin allowed')
ok(await check('https://www.example.com') === true, 'production: trailing slash in config is normalised')
ok(await check('https://evil.example.net') === false, 'production: unlisted origin refused')
ok(await check('http://localhost:5173') === false, 'production: localhost refused when not listed')
ok(await check(undefined) === true, 'non-browser request (no Origin) is not blocked')
set({ CLIENT_ORIGIN: undefined })
ok(await check('https://anything.example.net') === false, 'production with no CLIENT_ORIGIN: closed')
set({ NODE_ENV: 'development' })
ok(await check('http://localhost:5173') === true, 'development with no CLIENT_ORIGIN: open')

// ── real app: OPTIONS preflight for the registration flow (no database needed — CORS runs before the DB guard and routes) ──
// CLIENT_ORIGIN must be set BEFORE server.js is imported (the middleware reads it when the app is built).
set({ NODE_ENV: 'test', RENDER: undefined, VERCEL: undefined, JWT_SECRET: 'test-secret', MONGODB_URI: 'mongodb://127.0.0.1:1/never_connected', CLIENT_ORIGIN: 'http://localhost:5173, https://app.example.com' })
const http = await import('node:http')
const { default: app } = await import('../server.js')
const server = app.listen(0); const port = server.address().port
const preflight = (path, origin, reqHeaders, method = 'GET') => new Promise((res, rej) => {
  const r = http.request({ port, path, method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': reqHeaders } },
    (resp) => { resp.resume(); resp.on('end', () => res({ status: resp.statusCode, h: resp.headers })) })
  r.on('error', rej); r.end()
})
const allowed = (h) => String(h['access-control-allow-headers'] || '').toLowerCase().split(',').map((x) => x.trim())
for (const [method, path] of [['GET', '/api/auth/register/session'], ['POST', '/api/auth/register/personal'], ['POST', '/api/auth/register/complete'], ['POST', '/api/auth/register/avatar'], ['GET', '/api/auth/register/check-username']]) {
  const p = await preflight(path, 'http://localhost:5173', 'x-registration-token,content-type', method)
  ok(p.status === 204 && p.h['access-control-allow-origin'] === 'http://localhost:5173' && allowed(p.h).includes('x-registration-token') && allowed(p.h).includes('content-type'), `preflight ${method} ${path} with x-registration-token: 204, allowed origin echoed, header allowed`)
}
{ const p = await preflight('/api/auth/register/session', 'https://app.example.com', 'x-registration-token', 'GET')
  ok(p.status === 204 && p.h['access-control-allow-origin'] === 'https://app.example.com', 'preflight: second allow-listed (production-style) origin accepted') }
{ const p = await preflight('/api/auth/register/session', 'https://evil.example.net', 'x-registration-token', 'GET')
  ok(!p.h['access-control-allow-origin'] && !p.h['access-control-allow-headers'], 'preflight: unapproved origin gets NO CORS grant (browser blocks it)') }
{ const p = await preflight('/api/auth/register/session', 'http://localhost:5173', 'x-evil-header', 'GET')
  ok(!allowed(p.h).includes('x-evil-header') && allowed(p.h).includes('x-registration-token'), 'preflight: allow-list is exact — arbitrary request headers are NOT allowed') }
{ const p = await preflight('/api/seller/products', 'http://localhost:5173', 'authorization,x-view-as,content-type', 'GET')
  ok(allowed(p.h).includes('authorization') && allowed(p.h).includes('x-view-as') && allowed(p.h).includes('content-type'), 'preflight: existing headers (Authorization, x-view-as, Content-Type) still allowed') }
await new Promise((r) => server.close(r))
set({ CLIENT_ORIGIN: undefined })

// error handler never leaks stack/driver text in production, only RENDER set
set({ NODE_ENV: undefined, RENDER: 'true' })
const { errorHandler } = await import('../middleware/errorHandler.js')
// (the status is kept under `httpStatus`, not `code`: the response body now carries its own machine-readable `code`)
const run = (err) => { let out; errorHandler(err, { method: 'GET', originalUrl: '/x' }, { statusCode: 200, status(c) { this.c = c; return this }, json(b) { out = { httpStatus: this.c, ...b } } }, () => {}); return out }
const origErr = console.error; console.error = () => {}
const r = run(new Error('E11000 mongodb://user:pw@host/db failed'))
console.error = origErr
ok(r.httpStatus === 500 && r.stack === undefined, 'production 500: no stack trace')
ok(!/mongodb|pw@/.test(r.message), 'production 500: no driver/connection text in message')
console.log(`\n${n} CORS / error-handler checks passed`)
