import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { analyzeEvent } from "@/lib/ai/analysis";
import { maskObject } from "@/lib/mask";

export const dynamic = "force-dynamic";

/** Spec alias — AI analysis endpoint (same engine as /api/security/analyze). */
export const POST = handle(async (req: NextRequest) => {
  await requireRole(req);
  const body = (await req.json()) as Record<string, unknown>;
  const { payload: maskedPayload, findings } = maskObject(
    (body.payload as Record<string, unknown>) ?? {}
  );

  const analysis = await analyzeEvent({
    eventType: String(body.eventType ?? "UNAUTHORIZED_ACCESS"),
    source: String(body.source ?? "MANUAL"),
    actorLabel: "masked_user_****",
    resource: body.resource ? String(body.resource) : null,
    location: body.location ? String(body.location) : null,
    maskedPayload,
    riskInput: {
      eventType: String(body.eventType ?? "UNAUTHORIZED_ACCESS"),
      resourceSensitivity: (body.resourceSensitivity as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED") ?? "CONFIDENTIAL",
      failedAttempts: Number(body.failedAttempts ?? 0),
      dataVolumeMb: Number(body.dataVolumeMb ?? 0),
      knownLocation: Boolean(body.knownLocation ?? true),
      newDevice: Boolean(body.newDevice ?? false),
    },
  });

  return ok({ ...analysis, piiMaskedTypes: findings.map((f) => f.type) });
});
