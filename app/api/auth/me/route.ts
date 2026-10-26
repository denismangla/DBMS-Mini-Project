import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          userId: user.userId,
          id: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Session check error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to verify session.",
      },
      { status: 500 }
    );
  }
}
