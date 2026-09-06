import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { requireRole, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["LOCK", "UNLOCK", "FLAG_SUSPICIOUS", "CHANGE_ROLE", "REQUIRE_MFA", "RESET_ACCESS"]),
  role: z.enum(["ADMIN", "SECURITY_ANALYST", "VIEWER"]).optional(),
});

/** IAM actions: lock / unlock / flag / change role / require MFA / reset access. */
export const PATCH = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(req, ["ADMIN"]);
    const { id } = await ctx.params;
    const { action, role } = patchSchema.parse(await req.json());

    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw new ApiError("User not found", 404);

    const data: Record<string, unknown> = {};
    switch (action) {
      case "LOCK": data.status = "LOCKED"; break;
      case "UNLOCK": data.status = "ACTIVE"; data.riskScore = Math.max(0, user.riskScore - 30); break;
      case "FLAG_SUSPICIOUS": data.status = "SUSPICIOUS"; break;
      case "CHANGE_ROLE":
        if (!role) throw new ApiError("Role is required for CHANGE_ROLE");
        data.role = role;
        break;
      case "REQUIRE_MFA": data.mfaEnabled = true; break;
      case "RESET_ACCESS": {
        data.riskScore = 0;
        data.status = "ACTIVE";
        data.passwordHash = await hashPassword(`Reset@${Math.random().toString(36).slice(2, 10)}!1A`);
        break;
      }
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, name: true, role: true, status: true,
        department: true, riskScore: true, mfaEnabled: true, lastLoginAt: true,
      },
    });

    // cascade side-effects
    if (action === "LOCK" || action === "RESET_ACCESS") {
      await db.activeSession.updateMany({
        where: { userEmail: user.email, status: { in: ["ACTIVE", "SUSPICIOUS"] } },
        data: { status: "REVOKED" },
      });
    }

    await db.auditLog.create({
      data: {
        actorEmail: session.email,
        action: `USER_${action}`,
        detail: `${user.email}${role ? ` → ${role}` : ""}`,
      },
    });

    return ok({ user: updated });
  }
);

/** Hard user removal (ADMIN only, cannot delete self). */
export const DELETE = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(req, ["ADMIN"]);
    const { id } = await ctx.params;
    if (id === session.id) throw new ApiError("You cannot delete your own account", 400);

    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw new ApiError("User not found", 404);

    await db.user.delete({ where: { id } });
    await db.auditLog.create({
      data: { actorEmail: session.email, action: "USER_DELETE", detail: user.email },
    });
    return ok({ deleted: user.email });
  }
);
