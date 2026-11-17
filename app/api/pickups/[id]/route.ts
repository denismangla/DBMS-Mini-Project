import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

function positiveInteger(value: unknown) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  let transactionStarted = false;
  try {
    const user = await requireRole(["STAFF", "ADMIN"]);
    const { id } = await context.params;
    const pickupId = /^\d+$/.test(id) ? Number(id) : NaN;
    if (!Number.isSafeInteger(pickupId) || pickupId <= 0) {
      return NextResponse.json(
        { success: false, message: "A valid pickup ID is required." },
        { status: 400, headers: noStore }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "A valid JSON request body is required." },
        { status: 400, headers: noStore }
      );
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "A valid pickup update is required." },
        { status: 400, headers: noStore }
      );
    }
    const update = body as Record<string, unknown>;
    const scheduledDate = update.scheduledDate;
    const collectorId =
      update.collectorId === null || update.collectorId === ""
        ? null
        : positiveInteger(update.collectorId);
    const complete = update.status === "Completed";
    if (
      (scheduledDate !== undefined &&
        (typeof scheduledDate !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) ||
          Number.isNaN(Date.parse(`${scheduledDate}T00:00:00Z`)) ||
          new Date(`${scheduledDate}T00:00:00Z`).toISOString().slice(0, 10) !== scheduledDate)) ||
      (update.collectorId !== undefined &&
        update.collectorId !== null &&
        update.collectorId !== "" &&
        collectorId === null) ||
      (update.status !== undefined && !complete) ||
      (scheduledDate === undefined && update.collectorId === undefined && !complete)
    ) {
      return NextResponse.json(
        { success: false, message: "Provide a valid schedule date, collector assignment, or collection completion." },
        { status: 400, headers: noStore }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      `SELECT pickup_id,
              DATE_FORMAT(requested_date, '%Y-%m-%d') AS requested_date,
              DATE_FORMAT(scheduled_date, '%Y-%m-%d') AS scheduled_date,
              pickup_status,
              assignment_status, collector_id, center_id, user_id
       FROM PICKUP_REQUEST
       WHERE pickup_id = ?
       FOR UPDATE`,
      [pickupId]
    );
    const pickup = (rows as Array<{
      pickup_id: number;
      requested_date: string;
      scheduled_date: string | null;
      pickup_status: string | null;
      assignment_status: string | null;
      collector_id: number | null;
      center_id: number;
      user_id: number;
    }>)[0];
    if (!pickup) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Pickup request not found." },
        { status: 404, headers: noStore }
      );
    }
    if (!["Pending", "Scheduled"].includes(pickup.pickup_status ?? "")) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Only pending or scheduled pickups can be changed." },
        { status: 409, headers: noStore }
      );
    }

    const nextDate = typeof scheduledDate === "string" ? scheduledDate : pickup.scheduled_date;
    const nextCollector =
      update.collectorId === undefined ? pickup.collector_id : collectorId;
    if (typeof scheduledDate === "string" && scheduledDate < String(pickup.requested_date).slice(0, 10)) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Schedule date cannot be earlier than the request date." },
        { status: 400, headers: noStore }
      );
    }
    if (nextCollector !== null) {
      const [collectors] = await connection.query(
        "SELECT collector_id FROM COLLECTOR WHERE collector_id = ? AND center_id = ? LIMIT 1",
        [nextCollector, pickup.center_id]
      );
      if ((collectors as Array<{ collector_id: number }>).length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return NextResponse.json(
          { success: false, message: "Choose a collector assigned to this collection center." },
          { status: 400, headers: noStore }
        );
      }
    }

    if (complete) {
      if (!nextDate || nextCollector === null) {
        await connection.rollback();
        transactionStarted = false;
        return NextResponse.json(
          { success: false, message: "Schedule the pickup and assign a collector before recording collection." },
          { status: 409, headers: noStore }
        );
      }
      await connection.query(
        `INSERT INTO ITEM_STATUS_HISTORY
          (item_id, previous_status, next_status, changed_by_user_id, reason)
         SELECT item_id, item_status, 'Collected', ?, ?
         FROM E_WASTE_ITEM WHERE pickup_id = ?`,
        [user.userId, `Pickup #${pickupId} marked collected.`, pickupId]
      );
      await connection.query(
        `UPDATE PICKUP_REQUEST
         SET pickup_status = 'Completed', assignment_status = 'Completed',
             completed_at = CURRENT_TIMESTAMP
         WHERE pickup_id = ?`,
        [pickupId]
      );
      await connection.query(
        `UPDATE E_WASTE_ITEM
         SET item_status = 'Collected'
         WHERE pickup_id = ?`,
        [pickupId]
      );
    } else {
      const nextStatus = nextDate ? "Scheduled" : "Pending";
      const nextAssignment = nextCollector === null ? "Pending" : "Assigned";
      await connection.query(
        `UPDATE PICKUP_REQUEST
         SET scheduled_date = ?, collector_id = ?, pickup_status = ?,
             assignment_status = ?,
             assigned_at = CASE WHEN ? IS NULL THEN NULL ELSE COALESCE(assigned_at, CURRENT_TIMESTAMP) END
         WHERE pickup_id = ?`,
        [nextDate, nextCollector, nextStatus, nextAssignment, nextCollector, pickupId]
      );
    }
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      { success: true, message: complete ? "Collection recorded." : "Pickup schedule updated." },
      { headers: noStore }
    );
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back pickup update.", rollbackError);
      }
    }
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHENTICATED" || message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: message === "UNAUTHENTICATED" ? "Authentication required." : "Staff or administrator access is required." },
        { status: message === "UNAUTHENTICATED" ? 401 : 403, headers: noStore }
      );
    }
    console.error("Failed to update pickup request.", error);
    return NextResponse.json(
      { success: false, message: "Unable to update pickup request." },
      { status: 500, headers: noStore }
    );
  } finally {
    connection?.release();
  }
}
