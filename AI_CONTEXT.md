# AI_CONTEXT.md — Loco ("Local Finder") project knowledge base

> Scope note: this is the single master file requested for repository `rajeevranjan-023/test-loco`. The `.ai-context/*.json`
> manifests and `scripts/update-ai-context.js` described in the original brief were **intentionally not generated**
> (instruction: "only create that file"). Section J lists them as *not generated*.
> Everything below was derived from reading the repository at commit `c847ebd` (shallow clone, default branch) with grep/static
> import analysis. **No code was executed, no tests were run, no database or API was contacted.**

## BEFORE MODIFYING THE APPLICATION (protocol for AI coding agents)

1. Read this file.
2. Check the generation commit above (`c847ebd`) against `git log` to see how stale this document is.
3. Read the relevant feature in section E and the route/API tables in sections B and E.
4. Open the actual source files before relying on anything written here.
5. Verify the documented relationships still match the current code.
6. Identify all directly and indirectly affected files (section F and section H list shared modules and constraints).
7. Preserve unrelated application behavior.
8. Implement the smallest safe change.
9. Run the relevant tests (section G) — note that some test scripts need a Mongo-compatible database.
10. Update this document if the change affects architecture, routes, APIs, models, dependencies, or flows.

The documentation is a navigation aid, not a source of truth. Source code and runtime configuration win over this file.
Evidence labels used below: **[static]** = read directly from source; **[inferred]** = deduced, not executed; **[unresolved]** = not verified.

---

## A. PROJECT IDENTITY

| Item | Value |
|---|---|
| Name | Loco / "Local Finder" (backend package `local-finder-backend`, frontend package `local-product-service-finder`) |
| Repository root | `test-loco/` — top level: `backend/`, `frontend/`, `design/` (two `.webp` previews), `README.md`, `AUTH_SETUP.md`, `.gitignore` |
| Product | Hyperlocal directory + seller toolkit for **shops**, **service providers** and **study centers/libraries** (India-oriented: +91 phones, `udhar` credit ledger) |
| Frontend | React 18 + Vite 5 SPA, `react-router-dom` v6, `axios`, `recharts`, `lucide-react`, Tailwind 4 (`@tailwindcss/vite`) plus hand-written CSS in `src/css/`. JavaScript (JSX), no TypeScript. [static] |
| Backend | Node (ESM, `"type": "module"`) + Express 4, Mongoose 8 / MongoDB. [static] Local Node used for analysis was v22; no `engines` field declared in either package.json. |
| Auth | JWT bearer tokens (`jsonwebtoken`), bcrypt passwords, Google OAuth (code flow), OTP (SMS via Twilio adapter; dev fixed code), email via nodemailer. Token stored in browser `localStorage` key `lf_token`. [static] |
| State management | React Context only (no Redux/Zustand): `AuthContext`, `LocationContext`, `ThemeContext`, `ViewModeContext`, plus `BusinessContext` scoped to the seller layout. Data fetching through `hooks/useApiData.js` and direct `api.*` calls. [static] |
| Media | Cloudinary (`backend/config/cloudinary.js`, `multer` + `streamifier`) |
| Build/deploy | Frontend: `vite build`; `frontend/public/_redirects` suggests Netlify-style SPA fallback [inferred]. Backend: comments/env checks mention Render (`RENDER`, `TRUST_PROXY`) and Vercel (`VERCEL`) [static], and a Render URL appears in a `server.js` comment. No Dockerfile/CI config found in the tracked file list. |
| Size | 410 tracked non-image, non-lockfile files; 366 JS/JSX/MJS files fed to the import analysis |

---

## B. EXECUTION ENTRY POINTS

### Backend
| Entry | File | Notes |
|---|---|---|
| Server bootstrap | `backend/server.js` | `dotenv/config` → Express app → `cors()` (open), `express.json()`, `morgan('dev')` unless `NODE_ENV=test` → mounts routers → `notFound` + `errorHandler` → `start()` (skipped when `NODE_ENV=test`; `app` is default-exported for tests) |
| Startup sequence (`start()`) | `backend/server.js` | `assertOtpConfig()` (refuses boot on unsafe OTP config) → `connectDB()` (`config/db.js`; `process.exit(1)` on failure; also sets DNS servers to 8.8.8.8/1.1.1.1) → `ensureBillIndexes()` → `migrateLedger()` → unless `AUTO_SEED=false`: `seedIfMissing()`, `seedStudyIfMissing()` → `seedHomeConfig()` → `migrateInventory()` → `app.listen(PORT||5000)` |
| Auth middleware | `backend/middleware/auth.js` | `protect`, `optionalAuth`, `requireSeller`, `requireOwner(param)`, `requireCapability(cap)` |
| Error handling | `backend/middleware/errorHandler.js` | `notFound`, `errorHandler` registered last in `server.js` |
| Rate limiting | `backend/middleware/rateLimit.js` | in-memory (per `AUTH_SETUP.md`: use a shared store for multi-instance) |
| Background workers | none found [static] | startup migrations/seeds only |

### Frontend
| Entry | File | Notes |
|---|---|---|
| HTML shell | `frontend/index.html` | |
| Bootstrap | `frontend/src/main.jsx` | `BrowserRouter` → `ThemeProvider` → `AuthProvider` → `LocationProvider` → `ViewModeProvider` → `App` |
| Router | `frontend/src/App.jsx` | all routes; see route table below |
| API client | `frontend/src/services/api.js` | axios instance, **`BASE_URL` hard-coded to `http://localhost:5000`** (no env var read; confirmed in code and in `AUTH_SETUP.md`); request interceptor attaches `Authorization: Bearer <lf_token>` and `x-view-as` only when the request config has `requiresAuth: true`; response interceptor unwraps `res.data` and rethrows `Error` with `.status` / `.data` |
| Auth provider | `frontend/src/context/AuthContext.jsx` | reads `lf_token`, calls `GET /api/auth/me`, exposes `useAuth()` (`isAuthenticated`, `isSeller`, `isAdmin`, `loading`, `user`, login/logout/start-seller) |
| Seller shell | `frontend/src/features/analytics/SellerLayout.jsx` | fetches `/api/seller/summary`, wraps children in `BusinessProvider` (business schema) |

---

## C. DIRECTORY TREE (verified against `git ls-files`; node_modules/dist excluded)

```
backend/
  server.js                  Express bootstrap (see B)
  config/                    db.js (mongoose connect), cloudinary.js
  middleware/                auth.js, errorHandler.js, rateLimit.js, upload.js (multer)
  routes/        (13 files)  Express routers, mounted in server.js
  controllers/   (26 files)  Request handlers; most business logic lives here + utils/
  models/        (34 files)  Mongoose models (+ billingConfigSchema.js, a schema fragment)
  utils/         (27 files)  Business logic: billing, ledger/udhar, stock/batches, OTP, Google OAuth, study-center logic, business schemas, accounts
  seed/                      demo/home/study seed scripts + credentials.csv (see Known Gaps)
  tests/                     plain-node test scripts (*.test.js, *.int.test.js) + e2e-harness.js
frontend/
  index.html, vite.config.js, vitest.config.js, tailwind.config.js, ARCHITECTURE.md (older, partly stale)
  public/_redirects
  src/
    main.jsx, App.jsx        bootstrap + router
    pages/                   public pages (Home, SearchResultsPage, About, Contact, FAQ, Privacy, Terms, Requirements, Settings) + legacy login.jsx/signUp.jsx
    features/                domain code
      auth/                  AuthPage, Register, Welcome, GoogleCallback, PasswordReset
      home/                  homepage components (components/*), config.js, homeData.js
      profile/               UnifiedProfilePage (/@username), EditAccountModal, EditProfileModal
      seller/                StartYours + Shop/Service/StudyCenter wizards; older SellerDashboard/Sales/Credit/Products panels
      analytics/             owner dashboards: pages/ (Billing, Orders, Udhar, Inventory, Customers…), SellerLayout, billing/bill helpers
      study/                 study-centre pages (Dashboard, Members, Courses, Seats, Config analytics, Add menu)
      modules.jsx            module registry used by the router
      follow/ review/ requirement/ search/ faq/ shops/ services/
    components/              shared UI (Navbar, Footer, SiteChrome, ProfileFrame, ProtectedRoute, UsernameRoute, LocationPicker …) + common/, loading/, profile/, shop/, study/, legal/
    layouts/                 ProfileFrame.jsx, SiteChrome.jsx, SellerLayout.jsx (differ from same-named files elsewhere; no importers found)
    context/                 Auth, Business, Location, Theme, ViewMode
    hooks/                   useApiData, useOwnerPath, useRequireAuth, useHome, useGeolocation, useMockApi …
    services/                api.js, authApi.js, homeApi.js, media.js
    utils/                   username, redirect, format, geo/indiaGeo/cities, phone, validators, …
    data/ css/ sections/     static JSON/mock data, stylesheets, older homepage "sections"
  tests/                     vitest: addProduct.test.jsx, ownerPath.test.jsx
  tests-ui/                  ad-hoc build/run scripts + auth_e2e.py (not wired into package.json)
design/                      preview images only
```

---

## D. ARCHITECTURAL LAYERS (as actually implemented)

```
UI pages/components (React)
  → hooks (useApiData) / context (AuthContext…)
  → services/api.js (axios; token + x-view-as)
  → HTTP → backend/server.js
  → routes/*.js  (guards: protect / optionalAuth / requireSeller / requireOwner / requireCapability / rateLimit)
  → controllers/*.js  (handlers wrapped by utils/asyncHandler)
  → utils/*.js  (billing, ledger, stock, studyService, otp …)  — controllers import utils directly; there is no separate "service" folder
  → models/*.js (Mongoose) → MongoDB
```
Deviations: many frontend pages call `api.*` inline rather than through dedicated service modules; only auth, home and media have service files. Study-centre logic is split between `controllers/studyController.js` and `utils/studyService.js` / `studyLogic.js` / `studyReports.js`.

**Business-type abstraction (central design idea)** [static]: `User.sellerType` ∈ `shop | service | study_center` selects a schema in `backend/utils/businessSchema.js` (terminology, navigation tabs, URL-section → module map, add-menu, billing item types, capabilities). `backend/utils/accounts.js` maps `sellerType` → account model (`Shop`, `ServiceProvider`, `StudyCenter`). The frontend renders owner pages via `features/modules.jsx` (`<Module name=…/>`), using `business.modules[name]` from `GET /api/seller/summary`; a section the schema doesn't list redirects to the profile.

---

## E. FEATURE REGISTRY, ROUTES AND APIs

### E1. Frontend routes (`frontend/src/App.jsx`)
| Path | Component | Guard |
|---|---|---|
| `/login`, `/signup` | `AuthPage mode=login|signup` | public |
| `/auth/callback` | `GoogleCallback` | public |
| `/register`, `/welcome` | `Register`, `Welcome` | public routes (step state is server-side) |
| `/forgot-password`, `/reset-password` | `PasswordReset` exports | public |
| `/` (inside `SiteChrome`) | `pages/Home` | public |
| `/search`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/requirements`, `/settings` | pages | public routes (API calls inside may require a token) |
| `/analytics/*`, `/customer/*`, `/bill/*`, `/order/*` | `LegacyOwnerRedirect` | forwards to `/@username/…` or `/login` |
| `/start-yours` | `StartYours` | `ProtectedRoute` (client-side only) |
| `/:username` → `UsernameShell` | validates username, canonicalises to `/@username`, sets `x-view-as` for admins | — |
| `/:username` index | `UnifiedProfilePage` | public profile |
| `/:username/{dashboard,billing,udhar,dues,analytics,inventory,customer,customer/:id,members,members/:id,courses,seats,add,bill/:id,order/:id,products,offers,messages,shop,settings}` | `<Module name=…>` inside `ProfileFrame` | schema-driven; `*` → `RedirectToProfile` |

Static routes win over `:username`. Client-side guards (`ProtectedRoute`, `useAccess`) are UX only; real enforcement is in backend middleware.

### E2. Backend routes (`backend/server.js` mounts → `backend/routes/*.js`) — all verified from source
Auth legend: **P** = `protect` (JWT), **O** = `optionalAuth`, **S** = `protect + requireSeller` (admins must send `x-view-as: <username>`), **A** = admin only, **–** = public.

| Mount | Endpoints |
|---|---|
| `/api` (listingRoutes) | – `GET /shops`, `/services`, `/products` |
| `/api` (homeRoutes) | – `GET /home`, `/home/suggest`; A `GET/POST /admin/home/{categories,cities,promos}`, `PUT/DELETE …/:id`; A `PATCH /admin/home/shops/:id` |
| `/api/search` | – `GET /` |
| `/api/auth` | `POST /register` (legacy; gated by `ALLOW_LEGACY_REGISTER`/test), `POST /login` (rate-limited), P `GET/PATCH /me`, P `PATCH /location`, `GET /google/start`, `GET /google/callback`, `POST /google/exchange`, `POST /google/link`, registration state machine `POST /register/email/start`, `GET /register/session`, `POST /register/personal`, `POST /register/otp/{resend,verify,change-phone}`, `GET /register/check-username`, `POST /register/avatar`, `POST /register/complete` (registration endpoints use `requireRegistration`), P `PATCH /onboarding`, `POST /forgot-password`, `POST /reset-password` |
| `/api/seller` (sellerRoutes) | P `POST /start`, `GET /me`, `PATCH /account`, `GET /check-username/:username`; **everything below is S**: `GET /owner/:username` (also `requireOwner`), `/study/*` (see below), products CRUD (`/products`), inventory (`/inventory/search`, `/inventory/add`, `/products/:id/stock`, `/products/:id/history`, `/products/:id/batches/:batchId`), `/sales`, `/bills`, `/analytics`, `/dashboard`, `/insights`, `/billing/*` (customers, drafts, products, config, services, summary, bills/:id[/document], recent), `/udhar/*`, `/summary`, `/orders[/:billId…]`, `/offers`, `/messages`, `/credits[/:id…]` |
| `/api/seller/study` (studyRoutes) | S + `requireCapability('seatManagement')`: `config` (+ list CRUD), `seats`, `assignments`, `members`, `courses`, `dashboard`, `analytics`, `billing/catalog` |
| `/api/bills` | S: `GET /:id`, `POST /:id/payment`, `POST /:id/convert-paid`, `PATCH /:id/status` (handlers from `ordersController.js`, `:id` aliased to `billId`) |
| `/api/customers` and `/api/seller/customers` | same `customerRoutes` router mounted twice; S: `/`, `/search`, `/activity`, `/:id`, `/:id/history`, `/:id/transactions`, `/:id/global`, `POST /:id/adjustment`, `PATCH /:id`. `/search` and `/activity` are declared before `/:id` (must stay that way) |
| `/api/profile` | O `GET /:username`, `/:username/products`, `/:username/stats`; – `/:username/similar` |
| `/api/reviews` | – `GET /`; P `POST /`, `DELETE /:reviewId` |
| `/api/requirements` | O `POST /`; P `GET /mine`, `PATCH /:id/close`; S `GET /inbox`, `PATCH /:id/respond` |
| `/api/follow` | P `POST /`; – `GET /followers`, `GET /following/:userId` |
| `/api/media` | – `GET /test-config` (public Cloudinary ping); P `POST /upload`, `DELETE /:publicId` |
| `/api/study` (studyPublicRoutes) | P `GET /my-seats`, `POST /release-request` |
| (inline) | – `GET /api/health` |

Ordering/collision facts [static]: in `sellerRoutes.js` the unguarded routes are deliberately above `router.use(protect, requireSeller)`. `GET /api/seller/orders/:billId` (sellerRoutes) and `GET /api/bills/:id` (billRoutes) both use `ordersController.getOrder`. `/api/seller/customers` and `/api/customers` expose the same handlers.

### E3. Feature registry
| Feature | Frontend entry | Backend | Models | Notes |
|---|---|---|---|---|
| Public homepage | `pages/Home.jsx`, `features/home/*`, `hooks/useHome.js`, `services/homeApi.js` | `homeController` (`GET /api/home`, suggest) | Category, City, PromoCard, Shop, ServiceProvider, Product, Review | Admin CRUD for categories/cities/promos in `homeController`; seeded by `seed/seedHome.js` |
| Listings & search | `pages/SearchResultsPage.jsx`, `features/search/*`, `sections/*` | `listingController`, `searchController` | Shop, ServiceProvider, Product | |
| Auth & registration | `features/auth/*`, `context/AuthContext.jsx`, `services/authApi.js` | `authController`, `registrationController`, `googleAuthController`, `accountController` | User, RegistrationSession, AuthTicket, OtpChallenge | Account is created at `register/complete`; Google email matching an existing password account requires password to link (per `AUTH_SETUP.md`; not independently traced) |
| Profiles (`/@username`) | `features/profile/UnifiedProfilePage.jsx`, `components/shop/*`, `components/profile/*` | `profileController` | Shop, ServiceProvider, StudyCenter, User, Product, Bill | Owner = logged-in username equals URL username; admin may view any |
| Seller onboarding ("Start Yours") | `features/seller/StartYours.jsx` + Shop/Service/StudyCenter wizards | `sellerController` | User, Shop, ServiceProvider, StudyCenter | One business per account (unique `userId` on account models) |
| Billing / orders | `features/analytics/pages/BillingPage, OrdersPage, BillPage`, `billCore.js`, `billOutput.js`, `billShare.js` | `billingController`, `ordersController`, `salesController`; utils `billing`, `billId`, `billPayments`, `billState`, `ledger` | Bill, BillDraft, BillCounter, Sale, Customer, Udhar, UdharHistory, ServiceItem, GlobalUser | Bill ids are per-shop unique (`{shopId, billId}` index) |
| Udhar / dues ledger | `pages/UdharPage.jsx`, `udhar/*` | `udharController`, `utils/ledger.js` | Udhar, UdharHistory, Bill, Customer | Study centre labels it "Pending Dues" (module id `dues`) |
| Inventory | `pages/InventoryPage.jsx`, `AddProductModal.jsx` | `inventoryController`, `productController`, `utils/stock.js` | Product (batches), Counter, Sale | `Product.stock` must equal sum of batch `remainingQty` (kept in sync by `utils/stock.js`) |
| Customers | `pages/CustomersPage.jsx`, `CustomerDetailPage.jsx`, `CustomerPanel.jsx` | `customerController` | Customer, GlobalUser, Bill, Udhar, UdharHistory | Cross-shop identity via `GlobalUser` keyed by 10-digit phone |
| Dashboard / analytics / insights | `AnalyticsPage.jsx`, `sections/*`, `DashboardPage.jsx` (older) | `dashboardController`, `analyticsController`, `insightsController` | Bill, Sale, Product, Credit, Message, Udhar | |
| Offers & messages | `OffersPage.jsx`, `MessagesPage.jsx` | `panelController` | Offer, Message | |
| Study centre | `features/study/*`, `components/study/StudyCenterProfile.jsx` | `studyController` + `studyRoutes`, `studyPublicRoutes`; utils `studyLogic/studyService/studyReports/businessHooks` | StudyCenter, Seat, SeatAssignment, StudyMember, Membership, Course, Enrollment (+ Customer, Bill, Udhar*) | Seat colour computed from active assignments only (per `ARCHITECTURE.md`); guarded by capability `seatManagement` |
| Follow | `features/follow/*` | `followController` | Shop/ServiceProvider/StudyCenter `followers[]`, User | |
| Reviews | `features/review/*` | `reviewController` | Review | Unique per `(targetType, targetId, userId)` |
| Requirements (buyer posts → sellers respond) | `pages/Requirements.jsx`, `features/requirement/*`, `components/MessagesIcon.jsx` | `requirementController` | Requirement | `postedBy` nullable (optionalAuth) |
| Media upload | `components/common/ImageUploadField, MediaUploadField`, `services/media.js` | `mediaController`, `middleware/upload.js` | – | Cloudinary |
| Location | `context/LocationContext.jsx`, `components/LocationPicker.jsx`, `utils/geo.js`, `indiaGeo.js` | `PATCH /api/auth/location` | User | Per `AUTH_SETUP.md` stored rounded (~1 km) |
| Legacy "seller" panels | `features/seller/{SellerDashboard,SalesPanel,CreditPanel,ProductsPanel,AnalyticsPanel}.jsx` | `creditController`, `salesController`, `productController` | Credit, Sale, Product | `SellerDashboard.jsx` has no static importer; `/api/seller/credits` + `/sales` endpoints are still mounted |

### E4. Frontend ↔ backend API matching (partial, grep-based)
Frontend call sites were extracted by regex for `api.<verb>('/api/…')` plus template-string `/api/…` paths. **All paths found matched a mounted backend route**, with these notes:
- `pages/Requirements.jsx` builds its URL from a variable (`api.get(\`${…}\`)`) — target not resolved statically **[unresolved]**.
- Backend endpoints with **no statically identified frontend caller** (grep of `frontend/src`): `GET/POST/PUT/DELETE /api/admin/home/*`, `GET /api/study/my-seats`, `POST /api/study/release-request`, `GET /api/media/test-config`. Treat these as "no statically identified caller", **not** as unused. (`/api/seller/products/:id/stock` and `/batches/:batchId` are called from `InventoryPage.jsx` through a local `call(method, url)` helper.)
- Duplicate mounts (`/api/customers` & `/api/seller/customers`; `/api/bills/:id` & `/api/seller/orders/:billId`) exist; the frontend uses both families.

---

## F. CROSS-FEATURE DEPENDENCIES (highest fan-in, from static import analysis)

Frontend (importers): `services/api.js` (40), `context/AuthContext.jsx` (34), `features/analytics/kit.jsx` (31), `utils/username.js` (27), `features/analytics/ui.jsx` (25), `hooks/useOwnerPath.jsx` (20), `hooks/useApiData.js` (17), `components/Img.jsx` (16), `utils/format.js` (13), `hooks/title.js` (13).

Backend: `utils/asyncHandler.js` (28 importers), models by importer count — `Bill` (18), `Sale` (16), `User` (15), `Product` (15), `Shop` (14), `Udhar` (14), `Customer` (12), `UdharHistory` (12), `ServiceProvider` (11); `utils/billId.js` (13), `middleware/auth.js` (12).

Business-logic hubs: `utils/businessSchema.js` + `utils/accounts.js` (business-type switch), `utils/ledger.js` (udhar/ledger effects), `utils/stock.js` (batch inventory), `utils/billing.js`/`billState.js`/`billPayments.js`.

---

## G. OPERATIONAL COMMANDS (only commands that exist in `package.json`)

Backend (`cd backend`): `npm install`; `npm run dev` (nodemon server.js); `npm start` (node server.js); `npm run seed:demo`, `seed:home`, `seed:study`; `npm run test:unit`; `test:study`; `test:billing`; `test:auth`; `npm run e2e:server` (starts a test harness on :5000 replacing only the Google chooser).
- `npm run seed` runs `node seed.js`, but the file is `backend/seed/seed.js` — **script path looks broken [static]**.
- `test:billing` / `test:auth` need a reachable Mongo-compatible DB (per `AUTH_SETUP.md`: `MONGODB_URI=… npm run test:auth`). Not executed here.
- No lint script exists in either package.

Frontend (`cd frontend`): `npm install`; `npm run dev` (vite); `npm run build`; `npm run preview`; `npm test` (`vitest run`, jsdom, `tests/**/*.test.jsx` only).

Documentation regeneration: no script exists (the proposed `scripts/update-ai-context.js` was not created).

Environment variables (names only, found via `process.env.*` grep in `backend/`; frontend reads none): `NODE_ENV, PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, TRUST_PROXY, AUTO_SEED, CLIENT_ORIGIN, API_PUBLIC_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, OTP_DEV_FIXED, OTP_SMS_PROVIDER, OTP_LENGTH, OTP_TTL_SECONDS, OTP_RESEND_COOLDOWN_SECONDS, OTP_MAX_ATTEMPTS, OTP_MAX_SENDS_PER_HOUR, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_MESSAGING_SERVICE_SID, MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, ALLOW_LEGACY_REGISTER, RATE_LIMIT_IN_TEST, REAL_MONGO, BILL_TZ, RENDER, VERCEL`. Requiredness is not verified per variable. `AUTH_SETUP.md` says the minimum for local dev is `MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN, API_PUBLIC_URL, OTP_DEV_FIXED=true` (+ Google creds for Google login). `.env*` is git-ignored (`!.env.example` allowed), but **no `.env.example` is tracked**, although `AUTH_SETUP.md` refers to `backend/.env.example`.

---

## H. IMPORTANT CONSTRAINTS (each supported by code)

1. **Backend enforces auth independently of the UI.** `protect` verifies JWT and loads the `User`; seller routes additionally require `role === 'seller'` and an existing account document (`requireSeller` → `findAccountByUser(userId, sellerType)`), exposing `req.sellerAccount` and `req.sellerType`.
2. **Admin "view as"**: admins calling `requireSeller` routes must send `x-view-as: <username>` (400 otherwise); the header is ignored for non-admins. The frontend sets it via `setViewAs()` in `UsernameShell`, and only for requests with `requiresAuth: true`.
3. **Ownership**: `requireOwner()` compares `req.user.username` to the URL param (admin bypass). Frontend equivalent is `useAccess()` in `components/UsernameRoute.jsx`.
4. **Route order** in `customerRoutes.js`: `/search` and `/activity` must stay above `/:id`. In `sellerRoutes.js`, `start/me/account/check-username` must stay above `router.use(protect, requireSeller)` because non-sellers need `/start`.
5. **Business schema is the switch**: do not key behaviour on username/shop name/id; use `businessSchema.js` capabilities (`requireCapability`) and `<Module>` registry. Adding a business type means a new schema + account model in `utils/accounts.js`.
6. **One business per user**: `Shop`, `ServiceProvider`, `StudyCenter` each have a unique `userId` and unique `username`.
7. **Stock invariant**: `Product.stock` = sum of `batches[].remainingQty`, maintained by `utils/stock.js`; `Sale`/`Bill.lines` keep `costBreakdown` per batch.
8. **Bill identity**: `Bill` unique on `{shopId, billId}`; daily counter in `BillCounter` (unique `{shopId, date}`); `ensureBillIndexes()` runs at startup.
9. **Ledger**: udhar/payment effects flow through `utils/ledger.js` (`applyLedger`) into `Udhar` (balance, unique `{shopId, customerId}`) and `UdharHistory`; `migrateLedger()` runs at startup.
10. **OTP safety**: server refuses to start when `OTP_DEV_FIXED=true` in production (`NODE_ENV=production`/`RENDER`/`VERCEL`), or production lacks an SMS provider (`assertOtpConfig`).
11. **Username policy** is enforced by `utils/username.js` (5–20 chars, `a–z0–9`, ≥3 digits per `AUTH_SETUP.md`; tests in `tests/username.test.js`). Frontend canonicalises URLs to `/@username`.
12. **Study-centre seats**: availability derives from active `SeatAssignment`s only (per `frontend/ARCHITECTURE.md`; logic in `utils/studyLogic.js`, tests in `tests/study.logic.test.js`).
13. **Frontend API base URL is hard-coded** to `http://localhost:5000` in `services/api.js` and reused by `services/media.js`; production deploys must edit it.

---

## I. KNOWN GAPS, STALE DOCS AND UNRESOLVED ITEMS

Documentation drift (verified):
- `AUTH_SETUP.md` states Study Center "has no separate backend model … is a Shop with category `Library`". Code contradicts this: `backend/models/StudyCenter.js` (+ Seat, SeatAssignment, StudyMember, Membership, Course, Enrollment) and `User.sellerType='study_center'` exist.
- `frontend/ARCHITECTURE.md` describes an earlier mock-data architecture (`useMockApi`, `data/*.json`, routes like `/shop/:shopId`, `/service/:id`); the current router (`App.jsx`) has no such routes.

Code-level findings (static, not executed):
- Case-sensitive import bug: `features/analytics/AnalyticsDashboard.jsx` and `DashboardPage.jsx` import `./Charts.jsx`, but the file is `charts.jsx`. Works on case-insensitive filesystems only. Both importers themselves have no static importer.
- Missing JSON referenced: `FAQAccordion.jsx` → `data/faq.json` exists; `ServicePage.jsx` → `data/commonServices.json` and `ShopPage.jsx` → `data/shops.json`/`products.json` **are not tracked** (those two pages have no static importer either).
- Files with **no statically identified importer** (not proven unused; checked only for static ESM imports): `backend/controllers/billController.js`; `frontend/src/components/{Banner,Header,MoreMenu,ProductCard,Section,ServiceCard,ShopCard,ThemeToggle,background}.jsx`, `components/common/ImageUploadField.jsx`, `components/profile/AnalyticsSection.jsx`, `features/analytics/{AnalyticsDashboard,DashboardPage,BillDetailPage,customer/TransactionTimeline}.jsx` (BillDetailPage path: `features/analytics/pages/BillDetailPage.jsx`), `features/home/homeData.js`, `features/seller/SellerDashboard.jsx`, `features/services/ServicePage.jsx`, `features/shops/ShopPage.jsx`, `layouts/{ProfileFrame,SiteChrome,SellerLayout}.jsx`, `hooks/{useGeolocation,useMockApi}.js`, `pages/{login,signUp}.jsx`, `sections/{CallToAction,CommonServices,Hero,NearbyShops,QuickCategories,SmartRecommendations,Testimonials,TrendingProducts}.jsx`, `utils/{search,time}.js`. Note: some of these (e.g. `sections/NearbyShops.jsx`) do contain live API calls, so check before deleting.
- Duplicated names with different content: `components/{ProfileFrame,SiteChrome}.jsx` (used by `App.jsx`) vs `layouts/{ProfileFrame,SiteChrome}.jsx` (no importers); `features/analytics/SellerLayout.jsx` (imports `BusinessProvider`, fetches `/api/seller/summary`) vs `layouts/SellerLayout.jsx` (also fetches it).
- `GET /api/media/test-config` is public by design (comment in code); it pings Cloudinary.
- `backend/seed/credentials.csv` is **tracked** and contains demo account emails and plaintext passwords (values intentionally not reproduced here). `AUTO_SEED` defaults to enabled (`!== 'false'`), so demo seeds run at every non-test startup unless disabled; confirm this is off for production.
- `cors()` is unrestricted (no origin allow-list) in `server.js` even though `CLIENT_ORIGIN` exists for other uses.
- Twilio SMS adapter is untested against Twilio (per `AUTH_SETUP.md`).
- Rate limiter is in-memory (single instance only).
- `seed` npm script path mismatch (see G).

Not verified (deliberately out of scope for this single-file pass): controller-internal branches and response shapes, per-model read/write operation lists, Mongoose hooks beyond `User.pre('save')` password hashing, aggregation pipelines, dynamic imports (none observed by the import regex), runtime behaviour of any flow, line-number evidence, per-file exports lists, and test-to-feature coverage mapping. Frontend API call extraction was regex-based and misses URLs built from variables.

### Flow status summary
| Flow | Status | Evidence |
|---|---|---|
| App startup / DB connect | verified (static) | `backend/server.js` `start()` |
| Frontend init | verified (static) | `main.jsx`, `App.jsx` |
| Homepage load | verified at route level | `GET /api/home` ← `services/homeApi.js` ← `useHome` |
| Login | verified at route level | `AuthContext` → `POST /api/auth/login` (rate-limited) → `GET /api/auth/me` |
| Google OAuth | route level | `/api/auth/google/{start,callback,exchange,link}`, `features/auth/GoogleCallback.jsx` |
| Registration + OTP | route level | `/api/auth/register/*`, `services/authApi.js`, models RegistrationSession/OtpChallenge |
| Password reset | route level | `/api/auth/forgot-password`, `/reset-password`, `PasswordReset.jsx` |
| Logout | frontend-only | `AuthContext` removes `lf_token`/`lf_view_mode` (no backend route found) |
| Account switching | **not found** as a distinct flow | one business per user; admin `x-view-as` is the only "switch" |
| Business creation | route level | `StartYours` → `POST /api/seller/start` |
| Billing / orders / udhar / inventory / customers / analytics | route level (frontend callers and mounts matched) | see E2/E3 |
| Study centre | route level | `/api/seller/study/*`, `features/study/*` |
| Payments (gateway) | **not found** — only recorded payment amounts/methods on bills (`upi/cash/card/udhar`) |
| Location selection | route level | `LocationContext` → `PATCH /api/auth/location` |
| Error handling | verified | `middleware/errorHandler.js`; axios interceptor in `services/api.js` |

---

## J. NAVIGATION TO SUPPORTING MANIFESTS

Requested but **not generated** (single-file request): `.ai-context/project-manifest.json`, `file-index.json`, `dependency-graph.json`, `route-map.json`, `api-map.json`, `database-map.json`, `flow-map.json`, `feature-map.json`, `environment-map.json`, `test-map.json`, `risk-map.json`, `unresolved-items.json`, `documentation-metadata.json`, and `scripts/update-ai-context.js`. Their content is summarized in sections E–I above. Existing human docs worth reading: `README.md`, `AUTH_SETUP.md` (auth design; partly stale on study centres), `frontend/ARCHITECTURE.md` (older, partly stale).

### Appendix 1 — Mongoose models (34 files in `backend/models/`)
Accounts/auth: `User` (role `consumer|seller|admin`, `sellerType`), `RegistrationSession`, `AuthTicket` (TTL), `OtpChallenge` (TTL, unique `{purpose, subject}`).
Businesses: `Shop`, `ServiceProvider`, `StudyCenter` (each `userId` unique, `username` unique, `followers[]`).
Commerce: `Product` (batches, virtuals), `Sale`, `Bill` (+`billingConfigSchema.js` fragment), `BillDraft`, `BillCounter`, `Counter`, `ServiceItem`, `Customer` (`globalUserId`), `GlobalUser` (unique phone), `Udhar`, `UdharHistory`, `Credit`, `Offer`, `Message`.
Study centre: `Seat`, `SeatAssignment`, `StudyMember`, `Membership`, `Course`, `Enrollment`.
Discovery/social: `Category`, `City`, `PromoCard`, `Review`, `Requirement`.
Main references: `*.shopId → Shop` (for `ServiceItem` the comment says it refers to the seller account of any type, with no `ref`), `Bill.customerId → Customer`, `Bill.creditId → Credit`, `Membership/SeatAssignment/StudyMember → StudyCenter/Seat/Customer`, `Review.targetType/targetId` polymorphic (`shop|service|study_center`), `Requirement.responses[].sellerType/sellerId`.

### Appendix 2 — Tests discovered (not run)
Backend plain-node scripts: `billId`, `username`, `stock`, `billing`, `billing.output` (unit); `billing.int`, `billing2.int`, `auth.int`, `inventory.int` (integration; `inventory.int` is not in any npm script), `smoke`, `study.logic`, `study.config`, `study.seed`; `e2e-harness.js`. Frontend: vitest `addProduct.test.jsx`, `ownerPath.test.jsx`; `tests-ui/*` ad-hoc scripts and `auth_e2e.py`. No tests were discovered for requirements, reviews, follow, media, or homepage admin endpoints (by filename only).
