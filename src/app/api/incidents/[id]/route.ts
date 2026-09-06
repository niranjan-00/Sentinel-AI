import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { bus } from "@/lib/events";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["INVESTIGATE", "CONTAIN", "RESOLVE", "ADD_NOTE", "ASSIGN"]).optional(),
  status: z.enum(["DETECTED", "INVESTIGATING", "CONTAINED", "RESOLVED"]).optional(),
  assignedAnalyst: z.string().max(80).optional(),
  note: z.string().min(1).max(600).optional(),
  regenerateAi: z.boolean().optional(),
});

/** Update incident workflow: investigate / contain / resolve / note / assign. */
export const PATCH = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());

    const incident = await db.incident.findUnique({ where: { id } });
    if (!incident) throw new ApiError("Incident not found", 404);

    const data: Record<string, unknown> = {};
    let noteText: string | null = null;

    if (body.status) data.status = body.status;
    else if (body.action === "INVESTIGATE") data.status = "INVESTIGATING";
    else if (body.action === "CONTAIN") data.status = "CONTAINED";
    else if (body.action === "RESOLVE") data.status = "RESOLVED";

    if (body.assignedAnalyst) data.assignedAnalyst = body.assignedAnalyst;

    if (body.note) {
      const notes = JSON.parse(incident.notes) as Array<{ author: string; text: string; at: string }>;
      noteText = body.note;
      notes.push({ author: session.name, text: body.note, at: new Date().toISOString() });
      data.notes = JSON.stringify(notes);
    }

    if (body.regenerateAi) {
      const { analyzeEvent } = await import("@/lib/ai/analysis");
      const analysis = await analyzeEvent({
        eventType: "UNAUTHORIZED_ACCESS",
        source: "INCIDENT_WORKFLOW",
        actorLabel: "masked_user_****",
        resource: incident.affectedSystem,
        maskedPayload: { incident: incident.code, severity: incident.severity, description: incident.description.slice(0, 200) },
        riskInput: {
          eventType: incident.severity === "CRITICAL" ? "DATA_EXFILRATION" : "UNAUTHORIZED_ACCESS",
          resourceSensitivity: "RESTRICTED",
          hourOfDay: new Date().getHours(),
        },
      });
      data.aiAnalysis = analysis.summary;
      data.recommendedAction = analysis.recommendation;
    }

    const updated = await db.incident.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        actorEmail: session.email,
        action: `INCIDENT_${body.action ?? body.status ?? "UPDATE"}`,
        detail: `${incident.code}${noteText ? ` — note added` : ""}`,
      },
    });

    bus.publish({ type: "incident", data: updated });
    return ok({ incident: updated });
  }
);
