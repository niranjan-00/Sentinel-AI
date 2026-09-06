"use client";

import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, LogIn, Database, Download, Lock, Unlock, Bot, UserX, Bug,
  FileWarning, Radiation, AlertTriangle, Activity, type LucideIcon,
} from "lucide-react";

export type RiskLevelStr = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const RISK_STYLES: Record<RiskLevelStr, string> = {
  LOW: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  HIGH: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  CRITICAL: "bg-red-500/10 text-red-300 border-red-500/30",
};

export const RISK_DOT: Record<RiskLevelStr, string> = {
  LOW: "bg-emerald-400",
  MEDIUM: "bg-amber-400",
  HIGH: "bg-orange-400",
  CRITICAL: "bg-red-500",
};

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  const l = (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(level) ? level : "LOW") as RiskLevelStr;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider ${RISK_STYLES[l]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${RISK_DOT[l]} ${l === "CRITICAL" ? "threat-pulse" : ""}`} aria-hidden />
      {level}{score !== undefined ? ` · ${score}` : ""}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-red-500/10 text-red-300 border-red-500/30",
  INVESTIGATING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  BLOCKED: "bg-teal-500/10 text-teal-300 border-teal-500/30",
  SAFE: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  RESOLVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  SUSPICIOUS: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  REVOKED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  LOCKED: "bg-red-500/10 text-red-300 border-red-500/30",
  DETECTED: "bg-red-500/10 text-red-300 border-red-500/30",
  CONTAINED: "bg-teal-500/10 text-teal-300 border-teal-500/30",
  STRONG: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REVIEW_REQUIRED: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  LEGACY: "bg-red-500/10 text-red-300 border-red-500/30",
  ALLOWED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  DENIED: "bg-red-500/10 text-red-300 border-red-500/30",
  MASKED: "bg-teal-500/10 text-teal-300 border-teal-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-secondary text-secondary-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function MetricCard({
  title, value, sub, icon: Icon, accent = "text-primary", children,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-2 hover:ring-glow transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{title}</p>
        <Icon className={`h-4 w-4 ${accent}`} aria-hidden />
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {children}
      </div>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  const color = score >= 85 ? "#34d399" : score >= 70 ? "#2dd4bf" : score >= 55 ? "#fbbf24" : "#f87171";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Security score ${score} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fill={color} fontSize={size * 0.26} fontWeight="700">
        {score}
      </text>
    </svg>
  );
}

export function eventIcon(eventType: string): LucideIcon {
  const map: Record<string, LucideIcon> = {
    FAILED_LOGIN: LogIn,
    BRUTE_FORCE: ShieldAlert,
    SUSPICIOUS_LOGIN: LogIn,
    DATA_EXFILRATION: Download,
    UNAUTHORIZED_ACCESS: Lock,
    PRIVILEGE_ESCALATION: Unlock,
    AI_DATA_EXPOSURE: Bot,
    INSIDER_THREAT: UserX,
    MALWARE: Bug,
    POLICY_VIOLATION: FileWarning,
  };
  return map[eventType] ?? Activity;
}

export function eventTypeLabel(eventType: string): string {
  return eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="h-11 w-11 rounded-xl bg-secondary/60 flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="text-xs text-muted-foreground max-w-xs">{hint}</p> : null}
    </div>
  );
}

export function SectionHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

export { AlertTriangle, Radiation };
