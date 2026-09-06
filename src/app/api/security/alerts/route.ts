import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  await requireRole(req);
  await ensureSeeded();
  const alerts = await db.securityAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return ok({ alerts });
});

const ackSchema = z.object({ id: z.string().min(1), acknowledged: z.boolean() });

export const PATCH = handle(async (req: NextRequest) => {
  await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
  const { id, acknowledged } = ackSchema.parse(await req.json());
  const alert = await db.securityAlert.update({
    where: { id },
    data: { acknowledged },
  });
  return ok({ alert });
});
