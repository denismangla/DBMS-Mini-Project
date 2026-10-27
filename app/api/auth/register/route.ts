import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/mysql";

type RegistrationBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  phone?: unknown;
  address?: unknown;
};

function isRecord(value: unknown): value is RegistrationBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDuplicateEntryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}

export async function POST(request: Request) {
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
      { success: false, message: "A valid registration form is required." },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  if (!name || name.length > 100) {
    return NextResponse.json(
      { success: false, message: "Name is required and must be 100 characters or fewer." },
      { status: 400 }
    );
  }

  if (
    email.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json(
      { success: false, message: "Enter a valid email address." },
      { status: 400 }
    );
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return NextResponse.json(
      { success: false, message: "Password must be at least 8 characters and no more than 72 bytes." },
      { status: 400 }
    );
  }

  if (phone.length > 20 || address.length > 255) {
    return NextResponse.json(
      { success: false, message: "Phone or address exceeds the allowed length." },
      { status: 400 }
    );
  }

  try {
    const [existingUsers] = await pool.query(
      "SELECT user_id FROM `USER` WHERE LOWER(email) = ? LIMIT 1",
      [email]
    );

    if ((existingUsers as Array<{ user_id: number }>).length > 0) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      `
      INSERT INTO \`USER\`
        (full_name, email, password_hash, phone, address, user_role)
      VALUES (?, ?, ?, ?, ?, 'CUSTOMER')
      `,
      [name, email, passwordHash, phone || null, address || null]
    );
    const userId = (result as { insertId: number }).insertId;

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. You can now log in.",
        user: { userId, name, email, role: "CUSTOMER" },
      },
      { status: 201 }
    );
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    console.error("Registration failed.");
    return NextResponse.json(
      { success: false, message: "Unable to create the account." },
      { status: 500 }
    );
  }
}
