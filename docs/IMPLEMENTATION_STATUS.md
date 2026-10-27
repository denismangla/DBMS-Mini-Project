# Implementation status

## Customer registration and devices

- `POST /api/auth/register` validates input, hashes passwords with bcryptjs,
  checks duplicate emails, and always inserts the `CUSTOMER` role.
- `/register` provides the registration form and link to login.
- Authenticated customers can register devices on `/items`. The API validates
  category/brand references, derives `user_id` from the signed session, and
  inserts devices with the initial `Registered` status.
- `GET /api/items` retains session-based customer ownership filtering and
  provides category and brand options for the form.

## Recycling and refurbishment

- `/recycling` displays MySQL recycling records and provides staff/admin status
  controls backed by `PATCH /api/recycling/[id]`.
- `/refurbishment` displays product, sale, payment, and processing information.
  Staff/admin updates use `PATCH /api/refurbishment/[id]`.
- A Sold product receives a sale date if one is not already recorded. Payment
  status is not changed or processed. A paid Sold product cannot be reverted to
  Available.
- Customers see only operational records linked to their own devices and cannot
  update statuses.

## MongoDB inspection reports

- `lib/mongodb.ts` caches a MongoDB client promise for development reloads.
- `GET` and staff/admin-only `POST /api/inspections` use
  `smart_ewaste_nosql.inspection_reports`.
- The API verifies inspection/item pairing against MySQL and customer report
  reads are restricted to reports for their own items.
- `/inspections` displays report notes, observations, component findings,
  recommendations, and attachment names. Staff/admin users can create reports.
- Configure `MONGODB_URI` and `MONGODB_DB=smart_ewaste_nosql` in `.env.local`.
- The local MongoDB service, target database, collection, reads, and a
  create/read-back cycle were verified using a temporary local URI override.
  Existing component findings use the `notes` field; new reports follow that
  same shape. The ignored local `.env.local` now contains the verified
  localhost URI and database name; deployments should configure their own
  reachable URI.
- Browser verification displayed existing reports and a newly created report
  after a full page reload.

## Data and security notes

- No schema migrations, drops, or seed scripts were run.
- Existing authentication/session helpers and MySQL pool are reused.
- APIs use parameterized SQL and return generic database errors rather than
  exposing query details or credentials.
- `.env.example` contains placeholders only; keep `.env.local` untracked.
- Executed commands and database-test limitations are documented in
  [TESTING.md](./TESTING.md).
