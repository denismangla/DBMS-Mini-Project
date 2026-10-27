import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        success: false,
        message: "Not found.",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  try {
    await requireRole(["STAFF", "ADMIN"]);

    const [rows] = await pool.query("SELECT DATABASE() AS currentDatabase");
    const result = rows as Array<{ currentDatabase: string | null }>;

    return NextResponse.json({
      success: true,
      message: "MySQL connection is available.",
      database: result[0]?.currentDatabase ?? null,
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
          message: "You do not have permission to access the database test endpoint.",
        },
        { status: 403 }
      );
    }

    console.error("Test DB error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to connect to the MySQL database.",
      },
      { status: 500 }
    );
  }
}
