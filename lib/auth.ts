import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export type AppRole = "CUSTOMER" | "STAFF" | "ADMIN";

export type SessionUser = {
  userId: number;
  email: string;
  role: AppRole;
  name: string;
};

export const SESSION_COOKIE_NAME = "ewaste_session";
export const AUTH_ROLES: AppRole[] = ["CUSTOMER", "STAFF", "ADMIN"];

export function getAuthSecret() {
  const value = process.env.AUTH_SECRET;

  if (!value || value.trim() === "") {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return new TextEncoder().encode(value);
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && AUTH_ROLES.includes(value as AppRole);
}

function parseUserId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    const userId = parseUserId(payload.userId);

    if (
      userId === null ||
      typeof payload.email !== "string" ||
      !isAppRole(payload.role) ||
      typeof payload.name !== "string"
    ) {
      return null;
    }

    return {
      userId,
      email: payload.email.trim(),
      role: payload.role,
      name: payload.name.trim() || "User",
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  return user;
}

export async function requireRole(
  allowedRoles: AppRole | AppRole[]
): Promise<SessionUser> {
  const user = await requireSession();
  const roleSet = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roleSet.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function hasManagementRole() {
  const user = await getSessionUser();
  return Boolean(user && (user.role === "STAFF" || user.role === "ADMIN"));
}
