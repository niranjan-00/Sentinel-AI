import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** IAM user directory. Password hashes are never returned. */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, ["ADMIN", "SECURITY_ANALYST"]);
  await ensureSeeded();

  const url = new URL(req.url);
  const q = url.searchParams.get("q");

  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
            { department: { contains: q } },
          ],
        }
      : undefined,
    select: {
      id: true, email: true, name: true, role: true, status: true,
      department: true, riskScore: true, mfaEnabled: true, lastLoginAt: true,
    },
    orderBy: { riskScore: "desc" },
    take: 100,
  });

  return ok({ users });
});
