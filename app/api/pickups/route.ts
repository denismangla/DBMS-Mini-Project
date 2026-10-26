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
        p.pickup_id,
        p.requested_date,
        p.scheduled_date,
        p.pickup_address,
        p.pickup_status,
        p.rating,
        p.comments,
        p.user_id,
        u.full_name AS user_name,
        c.center_name,
        col.collector_name,
        p.assignment_status
      FROM PICKUP_REQUEST p
      JOIN \`USER\` u
        ON p.user_id = u.user_id
      JOIN COLLECTION_CENTER c
        ON p.center_id = c.center_id
      JOIN COLLECTOR col
        ON p.collector_id = col.collector_id
      ${managementAccess ? "" : "WHERE p.user_id = ?"}
      ORDER BY p.pickup_id
      `,
      managementAccess ? [] : [user.userId]
    );

    return NextResponse.json({
      success: true,
      pickups: rows,
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
          message: "You do not have permission to access pickup requests.",
        },
        { status: 403 }
      );
    }

    console.error("Pickup API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load pickup requests.",
      },
      { status: 500 }
    );
  }
}
