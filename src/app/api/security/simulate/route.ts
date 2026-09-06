import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { simulateAttack, type AttackType } from "@/lib/simulator";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  attackType: z.enum([
    "BRUTE_FORCE",
    "SUSPICIOUS_LOGIN",
    "DATA_EXFILRATION",
    "UNAUTHORIZED_ACCESS",
    "AI_DATA_EXPOSURE",
    "INSIDER_THREAT",
  ]),
});

/** Threat Simulation Mode — generates a realistic multi-event attack. */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
  const { attackType } = schema.parse(await req.json());

  const result = await simulateAttack(attackType);

  await db.auditLog.create({
    data: {
      actorEmail: session.email,
      action: "SIMULATE_ATTACK",
      detail: `${result.label} — peak risk ${Math.max(...result.events.map((e) => e.riskScore))}/100${result.incidentCode ? ` — ${result.incidentCode} opened` : ""}`,
    },
  });

  return ok(result, 201);
});
