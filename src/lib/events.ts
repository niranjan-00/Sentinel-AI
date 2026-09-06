/**
 * SENTINEL AI — Event Bus + Security Event Service
 * ------------------------------------------------
 * Pipeline:  ingestion → sensitive-data masking → AI anomaly detection →
 *            risk scoring → alert engine → SSE fan-out → dashboard/response
 */

import { db } from "@/lib/db";
import { maskObject, anonymizeActor, maskIp } from "@/lib/mask";
import { scoreRisk, type RiskInput, levelOf } from "@/lib/risk-engine";
import { analyzeEvent } from "@/lib/ai/analysis";

/* ------------------------------- event bus ------------------------------- */

export interface BusMessage {
  type: "event" | "alert" | "incident" | "hello" | "heartbeat";
  data?: unknown;
}

type Listener = (msg: BusMessage) => void;

class EventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  publish(msg: BusMessage) {
    for (const fn of this.listeners) {
      try {
        fn(msg);
      } catch {
        /* a dead SSE client must never break ingestion */
      }
    }
  }

  get subscriberCount() {
    return this.listeners.size;
  }
}

const globalForBus = globalThis as unknown as {
  __sentinelBus: EventBus | undefined;
};
export const bus: EventBus = globalForBus.__sentinelBus ?? new EventBus();
globalForBus.__sentinelBus = bus;

/* ----------------------------- event creation ---------------------------- */

export interface IngestEventInput {
  eventType: string;
  source: string;
  /** raw identifier — will be masked/anonymized before storage */
  actor?: string;
  ipAddress?: string;
  location?: string;
  resource?: string;
  resourceSensitivity?: RiskInput["resourceSensitivity"];
  description: string;
  rawPayload?: Record<string, unknown>;
  status?: string;
  riskInput?: Partial<RiskInput>;
  /** skip AI narrative (used for high-volume background noise) */
  skipAi?: boolean;
  timestamp?: Date;
}

export interface IngestResult {
  id: string;
  eventType: string;
  riskScore: number;
  riskLevel: string;
  status: string;
  aiSummary: string | null;
  recommendation: string | null;
}

/**
 * Central ingestion point. Masks sensitive fields, scores risk, persists,
 * raises alerts for HIGH/CRITICAL and fans out over SSE.
 */
export async function ingestSecurityEvent(
  input: IngestEventInput
): Promise<IngestResult> {
  // 1. mask payload + actor before anything else sees it
  const { payload: maskedPayload, findings } = maskObject(
    input.rawPayload ?? {}
  );
  const actorLabel = input.actor ? anonymizeActor(input.actor) : "masked_user_****";
  const maskedIp = input.ipAddress ? maskIp(input.ipAddress) : null;

  // record sensitive-data interception (privacy-aware pipeline)
  if (findings.length > 0) {
    await db.sensitiveDataEvent.create({
      data: {
        dataType: findings[0].type,
        maskedSample: findings[0].masked,
        exposurePoint: "EVENT_INGESTION",
        actionTaken: "MASKED",
        riskLevel: "MEDIUM",
        timestamp: input.timestamp ?? new Date(),
      },
    });
  }

  // 2. risk scoring on structural features only
  const now = input.timestamp ?? new Date();
  const risk = scoreRisk({
    eventType: input.eventType,
    hourOfDay: now.getHours(),
    isWeekend: [0, 6].includes(now.getDay()),
    resourceSensitivity: input.resourceSensitivity,
    aiServiceAccess: input.eventType === "AI_DATA_EXPOSURE",
    ...input.riskInput,
  });

  // 3. persist (masked only)
  const event = await db.securityEvent.create({
    data: {
      eventType: input.eventType,
      source: input.source,
      actorLabel,
      ipAddress: maskedIp,
      location: input.location ?? null,
      resource: input.resource ?? null,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      status: input.status ?? "NEW",
      description: input.description,
      maskedPayload: JSON.stringify({
        ...maskedPayload,
        _piiMasked: findings.length,
        _actor: actorLabel,
      }),
      timestamp: now,
    },
  });

  // 4. AI analysis layer (skipped for background noise)
  let aiSummary: string | null = null;
  let recommendation: string | null = null;
  if (!input.skipAi && risk.riskScore > 30) {
    const analysis = await analyzeEvent({
      eventType: input.eventType,
      source: input.source,
      actorLabel,
      resource: input.resource,
      location: input.location,
      maskedPayload,
      riskInput: {
        eventType: input.eventType,
        hourOfDay: now.getHours(),
        resourceSensitivity: input.resourceSensitivity,
        ...input.riskInput,
      },
    });
    aiSummary = analysis.summary;
    recommendation = analysis.recommendation;
    await db.securityEvent.update({
      where: { id: event.id },
      data: { aiSummary, recommendation },
    });
  }

  // 5. alert engine
  if (risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL") {
    const alert = await db.securityAlert.create({
      data: {
        title: `${risk.riskLevel} — ${input.eventType.replace(/_/g, " ")}`,
        message: `${input.description} (actor ${actorLabel}, risk ${risk.riskScore}/100)`,
        severity: risk.riskLevel,
        eventId: event.id,
      },
    });
    bus.publish({ type: "alert", data: alert });
  }

  // 6. fan out
  const row = { ...event, aiSummary, recommendation };
  bus.publish({ type: "event", data: row });

  return {
    id: event.id,
    eventType: event.eventType,
    riskScore: event.riskScore,
    riskLevel: event.riskLevel,
    status: event.status,
    aiSummary,
    recommendation,
  };
}

export { levelOf };
