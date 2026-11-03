# MongoDB inspection-report design

## Responsibility and collection

MySQL remains authoritative for users, items, pickup state, structured
inspections, offers, disposition, payout and lifecycle status. MongoDB stores
only variable-depth inspection-report content in
`smart_ewaste_nosql.inspection_reports`. It does not independently decide the
device's official lifecycle state.

The database name defaults to `smart_ewaste_nosql` and can be overridden with
`MONGODB_DB`. The server-only connection string is `MONGODB_URI`. The existing
application code is in `lib/mongodb.ts` and `app/api/inspections/route.ts`.

## Document shape

```javascript
{
  _id: ObjectId,
  inspectionId: Number, // MySQL INSPECTION.inspection_id
  itemId: Number,       // MySQL E_WASTE_ITEM.item_id
  technicianNotes: String,
  observations: [String],
  componentFindings: [
    { component: String, condition: String, notes: String }
  ],
  repairRecommendations: [String],
  attachments: [String], // names only; upload/storage is not implemented
  createdAt: Date,
  updatedAt: Date
}
```

`inspectionId` and `itemId` are checked against the paired MySQL
`INSPECTION` row on creation. Customer reads are limited to item IDs owned by
the authenticated user; staff/admin reads are system-wide. Existing component
findings use the `notes` property. MongoDB has no cross-database foreign-key or
transaction constraint: MySQL inspection records must exist first.

## Operations currently implemented

- **Create:** authenticated staff/admin first create the structured MySQL
  record through `POST /api/inspections/record`, then create detailed report
  content through `POST /api/inspections`, after input limits and MySQL
  inspection/item pairing are checked.
- **Read:** authenticated `GET /api/inspections`, with customer ownership
  filtering in MySQL before MongoDB query.
- **Update/Delete:** not implemented.
- **Indexes:** the current configured collection was read-only inspected and
  contained `_id_` and `inspectionId_1`. No index creation is currently issued
  by the app. Add an item/time index if report-history query volume warrants it.
- **Aggregation:** no application aggregation pipeline is currently issued.
- **Retrieval:** reports are sorted by `createdAt` descending and serialized
  for the browser; this is appropriate for the current modest demo dataset.

The current read-only connectivity probe confirmed database
`smart_ewaste_nosql`, collection `inspection_reports`, and the two index names
above. It did not read report documents or mutate data. Historical local
MongoDB read/create evidence is summarized in
[TESTING.md](./TESTING.md). It is not a claim that the current environment's
MongoDB service is reachable.

## Recommended indexes

After confirming the collection and duplicates, create these indexes
manually (do not duplicate an existing equivalent index):

```javascript
db.inspection_reports.createIndex(
  { inspectionId: 1 },
  { name: "inspection_id_lookup" }
);
db.inspection_reports.createIndex(
  { itemId: 1, createdAt: -1 },
  { name: "item_report_history" }
);
```

An application-level unique constraint on `inspectionId` should only be
introduced if the business confirms exactly one detailed report per MySQL
inspection. The current API allows multiple report documents, so it does not
assume uniqueness.

## CRUD and aggregation examples

Run read-only examples in a test database:

```javascript
db.inspection_reports.find(
  { itemId: 123 },
  { technicianNotes: 1, observations: 1, createdAt: 1 }
).sort({ createdAt: -1 });

db.inspection_reports.aggregate([
  { $group: { _id: "$itemId", reportCount: { $sum: 1 } } },
  { $sort: { reportCount: -1, _id: 1 } }
]);
```

Use the application POST/GET for CRUD verification rather than hand-editing
production reports. MongoDB writes cannot be atomically committed with MySQL:
The current UI keeps the MySQL structured inspection and MongoDB detailed
report as separate submissions, so a failed report write does not undo the
already committed MySQL inspection. Staff can retry the report against the
existing inspection identity. No cross-database atomicity is claimed.
