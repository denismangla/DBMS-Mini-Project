# Smart E-Waste Management System

Next.js application for customer device registration and staff workflows over
the existing MySQL schema, with inspection reports stored in MongoDB.

## Requirements

- Node.js compatible with the installed Next.js version
- The existing MySQL database described in `MySQL/Smart_EWaste_MySQL.sql`
- MongoDB database `smart_ewaste_nosql` and collection `inspection_reports`

Do not run the SQL schema or seed script against a database that already holds
data. The application uses the existing tables and collection.

## Configuration

Configure `.env.local` with the MySQL and authentication values from
`.env.example`. Add `MONGODB_URI` and `MONGODB_DB=smart_ewaste_nosql` to enable
inspection reports. `.env.local` is ignored by Git; do not commit credentials.
The MongoDB URI is used only by server-side code.

If `.env.local` already exists, add or update the required keys without
overwriting its existing values.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Customers can register at `/register`, log in at
`/login`, and manage their own devices at `/items`. The dashboard links to
pickup, recycling, refurbishment, and inspection-report views.

Staff and administrators can update recycling and refurbishment/processing
statuses. Inspection report creation is restricted to staff and administrators;
reports are associated with existing MySQL inspection and item IDs.

## Validation

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

See [docs/TESTING.md](./docs/TESTING.md) for runtime test coverage and remaining
database configuration requirements.
