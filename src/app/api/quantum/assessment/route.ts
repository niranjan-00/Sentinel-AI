import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** Quantum-Safe Readiness Assessment — inventory + score + distribution. */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req);
  await ensureSeeded();

  const assets = await db.quantumAssessment.findMany({
    orderBy: [{ quantumRisk: "desc" }, { systemName: "asc" }],
  });

  const total = assets.length;
  const strong = assets.filter((a) => a.status === "STRONG").length;
  const review = assets.filter((a) => a.status === "REVIEW_REQUIRED").length;
  const legacy = assets.filter((a) => a.status === "LEGACY").length;
  const readiness = total ? Math.round(((strong * 1 + review * 0.5) / total) * 100) : 0;

  return ok({
    assets,
    readiness,
    distribution: { strong, review, legacy, total },
    disclaimer:
      "Quantum-Safe Readiness Assessment — this is an evaluative inventory of cryptographic assets and migration planning guidance. It does not implement quantum-safe cryptography.",
  });
});
