/**
 * SENTINEL AI — AI Security Analysis Layer
 * ----------------------------------------
 * 1. scoreRisk()            → deterministic anomaly detection (always runs)
 * 2. llmChat()              → narrative analysis when a provider is reachable
 * 3. mock templates below   → full functionality with zero external dependencies
 *
 * PRIVACY RULE: every prompt sent to the LLM is built ONLY from masked /
 * structural data. See src/lib/mask.ts — masking happens upstream of this file.
 */

import { db } from "@/lib/db";
import { llmChat, type ChatMessage } from "./provider";
import { scoreRisk, levelOf, type RiskInput, type RiskResult } from "@/lib/risk-engine";

export interface EventAnalysis {
  riskScore: number;
  riskLevel: string;
  anomalies: string[];
  summary: string;
  recommendation: string;
  model: string;
}

/** Build the deterministic template summary (mock engine). */
export function mockEventSummary(
  eventType: string,
  result: RiskResult,
  actor: string,
  resource?: string | null,
  location?: string | null
): string {
  const top = [...result.factors].sort((a, b) => b.points - a.points).slice(0, 3);
  const why = top.map((f) => f.label.toLowerCase()).join("; ");
  const parts = [
    `A ${result.riskLevel.toLowerCase()}-risk ${eventType.replace(/_/g, " ").toLowerCase()} was detected for actor ${actor}`,
    resource ? `targeting ${resource}` : null,
    location ? `from ${location}` : null,
    `. Risk score ${result.riskScore}/100 driven by: ${why}.`,
  ];
  if (result.anomalies.length > 0) {
    parts.push(`Key anomalies: ${result.anomalies.slice(0, 3).join("; ")}.`);
  }
  return parts.join("");
}

/** Analyze a security event: rule engine + optional LLM narrative. */
export async function analyzeEvent(input: {
  eventType: string;
  source: string;
  actorLabel: string;
  resource?: string | null;
  location?: string | null;
  maskedPayload: Record<string, unknown>;
  riskInput: RiskInput;
}): Promise<EventAnalysis> {
  const result = scoreRisk(input.riskInput);

  let summary = mockEventSummary(
    input.eventType,
    result,
    input.actorLabel,
    input.resource,
    input.location
  );
  let model = "sentinel-rules-v1";

  // Narrative enrichment via LLM — masked data only.
  const llm = await llmChat([
    {
      role: "system",
      content:
        "You are SENTINEL, an enterprise cybersecurity analysis engine. You receive MASKED security telemetry (no raw PII — identifiers are anonymized like masked_user_****). Write a concise 2-3 sentence SOC analyst briefing: what happened, why it is risky, and the single most important next action. Never invent unmasked identities, emails, card numbers or credentials.",
    },
    {
      role: "user",
      content: JSON.stringify({
        eventType: input.eventType,
        source: input.source,
        actor: input.actorLabel,
        resource: input.resource ?? "unknown",
        location: input.location ?? "unknown",
        computedRisk: { score: result.riskScore, level: result.riskLevel },
        detectedAnomalies: result.anomalies,
        riskFactors: result.factors,
        maskedPayload: input.maskedPayload,
      }),
    },
  ]);

  if (llm?.content) {
    summary = llm.content.trim();
    model = llm.model;
  }

  await db.aIAnalysis.create({
    data: {
      targetType: "EVENT",
      summary,
      anomalies: JSON.stringify(result.anomalies),
      recommendation: result.recommendation,
      riskScore: result.riskScore,
      model,
    },
  });

  return {
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    anomalies: result.anomalies,
    summary,
    recommendation: result.recommendation,
    model,
  };
}

/** Free-form assistant with security-grounded context. */
export async function assistantReply(
  userMessage: string,
  context: {
    metrics: Record<string, unknown>;
    recentEvents: Array<Record<string, unknown>>;
    openIncidents: Array<Record<string, unknown>>;
  }
): Promise<{ reply: string; model: string }> {
  const system: ChatMessage = {
    role: "assistant",
    content:
      "You are SENTINEL ASSISTANT, the embedded AI security analyst of the Sentinel AI platform. Answer SOC questions (why is this alert critical, what caused this anomaly, biggest risks today, how to reduce risk, explain this incident) using ONLY the masked context provided. Never reveal raw sensitive data, passwords, card numbers or true identities — actors appear as masked_user_****. Be concise (max ~120 words), factual and action-oriented.",
  };

  const llm = await llmChat([
    system,
    {
      role: "user",
      content: `MASKED SECURITY CONTEXT:\n${JSON.stringify({
        metrics: context.metrics,
        recentEvents: context.recentEvents.slice(0, 12),
        openIncidents: context.openIncidents.slice(0, 5),
      })}\n\nQUESTION: ${userMessage}`,
    },
  ]);

  if (llm?.content) return { reply: llm.content.trim(), model: llm.model };
  return { reply: mockAssistantReply(userMessage, context), model: "sentinel-rules-v1" };
}

type ChatMessageLike = { role: "system" | "user" | "assistant"; content: string };

/** Deterministic mock assistant — keyword-driven, context-aware. */
function mockAssistantReply(
  q: string,
  ctx: {
    metrics: Record<string, unknown>;
    recentEvents: Array<Record<string, unknown>>;
    openIncidents: Array<Record<string, unknown>>;
  }
): string {
  const lower = q.toLowerCase();
  const m = ctx.metrics;
  const events = ctx.recentEvents;
  const top = events.find((e) => String(e.riskLevel) === "CRITICAL") ??
    events.find((e) => String(e.riskLevel) === "HIGH");
  const topEvent = top
    ? `${String(top.eventType).replace(/_/g, " ").toLowerCase()} on ${String(top.resource ?? "a protected resource")} (risk ${String(top.riskScore)}/100, actor ${String(top.actorLabel ?? "masked_user_****")})`
    : "no critical events in the current window";

  if (lower.includes("flag") || lower.includes("why") || lower.includes("anomal") || lower.includes("explain")) {
    return `Analysis: the highest-priority activity is ${topEvent}. It was flagged because the behavioural engine detected deviations from the actor's baseline (location/device/time) combined with elevated data or request volume. The session was assigned a HIGH risk band and recommended action is step-up authentication plus session review. All identifiers remain masked (privacy-aware AI).`;
  }
  if (lower.includes("biggest") || lower.includes("today") || lower.includes("top") || lower.includes("risk")) {
    return `Today's biggest risks: ${topEvent}; active threats ${String(m.activeThreats ?? 0)}, critical alerts ${String(m.criticalAlerts ?? 0)}. Recommended focus: contain the critical session, audit RESTRICTED-class data access, and enforce MFA on the flagged accounts. Security score is ${String(m.securityScore ?? "—")}/100.`;
  }
  if (lower.includes("reduce") || lower.includes("improve") || lower.includes("recommend")) {
    const qr = Number(m.quantumReadiness ?? 68);
    return `To reduce risk: 1) enforce MFA on all accounts with HIGH recent risk; 2) block sessions with impossible-travel anomalies; 3) rotate ${qr < 80 ? "the legacy RSA/ECC cryptographic assets flagged in Quantum Readiness" : "expiring credentials"}; 4) tighten DLP rules on export endpoints — sensitive-data events are being auto-masked before AI processing.`;
  }
  if (lower.includes("incident")) {
    const inc = ctx.openIncidents[0];
    return inc
      ? `Open incident ${String(inc.code)} — ${String(inc.title)} (severity ${String(inc.severity)}, status ${String(inc.status)}). AI analysis: ${String(inc.aiAnalysis ?? "pending").slice(0, 220)} Recommended: ${String(inc.recommendedAction ?? "investigate affected system and contain lateral movement.")}`
      : "No open incidents — the platform is operating within normal risk bounds.";
  }
  return `Security posture: score ${String(m.securityScore ?? "—")}/100, ${String(m.activeThreats ?? 0)} active threats, ${String(m.blockedAttacks ?? 0)} attacks blocked in 24h, quantum readiness ${String(m.quantumReadiness ?? 68)}%. Most significant item: ${topEvent}. Ask me about a specific alert, anomaly, incident, or how to reduce risk.`;
}

/** Quantum-safe readiness recommendations (assessment only — clearly labelled). */
export async function quantumRecommendations(
  assets: Array<{ systemName: string; encryption: string; status: string; quantumRisk: string }>
): Promise<{ summary: string; model: string }> {
  const legacy = assets.filter((a) => a.status === "LEGACY");
  const review = assets.filter((a) => a.status === "REVIEW_REQUIRED");
  const fallback = `Assessment: ${legacy.length} legacy and ${review.length} review-required cryptographic assets detected. Legacy RSA/ECC deployments carry harvest-now-decrypt-later exposure and should be prioritised for migration planning toward NIST PQC standards (ML-KEM / ML-DSA) with crypto-agility. Recommended sequence: inventory → vendor PQC roadmap confirmation → hybrid TLS pilots on non-critical paths → staged migration of Payment API and gateway certificates. This is a readiness assessment, not an implementation of quantum-safe cryptography.`;

  const llm = await llmChat([
    {
      role: "system",
      content:
        "You are SENTINEL's quantum-readiness advisor. Given a cryptographic asset inventory, produce a 3-4 sentence migration-priority briefing. Clearly frame output as an assessment (no claims of implementing quantum-safe crypto). Mention NIST PQC (ML-KEM/ML-DSA) and harvest-now-decrypt-later where relevant.",
    },
    { role: "user", content: JSON.stringify(assets) },
  ]);

  return { summary: llm?.content?.trim() || fallback, model: llm?.model || "sentinel-rules-v1" };
}
