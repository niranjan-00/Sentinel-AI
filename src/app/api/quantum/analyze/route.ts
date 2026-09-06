import { NextRequest } from "next/server";
import { handle, ok, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { quantumRecommendations } from "@/lib/ai/analysis";

export const dynamic = "force-dynamic";

/** Re-run the AI quantum-readiness briefing over the current inventory. */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);

  const assets = await db.quantumAssessment.findMany();
  if (assets.length === 0) throw new ApiError("No cryptographic assets inventoried", 404);

  const { summary, model } = await quantumRecommendations(
    assets.map((a) => ({
      systemName: a.systemName,
      encryption: a.encryption,
      status: a.status,
      quantumRisk: a.quantumRisk,
    }))
  );

  await db.auditLog.create({
    data: { actorEmail: session.email, action: "QUANTUM_ANALYZE", detail: `AI briefing regenerated (${model})` },
  });

  return ok({
    summary,
    model,
    disclaimer:
      "Quantum-Safe Readiness Assessment — evaluative guidance only, not an implementation of quantum-safe cryptography.",
  });
});
