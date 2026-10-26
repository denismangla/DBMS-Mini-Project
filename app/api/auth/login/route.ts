import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getAuthSecret, SESSION_COOKIE_NAME } from "@/lib/auth";
import pool from "@/lib/mysql";

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const payload =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const email =
      typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const password = typeof payload.password === "string" ? payload.password : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const [rows] = await pool.query(
      `
      SELECT
        user_id,
        full_name,
        email,
        password_hash,
        user_role
      FROM \`USER\`
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    const users = rows as Array<{
      user_id: number;
      full_name: string;
      email: string;
      password_hash: string;
      user_role: string;
    }>;

    if (users.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const user = users[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const role = user.user_role.toUpperCase();

    if (!["CUSTOMER", "STAFF", "ADMIN"].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Account role is not supported.",
        },
        { status: 403 }
      );
    }

    const token = await new SignJWT({
      userId: user.user_id,
      email: user.email,
      role,
      name: user.full_name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(getAuthSecret());

    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful.",
        user: {
          userId: user.user_id,
          id: user.user_id,
          name: user.full_name,
          email: user.email,
          role,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to complete login.",
      },
      { status: 500 }
    );
  }
}
