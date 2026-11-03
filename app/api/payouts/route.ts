import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

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
              p.amount, p.currency, p.payment_method, p.payout_status,
              p.transaction_reference, p.created_at, p.paid_at
       FROM SUPPLIER_PAYOUT p
       JOIN DEVICE_OFFER o ON o.offer_id = p.offer_id
       JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
       ${customer ? "WHERE e.user_id = ?" : ""}
       ORDER BY p.created_at DESC, p.payout_id DESC`,
      customer ? [user.userId] : []
    );
    return NextResponse.json(
      { success: true, payouts: rows, userRole: user.role },
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
      `SELECT offer_id, amount, currency, offer_stage, offer_status
       FROM DEVICE_OFFER WHERE offer_id = ? FOR UPDATE`,
      [offerId]
    );
    const offer = (offers as Array<{
      offer_id: number;
      amount: string | number;
      currency: string;
      offer_stage: string;
      offer_status: string;
    }>)[0];
    if (!offer || offer.offer_stage !== "Final" || offer.offer_status !== "Accepted") {
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
        (offer_id, amount, currency, payment_method, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [offerId, offer.amount, offer.currency, paymentMethod || null, user.userId]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      {
        success: true,
        message: "Supplier payout recorded as pending manual payment.",
        payoutId: (result as { insertId: number }).insertId,
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
    await requireRole(["STAFF", "ADMIN"]);
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
    if (
      !payoutId ||
      (status !== "Paid" && status !== "Failed") ||
      reference.length > 150
    ) {
      return NextResponse.json(
        { success: false, message: "Provide a valid payout and final status." },
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
    if (payout.payout_status !== "Pending") {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Only pending payouts can be finalized." },
        { status: 409, headers: noStore }
      );
    }
    await connection.query(
      `UPDATE SUPPLIER_PAYOUT
       SET payout_status = ?, transaction_reference = ?,
           paid_at = CASE WHEN ? = 'Paid' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE payout_id = ?`,
      [status, reference || null, status, payoutId]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      { success: true, message: `Payout marked ${status.toLowerCase()}.` },
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
