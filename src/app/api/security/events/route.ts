import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { ensureSimulator } from "@/lib/simulator";
import { ingestSecurityEvent } from "@/lib/events";
import { maskObject } from "@/lib/mask";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  eventType: z.string().min(3).max(40),
  source: z.string().min(2).max(40),
  actor: z.string().max(120).optional(),
  ipAddress: z.string().max(60).optional(),
  location: z.string().max(80).optional(),
  resource: z.string().max(120).optional(),
  resourceSensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).optional(),
  description: z.string().min(3).max(400),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const GET = handle(async (req: NextRequest) => {
  await ensureSeeded();
  await requireRole(req); // any authenticated role can read
  ensureSimulator();

  const url = new URL(req.url);
  const level = url.searchParams.get("level");
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const q = url.searchParams.get("q");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 80), 300);

  const where: Record<string, unknown> = {};
  if (level) where.riskLevel = level;
  if (status) where.status = status;
  if (type) where.eventType = type;
  if (q) where.OR = [
    { description: { contains: q } },
    { actorLabel: { contains: q } },
    { resource: { contains: q } },
    { location: { contains: q } },
  ];

  const events = await db.securityEvent.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit,
  });
  return ok({ events });
});

/** Manual event ingestion (used by integrations / demo ingestion form). */
export const POST = handle(async (req: NextRequest) => {
  await ensureSeeded();
  const session = await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
  const body = createSchema.parse(await req.json());

  // sample of the incoming payload before masking (for the privacy demo)
  const raw = body.payload ?? {};
  const { findings } = maskObject(raw);

  const result = await ingestSecurityEvent({
    ...body,
    rawPayload: raw,
  });

  await db.auditLog.create({
    data: {
      actorEmail: session.email,
      action: "EVENT_INGEST",
      detail: `Ingested ${body.eventType} (risk ${result.riskScore}) — ${findings.length} PII type(s) masked`,
    },
  });

  return ok({ event: result, maskedFindings: findings }, 201);
});
