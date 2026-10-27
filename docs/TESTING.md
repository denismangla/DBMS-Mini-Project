# Testing

## Checks run

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

All three checks passed for this implementation.

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
  files or implement payment processing.
