import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { bus } from "@/lib/events";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req);
  await ensureSeeded();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const incidents = await db.incident.findMany({
    where: status ? { status } : undefined,
    orderBy: { detectionTime: "desc" },
  });
  return ok({ incidents });
});

const createSchema = z.object({
  title: z.string().min(4).max(140),
  description: z.string().min(4).max(2000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  affectedSystem: z.string().min(2).max(120),
});

export const POST = handle(async (req: NextRequest) => {
  const session = await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
  const body = createSchema.parse(await req.json());
  const count = await db.incident.count();
  const incident = await db.incident.create({
    data: {
      ...body,
      code: `INC-2026-${String(count + 1).padStart(3, "0")}`,
      status: "DETECTED",
      aiAnalysis: "Pending AI analysis — run investigation to generate.",
      recommendedAction: "Triage severity, assign an analyst and begin investigation.",
    },
  });
  await db.auditLog.create({
    data: { actorEmail: session.email, action: "INCIDENT_CREATE", detail: `${incident.code} — ${incident.title}` },
  });
  bus.publish({ type: "incident", data: incident });
  return ok({ incident }, 201);
});
