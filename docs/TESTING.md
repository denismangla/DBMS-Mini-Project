# Testing

## Existing implementation test evidence

The following checks and runtime flows were recorded before the current
workflow additions. They are historical evidence for the existing application,
not a claim that the new offer/payout/pickup flows were exercised.

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

The prior implementation report recorded all three checks as passing at that
time. Current-source validation is listed separately below.

## Runtime verification performed

- Against the configured MySQL service: invalid and duplicate registration,
  customer account creation, login, category validation, customer device
  creation, session-derived ownership despite a submitted `userId`, customer
  item-list visibility, and staff-only creation denial all passed.
- Staff recycling and refurbishment/processing updates persisted in MySQL and
  appeared in refreshed GET responses. Customer status-update attempts were
  denied. Original operational statuses were restored after the checks.
- Browser verification logged in as a temporary staff test account, changed
  recycling, sale, and processing statuses through the GUI, observed refreshed
  values, and restored the original values.
- Against the local MongoDB service and existing `inspection_reports`
  collection: existing reports were read, malformed nested input and mismatched
  MySQL references were rejected, customer write was denied, customer reads
  were item-scoped, and a valid staff report was created and read back.
  The GUI displayed existing documents and a new report after page reload; the
  exact test report was removed after verification.
- Browser flow: customer registration, login, device submission, and appearance
  in the refreshed item list passed. The exact test account/device were removed.

The first MongoDB integration checks used a temporary
`mongodb://127.0.0.1:27017` process environment override. After confirming the
existing local database and collection, the same URI and database name were
added to the ignored `.env.local`. A subsequent normal production-server start
read the existing reports successfully through that configuration. Deployments
must use their own reachable URI. The tested create/read-back used the existing
collection; no collection/index changes were issued.

For future manual checks, use a test account and a non-production database.
Keep the database populated with its existing data; do not run the SQL seed
file as a test. Restore operational status fields changed during manual
testing.

## Current implementation boundaries

- Registration creates customer accounts only; staff/admin provisioning remains
  an administrative database operation.
- Device creation supports the fields available in `E_WASTE_ITEM`; item
  ownership is assigned by the server.
- Inspection attachment fields store names only. This feature does not upload
  files.
- The current source adds offers, pickup creation/assignment and manual
  supplier-payout APIs. These require the additive workflow migration and were
  not run against MySQL/MongoDB during this update.
- The current source's customer, staff and admin UIs were not end-to-end
  authenticated with configured role accounts during this update.
- No live migration, saved screenshot files, full responsive browser matrix,
  trigger execution, SQL view/index verification or authenticated team-role
  workflow audit was performed as part of this update.

## Current-source checks

Run results for the current implementation:

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Next.js 16.3.6 generated the public pages and
  compiled `/api/offers`, `/api/payouts`, `/api/pickups/[id]` and
  `/api/inspections/record`.
- Production server smoke check: `http://localhost:3000` returned HTTP 200.
- Unauthenticated requests to the offer/payout GET routes and pickup/
  inspection mutation routes returned 401 before database access.
- Browser smoke check: landing page and registration page rendered; the offers
  page redirected to login when unauthenticated. Desktop screenshots were
  captured transiently in the browser tool; registration was also checked at
  390px with no horizontal overflow. No screenshot files were saved to the
  repository.
- `git diff --check`: passed.

These are build/UI smoke checks only. They do not prove MySQL migration
execution, MongoDB behavior, API state transitions, authorization under
authenticated roles, or the end-to-end workflow.

## Database readiness probe

The configured services were queried read-only without displaying connection
values or reading document contents:

- MySQL connection succeeded to `smart_ewaste_db` on MySQL `8.0.46`. The live
  `PICKUP_REQUEST.collector_id` is `NOT NULL`; the three workflow tables are
  absent. Baseline row counts reported by read-only `COUNT(*)` were 7 users,
  13 devices, 7 pickups and 10 inspections.
- The migration was **not applied**. A restorable backup was not confirmed,
  and applying DDL to the existing database was left as an explicit operator
  step. The migration source changes no existing row data, but its view/index/
  table DDL still needs review, backup and successful post-migration checks.
- MongoDB connection succeeded for `smart_ewaste_nosql`. The
  `inspection_reports` collection exists and currently reports index names
  `_id_` and `inspectionId_1`. No report contents were read or modified.

The database observation confirms the migration is required for pickup
creation and new offer/payout/history features; it does not prove those paths
work against the live database.
