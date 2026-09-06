import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok, ApiError, clientIp } from "@/lib/api";
import { signToken, verifyPassword, AUTH_COOKIE, type Role } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ensureSeeded } from "@/lib/seed";
import { maskIp } from "@/lib/mask";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(72),
});

export const POST = handle(async (req: NextRequest) => {
  await ensureSeeded();
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, 12, 60_000)) {
    throw new ApiError("Too many login attempts — try again in a minute", 429);
  }

  const body = schema.parse(await req.json());
  const email = body.email.toLowerCase();

  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new ApiError("Invalid email or password", 401);
  if (user.status === "LOCKED") throw new ApiError("Account is locked — contact an administrator", 403);

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    await db.accessLog.create({
      data: { userEmail: email, action: "LOGIN_FAILED", result: "DENIED", ipAddress: maskIp(ip), timestamp: new Date() },
    });
    throw new ApiError("Invalid email or password", 401);
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await db.accessLog.create({
    data: { userEmail: email, action: "LOGIN", result: "ALLOWED", ipAddress: maskIp(ip), timestamp: new Date() },
  });
  await db.auditLog.create({
    data: { actorEmail: email, action: "LOGIN", detail: "Session established" },
  });

  const token = await signToken({
    id: user.id, email: user.email, name: user.name, role: user.role as Role,
  });

  const res = ok({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  return res;
});
