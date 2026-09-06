import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { analyzeEvent } from "@/lib/ai/analysis";
import { maskObject } from "@/lib/mask";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventType: z.string().min(2).max(40).default("UNAUTHORIZED_ACCESS"),
  source: z.string().min(2).max(40).default("MANUAL"),
  actor: z.string().max(120).optional(),
  resource: z.string().max(120).optional(),
  location: z.string().max(80).optional(),
  hourOfDay: z.number().int().min(0).max(23).optional(),
  knownLocation: z.boolean().optional(),
  newDevice: z.boolean().optional(),
  failedAttempts: z.number().int().min(0).max(50).optional(),
  dataVolumeMb: z.number().min(0).max(1_000_000).optional(),
  requestsPerMin: z.number().int().min(0).max(100_000).optional(),
  resourceSensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).optional(),
  offNetwork: z.boolean().optional(),
  aiServiceAccess: z.boolean().optional(),
  velocityCountries: z.number().int().min(0).max(20).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/**
 * AI anomaly detection — accepts behavioural features (NOT raw identities),
 * masks any payload, returns risk score 0-100 + anomalies + recommendation.
 */
export const POST = handle(async (req: NextRequest) => {
  await requireRole(req);
  const body = schema.parse(await req.json());

  const { payload: maskedPayload, findings } = maskObject(body.payload ?? {});

  const analysis = await analyzeEvent({
    eventType: body.eventType,
    source: body.source,
    actorLabel: body.actor ? "masked_user_****" : "masked_user_****",
    resource: body.resource,
    location: body.location,
    maskedPayload,
    riskInput: {
      eventType: body.eventType,
      hourOfDay: body.hourOfDay,
      knownLocation: body.knownLocation,
      newDevice: body.newDevice,
      failedAttempts: body.failedAttempts,
      dataVolumeMb: body.dataVolumeMb,
      requestsPerMin: body.requestsPerMin,
      resourceSensitivity: body.resourceSensitivity,
      offNetwork: body.offNetwork,
      aiServiceAccess: body.aiServiceAccess,
      velocityCountries: body.velocityCountries,
    },
  });

  return ok({ ...analysis, piiMaskedTypes: findings.map((f) => f.type) });
});
