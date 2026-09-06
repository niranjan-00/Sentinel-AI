/**
 * SENTINEL AI — Risk Scoring / Anomaly Detection Engine
 * -----------------------------------------------------
 * Deterministic, explainable anomaly scoring that runs at the edge of the AI
 * pipeline. Raw identifiers are already masked upstream; this engine only ever
 * sees structural/behavioural features, never raw PII.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskInput {
  eventType?: string;
  hourOfDay?: number; // 0-23 local time of the event
  isWeekend?: boolean;
  knownLocation?: boolean; // does the user have prior history at this location?
  newDevice?: boolean;
  failedAttempts?: number; // recent consecutive failures
  dataVolumeMb?: number;
  requestsPerMin?: number;
  resourceSensitivity?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  offNetwork?: boolean; // outside corporate network / VPN
  aiServiceAccess?: boolean; // AI service account touching the resource
  velocityCountries?: number; // distinct countries in the last hour
  accountLockedBefore?: boolean;
}

export interface RiskFactor {
  label: string;
  points: number;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  anomalies: string[];
  factors: RiskFactor[];
  recommendation: string;
}

export function levelOf(score: number): RiskLevel {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

const SENSITIVITY_POINTS: Record<string, number> = {
  PUBLIC: 0,
  INTERNAL: 6,
  CONFIDENTIAL: 14,
  RESTRICTED: 22,
};

const EVENT_BASE: Record<string, number> = {
  BRUTE_FORCE: 30,
  DATA_EXFILRATION: 34,
  UNAUTHORIZED_ACCESS: 26,
  PRIVILEGE_ESCALATION: 28,
  AI_DATA_EXPOSURE: 30,
  INSIDER_THREAT: 22,
  MALWARE: 32,
  SUSPICIOUS_LOGIN: 14,
  FAILED_LOGIN: 8,
  POLICY_VIOLATION: 10,
};

export function scoreRisk(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = [];
  const anomalies: string[] = [];
  const hour = input.hourOfDay ?? new Date().getHours();

  // 1. event class baseline
  const base = input.eventType ? (EVENT_BASE[input.eventType] ?? 6) : 6;
  if (base > 0) factors.push({ label: `Event class: ${input.eventType ?? "GENERIC"}`, points: base });

  // 2. time-of-day anomaly
  if (hour < 6 || hour >= 21) {
    factors.push({ label: "Access outside normal working hours", points: 12 });
    anomalies.push("Access outside normal working hours");
  } else if (hour >= 19) {
    factors.push({ label: "Late-evening access", points: 6 });
  }
  if (input.isWeekend) {
    factors.push({ label: "Weekend access", points: 6 });
    anomalies.push("Activity during weekend");
  }

  // 3. geo / network anomalies
  if (input.knownLocation === false) {
    factors.push({ label: "Login from an unfamiliar location", points: 24 });
    anomalies.push("Login from an unfamiliar location");
  }
  if (input.velocityCountries && input.velocityCountries > 1) {
    const p = Math.min(28, 14 * input.velocityCountries);
    factors.push({ label: `Impossible travel — ${input.velocityCountries} countries in one hour`, points: p });
    anomalies.push(`Impossible travel: ${input.velocityCountries} countries within one hour`);
  }
  if (input.offNetwork) {
    factors.push({ label: "Connection outside corporate network", points: 8 });
  }

  // 4. device anomalies
  if (input.newDevice) {
    factors.push({ label: "Unrecognised device fingerprint", points: 14 });
    anomalies.push("Unrecognised device fingerprint");
  }

  // 5. authentication anomalies
  if (input.failedAttempts && input.failedAttempts > 0) {
    const p = Math.min(26, input.failedAttempts * 5);
    factors.push({ label: `${input.failedAttempts} recent failed login attempts`, points: p });
    if (input.failedAttempts >= 3) anomalies.push(`${input.failedAttempts} failed login attempts in short succession`);
  }
  if (input.accountLockedBefore) {
    factors.push({ label: "Account previously locked", points: 8 });
  }

  // 6. data-volume / rate anomalies
  const vol = input.dataVolumeMb ?? 0;
  if (vol > 2000) {
    factors.push({ label: "Abnormally high data access", points: 30 });
    anomalies.push(`Abnormally high data access (${vol.toLocaleString()} MB)`);
  } else if (vol > 500) {
    factors.push({ label: "Elevated data access volume", points: 18 });
    anomalies.push(`Elevated data access volume (${vol} MB)`);
  } else if (vol > 100) {
    factors.push({ label: "Moderate data access volume", points: 8 });
  }

  const rpm = input.requestsPerMin ?? 0;
  if (rpm > 120) {
    factors.push({ label: "Request rate consistent with automation/scanning", points: 18 });
    anomalies.push(`Abnormal request rate (${rpm} req/min)`);
  } else if (rpm > 60) {
    factors.push({ label: "Elevated request rate", points: 10 });
  }

  // 7. resource sensitivity
  const sens = input.resourceSensitivity ?? "INTERNAL";
  const sp = SENSITIVITY_POINTS[sens];
  if (sp > 0) {
    factors.push({ label: `Resource sensitivity: ${sens}`, points: sp });
    if (sens === "RESTRICTED") anomalies.push("Access to a RESTRICTED-classified resource");
  }

  // 8. AI-specific exposure
  if (input.aiServiceAccess) {
    factors.push({ label: "AI service account touching protected dataset", points: 18 });
    anomalies.push("AI model attempted access to a protected dataset");
  }

  const riskScore = Math.max(0, Math.min(100, factors.reduce((a, f) => a + f.points, 0)));
  const riskLevel = levelOf(riskScore);

  return { riskScore, riskLevel, anomalies, factors, recommendation: recommend(riskLevel, anomalies, input) };
}

function recommend(level: RiskLevel, anomalies: string[], input: RiskInput): string {
  if (level === "CRITICAL") {
    if ((input.dataVolumeMb ?? 0) > 500)
      return "Temporarily block the session, revoke active tokens, and start a data-exfiltration investigation immediately.";
    return "Temporarily block the session and require identity verification (MFA re-authentication) before restoring access.";
  }
  if (level === "HIGH") {
    if (anomalies.some((a) => a.toLowerCase().includes("login") || a.toLowerCase().includes("location")))
      return "Challenge the user with step-up MFA and notify the identity team for session review.";
    return "Open an investigation, flag the session as suspicious and monitor subsequent activity closely.";
  }
  if (level === "MEDIUM") {
    return "Apply additional monitoring to the session and verify the activity against the user's baseline behaviour.";
  }
  return "No immediate action required — record the event and continue baseline monitoring.";
}
