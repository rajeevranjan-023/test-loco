# Loco — Authentication, signup & protected access

## How it works
- **Homepage and all browsing are public.** Only protected actions (Follow, Contact, Start Yours, dashboards, settings…) ask for login. The visitor is sent to `/login?next=<page>` and returned after authenticating; a pending *Follow* is completed automatically. `next` must be a same-site path (`//host`, `https://…`, `\`, `javascript:` are rejected on both frontend and backend).
- The backend enforces auth on its own (`protect` middleware); hiding buttons is never relied on.

### Signup (`/signup` → `/register` → `/welcome`)
1. Landing (Continue with Google / Sign up with Email) → 2. Google's account chooser → "Verifying…" (`/auth/callback`)
3. Personal info → 4. Mobile OTP → 5. Username + password (**account is created here**, exactly once) →
6. Account type → 7. Optional business setup → 8. Interests → 9. Optional location → 10. Success.
Steps 6–9 can be skipped; progress resumes after a refresh/re-login.

### Backend pieces
| Concern | File |
|---|---|
| **OTP (the only place that knows codes/providers/dev value)** | `backend/utils/otp.js` (+ `models/OtpChallenge.js`) |
| Google OAuth (code flow, signed state, CSRF cookie, nonce, ID-token verification) | `controllers/googleAuthController.js`, `utils/googleOAuth.js` |
| Registration state machine (server-side) | `controllers/registrationController.js`, `models/RegistrationSession.js` |
| One-time Google→SPA hand-off ticket | `models/AuthTicket.js` |
| Onboarding prefs, forgot/reset password | `controllers/accountController.js`, `utils/mailer.js` |
| Rate limiting | `middleware/rateLimit.js` (in-memory; use a shared store if you run several instances) |
| Shared helpers (phone, password policy, safe redirect) | `utils/authHelpers.js` |

### Security decisions worth knowing
- Registration progress, Google verification and OTP verification live **only on the server**; the browser holds an opaque token. `complete` re-checks the OTP itself — `otpVerified` flags from the client are ignored.
- A Google email that matches an existing password account is **never merged automatically**: the user must enter that account's password to link (5 tries per ticket).
- Identity policy: one account per verified mobile (+91) and per email/Google id (unique indexes + checks). Double submits are idempotent.
- Passwords: bcrypt. New passwords need 8+ chars, letters+digits, not common, not containing username/email name (legacy accounts keep their old 6-char minimum).
- Usernames keep the **existing** policy (5–20 chars, `a–z0–9`, ≥3 digits, blocked number patterns). Example: `rajeev236` works; `rajeevkumar` does not.
- The legacy one-step `POST /api/auth/register` (no OTP) is **disabled** unless `NODE_ENV=test` or `ALLOW_LEGACY_REGISTER=true`.
- Location is requested only after "Allow Location" and stored rounded (~1 km). `LocationContext` no longer auto-prompts while a new account is still onboarding.
- Study Center has no separate backend model: it is a Shop with category `Library` (what the homepage's "Libraries/Study Spaces" already uses). One business per account (existing architecture).

## Environment variables
See `backend/.env.example` (all documented). Minimum for local dev: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `API_PUBLIC_URL`, `OTP_DEV_FIXED=true`, plus `GOOGLE_CLIENT_ID/SECRET` for Google.

## Google OAuth setup
1. Google Cloud Console → *APIs & Services → OAuth consent screen* (External; add scopes `openid`, `email`, `profile`).
2. *Credentials → Create credentials → OAuth client ID → Web application*.
3. **Authorised redirect URI**: `<API_PUBLIC_URL>/api/auth/google/callback` (e.g. `http://localhost:5000/api/auth/google/callback`, and your production API URL).
4. Put the client id/secret in `backend/.env`. Restart the API. The frontend never sees the secret.
5. The frontend must reach the API at `API_PUBLIC_URL`. **Note:** `frontend/src/services/api.js` hard-codes `http://localhost:5000` (the `VITE_API_URL` in `frontend/.env` is not read) — point `BASE_URL` at your deployed API for production.

## OTP: development vs production
- **Development:** `OTP_DEV_FIXED=true`. The fixed code is defined only in `utils/otp.js`; the API/UI never reveal it (the UI just shows a "development mode" notice). Verification still runs on the backend.
- **Production:** remove `OTP_DEV_FIXED`; set `OTP_SMS_PROVIDER=twilio` + Twilio vars. Codes are random (`OTP_LENGTH`, default 6), HMAC-hashed at rest, expire (5 min), lock after 5 wrong attempts, resend cooldown 30 s, max 5 sends/hour. The server **refuses to start** if `OTP_DEV_FIXED=true` with `NODE_ENV=production` (or `RENDER=true`/`VERCEL=1`), or if production has no valid provider.
- **Swap the mechanism later** by editing `utils/otp.js` only (add a provider to `SMS_PROVIDERS`, or change `generateCode`). The Twilio adapter is implemented but **not tested against Twilio** (no account here).

## Tests
- `cd backend && MONGODB_URI=mongodb://127.0.0.1:27017/loco_auth npm run test:auth` — 96 backend checks (needs a Mongo-compatible DB).
- `npm run e2e:server` starts a harness API on :5000 (fake Google chooser only) for browser testing.
