import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const managementRoles: ("STAFF" | "ADMIN")[] = ["STAFF", "ADMIN"];

type OfferBody = {
  itemId?: unknown;
  stage?: unknown;
  amount?: unknown;
  currency?: unknown;
  reason?: unknown;
  valuationNotes?: unknown;
  disposition?: unknown;
  offerId?: unknown;
  decision?: unknown;
};

type PendingValuation = {
  item_id: number;
  item_name: string;
  description: string | null;
  condition: string | null;
  category_name: string;
  brand_name: string | null;
  customer_name: string;
  submitted_at: Date | string | null;
  item_status: string;
  previous_offer_status: string | null;
  previous_offer_amount: string | number | null;
  previous_offer_currency: string | null;
};

type OfferStats = {
  preliminary: number;
  final: number;
  awaitingResponse: number;
  accepted: number;
  declined: number;
};

const emptyOfferStats: OfferStats = {
  preliminary: 0,
  final: 0,
  awaitingResponse: 0,
  accepted: 0,
  declined: 0,
};

function isRecord(value: unknown): value is OfferBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedCurrency(currency: string) {
  return (
    /^[A-Z]{3}$/.test(currency) &&
    Intl.supportedValuesOf("currency").includes(currency)
  );
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
      { success: false, message: "You do not have permission to manage offers." },
      { status: 403, headers: noStore }
    );
  }
  return null;
}

function positiveId(value: unknown): number | null {
  const id =
    typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET() {
  try {
    const user = await requireRole(["CUSTOMER", ...managementRoles]);
    const customer = user.role === "CUSTOMER";
    const [offers] = await pool.query(
      `
      SELECT o.offer_id, o.item_id, e.item_name, o.offer_stage, o.amount,
             o.currency, o.reason, o.valuation_notes, o.disposition, o.offer_status,
             o.created_at, o.decided_at
      FROM DEVICE_OFFER o
      JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
      ${customer ? "WHERE e.user_id = ?" : ""}
      ORDER BY o.created_at DESC, o.offer_id DESC
      `,
      customer ? [user.userId] : []
    );

    let pendingValuations: PendingValuation[] = [];
    let offerStats = emptyOfferStats;
    if (!customer) {
      const [queueRows] = await pool.query(
        `
        SELECT e.item_id, e.item_name, e.description, e.\`condition\`,
               e.item_status, e.submitted_at, c.category_name, b.brand_name,
               u.full_name AS customer_name,
               (
                 SELECT o.offer_status
                 FROM DEVICE_OFFER o
                 WHERE o.item_id = e.item_id AND o.offer_stage = 'Preliminary'
                 ORDER BY o.offer_id DESC
                 LIMIT 1
               ) AS previous_offer_status,
               (
                 SELECT o.amount
                 FROM DEVICE_OFFER o
                 WHERE o.item_id = e.item_id AND o.offer_stage = 'Preliminary'
                 ORDER BY o.offer_id DESC
                 LIMIT 1
               ) AS previous_offer_amount,
               (
                 SELECT o.currency
                 FROM DEVICE_OFFER o
                 WHERE o.item_id = e.item_id AND o.offer_stage = 'Preliminary'
                 ORDER BY o.offer_id DESC
                 LIMIT 1
               ) AS previous_offer_currency
        FROM E_WASTE_ITEM e
        JOIN CATEGORY c ON c.category_id = e.category_id
        LEFT JOIN BRAND b ON b.brand_id = e.brand_id
        JOIN \`USER\` u ON u.user_id = e.user_id
        WHERE e.item_status IN ('Registered', 'Estimate Declined')
          AND NOT EXISTS (
            SELECT 1
            FROM DEVICE_OFFER active_offer
            WHERE active_offer.item_id = e.item_id
              AND active_offer.offer_stage = 'Preliminary'
              AND active_offer.offer_status IN ('Pending', 'Accepted')
          )
        ORDER BY e.submitted_at DESC, e.item_id DESC
        `
      );
      pendingValuations = queueRows as PendingValuation[];

      const [statsRows] = await pool.query(
        `
        SELECT
          COALESCE(SUM(offer_stage = 'Preliminary'), 0) AS preliminary,
          COALESCE(SUM(offer_stage = 'Final'), 0) AS final,
          COALESCE(SUM(offer_status = 'Pending'), 0) AS awaitingResponse,
          COALESCE(SUM(offer_status = 'Accepted'), 0) AS accepted,
          COALESCE(SUM(offer_status = 'Declined'), 0) AS declined
        FROM DEVICE_OFFER
        `
      );
      const stats = (statsRows as Array<Record<keyof OfferStats, number | string>>)[0];
      offerStats = {
        preliminary: Number(stats.preliminary),
        final: Number(stats.final),
        awaitingResponse: Number(stats.awaitingResponse),
        accepted: Number(stats.accepted),
        declined: Number(stats.declined),
      };
    }

    return NextResponse.json(
      {
        success: true,
        offers,
        pendingValuations,
        offerStats,
        userRole: user.role,
      },
      { headers: noStore }
    );
  } catch (error) {
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to load device offers.", error);
    return NextResponse.json(
      { success: false, message: "Unable to load device offers. Confirm the workflow and valuation queue migrations have been applied." },
      { status: 500, headers: noStore }
    );
  }
}

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  let transactionStarted = false;
  try {
    const user = await requireRole(managementRoles);
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
        { success: false, message: "A valid offer is required." },
        { status: 400, headers: noStore }
      );
    }

    const itemId = positiveId(body.itemId);
    const stage = body.stage;
    const amountText =
      typeof body.amount === "number" || typeof body.amount === "string"
        ? String(body.amount).trim()
        : "";
    const amount = /^(?:\d+)(?:\.\d{1,2})?$/.test(amountText)
      ? Number(amountText)
      : NaN;
    const currency =
      typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const valuationNotes =
      typeof body.valuationNotes === "string" ? body.valuationNotes.trim() : "";
    const disposition = body.disposition;

    if (
      !itemId ||
      (stage !== "Preliminary" && stage !== "Final") ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 9999999999.99 ||
      !/^[A-Z]{3}$/.test(currency) ||
      !isSupportedCurrency(currency) ||
      !reason ||
      reason.length > 1000 ||
      valuationNotes.length > 1000 ||
      (stage === "Preliminary" && disposition != null) ||
      (stage === "Final" &&
        disposition !== "Recycling" &&
        disposition !== "Refurbishment")
    ) {
      return NextResponse.json(
        { success: false, message: "Provide a valid item, offer stage, positive amount, three-letter currency, reason and final disposition where applicable." },
        { status: 400, headers: noStore }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [itemRows] = await connection.query(
      "SELECT item_id, item_status FROM E_WASTE_ITEM WHERE item_id = ? FOR UPDATE",
      [itemId]
    );
    const item = (itemRows as Array<{ item_id: number; item_status: string | null }>)[0];
    if (!item) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Device not found." },
        { status: 404, headers: noStore }
      );
    }

    if (stage === "Preliminary") {
      if (!["Registered", "Estimate Declined"].includes(item.item_status ?? "")) {
        await connection.rollback();
        transactionStarted = false;
        return NextResponse.json(
          { success: false, message: "A preliminary estimate can only be issued for a newly registered device or one with a declined estimate." },
          { status: 409, headers: noStore }
        );
      }
    } else {
      const [inspections] = await connection.query(
        `SELECT ins.inspection_id, ins.processing_type, e.item_status,
                EXISTS (
                  SELECT 1 FROM RECYCLING r
                  WHERE r.inspection_id = ins.inspection_id
                ) AS has_recycling,
                EXISTS (
                  SELECT 1 FROM REFURBISHED_PRODUCT p
                  WHERE p.inspection_id = ins.inspection_id
                ) AS has_product
         FROM INSPECTION ins
         JOIN E_WASTE_ITEM e ON e.item_id = ins.item_id
         WHERE ins.item_id = ?
         ORDER BY ins.inspection_id DESC
         LIMIT 1`,
        [itemId]
      );
      const inspection = (inspections as Array<{
        inspection_id: number;
        processing_type: string | null;
        item_status: string | null;
        has_recycling: number | string;
        has_product: number | string;
      }>)[0];
      if (!inspection) {
        await connection.rollback();
        transactionStarted = false;
        return NextResponse.json(
          { success: false, message: "A final offer requires a recorded inspection." },
          { status: 409, headers: noStore }
        );
      }
      if (
        inspection.item_status !== "Inspected" ||
        inspection.processing_type !== disposition ||
        Number(inspection.has_recycling) > 0 ||
        Number(inspection.has_product) > 0
      ) {
        await connection.rollback();
        transactionStarted = false;
        return NextResponse.json(
          { success: false, message: "The final offer must match the inspected recommendation and be issued before processing starts." },
          { status: 409, headers: noStore }
        );
      }
    }

    const [pendingRows] = await connection.query(
      "SELECT offer_id FROM DEVICE_OFFER WHERE item_id = ? AND offer_stage = ? AND offer_status = 'Pending' LIMIT 1",
      [itemId, stage]
    );
    if ((pendingRows as Array<{ offer_id: number }>).length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "This device already has an offer awaiting the customer's response." },
        { status: 409, headers: noStore }
      );
    }

    const [result] = await connection.query(
      `INSERT INTO DEVICE_OFFER
        (item_id, offer_stage, amount, currency, reason, valuation_notes,
         disposition, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        stage,
        amount,
        currency,
        reason,
        valuationNotes || null,
        disposition ?? null,
        user.userId,
      ]
    );
    if (stage === "Preliminary") {
      await connection.query(
        "UPDATE E_WASTE_ITEM SET item_status = 'Estimate Pending' WHERE item_id = ?",
        [itemId]
      );
      await connection.query(
        `INSERT INTO ITEM_STATUS_HISTORY
          (item_id, previous_status, next_status, changed_by_user_id, reason)
         VALUES (?, ?, 'Estimate Pending', ?, ?)`,
        [itemId, item.item_status, user.userId, `Preliminary offer #${(result as { insertId: number }).insertId} issued`]
      );
    }
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      { success: true, message: "Offer created.", offerId: (result as { insertId: number }).insertId },
      { status: 201, headers: noStore }
    );
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back offer creation.", rollbackError);
      }
    }
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to create device offer.", error);
    return NextResponse.json(
      { success: false, message: "Unable to create the offer." },
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
    const user = await requireRole("CUSTOMER");
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
        { success: false, message: "A valid offer decision is required." },
        { status: 400, headers: noStore }
      );
    }
    const offerId = positiveId(body.offerId);
    if (!offerId || (body.decision !== "Accepted" && body.decision !== "Declined")) {
      return NextResponse.json(
        { success: false, message: "Choose an offer and accept or decline it." },
        { status: 400, headers: noStore }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      `SELECT o.offer_id, o.item_id, o.offer_stage, o.offer_status, o.disposition,
              e.user_id, e.item_status
       FROM DEVICE_OFFER o
       JOIN E_WASTE_ITEM e ON e.item_id = o.item_id
       WHERE o.offer_id = ?
       FOR UPDATE`,
      [offerId]
    );
    const offer = (rows as Array<{
      offer_id: number;
      item_id: number;
      offer_stage: "Preliminary" | "Final";
      offer_status: string;
      disposition: string | null;
      user_id: number;
      item_status: string | null;
    }>)[0];
    if (!offer || offer.user_id !== user.userId) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Offer not found." },
        { status: 404, headers: noStore }
      );
    }
    if (offer.offer_status !== "Pending") {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "This offer has already been decided." },
        { status: 409, headers: noStore }
      );
    }

    const nextStatus =
      body.decision === "Accepted"
        ? offer.offer_stage === "Preliminary"
          ? "Offer Accepted"
          : "Final Offer Accepted"
        : offer.offer_stage === "Final"
          ? "Return Requested"
          : "Estimate Declined";
    await connection.query(
      `UPDATE DEVICE_OFFER
       SET offer_status = ?, decided_by_user_id = ?, decided_at = CURRENT_TIMESTAMP
       WHERE offer_id = ?`,
      [body.decision, user.userId, offerId]
    );
    await connection.query(
      `UPDATE E_WASTE_ITEM
       SET item_status = ?,
           final_disposition = CASE
             WHEN ? = 'Accepted' AND ? = 'Final' THEN ?
             ELSE final_disposition
           END
       WHERE item_id = ?`,
      [nextStatus, body.decision, offer.offer_stage, offer.disposition, offer.item_id]
    );
    await connection.query(
      `INSERT INTO ITEM_STATUS_HISTORY
        (item_id, previous_status, next_status, changed_by_user_id, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [offer.item_id, offer.item_status, nextStatus, user.userId,
        body.decision === "Declined" && offer.offer_stage === "Final"
          ? "Final offer declined; item requires explicit return resolution."
          : `${offer.offer_stage} offer ${body.decision.toLowerCase()}.`]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      { success: true, message: body.decision === "Declined" && offer.offer_stage === "Final"
        ? "Offer declined. The device is marked for return resolution."
        : `Offer ${body.decision.toLowerCase()}.`, status: nextStatus },
      { headers: noStore }
    );
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back offer decision.", rollbackError);
      }
    }
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to record offer decision.", error);
    return NextResponse.json(
      { success: false, message: "Unable to record the offer decision." },
      { status: 500, headers: noStore }
    );
  } finally {
    connection?.release();
  }
}
