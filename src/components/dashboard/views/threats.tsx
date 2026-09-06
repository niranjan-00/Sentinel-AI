"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, can } from "@/lib/store";
import { api } from "@/lib/client-api";
import type { LiveEvent } from "@/lib/store";
import { RiskBadge, StatusBadge, eventIcon, eventTypeLabel, SectionHeader, EmptyState } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ChevronDown, Eye, ShieldOff, CheckCircle2, CheckCheck, Radar, Sparkles, Lock,
} from "lucide-react";

export default function ThreatsView() {
  const user = useApp((s) => s.user);
  const liveEvents = useApp((s) => s.liveEvents);
  const liveConnected = useApp((s) => s.liveConnected);
  const dataDirtyAt = useApp((s) => s.dataDirtyAt);

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const canAct = can(user?.role, "SECURITY_ANALYST");

  const load = useCallback(async () => {
    try {
      const res = await api<{ events: LiveEvent[] }>("/api/security/events?limit=120");
      setEvents(res.events);
    } catch (err) {
      /* keep previous data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, dataDirtyAt]);

  const filtered = useMemo(() => {
    // merge live stream on top of fetched
    const seen = new Set(events.map((e) => e.id));
    const merged = [...liveEvents.filter((e) => !seen.has(e.id)), ...events];
    return merged
      .filter((e) => (level === "ALL" ? true : e.riskLevel === level))
      .filter((e) => (status === "ALL" ? true : e.status === status))
      .filter((e) =>
        q.trim() === ""
          ? true
          : [e.description, e.actorLabel, e.resource, e.location, e.eventType]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q.toLowerCase()))
      )
      .slice(0, 80);
  }, [events, liveEvents, level, status, q]);

  const act = async (id: string, action: "INVESTIGATE" | "BLOCK" | "SAFE" | "RESOLVE") => {
    const label = { INVESTIGATE: "investigation opened", BLOCK: "blocked", SAFE: "marked safe", RESOLVE: "resolved" }[action];
    try {
      const res = await api<{ event: LiveEvent }>(`/api/security/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setEvents((prev) => prev.map((e) => (e.id === id ? res.event : e)));
      toast.success(`Event ${label}`, { description: `${eventTypeLabel(res.event.eventType)} → ${res.event.status}` });
    } catch (err) {
      toast.error("Action failed", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const counts = useMemo(() => {
    const all = [...liveEvents, ...events];
    return {
      critical: all.filter((e) => e.riskLevel === "CRITICAL" && ["NEW", "INVESTIGATING"].includes(e.status)).length,
      high: all.filter((e) => e.riskLevel === "HIGH" && ["NEW", "INVESTIGATING"].includes(e.status)).length,
      live: liveConnected,
    };
  }, [liveEvents, events, liveConnected]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Event Stream"
        sub={`${filtered.length} events · ${counts.critical} critical unhandled · ${counts.high} high unhandled`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search events…" className="pl-8 h-8 w-44 text-xs"
              aria-label="Search events"
            />
          </div>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="h-8 w-[118px] text-xs" aria-label="Filter by risk level">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All levels</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[128px] text-xs" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="INVESTIGATING">Investigating</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
              <SelectItem value="SAFE">Safe</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionHeader>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl">
            <EmptyState icon={Radar} title="No matching events" hint="Adjust filters or trigger Threat Simulation Mode from the topbar." />
          </div>
        ) : (
          filtered.map((e) => {
            const Icon = eventIcon(e.eventType);
            const open = expanded === e.id;
            let payload: Record<string, unknown> = {};
            try { payload = JSON.parse(e.maskedPayload); } catch { /* noop */ }
            return (
              <motion.div layout key={e.id} className="glass rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpanded(open ? null : e.id)}
                  aria-expanded={open}
                >
                  <div className="mt-0.5 h-9 w-9 rounded-lg bg-secondary/70 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{eventTypeLabel(e.eventType)}</p>
                      <RiskBadge level={e.riskLevel} score={e.riskScore} />
                      <StatusBadge status={e.status} />
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/70 mt-1 truncate">
                      {e.actorLabel ?? "masked_user_****"} · {e.ipAddress ?? "ip masked"} · {e.location ?? "location unknown"}
                      {e.resource ? ` · ${e.resource}` : ""}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 mt-2 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/50 px-4 py-3 space-y-3 bg-background/40">
                        {e.aiSummary ? (
                          <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                            <p className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-primary mb-1">
                              <Sparkles className="h-3 w-3" /> AI ANALYSIS
                            </p>
                            <p className="text-xs leading-relaxed">{e.aiSummary}</p>
                            {e.recommendation ? (
                              <p className="text-xs text-muted-foreground mt-1.5">
                                <span className="font-medium text-foreground/80">Recommended: </span>{e.recommendation}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Lock className="h-3 w-3" /> Risk too low for AI narrative — structural telemetry only.
                          </p>
                        )}
                        <div>
                          <p className="text-[10px] font-mono tracking-widest text-muted-foreground mb-1">MASKED PAYLOAD (AI-SAFE VIEW)</p>
                          <pre className="text-[10px] font-mono bg-secondary/40 rounded-lg p-2.5 overflow-x-auto max-h-32 text-teal-200/80">
{JSON.stringify(payload, null, 2)}
                          </pre>
                        </div>
                        {canAct ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => act(e.id, "INVESTIGATE")}>
                              <Eye className="h-3 w-3" /> Investigate
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => act(e.id, "BLOCK")}>
                              <ShieldOff className="h-3 w-3" /> Block
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => act(e.id, "SAFE")}>
                              <CheckCircle2 className="h-3 w-3" /> Mark Safe
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => act(e.id, "RESOLVE")}>
                              <CheckCheck className="h-3 w-3" /> Resolve
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Lock className="h-3 w-3" /> Read-only role — response actions require ANALYST or ADMIN.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
