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
- The additive Offers queue migration
  `MySQL/migrations/20261117_offer_valuation_queue.sql` was applied after a
  restorable backup was confirmed. Its two columns and supporting indexes were
  verified in MySQL.
- Authenticated API tests exercised preliminary/final offers, pickup
  scheduling/completion, inspection, payout creation, processing, failure,
  retry, duplicate rejection, declined-offer rejection and customer ownership
  scoping. Any status-only payment tests used temporary test data and do not
  verify or claim an actual money transfer.
- Customer login used the normal login route. Management API tests used a
  short-lived signed `ADMIN` session for an existing administrator because
  no management password was used in the test. This verifies the route's
  role/session checks, not password-based management login.
- Authenticated production-browser checks exercised staff/customer Offers and
  Payouts pages. Staff created a preliminary offer; customers declined and
  accepted offers; staff created a final offer after inspection; and the
  customer and staff both read a pending/processing payout and its history.
  Temporary fixtures were removed and item states restored afterward.
- The successful payment-completion transition was not exercised because no
  real payment was made. The API rejected completion without a transaction
  reference. No full responsive browser matrix or MongoDB report write was
  part of this verification.

## Current-source checks

Run results for the current implementation:

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Next.js 16.3.6 generated the public pages and
  compiled `/api/offers`, `/api/payouts`, `/api/pickups/[id]` and
  `/api/inspections/record`.
- Authenticated staff/customer GETs for dashboard, items, pickups, inspections,
  offers, payouts, recycling and refurbishment returned HTTP 200.
- MySQL workflow tests passed: staff preliminary/final offer creation;
  customer offer ownership, decline and acceptance; payout creation from an
  accepted final offer; duplicate rejection; customer ownership isolation;
  staff-only payout mutations; payout processing, failure and retry; history
  reads; and rejection of a declined final offer for payout.
- The successful `Paid` transition was not performed. Supplying no transaction
  reference is rejected; no payment was made or represented as completed.
- Authenticated production-browser checks passed for staff and customer Offers
  and Payouts pages, including staff offer creation, customer offer decisions,
  payout details/history, filters, and role-specific empty states.
- After cleanup, MySQL contains zero `DEVICE_OFFER`, `SUPPLIER_PAYOUT` and
  `SUPPLIER_PAYOUT_HISTORY` rows; all 10 pre-existing inspections and original
  item statuses remain. No test payout or simulated payment was left behind.
- `git diff --check`: passed.

The local development server reported HMR WebSocket handshake errors in the
browser harness; the production build/browser checks were used for UI
verification and completed without page errors.

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

## Offers and payouts audit (2026-11-17)

The initial read-only inspection found that the database lacked
`DEVICE_OFFER.valuation_notes` and `E_WASTE_ITEM.submitted_at`, although the
updated Offers API queried both. The resulting authenticated `GET /api/offers`
failed with HTTP 500 (`Unknown column 'o.valuation_notes' in 'field list'`).
The approved additive migration was applied and verified; both staff and
customer Offers/Payouts reads then returned HTTP 200.

The database originally had zero offers and zero payouts, so the empty payout
view was accurate rather than missing seeded production data. Temporary,
clearly marked records on existing devices were used to exercise the staff and
customer workflows and then removed. The device statuses/dispositions were
restored. No persistent offer or payout test data remains; the current UI
continues to show a true empty state until real eligible offers/payouts exist.
