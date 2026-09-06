/**
 * SENTINEL AI — Database Seeder
 * -----------------------------
 * Idempotent: runs once (guarded by globalThis promise). Populates 50+ users,
 * 300+ security events across 48h, incidents, sensitive-data events, sessions,
 * access logs, alerts, quantum assessments and audit logs so the platform is
 * demo-ready immediately after installation.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { maskObject, anonymizeActor } from "@/lib/mask";
import { scoreRisk, levelOf } from "@/lib/risk-engine";

/* --------------------------- deterministic PRNG --------------------------- */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260421);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const rint = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const globalForSeed = globalThis as unknown as {
  __sentinelSeed: Promise<void> | undefined;
};

export function ensureSeeded(): Promise<void> {
  if (!globalForSeed.__sentinelSeed) {
    globalForSeed.__sentinelSeed = seed().catch((err) => {
      console.error("[seed] failed", err);
      globalForSeed.__sentinelSeed = undefined;
      throw err;
    });
  }
  return globalForSeed.__sentinelSeed;
}

const FIRST = ["Aarav", "Priya", "Niranjan", "Sofia", "Liam", "Mei", "Diego", "Ananya", "Ethan", "Zara", "Noah", "Ishita", "Lucas", "Amara", "Rohan", "Elena", "Kiran", "Yuki", "Omar", "Freya", "Dev", "Lena", "Marcus", "Tara", "Ravi", "Chloe", "Hiro", "Nadia", "Felix", "Leela", "Sam", "Ivy", "Arjun", "Maya", "Jonas", "Sara", "Vikram", "Emma", "Tariq", "Nina", "Rahul", "Olga", "Ben", "Divya", "Karl", "Riya", "Paul", "Sana", "Jack", "Aditi", "Tom", "Kavya", "Leo", "Ritu"];
const LAST = ["Sharma", "Patel", "Iyer", "Ng", "Silva", "Kim", "Rossi", "Okafor", "Novak", "Tan", "Weber", "Costa", "Mehta", "Johansson", "Reyes", "Kapoor", "Dubois", "Sato", "Haddad", "Nair", "Berg", "Cole", "Menon", "Fox", "Rao", "Lund", "Bose", "Iqbal", "Wong"];
const DEPTS = ["Security Operations", "Engineering", "Finance", "Human Resources", "Analytics", "Customer Success", "IT Infrastructure", "Legal & Compliance", "AI Research"];
const LOCATIONS = ["Mumbai, IN", "Bengaluru, IN", "New York, US", "London, UK", "Singapore, SG", "Frankfurt, DE", "Sydney, AU", "Toronto, CA", "Tokyo, JP", "São Paulo, BR"];
const DEVICES = ["MacBook-Pro-****", "ThinkPad-X1-****", "Dell-Lat-****", "iPad-Pro-****", "Pixel-8-****", "WS-LINUX-****"];
const RESOURCES: Array<[string, "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED"]> = [
  ["customer_financial_data", "RESTRICTED"],
  ["customer_pii_index", "RESTRICTED"],
  ["payment_gateway_logs", "CONFIDENTIAL"],
  ["hr_employee_records", "RESTRICTED"],
  ["api_gateway_audit", "INTERNAL"],
  ["ml_feature_store", "CONFIDENTIAL"],
  ["billing_export_service", "CONFIDENTIAL"],
  ["internal_wiki", "INTERNAL"],
  ["fraud_model_registry", "RESTRICTED"],
  ["public_status_page", "PUBLIC"],
];

async function seed(): Promise<void> {
  const userCount = await db.user.count();
  if (userCount > 0) return; // already seeded
  console.log("[seed] populating SENTINEL AI demo dataset…");

  /* ------------------------------- users -------------------------------- */
  const demoPass = await hashPassword("Demo@1234");
  const users: Array<{ email: string; name: string; role: string; status: string; department: string; riskScore: number; mfaEnabled: boolean; passwordHash: string; lastLoginAt: Date }> = [];

  users.push({ email: "admin@sentinel.ai", name: "Niranjan Iyer", role: "ADMIN", status: "ACTIVE", department: "Security Operations", riskScore: 4, mfaEnabled: true, passwordHash: await hashPassword("Admin@123"), lastLoginAt: minutesAgo(2) });
  users.push({ email: "analyst@sentinel.ai", name: "Priya Sharma", role: "SECURITY_ANALYST", status: "ACTIVE", department: "Security Operations", riskScore: 9, mfaEnabled: true, passwordHash: await hashPassword("Analyst@123"), lastLoginAt: minutesAgo(5) });
  users.push({ email: "viewer@sentinel.ai", name: "Alex Rivera", role: "VIEWER", status: "ACTIVE", department: "Executive Staff", riskScore: 2, mfaEnabled: false, passwordHash: await hashPassword("Viewer@123"), lastLoginAt: minutesAgo(48) });

  const usedEmails = new Set(users.map((u) => u.email));
  for (let i = 0; i < 52; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    let email = `${name.toLowerCase().replace(/[^a-z]/g, ".")}@sentinelcorp.io`;
    while (usedEmails.has(email)) email = `${email.split("@")[0]}${rint(2, 99)}@sentinelcorp.io`;
    usedEmails.add(email);
    const roll = rand();
    users.push({
      email,
      name,
      role: roll > 0.82 ? "SECURITY_ANALYST" : roll > 0.7 ? "ADMIN" : "VIEWER",
      status: roll > 0.94 ? "SUSPICIOUS" : roll > 0.9 ? "LOCKED" : "ACTIVE",
      department: pick(DEPTS),
      riskScore: rint(0, 92),
      mfaEnabled: rand() > 0.35,
      passwordHash: demoPass,
      lastLoginAt: minutesAgo(rint(1, 2900)),
    });
  }
  await db.user.createMany({ data: users });
  const allUsers = await db.user.findMany({ select: { email: true, department: true } });

  /* --------------------------- security events --------------------------- */
  // 247 blocked attacks (24h metric) + varied notable events + background noise
  const events: Prisma.SecurityEventCreateManyInput[] = [];
  const now = Date.now();

  const push = (
    opts: {
      type: string; source: string; actorIdx?: number; hoursAgo: number;
      desc: string; status?: string; risk?: number; resource?: string; sens?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
      loc?: string; newDevice?: boolean; knownLoc?: boolean; failed?: number; vol?: number; rpm?: number; payload?: Record<string, unknown>;
    }
  ) => {
    const u = opts.actorIdx !== undefined ? allUsers[opts.actorIdx % allUsers.length] : null;
    const ts = new Date(now - opts.hoursAgo * 3600_000);
    const riskInput = {
      eventType: opts.type,
      hourOfDay: ts.getHours(),
      isWeekend: [0, 6].includes(ts.getDay()),
      knownLocation: opts.knownLoc ?? rand() > 0.3,
      newDevice: opts.newDevice ?? rand() > 0.8,
      failedAttempts: opts.failed ?? 0,
      dataVolumeMb: opts.vol ?? Math.round(rand() * 90),
      requestsPerMin: opts.rpm ?? rint(4, 40),
      resourceSensitivity: opts.sens ?? "INTERNAL" as const,
    };
    const scored = scoreRisk(riskInput);
    const riskScore = opts.risk ?? scored.riskScore;
    const riskLevel = levelOf(riskScore);
    const actorLabel = u ? u.email : anonymizeActor(`${opts.type}-${opts.loc ?? ""}-${rand()}`);
    const { payload } = maskObject({
      device: pick(DEVICES),
      session: `sess_${rint(1000, 9999)}`,
      ...opts.payload,
    });
    events.push({
      eventType: opts.type,
      source: opts.source,
      actorLabel,
      ipAddress: `${rint(4, 220)}.${rint(0, 255)}.x.x`,
      location: opts.loc ?? pick(LOCATIONS),
      resource: opts.resource ?? null,
      riskScore,
      riskLevel,
      status: opts.status ?? "NEW",
      description: opts.desc,
      maskedPayload: JSON.stringify({ ...payload, _piiMasked: rand() > 0.7 ? rint(1, 4) : 0, _actor: actorLabel }),
      timestamp: ts,
    });
  };

  // blocked attack wall (matches "247 blocked attacks" demo metric)
  for (let i = 0; i < 247; i++) {
    const r = RESOURCES[rint(0, RESOURCES.length - 1)];
    push({
      type: pick(["BRUTE_FORCE", "MALWARE", "UNAUTHORIZED_ACCESS", "FAILED_LOGIN", "POLICY_VIOLATION"]),
      source: pick(["WAF", "IDS", "AUTH_SERVICE", "ENDPOINT", "DLP"]),
      hoursAgo: rand() * 23,
      desc: pick(["Automated attack blocked at edge", "Malicious payload quarantined", "Blocked policy-violating request", "Credential-stuffing attempt blocked", "Port-scan signature dropped"]),
      status: "BLOCKED",
      risk: rint(18, 55),
      resource: r[0], sens: r[1],
    });
  }

  // notable open events
  const notable: Array<[string, string, number]> = [
    ["FAILED_LOGIN", "Failed login attempt — invalid credentials", 1],
    ["SUSPICIOUS_LOGIN", "Login from unfamiliar location with new device", 2],
    ["UNAUTHORIZED_ACCESS", "Access attempt to restricted dataset without entitlement", 3],
    ["AI_DATA_EXPOSURE", "AI model attempted access to restricted dataset — masked and blocked", 4],
    ["DATA_EXFILRATION", "Unusual outbound data volume to external storage", 6],
    ["PRIVILEGE_ESCALATION", "Attempted role elevation on production IAM", 8],
    ["INSIDER_THREAT", "Off-hours bulk access to confidential registry", 10],
    ["MALWARE", "Trojan signature quarantined on finance workstation", 12],
  ];
  for (const [type, desc, h] of notable) {
    const r = RESOURCES[rint(0, 6)];
    push({
      type, source: pick(["AUTH_SERVICE", "IAM", "AI_GUARDRAIL", "DLP", "UEBA", "ENDPOINT"]),
      actorIdx: rint(0, allUsers.length - 1),
      hoursAgo: h, desc, resource: r[0], sens: r[1],
      failed: type === "FAILED_LOGIN" ? 3 : 0,
      vol: type === "DATA_EXFILRATION" ? 1450 : undefined,
      status: type === "AI_DATA_EXPOSURE" || type === "DATA_EXFILRATION" ? "BLOCKED" : "NEW",
      knownLoc: type === "SUSPICIOUS_LOGIN" ? false : undefined,
      newDevice: type === "SUSPICIOUS_LOGIN" || type === "INSIDER_THREAT",
    });
  }

  // ~120 varied events over 48h (most already triaged — keeps "active threats" realistic)
  for (let i = 0; i < 120; i++) {
    const r = RESOURCES[rint(0, RESOURCES.length - 1)];
    const statusRoll = rand();
    push({
      type: pick(["FAILED_LOGIN", "SUSPICIOUS_LOGIN", "POLICY_VIOLATION", "UNAUTHORIZED_ACCESS", "MALWARE", "PRIVILEGE_ESCALATION", "BRUTE_FORCE"]),
      source: pick(["AUTH_SERVICE", "IAM", "DLP", "IDS", "UEBA", "WAF", "ENDPOINT"]),
      actorIdx: rand() > 0.15 ? rint(0, allUsers.length - 1) : undefined,
      hoursAgo: rand() * 47,
      desc: pick([
        "Failed login attempt — invalid credentials",
        "Unusual data access pattern detected",
        "Access attempt outside baseline behaviour",
        "Credential sharing suspected on endpoint",
        "Anomalous query volume on protected dataset",
        "Session token reuse from different geography",
      ]),
      resource: r[0], sens: r[1],
      status: statusRoll > 0.85 ? "NEW" : statusRoll > 0.6 ? "RESOLVED" : statusRoll > 0.35 ? "SAFE" : "BLOCKED",
      vol: rand() > 0.9 ? rint(600, 2400) : undefined,
      failed: rand() > 0.85 ? rint(3, 6) : 0,
    });
  }
  await db.securityEvent.createMany({ data: events });

  /* ------------------------------ incidents ------------------------------ */
  await db.incident.createMany({
    data: [
      {
        code: "INC-2026-001", title: "Credential-stuffing campaign against customer portal",
        description: "Coordinated login attempts from rotating proxy IPs targeting 400+ customer accounts. WAF and rate-limiter contained the burst; 3 accounts showed successful unauthorized access.",
        severity: "CRITICAL", affectedSystem: "Customer SSO Portal", status: "INVESTIGATING", detectionTime: minutesAgo(95),
        aiAnalysis: "Pattern matches credential-stuffing from a commercial proxy pool. Two accounts show post-success data access to customer_financial_data; recommend forced password reset + step-up MFA for affected identities.",
        recommendedAction: "Force reset for affected accounts; deploy CAPTCHA on the portal; block proxy ASN range.", assignedAnalyst: "Priya Sharma",
        notes: JSON.stringify([{ author: "Priya Sharma", text: "Proxy ASN blocked at edge; monitoring residual attempts.", at: minutesAgo(60).toISOString() }]),
      },
      {
        code: "INC-2026-002", title: "Unusual data access on customer_financial_data",
        description: "Analyst workstation pulled 1.4 GB from the financial data mart at 02:47, far outside baseline. Session token was reused from a different geography 40 minutes later.",
        severity: "CRITICAL", affectedSystem: "Financial Data Mart", status: "DETECTED", detectionTime: minutesAgo(210),
        aiAnalysis: "Volume (1.4 GB), time (02:47) and geo-reuse indicate probable credential compromise or insider exfiltration. Recommend immediate session revocation and endpoint forensics.",
        recommendedAction: "Revoke sessions, isolate workstation, start forensic image capture.",
      },
      {
        code: "INC-2026-003", title: "AI assistant attempted restricted-dataset inclusion",
        description: "The AI assistant runtime tried to include raw customer PII rows in a model prompt. Guardrail masked 4 PII field types and blocked transmission.",
        severity: "HIGH", affectedSystem: "AI Assistant Runtime", status: "CONTAINED", detectionTime: minutesAgo(320),
        aiAnalysis: "Guardrail behaved as designed — privacy-aware AI pipeline prevented exposure. Underlying retrieval scope was too broad for the requesting persona.",
        recommendedAction: "Narrow retrieval ACLs for the assistant service account; add regression test to guardrail suite.", assignedAnalyst: "Niranjan Iyer",
        notes: JSON.stringify([{ author: "Niranjan Iyer", text: "ACL narrowed; guardrail logs attached to case.", at: minutesAgo(260).toISOString() }]),
      },
      {
        code: "INC-2026-004", title: "Malware quarantined on finance workstation",
        description: "Trojan dropper detected via EDR on a Finance workstation after a phishing email attachment was opened.",
        severity: "MEDIUM", affectedSystem: "Finance Endpoint FIN-WS-114", status: "CONTAINED", detectionTime: minutesAgo(430),
        aiAnalysis: "Binary matches known loader family; no lateral movement observed within 24h. Email origin added to blocklist.",
        recommendedAction: "Reimage endpoint, rotate local credentials, confirm no DLP events correlate.", assignedAnalyst: "Priya Sharma",
      },
      {
        code: "INC-2026-005", title: "Impossible travel on executive account",
        description: "Login from Toronto followed by Singapore login 38 minutes later on the same account.",
        severity: "HIGH", affectedSystem: "Identity Provider", status: "RESOLVED", detectionTime: minutesAgo(600),
        aiAnalysis: "Confirmed executive travel itinerary — false positive. Behavioural baseline updated to include travel pattern.",
        recommendedAction: "No further action; baseline updated.", assignedAnalyst: "Niranjan Iyer",
        notes: JSON.stringify([{ author: "Niranjan Iyer", text: "Confirmed with EA; updated UEBA profile.", at: minutesAgo(540).toISOString() }]),
      },
      {
        code: "INC-2026-006", title: "Privilege escalation attempt by analytics service account",
        description: "svc.analytics attempted HR_ADMIN role assumption three times in five minutes; all denied by policy engine.",
        severity: "HIGH", affectedSystem: "Production IAM", status: "INVESTIGATING", detectionTime: minutesAgo(150),
        aiAnalysis: "Service account config drift after a deploy. No data accessed. Likely automation bug rather than adversary, but treating as potential until pipeline owner confirms.",
        recommendedAction: "Roll back deploy, restrict service-account role assumptions, notify platform team.", assignedAnalyst: "Priya Sharma",
      },
    ],
  });

  /* ------------------------ sensitive data events ------------------------ */
  const dataEvents: Prisma.SensitiveDataEventCreateManyInput[] = [];
  const samples: Array<[string, string, string]> = [
    ["EMAIL", "j***@example.com", "LOG_STREAM"],
    ["EMAIL", "a***@sentinelcorp.io", "AI_PROMPT"],
    ["CREDIT_CARD", "4532 **** **** 9010", "API_RESPONSE"],
    ["CREDIT_CARD", "5512 **** **** 3345", "LOG_STREAM"],
    ["PHONE", "***-***-4021", "TICKET"],
    ["SSN", "***-**-1234", "EXPORT_FILE"],
    ["API_KEY", "sk-********789", "LOG_STREAM"],
    ["API_KEY", "ghp_********a1f", "AI_PROMPT"],
    ["PASSWORD", 'password: "********"', "LOG_STREAM"],
    ["IBAN", "DE44**********", "EXPORT_FILE"],
    ["GOVERNMENT_ID", "ID:******", "TICKET"],
    ["HEALTHCARE_ID", "MRN:*****", "API_RESPONSE"],
  ];
  for (let i = 0; i < 34; i++) {
    const [dataType, maskedSample, exposurePoint] = samples[i % samples.length];
    dataEvents.push({
      dataType, maskedSample, exposurePoint,
      actionTaken: rand() > 0.85 ? "BLOCKED" : "MASKED",
      riskLevel: exposurePoint === "AI_PROMPT" ? "HIGH" : rand() > 0.5 ? "MEDIUM" : "LOW",
      timestamp: new Date(now - rand() * 47 * 3600_000),
    });
  }
  await db.sensitiveDataEvent.createMany({ data: dataEvents });

  /* ----------------------------- sessions/logs ---------------------------- */
  const sessions: Prisma.ActiveSessionCreateManyInput[] = [];
  for (let i = 0; i < 12; i++) {
    const u = allUsers[i % allUsers.length];
    const suspicious = i === 3 || i === 7;
    sessions.push({
      userEmail: u.email,
      device: pick(DEVICES),
      ipAddress: `${rint(4, 220)}.${rint(0, 255)}.x.x`,
      location: pick(LOCATIONS),
      status: suspicious ? "SUSPICIOUS" : "ACTIVE",
      startedAt: minutesAgo(rint(5, 600)),
      lastActivity: minutesAgo(rint(0, 30)),
    });
  }
  await db.activeSession.createMany({ data: sessions });

  const accessLogs: Prisma.AccessLogCreateManyInput[] = [];
  for (let i = 0; i < 46; i++) {
    const u = allUsers[rint(0, allUsers.length - 1)];
    const denied = rand() > 0.72;
    accessLogs.push({
      userEmail: u.email,
      action: pick(["LOGIN", "LOGIN_FAILED", "ACCESS_RESOURCE", "EXPORT_DATA", "ROLE_CHANGE", "CONFIG_CHANGE"]),
      resource: pick(RESOURCES)[0],
      result: denied ? "DENIED" : "ALLOWED",
      ipAddress: `${rint(4, 220)}.${rint(0, 255)}.x.x`,
      location: pick(LOCATIONS),
      timestamp: new Date(now - rand() * 47 * 3600_000),
    });
  }
  await db.accessLog.createMany({ data: accessLogs });

  /* -------------------------------- alerts ------------------------------- */
  await db.securityAlert.createMany({
    data: [
      { title: "CRITICAL — Data exfiltration pattern", message: "Unusual outbound data volume to external storage (actor masked_user_****, risk 92/100)", severity: "CRITICAL", acknowledged: false, createdAt: minutesAgo(210) },
      { title: "CRITICAL — Credential-stuffing campaign", message: "Coordinated login attempts against customer SSO portal — 3 accounts compromised", severity: "CRITICAL", acknowledged: false, createdAt: minutesAgo(95) },
      { title: "HIGH — Impossible travel anomaly", message: "Session token reused from different geography within 40 minutes", severity: "HIGH", acknowledged: false, createdAt: minutesAgo(150) },
      { title: "HIGH — AI guardrail interception", message: "AI model attempted to include raw PII in prompt — masked before inference", severity: "HIGH", acknowledged: true, createdAt: minutesAgo(320) },
      { title: "MEDIUM — Elevated failed logins", message: "6 failed attempts from a single origin on vendor account", severity: "MEDIUM", acknowledged: true, createdAt: minutesAgo(70) },
      { title: "MEDIUM — DLP policy warning", message: "File transfer policy warning on analytics endpoint", severity: "MEDIUM", acknowledged: false, createdAt: minutesAgo(45) },
    ],
  });

  /* --------------------------- quantum assessment ------------------------- */
  await db.quantumAssessment.createMany({
    data: [
      { systemName: "Payment API", encryption: "RSA-2048", keyLength: "2048-bit", status: "LEGACY", quantumRisk: "HIGH", recommendation: "Prioritise migration to ML-KEM hybrid TLS; harvest-now-decrypt-later exposure on card flows.", lastReviewed: minutesAgo(2880) },
      { systemName: "Core Database (Db2 on IBM Z)", encryption: "AES-256", keyLength: "256-bit", status: "STRONG", quantumRisk: "LOW", recommendation: "Maintain key rotation cadence; monitor NIST guidance for AES post-quantum margins.", lastReviewed: minutesAgo(2880) },
      { systemName: "Secure Gateway", encryption: "ECC", keyLength: "P-256", status: "REVIEW_REQUIRED", quantumRisk: "MEDIUM", recommendation: "Evaluate hybrid PQC certificates for TLS termination.", lastReviewed: minutesAgo(2880) },
      { systemName: "Internal SSO (OIDC)", encryption: "ECDSA", keyLength: "P-384", status: "REVIEW_REQUIRED", quantumRisk: "MEDIUM", recommendation: "Plan token-signing key migration to ML-DSA.", lastReviewed: minutesAgo(2880) },
      { systemName: "Backup Vault", encryption: "AES-256-GCM", keyLength: "256-bit", status: "STRONG", quantumRisk: "LOW", recommendation: "No action — symmetric scheme remains robust at 256-bit.", lastReviewed: minutesAgo(2880) },
      { systemName: "Partner API Edge", encryption: "TLS 1.2 + RSA", keyLength: "2048-bit", status: "LEGACY", quantumRisk: "CRITICAL", recommendation: "Upgrade to TLS 1.3 with hybrid key exchange immediately.", lastReviewed: minutesAgo(2880) },
      { systemName: "AI Model Registry", encryption: "AES-256", keyLength: "256-bit", status: "STRONG", quantumRisk: "LOW", recommendation: "Ensure model-signing keys are inventoried for PQC rotation.", lastReviewed: minutesAgo(2880) },
      { systemName: "HSM Cluster", encryption: "FIPS 140-3", keyLength: "n/a", status: "STRONG", quantumRisk: "LOW", recommendation: "Verify firmware roadmap includes PQC key generation.", lastReviewed: minutesAgo(2880) },
      { systemName: "Legacy File Transfer", encryption: "SFTP (RSA)", keyLength: "1024-bit", status: "LEGACY", quantumRisk: "CRITICAL", recommendation: "Decommission — 1024-bit RSA is unsafe; move partners to SFTP w/ AES.", lastReviewed: minutesAgo(2880) },
      { systemName: "Container Registry", encryption: "TLS 1.3", keyLength: "AES-128-GCM", status: "STRONG", quantumRisk: "LOW", recommendation: "No action.", lastReviewed: minutesAgo(2880) },
      { systemName: "Email Gateway", encryption: "S/MIME (RSA-3072)", keyLength: "3072-bit", status: "STRONG", quantumRisk: "LOW", recommendation: "3072-bit RSA remains acceptable; reassess when S/MIME PQC profiles stabilise.", lastReviewed: minutesAgo(2880) },
      { systemName: "Audit Log Archive", encryption: "AES-256", keyLength: "256-bit", status: "STRONG", quantumRisk: "LOW", recommendation: "No action.", lastReviewed: minutesAgo(2880) },
      { systemName: "Vault Secrets Store", encryption: "AES-256-GCM", keyLength: "256-bit", status: "STRONG", quantumRisk: "LOW", recommendation: "No action — symmetric at 256-bit with HSM-backed keys.", lastReviewed: minutesAgo(2880) },
      { systemName: "Kubernetes Secrets (managed)", encryption: "AES-256-GCM", keyLength: "256-bit", status: "STRONG", quantumRisk: "LOW", recommendation: "No action; etcd encryption-at-rest verified.", lastReviewed: minutesAgo(2880) },
      { systemName: "Legacy VPN Concentrator", encryption: "IKEv1 / 3DES", keyLength: "112-bit", status: "LEGACY", quantumRisk: "CRITICAL", recommendation: "Decommission immediately — 3DES is deprecated.", lastReviewed: minutesAgo(2880) },
    ],
  });

  /* ------------------------------ audit logs ------------------------------ */
  await db.auditLog.createMany({
    data: [
      { actorEmail: "admin@sentinel.ai", action: "ROLE_CHANGE", detail: "Changed role of s.nair@sentinelcorp.io to VIEWER", timestamp: minutesAgo(120) },
      { actorEmail: "admin@sentinel.ai", action: "POLICY_UPDATE", detail: "Tightened DLP export rule for RESTRICTED resources", timestamp: minutesAgo(200) },
      { actorEmail: "analyst@sentinel.ai", action: "INCIDENT_STATUS", detail: "INC-2026-003 → CONTAINED", timestamp: minutesAgo(240) },
      { actorEmail: "analyst@sentinel.ai", action: "EVENT_BLOCK", detail: "Blocked session masked_user_3312 after brute-force pattern", timestamp: minutesAgo(88) },
      { actorEmail: "admin@sentinel.ai", action: "SESSION_REVOKE", detail: "Revoked suspicious session in Singapore", timestamp: minutesAgo(150) },
      { actorEmail: "system", action: "SEED", detail: "Demo dataset initialised", timestamp: new Date(now) },
    ],
  });

  console.log("[seed] done:", {
    users: users.length, events: events.length, incidents: 6,
    sensitiveDataEvents: dataEvents.length, sessions: sessions.length, accessLogs: accessLogs.length,
  });
}

function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60_000);
}
