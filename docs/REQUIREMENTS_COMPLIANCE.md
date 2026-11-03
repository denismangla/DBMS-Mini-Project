# DBMS Level 3 requirements compliance

Assessment date: 28 October 2026. A status of **Verified** below means that
there is identifiable implementation evidence in the repository or existing
test record. It does not imply that every external database operation was
re-run during this update. New workflow routes and the additive migration are
marked **Partial** until they are applied to a configured test database and
exercised end to end.

| Requirement | Status | Evidence / remaining work | Responsible member |
|---|---|---|---|
| Problem statement, objectives, scope | Partial | Project identity and workflow are in [README.md](../README.md); add the team's approved course wording and named scope owners. | Team |
| ER diagram and relational schema | Partial | Existing ER image [ER_Diagram.drawio.png](../MySQL/ER_Diagram.drawio.png), schema image [Relational Schema.jpeg](../MySQL/Relational%20Schema.jpeg), and DDL in [Smart_EWaste_MySQL.sql](../MySQL/Smart_EWaste_MySQL.sql). Update diagrams for `DEVICE_OFFER`, `SUPPLIER_PAYOUT`, `ITEM_STATUS_HISTORY`, and nullable pickup collector after applying the migration. | Team |
| Primary/foreign keys and constraints | Verified in source | DDL defines PKs, FKs, and checks for weights, quantities, ratings, money and percentages; new migration adds workflow FKs and checks. Live schema must be compared after migration. | Team |
| CREATE, ALTER, safe DROP | Partial | CREATE/ALTER and an isolated `ddl_drop_demo` create/drop are in the SQL script. Run the demonstration only in a disposable copy; never run the seed script against the populated application database. | Team |
| INSERT, UPDATE, DELETE, SELECT | Verified in source | DML examples, including deletion of a uniquely named temporary test user, are in the SQL script. Execute only on a disposable schema or use the application's configured test database. | Team |
| JOIN, aggregates, GROUP BY, HAVING, ORDER BY, subqueries | Verified in source | Query examples are in sections 8–10 of the SQL script. Results have not been independently re-captured for this update. | Team |
| Advanced database concepts | Partial | Transactions, views, trigger, and additive indexes are described in [ADVANCED_DATABASE_FEATURES.md](./ADVANCED_DATABASE_FEATURES.md). New table/index migration has not been applied in this session; see the evidence table there. | Team |
| MongoDB CRUD, indexes and aggregation | Partial | `GET`/`POST` CRUD and MySQL association are implemented in `app/api/inspections/route.ts`; historical local integration evidence is in [TESTING.md](./TESTING.md). No Mongo index-creation or aggregation pipeline is currently wired into the application; [MONGODB_DESIGN.md](./MONGODB_DESIGN.md) records that gap and safe manual examples. | Team |
| Registration and customer device submission | Verified (existing evidence) | Customer-only registration and session-owned device insertion are preserved in `app/api/auth/register/route.ts` and `app/api/items/route.ts`. Existing runtime/browser evidence is in [TESTING.md](./TESTING.md); these contracts were not replaced. | Team |
| Role-based API authorization | Partial | APIs use signed session roles and ownership filters. Customer, staff, and admin separation exists for current workflows; dedicated admin user/master-data management and security tests for every new route remain incomplete. | Team |
| Customer offers and pickup request | Partial | Added offer decisions and pickup creation/scheduling APIs and pages. Requires `MySQL/migrations/20261028_workflow_tables.sql`; the new routes have not been exercised against a migrated live database in this session. | Team |
| Inspection structured MySQL workflow | Partial | `POST /api/inspections/record` and the staff form create the structured row and status history in one MySQL transaction; Mongo report creation remains a separate explicit step. Runtime verification and enforced disposition transition rules remain. | Team |
| Supplier payout | Partial | Added an isolated supplier payout table/API and customer/staff view. Manual payout status flow is implemented in source, but needs migration application and runtime verification. Refurbished-product buyer payment remains separate. | Team |
| Recycling and refurbishment | Partial | Existing MySQL list/update routes are present. Quality-gated product availability, role-specific override auditing, and full transition tests remain to be implemented/verified. | Team |
| Responsive UI and accessibility | Partial | Shared tokens and responsive dashboard, form, table, focus and reduced-motion styling were added. Browser/device-size visual review is still required. | Team |
| Screenshots | Missing | No screenshots are committed or captured in this session. Capture representative responsive pages after configuring test services and add them under `docs/screenshots/`. | Team |
| Tests and end-to-end acceptance | Partial | Prior test evidence is in [TESTING.md](./TESTING.md). Lint, TypeScript, build and new workflow runtime tests must be reported separately for each run; this session's final commands are recorded there. | Team |
| Individual team contributions | Missing | Git history must be reviewed by the team and mapped to actual commits/files. No attribution is invented here; record both members' real application and database work before submission. | Team |
| Conclusion and future enhancements | Partial | Current limitations and likely follow-up work are listed in [README.md](../README.md) and this matrix. Add the team's final course report conclusion after live demonstration. | Team |

## Migration order

1. Make and verify a restorable backup of the existing database.
2. Confirm `MYSQL_DATABASE=smart_ewaste_db`; do not execute the full schema/seed
   script against this populated database.
3. Inspect the live `PICKUP_REQUEST.collector_id`, views, and existing indexes.
4. Apply `MySQL/migrations/20261028_workflow_tables.sql` once. The migration
   alters a nullable column, replaces only the pending-pickup view, creates
   indexes and adds workflow tables; it preserves existing rows.
5. Inspect the new schema and perform workflow tests only with disposable
   test accounts/devices. See [README.md](../README.md) for a Windows command.

Do not call the migration applied until the operator verifies successful
execution and confirms all created objects in MySQL.
