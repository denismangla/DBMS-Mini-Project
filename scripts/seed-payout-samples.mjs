import mysql from "mysql2/promise";
import { SignJWT } from "jose";

const confirmationFlag = "--confirm-development-data";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const sampleRows = [
  {
    itemName: "DEV SAMPLE PAYOUT - Android phone",
    categoryName: "Mobile Phones",
    condition: "Used - Good",
    manufactureYear: 2021,
    estimatedWeight: 0.25,
    preliminaryAmount: 950,
    finalAmount: 1200,
    payoutStatus: "Pending",
  },
  {
    itemName: "DEV SAMPLE PAYOUT - Laptop",
    categoryName: "Laptops",
    condition: "Used - Fair",
    manufactureYear: 2020,
    estimatedWeight: 2.1,
    preliminaryAmount: 4200,
    finalAmount: 5000,
    payoutStatus: "Processing",
  },
  {
    itemName: "DEV SAMPLE PAYOUT - Battery pack",
    categoryName: "Batteries",
    condition: "Used - Fair",
    manufactureYear: 2022,
    estimatedWeight: 1.4,
    preliminaryAmount: 1600,
    finalAmount: 2100,
    payoutStatus: "Paid",
  },
];

function requireDevelopmentConfirmation() {
  if (!process.argv.includes(confirmationFlag)) {
    throw new Error(
      `Refusing to seed data. Re-run with ${confirmationFlag} after confirming this is a development database.`
    );
  }
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing to seed unless NODE_ENV=development is explicitly set.");
  }

  const mysqlHost = process.env.MYSQL_HOST?.toLowerCase();
  if (!mysqlHost || !localHosts.has(mysqlHost)) {
    throw new Error("Refusing to seed: MYSQL_HOST must be a local loopback host.");
  }
  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required to exercise the existing API workflows.");
  }

  const baseUrl = new URL(
    process.env.PAYOUT_SEED_BASE_URL || "http://localhost:3000"
  );
  if (
    baseUrl.protocol !== "http:" ||
    !localHosts.has(baseUrl.hostname.toLowerCase())
  ) {
    throw new Error("PAYOUT_SEED_BASE_URL must point to a local HTTP server.");
  }
  return baseUrl.toString().replace(/\/$/, "");
}

async function createSessionToken(userId, role) {
  return new SignJWT({
    userId: Number(userId),
    email: `development-seed-${userId}@example.invalid`,
    role,
    name: "Development sample-data seed",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
}

async function apiRequest(baseUrl, token, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      Cookie: `ewaste_session=${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${options.method || "GET"} ${route} returned invalid JSON (${response.status}).`);
  }
  if (!response.ok || payload.success === false) {
    throw new Error(
      `${options.method || "GET"} ${route} failed (${response.status}): ${payload.message || "Unknown API error"}`
    );
  }
  return payload;
}

async function postJson(baseUrl, token, route, body) {
  return apiRequest(baseUrl, token, route, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function patchJson(baseUrl, token, route, body) {
  return apiRequest(baseUrl, token, route, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function getItem(connection, itemId) {
  const [rows] = await connection.execute(
    `SELECT item_id, user_id, item_status, pickup_id, final_disposition
     FROM E_WASTE_ITEM WHERE item_id = ?`,
    [itemId]
  );
  if (rows.length !== 1) {
    throw new Error(`Sample item ${itemId} was not found after its workflow update.`);
  }
  return rows[0];
}

async function findSampleItem(connection, customerId, itemName) {
  const [rows] = await connection.execute(
    `SELECT item_id, user_id, item_status, pickup_id, final_disposition
     FROM E_WASTE_ITEM WHERE user_id = ? AND item_name = ?
     ORDER BY item_id LIMIT 1`,
    [customerId, itemName]
  );
  return rows[0] || null;
}

async function findOffer(connection, itemId, stage, marker) {
  const [rows] = await connection.execute(
    `SELECT offer_id, offer_status
     FROM DEVICE_OFFER
     WHERE item_id = ? AND offer_stage = ? AND reason LIKE ?
     ORDER BY offer_id DESC LIMIT 1`,
    [itemId, stage, `${marker}:%`]
  );
  return rows[0] || null;
}

async function ensureOffer({
  connection,
  baseUrl,
  staffToken,
  customerToken,
  item,
  stage,
  marker,
  amount,
  disposition,
}) {
  let offer = await findOffer(connection, item.item_id, stage, marker);
  if (!offer || offer.offer_status === "Declined") {
    const body = {
      itemId: Number(item.item_id),
      stage,
      amount,
      currency: "INR",
      reason: `${marker}: ${stage} development sample only; no real payment is implied.`,
      valuationNotes:
        "Seeded for development display and workflow testing. Not a real valuation or payment.",
    };
    if (stage === "Final") body.disposition = disposition;
    const created = await postJson(baseUrl, staffToken, "/api/offers", body);
    offer = { offer_id: created.offerId, offer_status: "Pending" };
  }

  if (offer.offer_status === "Pending") {
    await patchJson(baseUrl, customerToken, "/api/offers", {
      offerId: Number(offer.offer_id),
      decision: "Accepted",
    });
    offer.offer_status = "Accepted";
  }
  if (offer.offer_status !== "Accepted") {
    throw new Error(
      `The ${stage.toLowerCase()} sample offer ${offer.offer_id} is not accepted.`
    );
  }
  return Number(offer.offer_id);
}

async function ensureCollected({
  connection,
  baseUrl,
  staffToken,
  customerToken,
  item,
  centerId,
  collectorId,
  marker,
}) {
  let current = await getItem(connection, item.item_id);
  if (current.item_status === "Offer Accepted") {
    const result = await postJson(baseUrl, customerToken, "/api/pickups", {
      itemId: Number(item.item_id),
      centerId,
      pickupAddress: `${marker} - development workflow only; no physical pickup`,
    });
    current = await getItem(connection, item.item_id);
    if (Number(current.pickup_id) !== Number(result.pickupId)) {
      throw new Error(`Pickup request was not linked to sample item ${item.item_id}.`);
    }
  }

  if (current.item_status === "Pickup Requested") {
    const [rows] = await connection.execute(
      `SELECT pickup_id,
              DATE_FORMAT(requested_date, '%Y-%m-%d') AS requested_date,
              scheduled_date, pickup_status,
              collector_id, center_id
       FROM PICKUP_REQUEST WHERE pickup_id = ?`,
      [current.pickup_id]
    );
    const pickup = rows[0];
    if (!pickup) throw new Error(`Pickup for sample item ${item.item_id} was not found.`);
    if (pickup.pickup_status === "Pending") {
      await patchJson(
        baseUrl,
        staffToken,
        `/api/pickups/${pickup.pickup_id}`,
        {
          scheduledDate: String(pickup.requested_date).slice(0, 10),
          collectorId,
        }
      );
    } else if (
      pickup.pickup_status !== "Scheduled" ||
      !pickup.scheduled_date ||
      !pickup.collector_id
    ) {
      throw new Error(
        `Sample pickup ${pickup.pickup_id} is in unsupported state ${pickup.pickup_status}.`
      );
    }
    await patchJson(
      baseUrl,
      staffToken,
      `/api/pickups/${pickup.pickup_id}`,
      { status: "Completed" }
    );
    current = await getItem(connection, item.item_id);
  }

  if (!["Collected", "Inspected", "Final Offer Accepted"].includes(current.item_status)) {
    throw new Error(
      `Sample item ${item.item_id} cannot proceed from ${current.item_status}.`
    );
  }
  if (current.item_status === "Collected") {
    const [inspections] = await connection.execute(
      "SELECT inspection_id FROM INSPECTION WHERE item_id = ? LIMIT 1",
      [item.item_id]
    );
    if (inspections.length > 0) {
      throw new Error(
        `Sample item ${item.item_id} already has an inspection but remains Collected; refusing to bypass the inspection workflow.`
      );
    }
    await postJson(baseUrl, staffToken, "/api/inspections/record", {
      itemId: Number(item.item_id),
      conditionAssessment:
        `${marker}: development-only sample inspection. No physical inspection was performed.`,
      damageLevel: "Moderate",
      inspectionResult: "Recycling recommended",
      processingType: "Recycling",
      estimatedRepairCost: 0,
    });
    current = await getItem(connection, item.item_id);
  }
  if (!["Inspected", "Final Offer Accepted"].includes(current.item_status)) {
    throw new Error(`Sample item ${item.item_id} did not reach the Inspected state.`);
  }
  return current;
}

async function ensurePayout({
  connection,
  baseUrl,
  staffToken,
  offerId,
  desiredStatus,
}) {
  let [rows] = await connection.execute(
    `SELECT payout_id, payout_status, transaction_reference
     FROM SUPPLIER_PAYOUT WHERE offer_id = ? LIMIT 1`,
    [offerId]
  );
  let payout = rows[0];
  if (!payout) {
    const created = await postJson(baseUrl, staffToken, "/api/payouts", {
      offerId,
      paymentMethod: "Bank transfer (sample)",
    });
    [rows] = await connection.execute(
      `SELECT payout_id, payout_status, transaction_reference
       FROM SUPPLIER_PAYOUT WHERE payout_id = ?`,
      [created.payoutId]
    );
    payout = rows[0];
  }
  if (!payout) throw new Error(`Payout for offer ${offerId} was not recorded.`);

  if (desiredStatus === "Processing" && payout.payout_status === "Pending") {
    await patchJson(baseUrl, staffToken, "/api/payouts", {
      payoutId: Number(payout.payout_id),
      status: "Processing",
    });
  } else if (
    desiredStatus === "Paid" &&
    payout.payout_status !== "Paid"
  ) {
    if (payout.payout_status !== "Processing") {
      await patchJson(baseUrl, staffToken, "/api/payouts", {
        payoutId: Number(payout.payout_id),
        status: "Processing",
      });
    }
    await patchJson(baseUrl, staffToken, "/api/payouts", {
      payoutId: Number(payout.payout_id),
      status: "Paid",
      transactionReference: `DEV-SAMPLE-NO-TRANSFER-OFFER-${offerId}`,
    });
  }

  [rows] = await connection.execute(
    `SELECT p.payout_id, p.offer_id, p.amount, p.currency, p.payment_method,
            p.payout_status, p.transaction_reference, e.user_id, e.item_status,
            e.final_disposition, e.item_name, u.full_name AS customer_name,
            o.amount AS accepted_offer_amount, o.offer_stage, o.offer_status,
            o.disposition
     FROM SUPPLIER_PAYOUT p
     JOIN DEVICE_OFFER o ON o.offer_id = p.offer_id
     JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
     JOIN \`USER\` u ON u.user_id = e.user_id
     WHERE p.offer_id = ?`,
    [offerId]
  );
  const savedPayout = rows[0];
  if (
    !savedPayout ||
    savedPayout.offer_stage !== "Final" ||
    savedPayout.offer_status !== "Accepted" ||
    savedPayout.item_status !== "Final Offer Accepted" ||
    savedPayout.final_disposition !== savedPayout.disposition ||
    Number(savedPayout.amount) !== Number(savedPayout.accepted_offer_amount)
  ) {
    throw new Error(`Payout for accepted final offer ${offerId} failed relational validation.`);
  }
  if (
    savedPayout.payout_status === "Paid" &&
    !String(savedPayout.transaction_reference).startsWith("DEV-SAMPLE-NO-TRANSFER-")
  ) {
    throw new Error(`Paid sample payout ${savedPayout.payout_id} lacks its no-transfer reference.`);
  }
  return savedPayout;
}

async function main() {
  const baseUrl = requireDevelopmentConfirmation();
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const [customerRows] = await connection.execute(
      `SELECT user_id FROM \`USER\`
       WHERE user_role = 'CUSTOMER' ORDER BY user_id LIMIT 3`
    );
    const [staffRows] = await connection.execute(
      `SELECT user_id, user_role FROM \`USER\`
       WHERE user_role IN ('STAFF', 'ADMIN')
       ORDER BY CASE user_role WHEN 'STAFF' THEN 0 ELSE 1 END, user_id LIMIT 1`
    );
    const [categoryRows] = await connection.execute(
      "SELECT category_id, category_name FROM CATEGORY"
    );
    const [centerRows] = await connection.execute(
      "SELECT center_id FROM COLLECTION_CENTER ORDER BY center_id LIMIT 1"
    );
    if (customerRows.length < sampleRows.length || staffRows.length === 0) {
      throw new Error("Three existing customers and one existing staff/admin account are required.");
    }
    const centerId = Number(centerRows[0]?.center_id);
    if (!centerId) throw new Error("No collection center is available for the test workflow.");
    const [collectorRows] = await connection.execute(
      "SELECT collector_id FROM COLLECTOR WHERE center_id = ? ORDER BY collector_id LIMIT 1",
      [centerId]
    );
    const collectorId = Number(collectorRows[0]?.collector_id);
    if (!collectorId) throw new Error("The selected collection center has no assigned collector.");

    const staff = staffRows[0];
    const staffToken = await createSessionToken(staff.user_id, staff.user_role);
    const staffPreflight = await apiRequest(
      baseUrl,
      staffToken,
      "/api/payouts"
    );
    if (!Array.isArray(staffPreflight.payouts)) {
      throw new Error("Staff payout API returned an unexpected response shape.");
    }

    const categoryByName = new Map(
      categoryRows.map((row) => [row.category_name, Number(row.category_id)])
    );
    const workflows = [];

    for (let index = 0; index < sampleRows.length; index += 1) {
      const sample = sampleRows[index];
      const customer = customerRows[index];
      const customerId = Number(customer.user_id);
      const marker = `DEV-PAYOUT-SEED-CUSTOMER-${customerId}-SAMPLE-${index + 1}`;
      const customerToken = await createSessionToken(customerId, "CUSTOMER");

      const customerPreflight = await apiRequest(
        baseUrl,
        customerToken,
        "/api/payouts"
      );
      if (!Array.isArray(customerPreflight.payouts)) {
        throw new Error(`Customer ${customerId} payout API returned an unexpected response shape.`);
      }

      let item = await findSampleItem(connection, customerId, sample.itemName);
      if (!item) {
        const categoryId = categoryByName.get(sample.categoryName);
        if (!categoryId) {
          throw new Error(`Required existing category "${sample.categoryName}" was not found.`);
        }
        const created = await postJson(baseUrl, customerToken, "/api/items", {
          itemName: sample.itemName,
          description:
            `${marker}: development-only sample record; no physical collection or inspection occurred.`,
          condition: sample.condition,
          categoryId,
          manufactureYear: sample.manufactureYear,
          estimatedWeight: sample.estimatedWeight,
          quantity: 1,
        });
        item = await findSampleItem(connection, customerId, sample.itemName);
        if (!item || Number(item.item_id) !== Number(created.itemId)) {
          throw new Error(`Sample item for existing customer ${customerId} was not created.`);
        }
      }

      const preliminaryOfferId = await ensureOffer({
        connection,
        baseUrl,
        staffToken,
        customerToken,
        item,
        stage: "Preliminary",
        marker,
        amount: sample.preliminaryAmount,
      });
      await ensureCollected({
        connection,
        baseUrl,
        staffToken,
        customerToken,
        item,
        centerId,
        collectorId,
        marker,
      });
      const finalOfferId = await ensureOffer({
        connection,
        baseUrl,
        staffToken,
        customerToken,
        item,
        stage: "Final",
        marker,
        amount: sample.finalAmount,
        disposition: "Recycling",
      });
      const payout = await ensurePayout({
        connection,
        baseUrl,
        staffToken,
        offerId: finalOfferId,
        desiredStatus: sample.payoutStatus,
      });
      workflows.push({
        customerId,
        itemId: Number(item.item_id),
        itemName: payout.item_name,
        preliminaryOfferId,
        finalOfferId,
        payoutId: Number(payout.payout_id),
        amount: Number(payout.amount),
        status: payout.payout_status,
        customerName: payout.customer_name,
      });
    }

    const staffView = await apiRequest(baseUrl, staffToken, "/api/payouts");
    const samplePayoutIds = new Set(workflows.map((row) => row.payoutId));
    for (const workflow of workflows) {
      const visible = staffView.payouts.find(
        (row) => Number(row.payout_id) === workflow.payoutId
      );
      if (
        !visible ||
        Number(visible.user_id) !== workflow.customerId ||
        visible.item_name !== workflow.itemName ||
        visible.payout_status !== workflow.status ||
        Number(visible.amount) !== workflow.amount ||
        Number(visible.accepted_offer_amount) !== workflow.amount ||
        visible.customer_name !== workflow.customerName
      ) {
        throw new Error(`Staff payout view did not return sample payout ${workflow.payoutId} correctly.`);
      }

      const customerToken = await createSessionToken(workflow.customerId, "CUSTOMER");
      const customerView = await apiRequest(baseUrl, customerToken, "/api/payouts");
      const customerPayout = customerView.payouts.find(
        (row) => Number(row.payout_id) === workflow.payoutId
      );
      if (
        !customerPayout ||
        customerPayout.item_name !== workflow.itemName ||
        Number(customerPayout.amount) !== workflow.amount ||
        customerPayout.payout_status !== workflow.status
      ) {
        throw new Error(`Customer ${workflow.customerId} cannot see their sample payout ${workflow.payoutId}.`);
      }
      if (
        customerView.payouts.some(
          (row) =>
            samplePayoutIds.has(Number(row.payout_id)) &&
            Number(row.user_id) !== workflow.customerId
        )
      ) {
        throw new Error(`Customer ${workflow.customerId} can see another customer's sample payout.`);
      }
    }

    console.log(
      JSON.stringify(
        {
          result: "verified",
          sampleItems: workflows.length,
          totalOffers: workflows.length * 2,
          preliminaryOffers: workflows.length,
          finalOffers: workflows.length,
          acceptedFinalOffers: workflows.length,
          payouts: workflows.length,
          staffVisiblePayouts: workflows.filter((row) =>
            staffView.payouts.some(
              (entry) => Number(entry.payout_id) === row.payoutId
            )
          ).length,
          workflows,
          sampleDataNotice:
            "All item, pickup, inspection, offer, and payout records are development samples. The Paid example has a DEV-SAMPLE-NO-TRANSFER reference; no funds were transferred.",
        },
        null,
        2
      )
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Payout sample seed failed: ${error.message}`);
  process.exitCode = 1;
});
