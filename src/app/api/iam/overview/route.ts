import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** IAM overview: users, active sessions, login history, audit trail. */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
  await ensureSeeded();

  const [users, sessions, accessLogs, auditLogs] = await Promise.all([
    db.user.findMany({
      select: {
        id: true, email: true, name: true, role: true, status: true,
        department: true, riskScore: true, mfaEnabled: true, lastLoginAt: true,
      },
      orderBy: { riskScore: "desc" },
      take: 60,
    }),
    db.activeSession.findMany({
      where: { status: { in: ["ACTIVE", "SUSPICIOUS"] } },
      orderBy: { lastActivity: "desc" },
      take: 20,
    }),
    db.accessLog.findMany({ orderBy: { timestamp: "desc" }, take: 40 }),
    db.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 20 }),
  ]);

  return ok({ users, sessions, accessLogs, auditLogs });
});
