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

    const [categories] = await pool.query(
      "SELECT category_id, category_name FROM CATEGORY ORDER BY category_name"
    );
    const [brands] = await pool.query(
      "SELECT brand_id, brand_name FROM BRAND ORDER BY brand_name"
    );

    return NextResponse.json(
      {
        success: true,
        items: rows,
        categories,
        brands,
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
          message: "You do not have permission to access e-waste items.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    console.error("Items API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load e-waste items.",
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

type NewItemBody = {
  itemName?: unknown;
  description?: unknown;
  condition?: unknown;
  categoryId?: unknown;
  brandId?: unknown;
  manufactureYear?: unknown;
  estimatedWeight?: unknown;
  quantity?: unknown;
};

function isRecord(value: unknown): value is NewItemBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
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

    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, message: "A valid item form is required." },
        { status: 400 }
      );
    }

    const itemName =
      typeof body.itemName === "string" ? body.itemName.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const itemCondition =
      typeof body.condition === "string" ? body.condition.trim() : "";
    const categoryId =
      typeof body.categoryId === "number" ||
      typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : NaN;
    const brandId =
      body.brandId === "" || body.brandId === null || body.brandId === undefined
        ? null
        : typeof body.brandId === "number" ||
            typeof body.brandId === "string"
          ? Number(body.brandId)
          : NaN;
    const manufactureYear =
      body.manufactureYear === "" ||
      body.manufactureYear === null ||
      body.manufactureYear === undefined
        ? null
        : typeof body.manufactureYear === "number" ||
            typeof body.manufactureYear === "string"
          ? Number(body.manufactureYear)
          : NaN;
    const estimatedWeight =
      body.estimatedWeight === "" ||
      body.estimatedWeight === null ||
      body.estimatedWeight === undefined
        ? null
        : typeof body.estimatedWeight === "number" ||
            typeof body.estimatedWeight === "string"
          ? Number(body.estimatedWeight)
          : NaN;
    const quantity =
      body.quantity === "" ||
      body.quantity === null ||
      body.quantity === undefined
        ? null
        : typeof body.quantity === "number" ||
            typeof body.quantity === "string"
          ? Number(body.quantity)
          : NaN;
    const currentYear = new Date().getFullYear();

    if (!itemName || itemName.length > 150) {
      return NextResponse.json(
        { success: false, message: "Item name is required and must be 150 characters or fewer." },
        { status: 400 }
      );
    }

    if (description.length > 500 || itemCondition.length > 50) {
      return NextResponse.json(
        { success: false, message: "Description or condition exceeds the allowed length." },
        { status: 400 }
      );
    }

    if (
      !Number.isSafeInteger(categoryId) ||
      categoryId <= 0 ||
      categoryId > 2147483647
    ) {
      return NextResponse.json(
        { success: false, message: "Select a valid category." },
        { status: 400 }
      );
    }

    if (
      brandId !== null &&
      (!Number.isSafeInteger(brandId) ||
        brandId <= 0 ||
        brandId > 2147483647)
    ) {
      return NextResponse.json(
        { success: false, message: "Select a valid brand." },
        { status: 400 }
      );
    }

    if (
      manufactureYear !== null &&
      (!Number.isInteger(manufactureYear) ||
        manufactureYear < 1901 ||
        manufactureYear > currentYear)
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid manufacture year." },
        { status: 400 }
      );
    }

    if (
      estimatedWeight !== null &&
      (!Number.isFinite(estimatedWeight) ||
        estimatedWeight < 0 ||
        estimatedWeight > 99999999.99 ||
        Math.abs(estimatedWeight * 100 - Math.round(estimatedWeight * 100)) >
          0.0000001)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Estimated weight must be between 0 and 99,999,999.99 kg, with at most two decimal places.",
        },
        { status: 400 }
      );
    }

    if (
      quantity !== null &&
      (!Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > 2147483647)
    ) {
      return NextResponse.json(
        { success: false, message: "Quantity must be a positive whole number." },
        { status: 400 }
      );
    }

    const [categories] = await pool.query(
      "SELECT category_id FROM CATEGORY WHERE category_id = ? LIMIT 1",
      [categoryId]
    );
    if ((categories as Array<{ category_id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, message: "The selected category does not exist." },
        { status: 400 }
      );
    }

    if (brandId !== null) {
      const [brands] = await pool.query(
        "SELECT brand_id FROM BRAND WHERE brand_id = ? LIMIT 1",
        [brandId]
      );
      if ((brands as Array<{ brand_id: number }>).length === 0) {
        return NextResponse.json(
          { success: false, message: "The selected brand does not exist." },
          { status: 400 }
        );
      }
    }

    const [result] = await pool.query(
      `
      INSERT INTO E_WASTE_ITEM
        (item_name, description, \`condition\`, manufacture_year,
         estimated_weight, item_status, final_disposition, user_id,
         category_id, brand_id, quantity)
      VALUES (?, ?, ?, ?, ?, 'Registered', NULL, ?, ?, ?, ?)
      `,
      [
        itemName,
        description || null,
        itemCondition || null,
        manufactureYear,
        estimatedWeight,
        user.userId,
        categoryId,
        brandId,
        quantity,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Device registered successfully.",
        itemId: (result as { insertId: number }).insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Only customers can register devices." },
        { status: 403 }
      );
    }

    console.error("Device registration failed.");
    return NextResponse.json(
      { success: false, message: "Unable to register this device." },
      { status: 500 }
    );
  }
}
