import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { ensureSimulator } from "@/lib/simulator";

export const dynamic = "force-dynamic";

/** Aggregated SOC metrics + feed snapshot for the dashboard overview. */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req);
  await ensureSeeded();
  ensureSimulator();

  const since24h = new Date(Date.now() - 24 * 3600_000);

  const [totalEvents24h, blocked, criticalEvents, activeThreats, unackedCritical, sensitiveEvents, activeUsers, strong, review, legacy, totalAssets, recentEvents, alerts, openIncidents] =
    await Promise.all([
      db.securityEvent.count({ where: { timestamp: { gte: since24h } } }),
      db.securityEvent.count({ where: { status: "BLOCKED" } }),
      db.securityEvent.count({ where: { riskLevel: "CRITICAL", status: { in: ["NEW", "INVESTIGATING"] }, timestamp: { gte: since24h } } }),
      db.securityEvent.count({ where: { status: { in: ["NEW", "INVESTIGATING"] }, riskLevel: { in: ["HIGH", "CRITICAL"] } } }),
      db.securityAlert.count({ where: { acknowledged: false, severity: "CRITICAL" } }),
      db.sensitiveDataEvent.count({ where: { timestamp: { gte: since24h } } }),
      db.activeSession.count({ where: { status: { in: ["ACTIVE", "SUSPICIOUS"] } } }),
      db.quantumAssessment.count({ where: { status: "STRONG" } }),
      db.quantumAssessment.count({ where: { status: "REVIEW_REQUIRED" } }),
      db.quantumAssessment.count({ where: { status: "LEGACY" } }),
      db.quantumAssessment.count(),
      db.securityEvent.findMany({
        orderBy: { timestamp: "desc" },
        take: 25,
      }),
      db.securityAlert.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      db.incident.count({ where: { status: { in: ["DETECTED", "INVESTIGATING", "CONTAINED"] } } }),
    ]);

  // weighted security score — reacts to live incidents but stays professional at baseline
  const penalty = criticalEvents * 1.5 + Math.max(0, activeThreats - 2) * 0.25 + unackedCritical * 1.2;
  const securityScore = Math.max(52, Math.min(99, Math.round(99 - penalty)));

  const quantumReadiness = totalAssets
    ? Math.round(((strong * 1 + review * 0.5) / totalAssets) * 100)
    : 0;

  return ok({
    metrics: {
      securityScore,
      activeThreats,
      criticalAlerts: unackedCritical,
      blockedAttacks: blocked,
      sensitiveDataEvents: sensitiveEvents,
      activeUsers,
      systemsProtected: 42,
      quantumReadiness,
      totalEvents24h,
      openIncidents,
      legacyCrypto: legacy,
    },
    recentEvents,
    alerts,
  });
});
