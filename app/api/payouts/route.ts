import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
type PayoutStatus = "Pending" | "Processing" | "Paid" | "Failed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveId(value: unknown) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function authFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHENTICATED") {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401, headers: noStore }
    );
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Staff or administrator access is required." },
      { status: 403, headers: noStore }
    );
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireRole(["CUSTOMER", "STAFF", "ADMIN"]);
    const customer = user.role === "CUSTOMER";
    const [rows] = await pool.query(
      `SELECT p.payout_id, p.offer_id, o.item_id, e.item_name,
              e.description, e.\`condition\`, c.category_name, b.brand_name,
              e.user_id, u.full_name AS customer_name,
              o.amount AS accepted_offer_amount, o.reason AS offer_reason,
              o.disposition AS offer_disposition,
              p.amount, p.currency, p.payment_method, p.payout_status,
              p.transaction_reference, p.failure_reason, p.created_at,
              p.updated_at, p.processing_at, p.paid_at
       FROM SUPPLIER_PAYOUT p
       JOIN DEVICE_OFFER o ON o.offer_id = p.offer_id
       JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
       JOIN CATEGORY c ON c.category_id = e.category_id
       LEFT JOIN BRAND b ON b.brand_id = e.brand_id
       JOIN \`USER\` u ON u.user_id = e.user_id
       ${customer ? "WHERE e.user_id = ?" : ""}
       ORDER BY p.created_at DESC, p.payout_id DESC`,
      customer ? [user.userId] : []
    );
    const payouts = rows as Array<Record<string, unknown> & {
      payout_id: number;
      payout_status: "Pending" | "Processing" | "Paid" | "Failed";
      amount: string | number;
      currency: string;
    }>;
    const historyByPayout = new Map<number, Array<Record<string, unknown>>>();
    if (payouts.length > 0) {
      const placeholders = payouts.map(() => "?").join(", ");
      const [historyRows] = await pool.query(
        `SELECT payout_id, previous_status, next_status, transaction_reference,
                failure_reason, changed_at
         FROM SUPPLIER_PAYOUT_HISTORY
         WHERE payout_id IN (${placeholders})
         ORDER BY changed_at DESC, payout_history_id DESC`,
        payouts.map((payout) => payout.payout_id)
      );
      for (const entry of historyRows as Array<Record<string, unknown> & { payout_id: number }>) {
        const history = historyByPayout.get(entry.payout_id) ?? [];
        history.push(entry);
        historyByPayout.set(entry.payout_id, history);
      }
    }

    const [summaryRows] = await pool.query(
      `SELECT p.payout_status, p.currency, COUNT(*) AS payout_count,
              SUM(p.amount) AS payout_total
       FROM SUPPLIER_PAYOUT p
       JOIN DEVICE_OFFER o ON o.offer_id = p.offer_id
       JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
       ${customer ? "WHERE e.user_id = ?" : ""}
       GROUP BY p.payout_status, p.currency`,
      customer ? [user.userId] : []
    );
    const aggregates = summaryRows as Array<{
      payout_status: PayoutStatus;
      currency: string;
      payout_count: number | string;
      payout_total: number | string;
    }>;
    const summary = Object.fromEntries(
      (["Pending", "Processing", "Paid", "Failed"] as const).map((status) => {
        const matching = aggregates.filter((entry) => entry.payout_status === status);
        return [
          status,
          {
            count: matching.reduce((total, entry) => total + Number(entry.payout_count), 0),
            totals: matching.map((entry) => ({
              currency: entry.currency,
              amount: entry.payout_total,
            })),
          },
        ];
      })
    );

    let eligibleOffers: Array<Record<string, unknown>> = [];
    if (!customer) {
      const [eligibleRows] = await pool.query(
        `SELECT o.offer_id, o.item_id, e.item_name, u.full_name AS customer_name,
                o.amount, o.currency
         FROM DEVICE_OFFER o
         JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
         JOIN \`USER\` u ON u.user_id = e.user_id
         WHERE o.offer_stage = 'Final'
           AND o.offer_status = 'Accepted'
           AND e.item_status = 'Final Offer Accepted'
           AND e.final_disposition = o.disposition
           AND NOT EXISTS (
             SELECT 1 FROM SUPPLIER_PAYOUT p WHERE p.offer_id = o.offer_id
           )
         ORDER BY o.decided_at DESC, o.offer_id DESC`
      );
      eligibleOffers = eligibleRows as Array<Record<string, unknown>>;
    }

    return NextResponse.json(
      {
        success: true,
        payouts: payouts.map((payout) => ({
          ...payout,
          history: historyByPayout.get(payout.payout_id) ?? [],
        })),
        eligibleOffers,
        summary,
        userRole: user.role,
      },
      { headers: noStore }
    );
  } catch (error) {
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to load supplier payouts.", error);
    return NextResponse.json(
      { success: false, message: "Unable to load payouts. Confirm the workflow migration has been applied." },
      { status: 500, headers: noStore }
    );
  }
}

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  let transactionStarted = false;
  try {
    const user = await requireRole(["STAFF", "ADMIN"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "A valid JSON request body is required." },
        { status: 400, headers: noStore }
      );
    }
    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, message: "A valid payout request is required." },
        { status: 400, headers: noStore }
      );
    }
    const offerId = positiveId(body.offerId);
    const paymentMethod =
      typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
    if (!offerId || paymentMethod.length > 50) {
      return NextResponse.json(
        { success: false, message: "Select a valid offer and payment method." },
        { status: 400, headers: noStore }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [offers] = await connection.query(
      `SELECT o.offer_id, o.amount, o.currency, o.offer_stage, o.offer_status,
              o.disposition, e.item_status, e.final_disposition
       FROM DEVICE_OFFER o
       JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
       WHERE o.offer_id = ?
       FOR UPDATE`,
      [offerId]
    );
    const offer = (offers as Array<{
      offer_id: number;
      amount: string | number;
      currency: string;
      offer_stage: string;
      offer_status: string;
      disposition: string | null;
      item_status: string | null;
      final_disposition: string | null;
    }>)[0];
    if (
      !offer ||
      offer.offer_stage !== "Final" ||
      offer.offer_status !== "Accepted" ||
      offer.item_status !== "Final Offer Accepted" ||
      offer.final_disposition !== offer.disposition
    ) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Payouts can only be recorded against a customer-accepted final offer." },
        { status: 409, headers: noStore }
      );
    }
    const [existing] = await connection.query(
      "SELECT payout_id FROM SUPPLIER_PAYOUT WHERE offer_id = ? LIMIT 1",
      [offerId]
    );
    if ((existing as Array<{ payout_id: number }>).length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "A payout record already exists for this accepted offer." },
        { status: 409, headers: noStore }
      );
    }
    const [result] = await connection.query(
      `INSERT INTO SUPPLIER_PAYOUT
        (offer_id, amount, currency, payment_method, created_by_user_id,
         updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [offerId, offer.amount, offer.currency, paymentMethod || null, user.userId, user.userId]
    );
    const payoutId = (result as { insertId: number }).insertId;
    await connection.query(
      `INSERT INTO SUPPLIER_PAYOUT_HISTORY
        (payout_id, previous_status, next_status, changed_by_user_id)
       VALUES (?, NULL, 'Pending', ?)`,
      [payoutId, user.userId]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      {
        success: true,
        message: "Supplier payout recorded as pending manual payment.",
        payoutId,
      },
      { status: 201, headers: noStore }
    );
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back payout creation.", rollbackError);
      }
    }
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to create supplier payout.", error);
    return NextResponse.json(
      { success: false, message: "Unable to record the payout." },
      { status: 500, headers: noStore }
    );
  } finally {
    connection?.release();
  }
}

export async function PATCH(request: Request) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  let transactionStarted = false;
  try {
    const user = await requireRole(["STAFF", "ADMIN"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "A valid JSON request body is required." },
        { status: 400, headers: noStore }
      );
    }
    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, message: "A valid payout update is required." },
        { status: 400, headers: noStore }
      );
    }
    const payoutId = positiveId(body.payoutId);
    const status = body.status;
    const reference =
      typeof body.transactionReference === "string"
        ? body.transactionReference.trim()
        : "";
    const failureReason =
      typeof body.failureReason === "string" ? body.failureReason.trim() : "";
    if (
      !payoutId ||
      (status !== "Processing" && status !== "Paid" && status !== "Failed") ||
      reference.length > 150 ||
      failureReason.length > 1000 ||
      (status === "Paid" && !reference) ||
      (status === "Failed" && !failureReason)
    ) {
      return NextResponse.json(
        { success: false, message: "Provide a transaction reference when recording payment completion and a failure reason when marking a payout failed." },
        { status: 400, headers: noStore }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      "SELECT payout_id, payout_status FROM SUPPLIER_PAYOUT WHERE payout_id = ? FOR UPDATE",
      [payoutId]
    );
    const payout = (rows as Array<{ payout_id: number; payout_status: string }>)[0];
    if (!payout) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Payout record not found." },
        { status: 404, headers: noStore }
      );
    }
    const allowedTransition =
      status === "Processing"
        ? payout.payout_status === "Pending" || payout.payout_status === "Failed"
        : payout.payout_status === "Processing";
    if (!allowedTransition) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "The payout cannot make that status transition." },
        { status: 409, headers: noStore }
      );
    }
    await connection.query(
      `UPDATE SUPPLIER_PAYOUT
       SET payout_status = ?,
           transaction_reference = CASE
             WHEN ? = 'Processing' THEN NULL
             ELSE ?
           END,
           failure_reason = CASE
             WHEN ? = 'Failed' THEN ?
             ELSE NULL
           END,
           processing_at = CASE
             WHEN ? = 'Processing' THEN CURRENT_TIMESTAMP
             ELSE processing_at
           END,
           paid_at = CASE
             WHEN ? = 'Paid' THEN CURRENT_TIMESTAMP
             ELSE NULL
           END,
           updated_by_user_id = ?
       WHERE payout_id = ?`,
      [
        status,
        status,
        reference || null,
        status,
        failureReason || null,
        status,
        status,
        user.userId,
        payoutId,
      ]
    );
    await connection.query(
      `INSERT INTO SUPPLIER_PAYOUT_HISTORY
        (payout_id, previous_status, next_status, transaction_reference,
         failure_reason, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payoutId,
        payout.payout_status,
        status,
        status === "Processing" ? null : reference || null,
        status === "Failed" ? failureReason : null,
        user.userId,
      ]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      {
        success: true,
        message: status === "Paid"
          ? "Completed payment recorded with its transaction reference."
          : `Payout moved to ${status.toLowerCase()}.`,
        status,
      },
      { headers: noStore }
    );
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back payout update.", rollbackError);
      }
    }
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to update supplier payout.", error);
    return NextResponse.json(
      { success: false, message: "Unable to update the payout." },
      { status: 500, headers: noStore }
    );
  } finally {
    connection?.release();
  }
}
