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
        p.product_id,
        p.product_name,
        p.model,
        p.\`condition\`,
        p.warranty_period,
        p.selling_price,
        p.sale_status,
        p.sale_date,
        p.payment_method,
        p.payment_status,
        p.inspection_id,
        i.processing_status,
        i.item_id,
        e.item_name
      FROM REFURBISHED_PRODUCT p
      JOIN INSPECTION i ON p.inspection_id = i.inspection_id
      JOIN E_WASTE_ITEM e ON i.item_id = e.item_id
      ${managementAccess ? "" : "WHERE e.user_id = ?"}
      ORDER BY p.product_id
      `,
      managementAccess ? [] : [user.userId]
    );
    return NextResponse.json(
      { success: true, products: rows, userRole: user.role },
      { headers: noStore }
    );
  } catch (error) {
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to load refurbished products.");
    return NextResponse.json(
      { success: false, message: "Unable to load refurbished products." },
      { status: 500, headers: noStore }
    );
  }
}
