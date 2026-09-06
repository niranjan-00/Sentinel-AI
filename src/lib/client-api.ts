"use client";

/** Client-side JSON fetch helper with uniform error handling. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface DashboardSummary {
  metrics: {
    securityScore: number;
    activeThreats: number;
    criticalAlerts: number;
    blockedAttacks: number;
    sensitiveDataEvents: number;
    activeUsers: number;
    systemsProtected: number;
    quantumReadiness: number;
    totalEvents24h: number;
    openIncidents: number;
    legacyCrypto: number;
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    source: string;
    actorLabel: string | null;
    ipAddress: string | null;
    location: string | null;
    resource: string | null;
    riskScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status: string;
    description: string;
    aiSummary: string | null;
    recommendation: string | null;
    timestamp: string;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    acknowledged: boolean;
    createdAt: string;
  }>;
}

export interface Incident {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedSystem: string;
  status: "DETECTED" | "INVESTIGATING" | "CONTAINED" | "RESOLVED";
  detectionTime: string;
  aiAnalysis: string | null;
  recommendedAction: string | null;
  assignedAnalyst: string | null;
  notes: string;
}

export interface IamUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "SECURITY_ANALYST" | "VIEWER";
  status: string;
  department: string;
  riskScore: number;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

export interface ActiveSession {
  id: string;
  userEmail: string;
  device: string;
  ipAddress: string | null;
  location: string | null;
  status: string;
  startedAt: string;
  lastActivity: string;
}

export interface AccessLogRow {
  id: string;
  userEmail: string;
  action: string;
  resource: string | null;
  result: string;
  ipAddress: string | null;
  location: string | null;
  timestamp: string;
}

export interface AuditRow {
  id: string;
  actorEmail: string;
  action: string;
  detail: string | null;
  timestamp: string;
}

export interface QuantumAsset {
  id: string;
  systemName: string;
  encryption: string;
  keyLength: string | null;
  status: "STRONG" | "REVIEW_REQUIRED" | "LEGACY";
  quantumRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: string | null;
  lastReviewed: string;
}

export interface SensitiveDataEvent {
  id: string;
  dataType: string;
  maskedSample: string;
  exposurePoint: string;
  actionTaken: string;
  riskLevel: string;
  timestamp: string;
}

export interface AnalyticsData {
  timeline: Array<{ hour: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }>;
  riskDistribution: Array<{ level: string; count: number }>;
  attackTypes: Array<{ type: string; count: number }>;
  topSystems: Array<{ system: string; count: number }>;
  riskyUsers: Array<{ actor: string; avgRisk: number; events: number }>;
  regions: Array<{ region: string; count: number }>;
  dataTypes: Array<{ type: string; count: number }>;
}
