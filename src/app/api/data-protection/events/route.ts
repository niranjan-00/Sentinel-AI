import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** Sensitive-data protection center feed. */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req);
  await ensureSeeded();

  const [events, since24h, byType] = await Promise.all([
    db.sensitiveDataEvent.findMany({ orderBy: { timestamp: "desc" }, take: 40 }),
    db.sensitiveDataEvent.count({ where: { timestamp: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
    db.sensitiveDataEvent.groupBy({ by: ["dataType"], _count: { _all: true } }),
  ]);

  return ok({
    events,
    stats: {
      last24h: since24h,
      totalMasked: byType.reduce((a, g) => a + g._count._all, 0),
      byType: byType.map((g) => ({ type: g.dataType, count: g._count._all })).sort((a, b) => b.count - a.count),
    },
  });
});
