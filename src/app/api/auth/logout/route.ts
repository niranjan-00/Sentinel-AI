import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { AUTH_COOKIE, getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: NextRequest) => {
  const session = await getSession(req);
  if (session) {
    await db.auditLog.create({
      data: { actorEmail: session.email, action: "LOGOUT", detail: "Session terminated" },
    }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
});
