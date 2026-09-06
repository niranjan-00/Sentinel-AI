import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { maskSensitiveData } from "@/lib/mask";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().min(1).max(5000) });

/**
 * Data-masking playground: paste sample text, receive the masked form plus the
 * detected PII types. Demonstrates exactly what the AI layer is allowed to see.
 */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireRole(req);
  if (!rateLimit(`mask:${session.id}`, 30, 60_000)) {
    throw new ApiError("Rate limit reached", 429);
  }
  const { text } = schema.parse(await req.json());
  const result = maskSensitiveData(text);

  // audit that masking occurred (no raw text is stored)
  await db.auditLog.create({
    data: {
      actorEmail: session.email,
      action: "DATA_MASK",
      detail: `Masked ${result.totalMasked} finding(s): ${result.findings.map((f) => f.type).join(", ") || "none"}`,
    },
  }).catch(() => {});

  return ok({
    masked: result.masked,
    findings: result.findings,
    totalMasked: result.totalMasked,
    aiView: result.masked.slice(0, 2000),
  });
});
