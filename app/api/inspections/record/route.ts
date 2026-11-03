import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const outcomes = [
  "Refurbishment recommended",
  "Recycling recommended",
] as const;
const damageLevels = ["Low", "Moderate", "High", "Critical", "Unknown"] as const;

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
        { success: false, message: "A valid inspection is required." },
        { status: 400, headers: noStore }
      );
    }

    const itemId = positiveId(body.itemId);
    const assessment =
      typeof body.conditionAssessment === "string" ? body.conditionAssessment.trim() : "";
    const damageLevel = body.damageLevel;
    const inspectionResult = body.inspectionResult;
    const processingType = body.processingType;
    const costText =
      body.estimatedRepairCost === "" || body.estimatedRepairCost == null
        ? ""
        : String(body.estimatedRepairCost).trim();
    const repairCost =
      costText === ""
        ? null
        : /^(?:\d+)(?:\.\d{1,2})?$/.test(costText)
          ? Number(costText)
          : NaN;
    const expectedProcessingType =
      inspectionResult === "Refurbishment recommended"
        ? "Refurbishment"
        : inspectionResult === "Recycling recommended"
          ? "Recycling"
          : null;

    if (
      !itemId ||
      !assessment ||
      assessment.length > 500 ||
      typeof damageLevel !== "string" ||
      !damageLevels.includes(damageLevel as (typeof damageLevels)[number]) ||
      typeof inspectionResult !== "string" ||
      !outcomes.includes(inspectionResult as (typeof outcomes)[number]) ||
      processingType !== expectedProcessingType ||
      (repairCost !== null &&
        (!Number.isFinite(repairCost) || repairCost < 0 || repairCost > 9999999999.99))
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid device, assessment, damage level, outcome and optional repair cost. The processing path must match the recommendation." },
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
    if (item.item_status !== "Collected") {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Only a collected device can be inspected." },
        { status: 409, headers: noStore }
      );
    }
    const [existingRows] = await connection.query(
      "SELECT inspection_id FROM INSPECTION WHERE item_id = ? LIMIT 1",
      [itemId]
    );
    if ((existingRows as Array<{ inspection_id: number }>).length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "An inspection already exists for this device." },
        { status: 409, headers: noStore }
      );
    }

    const [result] = await connection.query(
      `INSERT INTO INSPECTION
        (inspection_date, condition_assessment, damage_level, inspection_result,
         estimated_repair_cost, processing_type, processing_status, item_id)
       VALUES (CURRENT_DATE, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [assessment, damageLevel, inspectionResult, repairCost, processingType, itemId]
    );
    const inspectionId = (result as { insertId: number }).insertId;
    await connection.query(
      "UPDATE E_WASTE_ITEM SET item_status = 'Inspected' WHERE item_id = ?",
      [itemId]
    );
    await connection.query(
      `INSERT INTO ITEM_STATUS_HISTORY
        (item_id, previous_status, next_status, changed_by_user_id, reason)
       VALUES (?, ?, 'Inspected', ?, ?)`,
      [itemId, item.item_status, user.userId, `Inspection #${inspectionId} recorded: ${inspectionResult}.`]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      {
        success: true,
        message: "Structured inspection saved in MySQL. Add the detailed technician report next.",
        inspectionId,
        itemId,
      },
      { status: 201, headers: noStore }
    );
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back structured inspection.", rollbackError);
      }
    }
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to save structured inspection.", error);
    return NextResponse.json(
      { success: false, message: "Unable to save the structured inspection." },
      { status: 500, headers: noStore }
    );
  } finally {
    connection?.release();
  }
}
