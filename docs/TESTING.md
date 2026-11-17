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
- The additive workflow migration was applied to `smart_ewaste_db` after the
  user confirmed a restorable backup. The migration added the offer, supplier
  payout, payout history and item status history tables, and made unassigned
  pickup collectors nullable.
- Authenticated API tests exercised preliminary/final offers, pickup
  scheduling/completion, inspection, payout creation, processing, payment,
  failure, retry, duplicate rejection, declined-offer rejection and customer
  ownership scoping. Temporary test users and workflow records were cleaned
  up after each run.
- Customer login used the normal login route. Management API tests used a
  short-lived signed `ADMIN` session for an existing administrator because
  no management password was used in the test. This verifies the route's
  role/session checks, not password-based management login.
- The customer/staff pages were not tested in a browser with authenticated
  users. No full responsive browser matrix or MongoDB report write was part of
  the offer/payout verification.

## Current-source checks

Run results for the current implementation:

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Next.js 16.3.6 generated the public pages and
  compiled `/api/offers`, `/api/payouts`, `/api/pickups/[id]` and
  `/api/inspections/record`.
- Live MySQL offer/payout API integration: passed for the flows listed above.
  Both customer and management `GET /api/offers` and `GET /api/payouts`
  returned HTTP 200 after migration; unauthenticated GETs returned 401.
- The customer read back the persisted paid amount, status and transaction
  reference. Another customer could not see that offer or payout.
- Failed payout required a reason, remained visible to its customer, and could
  be retried without creating a duplicate payout.
- Production server smoke check: `http://localhost:3000` returned HTTP 200.
- Unauthenticated requests to the offer/payout GET routes and pickup/
  inspection mutation routes returned 401 before database access.
- Browser smoke check: landing page and registration page rendered; the offers
  page redirected to login when unauthenticated. Desktop screenshots were
  captured transiently in the browser tool; registration was also checked at
  390px with no horizontal overflow. No screenshot files were saved to the
  repository.
- `git diff --check`: passed.

The browser checks remain smoke checks; the authenticated MySQL API workflow
was tested separately with temporary test records.

## Database readiness probe

The configured services were queried read-only without displaying connection
values or reading document contents:

- MySQL connection succeeded to `smart_ewaste_db` on MySQL `8.0.46`. Before
  migration, `DEVICE_OFFER`, `SUPPLIER_PAYOUT` and `ITEM_STATUS_HISTORY` were
  absent, and `PICKUP_REQUEST.collector_id` was `NOT NULL`.
- After the user confirmed a restorable backup, the existing
  `MySQL/migrations/20261028_workflow_tables.sql` migration was applied once.
  The four workflow tables, foreign keys, positive-amount/status checks,
  unique payout-per-offer constraint, indexes, pickup collector nullability
  and pending-pickup view were verified from `information_schema`.
- After temporary integration records were cleaned up, the base database
  counts remained 7 users, 13 devices, 7 pickups and 10 inspections. Offer,
  payout and workflow-history counts were zero; no existing customer or device
  records were deleted or reset.
- MongoDB connection succeeded for `smart_ewaste_nosql`. The
  `inspection_reports` collection exists and currently reports index names
  `_id_` and `inspectionId_1`. No report contents were read or modified.

The database observation confirms the migration is required for pickup
creation and new offer/payout/history features; it does not prove those paths
work against the live database.

## Offers queue audit (2026-11-17)

A read-only inspection of the currently configured MySQL database found the
`DEVICE_OFFER` table with zero rows and two registered devices eligible for a
preliminary valuation. The existing schema had no device submission timestamp
or offer valuation-notes column. The additive
`MySQL/migrations/20261117_offer_valuation_queue.sql` adds those fields and
supporting indexes; it was not applied during this source change.

After building the updated source, authenticated `GET /api/offers` returned
HTTP 500 with the migration-required message because the new columns are not
present yet. No offers were created and no customer or device data was changed.
Do not treat the updated queue or write workflow as live until the migration is
applied and verified, then test with approved test data.
