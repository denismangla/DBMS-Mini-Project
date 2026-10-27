import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const recyclingStatuses = ["Pending", "In Progress", "Completed"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["STAFF", "ADMIN"]);
    const { id } = await context.params;
    const recyclingId = /^\d+$/.test(id) ? Number(id) : NaN;
    if (!Number.isSafeInteger(recyclingId) || recyclingId <= 0) {
      return NextResponse.json(
        { success: false, message: "A valid recycling ID is required." },
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
    const status =
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      typeof body.status === "string"
        ? body.status
        : "";
    if (!recyclingStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Select a valid recycling status." },
        { status: 400, headers: noStore }
      );
    }

    const [existing] = await pool.query(
      "SELECT recycling_id FROM RECYCLING WHERE recycling_id = ? LIMIT 1",
      [recyclingId]
    );
    if ((existing as Array<{ recycling_id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, message: "Recycling record not found." },
        { status: 404, headers: noStore }
      );
    }
    await pool.query(
      "UPDATE RECYCLING SET recycling_status = ? WHERE recycling_id = ?",
      [status, recyclingId]
    );
    return NextResponse.json(
      { success: true, message: "Recycling status updated.", status },
      { headers: noStore }
    );
  } catch (error) {
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
    console.error("Failed to update recycling status.");
    return NextResponse.json(
      { success: false, message: "Unable to update recycling status." },
      { status: 500, headers: noStore }
    );
  }
}
