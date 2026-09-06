import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { activeProvider } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/** Which AI provider is currently wired up (never exposes keys). */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req);
  const provider = activeProvider();
  return ok({
    provider,
    label:
      provider === "openai" ? "OpenAI (OPENAI_API_KEY)"
      : provider === "groq" ? "Groq (GROQ_API_KEY)"
      : provider === "ollama" ? `Ollama (${process.env.OLLAMA_BASE_URL})`
      : "Platform AI runtime (z-ai-web-dev-sdk)",
    mockFallback:
      "If no provider is reachable, the deterministic sentinel-rules-v1 engine takes over — the platform stays fully functional.",
  });
});
