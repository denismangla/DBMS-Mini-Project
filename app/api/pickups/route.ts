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
        DATE_FORMAT(p.requested_date, '%Y-%m-%d') AS requested_date,
        DATE_FORMAT(p.scheduled_date, '%Y-%m-%d') AS scheduled_date,
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
      LEFT JOIN COLLECTOR col
        ON p.collector_id = col.collector_id
      ${managementAccess ? "" : "WHERE p.user_id = ?"}
      ORDER BY p.pickup_id
      `,
      managementAccess ? [] : [user.userId]
    );

    const [centers] = await pool.query(
      "SELECT center_id, center_name, city FROM COLLECTION_CENTER ORDER BY center_name"
    );
    const [collectors] = managementAccess
      ? await pool.query(
          `SELECT collector_id, collector_name, center_id
           FROM COLLECTOR
           ORDER BY collector_name`
        )
      : [[], []];

    return NextResponse.json(
      {
        success: true,
        pickups: rows,
        centers,
        collectors,
        userRole: user.role,
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
          message: "You do not have permission to access pickup requests.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    console.error("Pickup API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load pickup requests.",
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

type PickupBody = {
  itemId?: unknown;
  centerId?: unknown;
  pickupAddress?: unknown;
};

function isPickupBody(value: unknown): value is PickupBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown) {
  const id = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
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
        { status: 400 }
      );
    }
    if (!isPickupBody(body)) {
      return NextResponse.json(
        { success: false, message: "A valid pickup request is required." },
        { status: 400 }
      );
    }

    const itemId = positiveInteger(body.itemId);
    const centerId = positiveInteger(body.centerId);
    const address = typeof body.pickupAddress === "string" ? body.pickupAddress.trim() : "";
    if (!itemId || !centerId || !address || address.length > 255) {
      return NextResponse.json(
        { success: false, message: "Select a device and collection center, and provide a pickup address of 255 characters or fewer." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [items] = await connection.query(
      `SELECT item_id, item_status
       FROM E_WASTE_ITEM
       WHERE item_id = ? AND user_id = ?
       FOR UPDATE`,
      [itemId, user.userId]
    );
    const item = (items as Array<{ item_id: number; item_status: string | null }>)[0];
    if (!item) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Device not found." },
        { status: 404 }
      );
    }
    if (item.item_status !== "Offer Accepted") {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Accept a preliminary estimate before requesting collection." },
        { status: 409 }
      );
    }
    const [centers] = await connection.query(
      "SELECT center_id FROM COLLECTION_CENTER WHERE center_id = ? LIMIT 1",
      [centerId]
    );
    if ((centers as Array<{ center_id: number }>).length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "The selected collection center does not exist." },
        { status: 400 }
      );
    }

    const [result] = await connection.query(
      `INSERT INTO PICKUP_REQUEST
        (requested_date, pickup_address, pickup_status, user_id, center_id,
         collector_id, assignment_status)
       VALUES (CURRENT_DATE, ?, 'Pending', ?, ?, NULL, 'Pending')`,
      [address, user.userId, centerId]
    );
    const pickupId = (result as { insertId: number }).insertId;
    await connection.query(
      "UPDATE E_WASTE_ITEM SET pickup_id = ?, item_status = 'Pickup Requested' WHERE item_id = ?",
      [pickupId, itemId]
    );
    await connection.query(
      `INSERT INTO ITEM_STATUS_HISTORY
        (item_id, previous_status, next_status, changed_by_user_id, reason)
       VALUES (?, ?, 'Pickup Requested', ?, ?)`,
      [itemId, item.item_status, user.userId, `Pickup request #${pickupId} created.`]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      { success: true, message: "Pickup request submitted.", pickupId },
      { status: 201, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back pickup request.", rollbackError);
      }
    }
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHENTICATED" || message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: message === "UNAUTHENTICATED" ? "Authentication required." : "Only customers can request pickups." },
        { status: message === "UNAUTHENTICATED" ? 401 : 403 }
      );
    }
    console.error("Failed to create pickup request.", error);
    return NextResponse.json(
      { success: false, message: "Unable to create the pickup request. Confirm the workflow migration has been applied." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
