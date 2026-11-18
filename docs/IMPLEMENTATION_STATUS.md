# Implementation status

This status distinguishes existing behavior from new source changes. The
additive workflow and Offers queue migrations were applied to the configured
`smart_ewaste_db` after a restorable backup was confirmed. Offer/payout APIs
and authenticated staff/customer pages were tested using temporary records
that were removed afterward.

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
  its staff queue is sourced from eligible `E_WASTE_ITEM` rows, not existing
  offers, and customers see only their own offers and can accept/decline
  through `PATCH`.
- The Offers workspace shows eligible registered/estimate-declined devices,
  customer/device details, prior declined preliminary valuations and the
  inspection details/reports required to review a final offer. Final offers
  remain separate history rows; current pending/accepted preliminary offers
  are excluded from the valuation queue.
- Staff offer creation records the authenticated actor, validates price and
  currency, preserves optional valuation notes, and rejects duplicate active
  offers. Customer decisions remain transactional and ownership-scoped.
- `MySQL/migrations/20261117_offer_valuation_queue.sql` adds the nullable
  `submitted_at` field, optional offer valuation notes and queue/history
  indexes. Existing device rows have no reliable submission date and remain
  `NULL`; new website submissions record their timestamp.
- `POST /api/pickups` creates an owned-device request after accepted preliminary
  offer; staff/admin can schedule, assign a collector from that center and
  record receipt using `PATCH /api/pickups/[id]`.
- Pickup list uses `LEFT JOIN COLLECTOR` so unassigned requests are visible.
- `/payouts` records manual supplier payout against a customer-accepted final
  offer. Database uniqueness and transactional status locking prevent a second
  payout for that offer. Payout status transitions are `Pending` ->
  `Processing` -> `Paid` or `Failed`; failed payouts can be retried through
  `Processing`.
- Staff can review payout summaries, status filters and offer/device details.
  Customers see only their own payout rows and history. The UI labels `Paid`
  as completed, and the staff API requires a transaction reference before
  recording that state. This is a manual workflow; it does not initiate or
  verify a money transfer.
- `SUPPLIER_PAYOUT_HISTORY` records each payout status transition, actor,
  transaction reference and failure reason.
- `ITEM_STATUS_HISTORY` records transitions made by these workflow operations.
- The one-time additive `MySQL/migrations/20261028_workflow_tables.sql` has
  been applied to `smart_ewaste_db` and its tables, constraints and indexes
  were verified.

## Remaining workflow and authorization gaps

- MySQL offer, pickup, inspection and payout API transitions were exercised
  with temporary test records. Browser tests exercised the staff/customer
  Offers and Payouts pages. The successful payment-completion transition was
  not used to simulate a real payment. The MongoDB inspection-report write is
  separate; no automatic cross-database atomic transaction is claimed.
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
- The configured database currently has no offers or payouts, so both pages
  show real empty states until actual workflow records are created. No
  persistent test fixtures or simulated completed payments remain.

## Configuration and data safety

- Existing `lib/auth.ts`, MySQL pool and MongoDB client are reused.
- The applied migrations are additive; no tables were dropped/recreated and
  no seed script was run. Temporary offers, payouts and inspections used for
  verification were removed, and the affected existing item statuses were
  restored.
- `.env.example` contains variable names/placeholders only; keep `.env.local`
  untracked and do not share its values.
- Validation and historical runtime evidence are distinguished in
  [TESTING.md](./TESTING.md).
