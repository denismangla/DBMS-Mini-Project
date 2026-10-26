import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

export async function GET() {
  try {
    const user = await requireRole(["CUSTOMER", "STAFF", "ADMIN"]);
    const managementAccess = user.role === "STAFF" || user.role === "ADMIN";

    const [rows] = await pool.query(
      `
      SELECT
        i.item_id,
        i.item_name,
        i.description,
        i.\`condition\`,
        i.estimated_weight,
        i.item_status,
        i.final_disposition,
        c.category_name,
        b.brand_name
      FROM E_WASTE_ITEM i
      JOIN CATEGORY c
        ON i.category_id = c.category_id
      LEFT JOIN BRAND b
        ON i.brand_id = b.brand_id
      ${managementAccess ? "" : "WHERE i.user_id = ?"}
      ORDER BY i.item_id
      `,
      managementAccess ? [] : [user.userId]
    );

    return NextResponse.json({
      success: true,
      items: rows,
      userRole: user.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";

    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to access e-waste items.",
        },
        { status: 403 }
      );
    }

    console.error("Items API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load e-waste items.",
      },
      { status: 500 }
    );
  }
}
