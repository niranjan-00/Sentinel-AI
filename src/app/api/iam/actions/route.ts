import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["REVOKE_SESSION"]),
  sessionId: z.string().min(1),
});

/** Revoke an active session (ADMIN or the owning analyst). */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
  const { sessionId } = schema.parse(await req.json());

  const target = await db.activeSession.findUnique({ where: { id: sessionId } });
  if (!target) throw new ApiError("Session not found", 404);

  const updated = await db.activeSession.update({
    where: { id: sessionId },
    data: { status: "REVOKED" },
  });

  await db.auditLog.create({
    data: { actorEmail: session.email, action: "SESSION_REVOKE", detail: `Revoked session for ${target.userEmail}` },
  });

  return ok({ session: updated });
});
