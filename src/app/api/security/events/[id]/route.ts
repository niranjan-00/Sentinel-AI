import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { bus } from "@/lib/events";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["INVESTIGATE", "BLOCK", "SAFE", "RESOLVE"]),
});

/** Investigate / Block / Mark safe / Resolve a security event. */
export const PATCH = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
    const { id } = await ctx.params;
    const { action } = patchSchema.parse(await req.json());

    const event = await db.securityEvent.findUnique({ where: { id } });
    if (!event) throw new ApiError("Event not found", 404);

    const status =
      action === "INVESTIGATE" ? "INVESTIGATING"
      : action === "BLOCK" ? "BLOCKED"
      : action === "SAFE" ? "SAFE"
      : "RESOLVED";

    const updated = await db.securityEvent.update({
      where: { id },
      data: { status },
    });

    await db.auditLog.create({
      data: {
        actorEmail: session.email,
        action: `EVENT_${action}`,
        detail: `${event.eventType} → ${status}`,
      },
    });

    bus.publish({ type: "event", data: updated });
    return ok({ event: updated });
  }
);
