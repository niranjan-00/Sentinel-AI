import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api";

export const AUTH_COOKIE = "sentinel_token";
const JWT_TTL = "7d";

export type Role = "ADMIN" | "SECURITY_ANALYST" | "VIEWER";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

function getSecret(): Uint8Array {
  const raw =
    process.env.JWT_SECRET ||
    "sentinel-dev-secret-do-not-use-in-production-2026";
  return new TextEncoder().encode(raw);
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer("sentinel-ai")
    .setExpirationTime(JWT_TTL)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "sentinel-ai",
    });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: (payload.role as Role) ?? "VIEWER",
    };
  } catch {
    return null;
  }
}

/** Extract session user from request cookie. Null if unauthenticated. */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Require an authenticated session, optionally with one of the given roles.
 * Throws ApiError(401/403) — caught by the `handle()` wrapper.
 */
export async function requireRole(
  req: NextRequest,
  roles?: Role[]
): Promise<SessionUser> {
  const session = await getSession(req);
  if (!session) throw new ApiError("Authentication required", 401);
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    throw new ApiError(
      "Insufficient permissions for this action (RBAC policy denial)",
      403
    );
  }
  return session;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Role hierarchy helper for UI gating. */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  SECURITY_ANALYST: 2,
  ADMIN: 3,
};
