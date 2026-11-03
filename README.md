# Smart E-Waste Management System

A Next.js App Router application for customer device registration and
role-specific e-waste operations. MySQL is authoritative for structured device
and workflow data; MongoDB stores flexible inspection-report details.

## Problem, objectives and scope

Electronic devices contain valuable reusable components and materials, while
improper disposal creates avoidable environmental and safety risks. This
project models a traceable collection, inspection, refurbishment and recycling
workflow.

Objectives:

- Let customers register devices and track offers, pickups and outcomes.
- Give staff a database-backed operations view for submissions, collection,
  inspection and processing.
- Preserve relational ownership/integrity in MySQL and support variable
  inspection findings in MongoDB.
- Demonstrate DBMS concepts through schema constraints, SQL queries,
  transactions, views, triggers and indexes.

Current scope includes customer registration/device submission, device and
pickup lists, recycling/refurbishment status updates, MongoDB report CRUD,
offer decisions, pickup creation/assignment, structured MySQL inspection,
MongoDB inspection reports and manual supplier payouts. Admin user/master-data
management, return resolution and quality-gated product availability are not
complete.

## Architecture and database choices

- **Next.js App Router / TypeScript:** UI and server-side Route Handlers in one
  application.
- **MySQL (`smart_ewaste_db`):** normalized entities, foreign keys, structured
  workflow state and money fields.
- **MongoDB (`smart_ewaste_nosql.inspection_reports`):** flexible observations,
  findings, recommendations and attachment names, linked to MySQL inspection
  and item identifiers.
- **Authentication:** existing `bcryptjs` password hashing, signed `jose`
  session cookie and `lib/auth.ts` role helpers.

The SQL source schema and ER assets are under `MySQL`. Existing customer
registration and device submission are preserved; their API derives the
customer identity from the session.

## Requirements

- Node.js compatible with the installed Next.js version.
- A configured MySQL server and the existing schema.
- MongoDB if inspection reports are to be used.
- Apply the additive workflow migration before using offers, pickup creation/
  assignment, status history or payout features.

**Never execute `MySQL/Smart_EWaste_MySQL.sql` against a database that already
contains application data.** It creates the initial schema and contains sample
data and demonstrations. It is not a migration or a safe reset script.

## Configuration

Create or update `.env.local` using the variable names in `.env.example`:

```text
MYSQL_HOST
MYSQL_PORT
MYSQL_USER
MYSQL_PASSWORD
MYSQL_DATABASE
AUTH_SECRET
MONGODB_URI
MONGODB_DB
```

Set `MYSQL_DATABASE=smart_ewaste_db`, `MONGODB_DB=smart_ewaste_nosql` and a
long, unpredictable `AUTH_SECRET`. `.env.local` is ignored by Git. Never commit
or share credential values. The MongoDB URI is server-side only.

## Setup and run on Windows

```powershell
npm install
npm run dev
```

For an existing, backed-up database, inspect `MySQL/migrations/
20261028_workflow_tables.sql` and apply it once. From the repository root, a
Windows Command Prompt example is:

```cmd
mysql -h localhost -u your_mysql_user -p smart_ewaste_db < MySQL\migrations\20261028_workflow_tables.sql
```

This migration alters `PICKUP_REQUEST.collector_id` to permit an unassigned
collector, replaces the pending-pickup view with a `LEFT JOIN`, adds targeted
indexes and creates offer, payout and item-status-history tables. Back up
first; verify each statement and resulting object in MySQL. Do not claim it was
applied until that verification is complete. Migration order and evidence
requirements are in [docs/REQUIREMENTS_COMPLIANCE.md](./docs/REQUIREMENTS_COMPLIANCE.md).

Open `http://localhost:3000`. Public pages are `/`, `/register` and `/login`.
Authenticated pages include `/dashboard`, `/items`, `/offers`, `/pickups`,
`/inspections`, `/recycling`, `/refurbishment` and `/payouts`.

## Database documentation

- [ER diagram](./MySQL/ER_Diagram.drawio.png)
- [Relational schema diagram](./MySQL/Relational%20Schema.jpeg)
- [SQL schema, sample data and query demonstrations](./MySQL/Smart_EWaste_MySQL.sql)
- [Requirements compliance matrix](./docs/REQUIREMENTS_COMPLIANCE.md)
- [Advanced database features](./docs/ADVANCED_DATABASE_FEATURES.md)
- [MongoDB design and examples](./docs/MONGODB_DESIGN.md)
- [Live demonstration checklist](./docs/DEMO_CHECKLIST.md)
- [Testing evidence and limitations](./docs/TESTING.md)

The supplied ER/schema images predate the workflow migration. Update them after
the migration is applied and inspected. No screenshots or individual
contribution evidence are fabricated; add them only after collection/verification.

### Relational data dictionary

| Entity | Purpose |
|---|---|
| `USER` | Customer, staff and admin accounts; stores hashed password and role. |
| `CATEGORY`, `BRAND` | Device classification/reference data. |
| `COLLECTION_CENTER`, `COLLECTOR` | Collection sites and center-scoped collection staff. |
| `E_WASTE_ITEM` | Customer-owned device, condition, weight, current status and final disposition. |
| `PICKUP_REQUEST` | Customer collection request, schedule, center, optional collector and operational status. |
| `INSPECTION` | Structured assessment, recommendation, repair estimate and processing status in MySQL. |
| `RECYCLING` | Material recovery quantity, value, purity and recycling progress. |
| `REFURBISHED_PRODUCT` | Saleable-product sale status and buyer-payment details; separate from supplier payout. |
| `DEVICE_OFFER` | Preliminary/final supplier offer history, stage, amount, reason and customer decision (migration). |
| `SUPPLIER_PAYOUT` | Manual company-to-supplier settlement against one accepted final offer (migration). |
| `ITEM_STATUS_HISTORY` | Item status transition, actor, reason and timestamp (migration). |

MongoDB `inspection_reports` holds observations, component findings, technician
notes, repair recommendations and attachment names. See
[docs/MONGODB_DESIGN.md](./docs/MONGODB_DESIGN.md) for field and query detail.

### Testing results and conclusion

Current source checks and read-only MySQL/MongoDB connectivity evidence are in
[docs/TESTING.md](./docs/TESTING.md). The additive MySQL migration has not been
applied; offer, payout, pickup-creation and status-history writes must not be
presented as database-verified until it is safely applied and tested.

This project establishes an integrated foundation for traceable e-waste
collection and processing. Priority future work is authenticated end-to-end
workflow testing after migration, admin master-data/user management, final
offer return resolution, processing quality gates, MongoDB update/delete and
aggregation, and saved responsive screenshots. The existing SQL diagrams also
need updating to show the migrated tables and nullable collector relationship.

## Validation

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

See [docs/TESTING.md](./docs/TESTING.md) for the distinction between historical
runtime evidence and checks performed on the current changes.
