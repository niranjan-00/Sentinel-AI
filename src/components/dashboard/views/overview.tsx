"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { api, type DashboardSummary, type AnalyticsData } from "@/lib/client-api";
import {
  MetricCard, RiskBadge, ScoreRing, eventIcon, eventTypeLabel, SectionHeader, EmptyState,
} from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck, Radar, Siren, ShieldOff, FileLock2, Users, Server, Atom,
  ArrowRight, BellOff,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const LEVEL_COLORS: Record<string, string> = {
  LOW: "#34d399", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f87171",
};

export default function OverviewView() {
  const user = useApp((s) => s.user);
  const liveEvents = useApp((s) => s.liveEvents);
  const dataDirtyAt = useApp((s) => s.dataDirtyAt);
  const setDashView = useApp((s) => s.setDashView);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api<DashboardSummary>("/api/dashboard/summary"),
        api<AnalyticsData>("/api/analytics"),
      ]);
      setSummary(s);
      setAnalytics(a);
    } catch {
      /* silent — retry on next tick */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, dataDirtyAt]);

  const m = summary?.metrics;

  return (
    <div className="space-y-6">
      {/* metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading || !m ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
        ) : (
          <>
            <MetricCard title="Security Score" value={`${m.securityScore}/100`} icon={ShieldCheck} accent="text-emerald-300" sub="Weighted live posture">
              <ScoreRing score={m.securityScore} />
            </MetricCard>
            <MetricCard title="Active Threats" value={m.activeThreats} icon={Radar} accent="text-orange-300" sub="HIGH/CRITICAL unhandled">
              <RiskBadge level={m.activeThreats > 12 ? "CRITICAL" : m.activeThreats > 6 ? "HIGH" : "MEDIUM"} />
            </MetricCard>
            <MetricCard title="Critical Alerts" value={m.criticalAlerts} icon={Siren} accent="text-red-300" sub="Unacknowledged">
              {m.criticalAlerts > 0 && <span className="h-2 w-2 rounded-full bg-red-500 threat-pulse" aria-hidden />}
            </MetricCard>
            <MetricCard title="Blocked Attacks" value={m.blockedAttacks.toLocaleString()} icon={ShieldOff} accent="text-teal-300" sub="All-time counter">
              </MetricCard>
            <MetricCard title="Sensitive Data Events" value={m.sensitiveDataEvents} icon={FileLock2} accent="text-teal-300" sub="Auto-masked · 24h" />
            <MetricCard title="Active Users" value={m.activeUsers} icon={Users} accent="text-emerald-300" sub="Live sessions" />
            <MetricCard title="Systems Protected" value={m.systemsProtected} icon={Server} accent="text-primary" sub="Across the estate" />
            <MetricCard title="Quantum Readiness" value={`${m.quantumReadiness}%`} icon={Atom} accent="text-violet-300" sub={`${m.legacyCrypto} legacy crypto assets`}>
              <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{ width: `${m.quantumReadiness}%` }} />
              </div>
            </MetricCard>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* live feed */}
        <div className="lg:col-span-2 glass rounded-xl p-4">
          <SectionHeader
            title="Live Threat Feed"
            sub="Streamed over SSE — masked actors only"
          >
            <Button variant="outline" size="sm" className="gap-1 font-mono text-xs" onClick={() => setDashView("threats")}>
              FULL MONITOR <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </SectionHeader>
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : liveEvents.length + (summary?.recentEvents.length ?? 0) === 0 ? (
              <EmptyState icon={Radar} title="No events yet" hint="Events appear here in real time. Try Threat Simulation Mode." />
            ) : (
              mergeFeed(liveEvents, summary?.recentEvents ?? []).map((e) => {
                const Icon = eventIcon(e.eventType);
                return (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 hover:border-primary/30 transition-colors"
                  >
                    <div className="mt-0.5 h-8 w-8 rounded-lg bg-secondary/70 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{eventTypeLabel(e.eventType)}</p>
                        <RiskBadge level={e.riskLevel} score={e.riskScore} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.description}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/70 mt-1">
                        {new Date(e.timestamp).toLocaleTimeString()} · {e.actorLabel ?? "masked_user_****"} · {e.source}
                        {e.resource ? ` · ${e.resource}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4">
            <SectionHeader title="Risk Distribution" sub="Last 24 hours" />
            <div className="h-[190px]">
              {analytics ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.riskDistribution}
                      dataKey="count" nameKey="level" innerRadius={45} outerRadius={70} paddingAngle={3}
                      stroke="transparent"
                    >
                      {analytics.riskDistribution.map((entry) => (
                        <Cell key={entry.level} fill={LEVEL_COLORS[entry.level] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "oklch(0.18 0.015 210 / 0.95)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 10, fontSize: 12 }}
                    />
                    <Legend formatter={(v) => <span style={{ fontSize: 11, color: "#94a3b8" }}>{v}</span>} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Skeleton className="h-full rounded-lg" />
              )}
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <SectionHeader title="Events · 24h" sub="Hourly volume by risk band" />
            <div className="h-[190px]">
              {analytics ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.timeline} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="critFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f87171" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(1 0 0 / 6%)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#64748b" }} interval={5} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.18 0.015 210 / 0.95)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 10, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="CRITICAL" stroke="#f87171" strokeWidth={1.8} fill="url(#critFill)" />
                    <Area type="monotone" dataKey="HIGH" stroke="#fb923c" strokeWidth={1.2} fill="transparent" />
                    <Area type="monotone" dataKey="MEDIUM" stroke="#fbbf24" strokeWidth={1} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Skeleton className="h-full rounded-lg" />
              )}
            </div>
          </div>

          {/* alerts */}
          <div className="glass rounded-xl p-4">
            <SectionHeader title="Priority Alerts" sub="Unacknowledged first" />
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(summary?.alerts ?? []).length === 0 ? (
                <EmptyState icon={BellOff} title="No alerts" />
              ) : (
                summary?.alerts.map((a) => (
                  <div key={a.id} className={`rounded-lg border px-3 py-2 ${a.acknowledged ? "border-border/40 opacity-50" : "border-red-500/25 bg-red-500/5"}`}>
                    <p className="text-xs font-medium truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{a.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* role strip */}
      <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-medium">Signed in as {user?.name}</p>
          <p className="text-xs text-muted-foreground">
            Role <span className="font-mono text-teal-300">{user?.role.replace("_", " ")}</span>
            {user?.role === "VIEWER" ? " — read-only access. Analysts and Admins can investigate, block and resolve." : " — full response capabilities enabled."}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDashView("assistant")}>
          Ask SENTINEL Assistant <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Link
          href="#"
          onClick={(e) => { e.preventDefault(); setDashView("incidents"); }}
          className="text-xs font-mono text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
        >
          {m?.openIncidents ?? 0} open incidents →
        </Link>
      </div>
    </div>
  );
}

function mergeFeed(
  live: Array<import("@/lib/store").LiveEvent>,
  fetched: DashboardSummary["recentEvents"]
) {
  const seen = new Set(live.map((e) => e.id));
  const merged = [...live, ...fetched.filter((e) => !seen.has(e.id))];
  return merged
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}
