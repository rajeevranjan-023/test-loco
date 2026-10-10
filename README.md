
---
## Business types (Shop · Service · Study Center)
One application, one billing/payment/analytics engine. `User.sellerType` picks a **business schema** (`backend/utils/businessSchema.js`):
terms (Customer→Member, Udhar→Pending Dues …), navigation, modules, add-menu, billing item types. The shell gets it from
`GET /api/seller/summary → business`; the router renders `features/modules.jsx` modules by schema, never by name/id.
Study Center data: `StudyCenter`, `Seat`, `StudyMember`, `Membership`, `SeatAssignment`, `Course`, `Enrollment`; API `/api/seller/study/*`.
Seat colour is computed from active seat assignments only (`utils/studyLogic.js`) — membership expiry / dues never release a seat.
Test data + login: `cd backend && npm run seed:study` (see `backend/study-center-test-account.txt`); tests: `npm run test:unit && npm run test:study`.
