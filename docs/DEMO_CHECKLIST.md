# Demonstration checklist

Use a configured test environment only. Do not use real customer records,
commit credentials, run the base schema/seed file against populated data, or
claim a check passed if it was not run.

## Before the demonstration

- [ ] Confirm app build and lint outcomes in `docs/TESTING.md`.
- [ ] Configure `.env.local` from `.env.example` with test MySQL, MongoDB and
  an unpredictable `AUTH_SECRET`; never project or share secret values.
- [ ] Confirm `MYSQL_DATABASE` selects the intended database.
- [ ] Back up the database and apply the additive workflow migration only after
  reviewing its DDL and existing indexes.
- [ ] Verify `DEVICE_OFFER`, `SUPPLIER_PAYOUT`, `ITEM_STATUS_HISTORY`, nullable
  `PICKUP_REQUEST.collector_id`, and the left-joined `v_pending_pickups`.
- [ ] Verify the MongoDB database/collection and inspect report documents
  without exposing credentials or customer data.
- [ ] Prepare role accounts and non-sensitive demo records; document who
  created them and clean them up in the test database after the demo.

## Presentation

1. **Problem and objectives:** explain electronic waste collection,
   refurbishment, responsible recycling, and ownership/history traceability.
2. **ER diagram and relational schema:** show
   `MySQL/ER_Diagram.drawio.png` and relational schema. Explain keys,
   relationships, checks, the optional collector, offers, payouts and status
   history. Update the diagram after migration.
3. **SQL implementation:** show CREATE/ALTER, safe isolated DROP example,
   INSERT/UPDATE/DELETE/SELECT, joins, aggregates, grouping/HAVING, ordering,
   subquery and the views. Run only on a disposable dataset.
4. **Next.js application:** demonstrate public registration/login, customer
   device submission and customer-scoped device view. Verify the device API
   assigns ownership from the signed session.
5. **Customer offer and collection:** staff creates an estimate, customer
   accepts it, and customer requests collection. Staff sets the schedule,
   assigns a center collector and records receipt. Verify unassigned pickups
   remain in the pickup queue before assignment.
6. **Inspection integration:** show MySQL inspection identity and the detailed
   MongoDB report associated with the same IDs. Explain the lack of a
   cross-database atomic transaction and show failure/retry behavior only if
   it is actually configured and tested.
7. **Final offer and payout:** show disposition recommendation and explicit
   customer decision. Record a manual supplier payout. Explain that this
   payout is separate from buyer payment for a refurbished product. A declined
   final offer must be described as awaiting return resolution.
8. **Processing:** demonstrate recycling and refurbishment paths separately.
   Do not claim quality-gated sale availability until that validation exists.
9. **Advanced DB concepts:** show transaction rollback, views, trigger behavior
   and `SHOW INDEX`; use the disposable database and actual result output.
10. **Roles and responsive UI:** show customer-owned records versus staff
    work queues and admin visibility; test keyboard focus and desktop/tablet/
    mobile layouts. Admin-only management is incomplete and must be disclosed.
11. **Testing and limitations:** distinguish earlier runtime evidence from
    tests run on the demonstration database; show the current compliance
    matrix and remaining gaps.
12. **Individual contributions:** each member describes only work evidenced by
    their own Git commits, including both database and application tasks.

## Evidence to collect

- [ ] Redacted screenshots of login/registration, customer dashboard and
  device list/form, offers, pickups, staff dashboard/queues, inspection,
  recycling/refurbishment and payout on desktop and a mobile viewport.
- [ ] Redacted SQL output for `SHOW CREATE TABLE`, the workflow view, required
  joins/aggregates, transaction rollback, trigger result and `SHOW INDEX`.
- [ ] Redacted MySQL/Mongo records proving matching inspection identifiers.
- [ ] Test log with date, environment (local/test), exact command/flow,
  expected result, actual result and cleanup performed.
- [ ] Git contribution summary derived from repository history; no invented
  authorship or work.
