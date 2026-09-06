/**
 * SENTINEL AI — Threat Simulation Engine
 * --------------------------------------
 * Powers the hackathon "SIMULATE ATTACK" demo mode plus low-volume background
 * telemetry so the live feed always breathes. Single instance guarded via
 * globalThis (survives dev hot reloads).
 */

import { db } from "@/lib/db";
import { ingestSecurityEvent, bus } from "@/lib/events";
import type { IngestResult } from "@/lib/events";
import { hashPassword } from "@/lib/auth";

export type AttackType =
  | "BRUTE_FORCE"
  | "SUSPICIOUS_LOGIN"
  | "DATA_EXFILRATION"
  | "UNAUTHORIZED_ACCESS"
  | "AI_DATA_EXPOSURE"
  | "INSIDER_THREAT";

export const ATTACK_LABELS: Record<AttackType, string> = {
  BRUTE_FORCE: "Brute Force Attack",
  SUSPICIOUS_LOGIN: "Suspicious Login",
  DATA_EXFILRATION: "Data Exfiltration",
  UNAUTHORIZED_ACCESS: "Unauthorized Access",
  AI_DATA_EXPOSURE: "AI Data Exposure Attempt",
  INSIDER_THREAT: "Insider Threat",
};

/* --------------------------- background simulator ------------------------- */

const globalForSim = globalThis as unknown as {
  __sentinelSimulator: NodeJS.Timeout | undefined;
};

const LOCATIONS = [
  "Mumbai, IN", "Bengaluru, IN", "New York, US", "London, UK", "Singapore, SG",
  "Frankfurt, DE", "São Paulo, BR", "Sydney, AU", "Toronto, CA", "Tokyo, JP",
];
const RESOURCES = [
  "customer_financial_data", "customer_pii_index", "payment_gateway_logs",
  "hr_employee_records", "api_gateway_audit", "ml_feature_store",
  "billing_export_service", "internal_wiki", "fraud_model_registry",
];
const SENSITIVITY: Record<string, "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED"> = {
  customer_financial_data: "RESTRICTED",
  customer_pii_index: "RESTRICTED",
  payment_gateway_logs: "CONFIDENTIAL",
  hr_employee_records: "RESTRICTED",
  api_gateway_audit: "INTERNAL",
  ml_feature_store: "CONFIDENTIAL",
  billing_export_service: "CONFIDENTIAL",
  internal_wiki: "INTERNAL",
  fraud_model_registry: "RESTRICTED",
};

const NOISE_EVENTS: Array<{ type: string; source: string; desc: string }> = [
  { type: "FAILED_LOGIN", source: "AUTH_SERVICE", desc: "Failed login attempt — invalid credentials" },
  { type: "POLICY_VIOLATION", source: "DLP", desc: "File transfer policy warning on endpoint" },
  { type: "SUSPICIOUS_LOGIN", source: "IAM", desc: "Login from new device within known region" },
  { type: "UNAUTHORIZED_ACCESS", source: "IAM", desc: "Access attempt to role-restricted resource" },
  { type: "MALWARE", source: "ENDPOINT", desc: "Quarantined malware signature on workstation" },
];

export function ensureSimulator() {
  if (globalForSim.__sentinelSimulator) return;
  globalForSim.__sentinelSimulator = setInterval(
    async () => {
      try {
        if (Math.random() > 0.72) {
          const n = NOISE_EVENTS[Math.floor(Math.random() * NOISE_EVENTS.length)];
          const resource = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
          await ingestSecurityEvent({
            eventType: n.type,
            source: n.source,
            actor: `sim.user${Math.ceil(Math.random() * 900) + 99}@sentinelcorp.io`,
            ipAddress: `${103 + Math.floor(Math.random() * 120)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.ceil(Math.random() * 250)}`,
            location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
            resource,
            resourceSensitivity: SENSITIVITY[resource],
            description: n.desc,
            rawPayload: { device: "DVK-****", session: "sess_***" + Math.floor(Math.random() * 9000 + 1000) },
            riskInput: {
              failedAttempts: n.type === "FAILED_LOGIN" ? Math.ceil(Math.random() * 3) : 0,
              newDevice: n.type === "SUSPICIOUS_LOGIN",
              knownLocation: Math.random() > 0.4,
              dataVolumeMb: Math.random() * 60,
              requestsPerMin: Math.ceil(Math.random() * 30),
            },
            skipAi: true,
          });
        }
        // keep session presence fresh
        const sessions = await db.activeSession.findMany({ where: { status: "ACTIVE" }, take: 8 });
        if (sessions.length > 0) {
          const s = sessions[Math.floor(Math.random() * sessions.length)];
          await db.activeSession.update({
            where: { id: s.id },
            data: { lastActivity: new Date() },
          });
        }
      } catch (err) {
        console.error("[simulator]", err);
      }
    },
    14_000
  );
  console.log("[sentinel] background telemetry simulator started");
}

/* ---------------------------- attack scenarios --------------------------- */

export interface SimulationResult {
  attackType: AttackType;
  label: string;
  events: IngestResult[];
  incidentCode: string | null;
  headline: string;
  aiSummary: string;
  recommendation: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randIp(): string {
  return `${pick([45, 103, 185, 203, 91])}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.ceil(Math.random() * 250)}`;
}

export async function simulateAttack(type: AttackType): Promise<SimulationResult> {
  const result: SimulationResult = {
    attackType: type,
    label: ATTACK_LABELS[type],
    events: [],
    incidentCode: null,
    headline: "",
    aiSummary: "",
    recommendation: "",
  };

  switch (type) {
    case "BRUTE_FORCE": {
      const ip = randIp();
      const actor = "svc.contractor@vendor-partner.io";
      for (let i = 1; i <= 6; i++) {
        const r = await ingestSecurityEvent({
          eventType: i < 5 ? "FAILED_LOGIN" : "BRUTE_FORCE",
          source: "AUTH_SERVICE",
          actor,
          ipAddress: ip,
          location: "Unknown / Tor exit node",
          resource: "sso_portal",
          resourceSensitivity: "INTERNAL",
          description: i < 5 ? `Failed login attempt ${i} of 6 — invalid credentials` : "Brute-force pattern confirmed — 6 failures from one origin",
          rawPayload: { attempt: i, user_agent: "python-requests/2.31", mfa: false },
          riskInput: { failedAttempts: i, newDevice: true, knownLocation: false, requestsPerMin: 48 + i * 9, offNetwork: true },
          status: i < 5 ? "NEW" : "BLOCKED",
        });
        result.events.push(r);
      }
      result.headline = "Brute-force attack on SSO portal blocked after 6 failed attempts";
      break;
    }
    case "SUSPICIOUS_LOGIN": {
      const r = await ingestSecurityEvent({
        eventType: "SUSPICIOUS_LOGIN",
        source: "IAM",
        actor: "d.mercer@sentinelcorp.io",
        ipAddress: randIp(),
        location: pick(["Bucharest, RO", "Lagos, NG", "Hanoi, VN"]),
        resource: "salesforce_bridge",
        resourceSensitivity: "CONFIDENTIAL",
        description: "Login from an unfamiliar location with an unrecognised device",
        rawPayload: { known_devices: 0, previous_location: "Bengaluru, IN" },
        riskInput: { knownLocation: false, newDevice: true, offNetwork: true, velocityCountries: 2 },
      });
      result.events.push(r);
      result.headline = "Suspicious login from unfamiliar location — MFA challenge issued";
      break;
    }
    case "DATA_EXFILRATION": {
      const r = await ingestSecurityEvent({
        eventType: "DATA_EXFILRATION",
        source: "DLP",
        actor: "r.kapoor@sentinelcorp.io",
        ipAddress: randIp(),
        location: "Frankfurt, DE",
        resource: "customer_financial_data",
        resourceSensitivity: "RESTRICTED",
        description: "Abnormally high data export — 2,340 MB to external endpoint at 02:47 local time",
        rawPayload: { destination: "cdn.mirror-storage.io", records: 148_293, export_format: "CSV" },
        riskInput: { dataVolumeMb: 2340, knownLocation: true, hourOfDay: 2, requestsPerMin: 84, offNetwork: true },
        status: "BLOCKED",
      });
      result.events.push(r);
      result.headline = "Mass data exfiltration attempt (2.3 GB) blocked by DLP";
      break;
    }
    case "UNAUTHORIZED_ACCESS": {
      const r = await ingestSecurityEvent({
        eventType: "UNAUTHORIZED_ACCESS",
        source: "IAM",
        actor: "svc.analytics@sentinelcorp.io",
        ipAddress: "10.24.x.x",
        location: "Datacenter — Mumbai, IN",
        resource: "hr_employee_records",
        resourceSensitivity: "RESTRICTED",
        description: "Service account attempted privilege escalation into HR records outside its scope",
        rawPayload: { requested_role: "HR_ADMIN", granted_role: "ANALYTICS_RO" },
        riskInput: { resourceSensitivity: "RESTRICTED", newDevice: false, knownLocation: true, hourOfDay: 3 },
        status: "BLOCKED",
      });
      result.events.push(r);
      result.headline = "Privilege escalation attempt by analytics service account — denied";
      break;
    }
    case "AI_DATA_EXPOSURE": {
      const r = await ingestSecurityEvent({
        eventType: "AI_DATA_EXPOSURE",
        source: "AI_GUARDRAIL",
        actor: "ai.assistant.runtime@sentinelcorp.io",
        ipAddress: "10.40.x.x",
        location: "Private AI subnet",
        resource: "ml_feature_store",
        resourceSensitivity: "RESTRICTED",
        description: "AI model attempted to include raw customer records in a prompt — sensitive fields masked and request blocked by guardrail",
        rawPayload: {
          prompt_sample: "Summarize transactions for j***@example.com card 4532 **** **** 9010",
          action: "MASKED_BEFORE_INFERENCE",
          pii_fields_masked: 4,
        },
        riskInput: { aiServiceAccess: true, resourceSensitivity: "RESTRICTED" },
        status: "BLOCKED",
      });
      result.events.push(r);
      result.headline = "AI guardrail masked PII and blocked a model data-exposure attempt";
      break;
    }
    case "INSIDER_THREAT": {
      const r = await ingestSecurityEvent({
        eventType: "INSIDER_THREAT",
        source: "UEBA",
        actor: "s.nair@sentinelcorp.io",
        ipAddress: "10.12.x.x",
        location: "Bengaluru, IN — office",
        resource: "fraud_model_registry",
        resourceSensitivity: "RESTRICTED",
        description: "Employee accessed fraud model weights at 01:12 from an unusual workstation and attempted a 780 MB download",
        rawPayload: { tenure_years: 4, last_access_pattern: "business hours only", device: "unregistered" },
        riskInput: { dataVolumeMb: 780, hourOfDay: 1, newDevice: true, resourceSensitivity: "RESTRICTED", offNetwork: false },
      });
      result.events.push(r);
      result.headline = "Insider threat — off-hours bulk access to fraud model registry";
      break;
    }
  }

  // incident + AI analysis for HIGH/CRITICAL outcomes
  const top = result.events.reduce((a, b) => (b.riskScore > a.riskScore ? b : a));
  result.aiSummary =
    top.aiSummary ??
    `Simulated ${ATTACK_LABELS[type].toLowerCase()} replayed through the full pipeline: ingestion → masking → anomaly detection → scoring. Peak risk ${top.riskScore}/100 (${top.riskLevel}).`;
  result.recommendation =
    top.recommendation ?? "Review the session, apply containment, and record response actions on the incident.";

  if (top.riskLevel === "HIGH" || top.riskLevel === "CRITICAL") {
    const count = await db.incident.count();
    const code = `INC-2026-${String(count + 1).padStart(3, "0")}`;
    const incident = await db.incident.create({
      data: {
        code,
        title: result.headline,
        description: `Generated by Threat Simulation Mode (${ATTACK_LABELS[type]}). ${result.aiSummary}`,
        severity: top.riskLevel,
        affectedSystem: "Sentinel monitored estate",
        status: "DETECTED",
        aiAnalysis: result.aiSummary,
        recommendedAction: result.recommendation,
      },
    });
    result.incidentCode = incident.code;
    bus.publish({ type: "incident", data: incident });
  }

  return result;
}
