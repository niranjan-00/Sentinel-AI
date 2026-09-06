import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok, ApiError, clientIp } from "@/lib/api";
import { hashPassword, signToken, AUTH_COOKIE } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(72),
});

export const POST = handle(async (req: NextRequest) => {
  await ensureSeeded();
  const ip = clientIp(req);
  if (!rateLimit(`register:${ip}`, 10, 60_000)) {
    throw new ApiError("Too many attempts — slow down", 429);
  }

  const body = schema.parse(await req.json());

  const existing = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) throw new ApiError("An account with this email already exists", 409);

  const user = await db.user.create({
    data: {
      email: body.email.toLowerCase(),
      name: body.name.trim(),
      passwordHash: await hashPassword(body.password),
      role: "VIEWER", // least privilege by default; ADMIN can elevate
      status: "ACTIVE",
      department: "General",
    },
  });

  await db.auditLog.create({
    data: { actorEmail: user.email, action: "REGISTER", detail: "Account created (VIEWER role)" },
  });

  const token = await signToken({ id: user.id, email: user.email, name: user.name, role: "VIEWER" });
  const res = ok({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  }, 201);
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  return res;
});
