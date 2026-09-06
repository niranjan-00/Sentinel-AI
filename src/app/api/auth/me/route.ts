import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  await ensureSeeded();
  const session = await getSession(req);
  if (!session) return ok({ user: null });
  const user = await db.user
    .findUnique({
      where: { id: session.id },
      select: {
        id: true, email: true, name: true, role: true, status: true,
        department: true, mfaEnabled: true, lastLoginAt: true, riskScore: true,
      },
    })
    .catch(() => null);
  return ok({ user: user ?? session });
});
