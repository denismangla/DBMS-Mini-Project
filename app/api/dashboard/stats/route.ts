import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

type CountRow = {
  totalItems?: number | string | null;
  totalPickups?: number | string | null;
  totalRecycled?: number | string | null;
  totalRefurbished?: number | string | null;
};

export async function GET() {
  try {
    const user = await requireRole(["CUSTOMER", "STAFF", "ADMIN"]);
    const isManagement = user.role === "STAFF" || user.role === "ADMIN";

    const [items] = await pool.query(
      isManagement
        ? "SELECT COUNT(*) AS totalItems FROM E_WASTE_ITEM"
        : "SELECT COUNT(*) AS totalItems FROM E_WASTE_ITEM WHERE user_id = ?",
      isManagement ? [] : [user.userId]
    );

    const [pickups] = await pool.query(
      isManagement
        ? "SELECT COUNT(*) AS totalPickups FROM PICKUP_REQUEST"
        : "SELECT COUNT(*) AS totalPickups FROM PICKUP_REQUEST WHERE user_id = ?",
      isManagement ? [] : [user.userId]
    );

    const [recycled] = await pool.query(
      isManagement
        ? "SELECT COUNT(*) AS totalRecycled FROM RECYCLING"
        : `
          SELECT COUNT(*) AS totalRecycled
          FROM RECYCLING r
          JOIN INSPECTION i ON r.inspection_id = i.inspection_id
          JOIN E_WASTE_ITEM e ON i.item_id = e.item_id
          WHERE e.user_id = ?
        `,
      isManagement ? [] : [user.userId]
    );

    const [refurbished] = await pool.query(
      isManagement
        ? "SELECT COUNT(*) AS totalRefurbished FROM REFURBISHED_PRODUCT"
        : `
          SELECT COUNT(*) AS totalRefurbished
          FROM REFURBISHED_PRODUCT p
          JOIN INSPECTION i ON p.inspection_id = i.inspection_id
          JOIN E_WASTE_ITEM e ON i.item_id = e.item_id
          WHERE e.user_id = ?
        `,
      isManagement ? [] : [user.userId]
    );
    const [statusRows] = await pool.query(
      `SELECT COALESCE(item_status, 'Unspecified') AS status, COUNT(*) AS total
       FROM E_WASTE_ITEM
       ${isManagement ? "" : "WHERE user_id = ?"}
       GROUP BY item_status
       ORDER BY total DESC, status`,
      isManagement ? [] : [user.userId]
    );
    const [pendingReviewRows] = isManagement
      ? await pool.query(
          "SELECT COUNT(*) AS total FROM E_WASTE_ITEM WHERE item_status = 'Registered'"
        )
      : [{ total: 0 }];
    const [pendingPickupRows] = isManagement
      ? await pool.query(
          "SELECT COUNT(*) AS total FROM PICKUP_REQUEST WHERE pickup_status = 'Pending'"
        )
      : [{ total: 0 }];
    const [inspectionQueueRows] = isManagement
      ? await pool.query(
          `SELECT COUNT(*) AS total
           FROM E_WASTE_ITEM e
           WHERE e.item_status = 'Collected'
             AND NOT EXISTS (
               SELECT 1 FROM INSPECTION i WHERE i.item_id = e.item_id
             )`
        )
      : [{ total: 0 }];

    const itemRows = (items as CountRow[] | undefined) ?? [];
    const pickupRows = (pickups as CountRow[] | undefined) ?? [];
    const recycledRows = (recycled as CountRow[] | undefined) ?? [];
    const refurbishedRows = (refurbished as CountRow[] | undefined) ?? [];

    return NextResponse.json(
      {
        success: true,
        user: {
          name: user.name,
          role: user.role,
        },
        stats: {
          totalItems: Number(itemRows[0]?.totalItems ?? 0),
          totalPickups: Number(pickupRows[0]?.totalPickups ?? 0),
          totalRecycled: Number(recycledRows[0]?.totalRecycled ?? 0),
          totalRefurbished: Number(refurbishedRows[0]?.totalRefurbished ?? 0),
          statusBreakdown: statusRows,
          pendingReview: Number(
            (pendingReviewRows as Array<{ total: number | string }>)[0]?.total ?? 0
          ),
          pendingPickups: Number(
            (pendingPickupRows as Array<{ total: number | string }>)[0]?.total ?? 0
          ),
          awaitingInspection: Number(
            (inspectionQueueRows as Array<{ total: number | string }>)[0]?.total ?? 0
          ),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";

    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to access dashboard statistics.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    console.error("Dashboard stats error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load dashboard statistics.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
