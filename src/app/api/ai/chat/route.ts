import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { assistantReply } from "@/lib/ai/analysis";
import { maskSensitiveData } from "@/lib/mask";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .optional(),
});

/**
 * SENTINEL ASSISTANT — secure AI chat.
 * The user message is masked before it reaches any model; the model context is
 * built exclusively from aggregated, masked security data.
 */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireRole(req);
  await ensureSeeded();

  if (!rateLimit(`ai-chat:${session.id}`, 20, 60_000)) {
    throw new ApiError("Assistant rate limit reached — try again shortly", 429);
  }

  const body = schema.parse(await req.json());

  // privacy-aware input handling: mask PII typed by the user before inference
  const { masked: maskedMessage, findings } = maskSensitiveData(body.message);

  const since24h = new Date(Date.now() - 24 * 3600_000);
  const [criticalEvents, activeThreats, unackedCritical, blocked, sensitiveEvents, recentEvents, openIncidents] =
    await Promise.all([
      db.securityEvent.count({ where: { riskLevel: "CRITICAL", status: { in: ["NEW", "INVESTIGATING"] }, timestamp: { gte: since24h } } }),
      db.securityEvent.count({ where: { status: { in: ["NEW", "INVESTIGATING"] }, riskLevel: { in: ["HIGH", "CRITICAL"] } } }),
      db.securityAlert.count({ where: { acknowledged: false, severity: "CRITICAL" } }),
      db.securityEvent.count({ where: { status: "BLOCKED" } }),
      db.sensitiveDataEvent.count({ where: { timestamp: { gte: since24h } } }),
      db.securityEvent.findMany({
        orderBy: { timestamp: "desc" },
        take: 14,
        select: {
          eventType: true, actorLabel: true, resource: true, location: true,
          riskScore: true, riskLevel: true, status: true, description: true, timestamp: true,
        },
      }),
      db.incident.findMany({
        where: { status: { in: ["DETECTED", "INVESTIGATING", "CONTAINED"] } },
        take: 4,
        select: { code: true, title: true, severity: true, status: true, aiAnalysis: true, recommendedAction: true },
      }),
    ]);

  const { reply, model } = await assistantReply(maskedMessage, {
    metrics: {
      securityScore: Math.max(52, 99 - (criticalEvents * 1.5 + Math.max(0, activeThreats - 2) * 0.25 + unackedCritical * 1.2)),
      activeThreats,
      criticalAlerts: unackedCritical,
      blockedAttacks: blocked,
      sensitiveDataEvents: sensitiveEvents,
      quantumReadiness: 69,
    },
    recentEvents,
    openIncidents,
  });

  return ok({
    reply,
    model,
    privacyNote: findings.length
      ? `${findings.length} sensitive pattern(s) in your message were masked before AI processing (${findings.map((f) => f.type).join(", ")}).`
      : null,
  });
});
