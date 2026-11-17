# Implementation status

This status distinguishes existing behavior from new source changes. The
additive workflow migration was applied to the configured `smart_ewaste_db`
after a restorable backup was confirmed, and the offer/payout APIs were tested
against that database using temporary records that were removed afterward.

## Preserved customer features

- `POST /api/auth/register` validates input, hashes passwords with bcryptjs,
  checks duplicate emails and always creates a `CUSTOMER`.
- `/register` preserves the customer registration flow.
- Authenticated customers register devices on `/items`. The API validates
  category/brand references, derives `user_id` from the signed session and
  inserts the initial `Registered` status.
- `GET /api/items` scopes customer devices to the session identity and
  provides category and brand options.
- Existing runtime/browser evidence for these paths is recorded in
  [TESTING.md](./TESTING.md). The source contracts were not replaced.

## Existing processing and inspection behavior

- `/recycling` lists MySQL recycling rows; staff/admin status changes use
  `PATCH /api/recycling/[id]`.
- `/refurbishment` lists refurbished product, sale, payment and processing
  fields; staff/admin updates use `PATCH /api/refurbishment/[id]`.
- A Sold product receives a sale date if absent. Existing update logic does not
  process or conflate supplier payouts with refurbished-product buyer payment.
- `GET` and staff/admin-only `POST /api/inspections` use
  `smart_ewaste_nosql.inspection_reports`. The API validates the MySQL
  inspection/item pair and restricts customer reads to owned devices.
- Staff/admin `POST /api/inspections/record` creates a MySQL inspection for a
  collected device and changes the item state/history in one transaction. The
  detailed MongoDB report is saved separately so a MongoDB failure cannot
  silently undo or misrepresent the committed MySQL inspection.
- Mongo attachment fields are names only; upload/storage is not implemented.

## Offer, pickup and payout workflows

- `POST /api/offers` lets staff/admin create preliminary and final offers;
  customers see only their own and can accept/decline through `PATCH`.
- `POST /api/pickups` creates an owned-device request after accepted preliminary
  offer; staff/admin can schedule, assign a collector from that center and
  record receipt using `PATCH /api/pickups/[id]`.
- Pickup list uses `LEFT JOIN COLLECTOR` so unassigned requests are visible.
- `/payouts` records manual supplier payout against a customer-accepted final
  offer. Database uniqueness and transactional status locking prevent a second
  payout for that offer. Payout status transitions are `Pending` ->
  `Processing` -> `Paid` or `Failed`; failed payouts can be retried through
  `Processing`.
- `SUPPLIER_PAYOUT_HISTORY` records each payout status transition, actor,
  transaction reference and failure reason.
- `ITEM_STATUS_HISTORY` records transitions made by these workflow operations.
- The one-time additive `MySQL/migrations/20261028_workflow_tables.sql` has
  been applied to `smart_ewaste_db` and its tables, constraints and indexes
  were verified.

## Remaining workflow and authorization gaps

- MySQL offer, pickup, inspection and payout API transitions were exercised
  with temporary test records. The MongoDB inspection-report write is separate;
  no automatic cross-database atomic transaction is claimed.
- A declined final offer is explicitly marked `Return Requested`, but no
  return scheduling/resolution workflow exists yet.
- Recycling/refurbishment list/status operations remain existing functionality;
  there is no complete quality-gated refurbishment creation workflow.
- Role-aware navigation and API role checks exist for current features, but
  dedicated admin user/role/master-data management and audited overrides are
  absent.
- MongoDB update/delete endpoints, automated index provisioning and application
  aggregation are not present.
- No screenshots or individual contribution evidence are committed. Capture
  actual evidence and map contributions to Git history; do not infer ownership.

## Configuration and data safety

- Existing `lib/auth.ts`, MySQL pool and MongoDB client are reused.
- The new migration is additive. No database changes, drops, resets or seed
  scripts were executed for this update.
- `.env.example` contains variable names/placeholders only; keep `.env.local`
  untracked and do not share its values.
- Validation and historical runtime evidence are distinguished in
  [TESTING.md](./TESTING.md).
