"use client";

import { useEffect, useState } from "react";
import { api, type AnalyticsData } from "@/lib/client-api";
import { useApp } from "@/lib/store";
import { SectionHeader, RiskBadge, EmptyState } from "@/components/dashboard/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";
import { ChartColumnBig, MapPin, Users, Server, Bug } from "lucide-react";

const LEVEL_COLORS: Record<string, string> = {
  LOW: "#34d399", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f87171",
};
const SERIES_COLORS = ["#2dd4bf", "#34d399", "#fbbf24", "#fb923c", "#f87171", "#a78bfa", "#f472b6"];

const tooltipStyle = {
  background: "oklch(0.18 0.015 210 / 0.95)",
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: 10,
  fontSize: 12,
};

function labelEventType(t: string) {
  return t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AnalyticsView() {
  const dataDirtyAt = useApp((s) => s.dataDirtyAt);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api<AnalyticsData>("/api/analytics");
        if (!cancelled) setData(d);
      } catch { /* keep previous */ }
    })();
    return () => { cancelled = true; };
  }, [dataDirtyAt]);

  if (!data) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4 lg:col-span-2">
          <SectionHeader title="Threats Over Time" sub="Hourly volume by risk level — last 24h" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeline} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 6%)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} interval={2} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend formatter={(v) => <span style={{ fontSize: 11, color: "#94a3b8" }}>{v}</span>} iconSize={8} />
                <Area type="monotone" stackId="1" dataKey="LOW" stroke={LEVEL_COLORS.LOW} fill={LEVEL_COLORS.LOW} fillOpacity={0.25} strokeWidth={1.6} />
                <Area type="monotone" stackId="1" dataKey="MEDIUM" stroke={LEVEL_COLORS.MEDIUM} fill={LEVEL_COLORS.MEDIUM} fillOpacity={0.25} strokeWidth={1.6} />
                <Area type="monotone" stackId="1" dataKey="HIGH" stroke={LEVEL_COLORS.HIGH} fill={LEVEL_COLORS.HIGH} fillOpacity={0.25} strokeWidth={1.6} />
                <Area type="monotone" stackId="1" dataKey="CRITICAL" stroke={LEVEL_COLORS.CRITICAL} fill={LEVEL_COLORS.CRITICAL} fillOpacity={0.35} strokeWidth={1.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <SectionHeader title="Risk Distribution" sub="Share of events by severity" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.riskDistribution} dataKey="count" nameKey="level" innerRadius={48} outerRadius={76} paddingAngle={3} stroke="transparent">
                  {data.riskDistribution.map((entry) => (
                    <Cell key={entry.level} fill={LEVEL_COLORS[entry.level] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend formatter={(v) => <span style={{ fontSize: 11, color: "#94a3b8" }}>{v}</span>} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <SectionHeader title="Attack Types" sub="Top event classes — 48h" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.attackTypes} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 30 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 6%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" width={130} tickFormatter={labelEventType} tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "events"]} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.attackTypes.map((_, i) => (
                    <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <SectionHeader title="Sensitive-Data Events by Type" sub="Masked before reaching AI" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dataTypes} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 20 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 6%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "interceptions"]} />
                <Bar dataKey="count" fill="#2dd4bf" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <SectionHeader title="Geographic Activity" sub="Event volume by region" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.regions} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 10 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 6%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="region" width={120} tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "events"]} />
                <Bar dataKey="count" fill="#a78bfa" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <SectionHeader title="Top Targeted Systems" sub="Most attempted resources" />
          <div className="space-y-2.5">
            {data.topSystems.length === 0 ? <EmptyState icon={Server} title="No data" /> : data.topSystems.map((s, i) => (
              <div key={s.system} className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                <span className="flex-1 text-xs font-mono truncate">{s.system}</span>
                <div className="w-28 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-400" style={{ width: `${(s.count / (data.topSystems[0]?.count || 1)) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums w-8 text-right font-mono">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <SectionHeader title="Most Risky Actors" sub="Anonymised — avg risk score" />
          <div className="space-y-2.5">
            {data.riskyUsers.length === 0 ? <EmptyState icon={Users} title="No data" /> : data.riskyUsers.map((u) => (
              <div key={u.actor} className="flex items-center gap-3">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                <span className="flex-1 text-xs font-mono truncate">{u.actor}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{u.events} evts</span>
                <RiskBadge level={u.avgRisk > 80 ? "CRITICAL" : u.avgRisk > 60 ? "HIGH" : u.avgRisk > 30 ? "MEDIUM" : "LOW"} score={u.avgRisk} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
