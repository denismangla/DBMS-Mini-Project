import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

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
    const managementAccess = user.role !== "CUSTOMER";
    const [rows] = await pool.query(
      `
      SELECT
        r.recycling_id,
        r.inspection_id,
        r.recycling_date,
        r.recycling_method,
        r.recycling_status,
        r.recovered_material,
        r.recovered_quantity,
        r.recovered_value,
        r.purity_percentage,
        i.item_id,
        e.item_name
      FROM RECYCLING r
      JOIN INSPECTION i ON r.inspection_id = i.inspection_id
      JOIN E_WASTE_ITEM e ON i.item_id = e.item_id
      ${managementAccess ? "" : "WHERE e.user_id = ?"}
      ORDER BY r.recycling_id
      `,
      managementAccess ? [] : [user.userId]
    );
    return NextResponse.json(
      { success: true, recycling: rows, userRole: user.role },
      { headers: noStore }
    );
  } catch (error) {
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to load recycling records.");
    return NextResponse.json(
      { success: false, message: "Unable to load recycling records." },
      { status: 500, headers: noStore }
    );
  }
}
