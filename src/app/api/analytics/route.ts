import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** Chart datasets for Threat Analytics. */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req);
  await ensureSeeded();

  const since = new Date(Date.now() - 24 * 3600_000);

  const [events, typeGroups, resourceGroups, actorGroups, regionGroups, dataGroups] =
    await Promise.all([
      db.securityEvent.findMany({
        where: { timestamp: { gte: since } },
        select: { timestamp: true, riskLevel: true },
      }),
      db.securityEvent.groupBy({
        by: ["eventType"],
        _count: { _all: true },
        orderBy: { _count: { eventType: "desc" } },
        take: 7,
      }),
      db.securityEvent.groupBy({
        by: ["resource"],
        _count: { _all: true },
        where: { resource: { not: null } },
        orderBy: { _count: { resource: "desc" } },
        take: 6,
      }),
      db.securityEvent.groupBy({
        by: ["actorLabel"],
        _avg: { riskScore: true },
        _count: { _all: true },
        where: { actorLabel: { not: null } },
        orderBy: { _avg: { riskScore: "desc" } },
        take: 6,
      }),
      db.securityEvent.groupBy({
        by: ["location"],
        _count: { _all: true },
        where: { location: { not: null } },
        orderBy: { _count: { location: "desc" } },
        take: 8,
      }),
      db.sensitiveDataEvent.groupBy({
        by: ["dataType"],
        _count: { _all: true },
        orderBy: { _count: { dataType: "desc" } },
      }),
    ]);

  // hourly buckets, last 24h
  const timeline: Array<{ hour: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }> = [];
  const now = new Date();
  now.setMinutes(0, 0, 0);
  for (let i = 23; i >= 0; i--) {
    const start = new Date(now.getTime() - i * 3600_000);
    const end = new Date(start.getTime() + 3600_000);
    const bucket = { hour: `${String(start.getHours()).padStart(2, "0")}:00`, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const e of events) {
      const t = new Date(e.timestamp);
      if (t >= start && t < end && e.riskLevel in bucket) {
        bucket[e.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"] += 1;
      }
    }
    timeline.push(bucket);
  }

  const riskDistribution = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((level) => ({
    level,
    count: events.filter((e) => e.riskLevel === level).length,
  }));

  return ok({
    timeline,
    riskDistribution,
    attackTypes: typeGroups.map((g) => ({ type: g.eventType, count: g._count._all })),
    topSystems: resourceGroups.map((g) => ({ system: g.resource ?? "unknown", count: g._count._all })),
    riskyUsers: actorGroups.map((g) => ({
      actor: g.actorLabel ?? "masked_user_****",
      avgRisk: Math.round(g._avg.riskScore ?? 0),
      events: g._count._all,
    })),
    regions: regionGroups.map((g) => ({ region: g.location ?? "Unknown", count: g._count._all })),
    dataTypes: dataGroups.map((g) => ({ type: g.dataType, count: g._count._all })),
  });
});
