# Advanced database features

The project has implementation evidence for four intended database concepts.
Source presence and runtime verification are tracked separately: no SQL
migration or SQL demonstration script was run during this update.

| Concept | Purpose and implementation | Test command / expected behavior | Evidence status |
|---|---|---|---|
| Transactions | The refurbishment PATCH and new offer, payout and pickup APIs use MySQL transactions to keep related writes together. Offer decision updates the offer, device status, and history in one transaction. | Cause any later statement in a test transaction to fail; earlier status/history writes must roll back. Then verify all related rows remain unchanged. | API code present. New paths have not yet been runtime-tested after migration. Historical transaction evidence in [TESTING.md](./TESTING.md) covers existing status updates, not the new tables. |
| Views | `v_pending_pickups`, `v_item_processing_overview`, and `v_refurbished_products` give reusable workflow projections. The migration updates `v_pending_pickups` with a `LEFT JOIN` so unassigned pickups remain visible. | `SELECT * FROM v_pending_pickups ORDER BY requested_date;` should include pending/scheduled pickups even when `collector_id` is `NULL`. | Views defined in the base SQL file. Updated view is created by the migration and is unverified until applied. |
| Triggers | `trg_pickup_completed` changes linked device status to `Collected` when pickup status transitions to `Completed`. The API also records status history transactionally before triggering this transition. | In a disposable database, complete one pickup and query its linked item; expect `item_status = 'Collected'`. Do not run the test update against real data. | Trigger definition/test SQL exists in `Smart_EWaste_MySQL.sql`; no fresh live execution evidence is recorded. |
| Indexing | Foreign keys and unique constraints create supporting indexes in the base schema. The migration adds composite indexes for item ownership/status, pickup owner/status and schedule queues, inspection lookup, offer lookup, payout status, and item history. | `SHOW INDEX FROM E_WASTE_ITEM;`, `SHOW INDEX FROM PICKUP_REQUEST;`, `SHOW INDEX FROM DEVICE_OFFER;`, `SHOW INDEX FROM SUPPLIER_PAYOUT;`, `SHOW INDEX FROM ITEM_STATUS_HISTORY;`. Verify the named indexes after migration and compare `EXPLAIN` for owner/status and pickup queue queries. | Useful index DDL is included in the migration. The existing base SQL index section is empty; migration and execution remain unverified. |

## Base SQL demonstrations

`MySQL/Smart_EWaste_MySQL.sql` also contains DDL/DML, joins, aggregates,
`GROUP BY`, `HAVING`, `ORDER BY`, subqueries, transaction examples, trigger
definition, view queries, and schema/index inspection. It includes a
`ddl_drop_demo` create/drop pair and a temporary test-user delete example.
These are educational examples, not proof of execution. The script also
contains sample records and destructive/duplicate-prone DDL; do not rerun it
against an existing application database.

## Safe verification

Run demonstrations against a disposable database created from a copy of the
schema. Do not copy live customer records. Capture the SQL command and the
actual result (including database version) in the team's evidence log. The
application test account/device cleanup described in `TESTING.md` does not
verify the SQL trigger, view or new indexes.
