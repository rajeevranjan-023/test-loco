# Development-only accounts

**These logins exist only if you run a dev seed yourself. Never seed them into a production database** —
every seed script refuses to run when `NODE_ENV=production`, `RENDER` or `VERCEL` is set (`seed/guard.js`).

| Business type | Command | Login |
|---|---|---|
| Shop | `npm run seed:demo` | see `ACCOUNTS` in `seedDemo.js` (two shop owners) |
| Study Center | `npm run seed:study` | `demo.study@example.com` / `StudyCenter@123` |
| Service Provider (hybrid) | `npm run seed:service` | `demo.service@example.com` / `ServicePro@123` |

`npm run seed` (bulk directory data) is deterministic (`SEED_VALUE=<int>` changes the set) and writes a git-ignored `credentials.csv`.
Auto-seeding at server start only happens with `AUTO_SEED=true` outside production.
