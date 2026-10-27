import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const saleStatuses = ["Available", "Sold"];
const processingStatuses = ["Pending", "In Progress", "Completed"];

type RefurbishmentUpdate = {
  saleStatus?: unknown;
  processingStatus?: unknown;
};

function isUpdate(value: unknown): value is RefurbishmentUpdate {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let connection:
    | Awaited<ReturnType<typeof pool.getConnection>>
    | undefined;
  let transactionStarted = false;

  try {
    await requireRole(["STAFF", "ADMIN"]);
    const { id } = await context.params;
    const productId = /^\d+$/.test(id) ? Number(id) : NaN;
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, message: "A valid product ID is required." },
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
    if (!isUpdate(body)) {
      return NextResponse.json(
        { success: false, message: "A valid status update is required." },
        { status: 400, headers: noStore }
      );
    }

    const saleStatus =
      body.saleStatus === undefined ? undefined : body.saleStatus;
    const processingStatus =
      body.processingStatus === undefined
        ? undefined
        : body.processingStatus;
    if (
      (saleStatus === undefined && processingStatus === undefined) ||
      (saleStatus !== undefined &&
        (typeof saleStatus !== "string" ||
          !saleStatuses.includes(saleStatus))) ||
      (processingStatus !== undefined &&
        (typeof processingStatus !== "string" ||
          !processingStatuses.includes(processingStatus)))
    ) {
      return NextResponse.json(
        { success: false, message: "Select valid product and processing statuses." },
        { status: 400, headers: noStore }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      `
      SELECT p.product_id, p.sale_status, p.payment_status, p.inspection_id
      FROM REFURBISHED_PRODUCT p
      WHERE p.product_id = ?
      LIMIT 1
      `,
      [productId]
    );
    const product = (rows as Array<{
      product_id: number;
      sale_status: string | null;
      payment_status: string | null;
      inspection_id: number;
    }>)[0];

    if (!product) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, message: "Refurbished product not found." },
        { status: 404, headers: noStore }
      );
    }
    if (
      saleStatus === "Available" &&
      product.sale_status === "Sold" &&
      product.payment_status === "Paid"
    ) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        {
          success: false,
          message: "A paid product cannot be returned to available status.",
        },
        { status: 400, headers: noStore }
      );
    }

    if (saleStatus !== undefined) {
      await connection.query(
        `
        UPDATE REFURBISHED_PRODUCT
        SET sale_status = ?,
            sale_date = CASE
              WHEN ? = 'Sold' THEN COALESCE(sale_date, CURRENT_DATE)
              ELSE NULL
            END
        WHERE product_id = ?
        `,
        [saleStatus, saleStatus, productId]
      );
    }
    if (processingStatus !== undefined) {
      await connection.query(
        "UPDATE INSPECTION SET processing_status = ? WHERE inspection_id = ?",
        [processingStatus, product.inspection_id]
      );
    }

    await connection.commit();
    transactionStarted = false;
    return NextResponse.json(
      {
        success: true,
        message: "Refurbishment status updated.",
        saleStatus: saleStatus ?? product.sale_status,
        processingStatus: processingStatus ?? undefined,
      },
      { headers: noStore }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch {
        console.error("Unable to roll back refurbishment update.");
      }
    }
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
    console.error("Failed to update refurbishment status.");
    return NextResponse.json(
      { success: false, message: "Unable to update refurbishment status." },
      { status: 500, headers: noStore }
    );
  } finally {
    connection?.release();
  }
}
