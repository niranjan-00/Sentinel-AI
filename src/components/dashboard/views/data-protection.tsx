"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api, type SensitiveDataEvent } from "@/lib/client-api";
import { useApp } from "@/lib/store";
import { RiskBadge, StatusBadge, SectionHeader, EmptyState } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FileLock2, ScanSearch, ShieldCheck, Database, Wand2, EyeOff, Lock,
} from "lucide-react";

const SAMPLES: Array<{ label: string; text: string }> = [
  {
    label: "Customer email",
    text: "New signup: john.doe@example.com verified at 10:42 from Mumbai.",
  },
  {
    label: "Payment record",
    text: "Card 4532 1234 5678 9010 charged $42.10 — statement mailed to s.lee@corp.io, phone 555-314-4021.",
  },
  {
    label: "Leaked credential",
    text: 'Found in logs: { "api_key": "sk-proj-9f8ac2ef7714bde0", "password": "hunter2secret", "email": "r.kapoor@sentinelcorp.io" }',
  },
  {
    label: "Government ID",
    text: "Passport: XH4823941, SSN 412-88-9021, IBAN DE44 5001 0517 5407 3249 31.",
  },
];

interface MaskResponse {
  masked: string;
  findings: Array<{ type: string; masked: string; count: number }>;
  totalMasked: number;
}

export default function DataProtectionView() {
  const dataDirtyAt = useApp((s) => s.dataDirtyAt);
  const [input, setInput] = useState(SAMPLES[1].text);
  const [result, setResult] = useState<MaskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<{ events: SensitiveDataEvent[]; stats: { last24h: number; totalMasked: number; byType: Array<{ type: string; count: number }> } } | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const res = await api<{ events: SensitiveDataEvent[]; stats: { last24h: number; totalMasked: number; byType: Array<{ type: string; count: number }> } }>("/api/data-protection/events");
      setFeed(res);
    } catch { /* keep */ }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed, dataDirtyAt]);

  const runMask = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const res = await api<MaskResponse>("/api/data-protection/mask", {
        method: "POST",
        body: JSON.stringify({ text: input }),
      });
      setResult(res);
      loadFeed();
      toast.success(`${res.totalMasked} sensitive pattern(s) masked`, { description: "The AI layer never receives the raw form." });
    } catch (err) {
      toast.error("Masking failed", { description: err instanceof Error ? err.message : undefined });
    } finally { setBusy(false); }
  };

  const maxType = Math.max(1, ...(feed?.stats.byType.map((t) => t.count) ?? [1]));

  return (
    <div className="space-y-6">
      {/* pipeline banner */}
      <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-3 border-primary/20">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ring-glow shrink-0">
          <EyeOff className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="flex-1 min-w-[240px]">
          <p className="text-sm font-semibold">Privacy-Aware AI Pipeline</p>
          <p className="text-xs text-muted-foreground">
            Every payload passes through <span className="font-mono text-teal-300">maskSensitiveData()</span> before storage, analysis or inference. Below is the exact view the AI receives.
          </p>
        </div>
        <div className="flex gap-4 font-mono text-[11px] text-muted-foreground">
          <span><span className="text-teal-300 font-bold">{feed?.stats.last24h ?? "—"}</span> events / 24h</span>
          <span><span className="text-teal-300 font-bold">{feed?.stats.totalMasked ?? "—"}</span> total masked</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* masking playground */}
        <div className="glass rounded-xl p-4">
          <SectionHeader title="Masking Playground" sub="Try raw text — see exactly what leaves the trust boundary" />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button key={s.label}
                  onClick={() => setInput(s.text)}
                  className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} className="font-mono text-xs" aria-label="Text to mask" />
            <Button onClick={runMask} disabled={busy || !input.trim()} className="gap-1.5">
              {busy ? <Database className="h-4 w-4 animate-pulse" /> : <ScanSearch className="h-4 w-4" />}
              Mask Sensitive Data
            </Button>

            {result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> MASKED OUTPUT — SAFE FOR AI
                  </p>
                  <pre className="text-xs font-mono bg-emerald-500/5 border border-emerald-500/25 rounded-lg p-3 whitespace-pre-wrap break-words text-emerald-100/90">
{result.masked}
                  </pre>
                </div>
                {result.findings.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.findings.map((f) => (
                      <Badge key={f.type} variant="outline" className="font-mono text-[10px] border-teal-500/40 text-teal-300">
                        {f.type} ×{f.count}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No sensitive patterns detected.</p>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* exposure points + by type */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4">
            <SectionHeader title="Interceptions by Type" sub="All-time masking statistics" />
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {(feed?.stats.byType ?? []).length === 0 ? (
                <Skeleton className="h-32 rounded-lg" />
              ) : (
                feed?.stats.byType.map((t) => (
                  <div key={t.type} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">{t.type}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" style={{ width: `${(t.count / maxType) * 100}%` }} />
                    </div>
                    <span className="font-mono text-xs tabular-nums w-8 text-right">{t.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <SectionHeader title="How AI Innovation Stays Exposure-Free" />
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              {[
                { icon: Wand2, text: "Regex + structural detectors mask emails, cards, SSNs, API keys, passwords, IBANs, phone and health IDs in-flight." },
                { icon: ShieldCheck, text: "AI prompts are built from masked payloads and behavioural features only — never raw identifiers." },
                { icon: Database, text: "Even stored telemetry (maskedPayload) keeps anonymised actor labels like masked_user_****." },
                { icon: FileLock2, text: "Every masking action is audit-logged with actor and finding types — never with raw content." },
              ].map((item, i) => (
                <li key={i} className="flex gap-2.5">
                  <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* events feed */}
      <div className="glass rounded-xl p-4">
        <SectionHeader title="Sensitive-Data Event Log" sub="Detected & neutralised exposures" />
        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-border/50">
          {feed === null ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 rounded" />)}</div>
          ) : feed.events.length === 0 ? (
            <EmptyState icon={FileLock2} title="No exposures recorded" />
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Masked sample</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Exposure point</th>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Risk</th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {feed.events.map((e) => (
                  <tr key={e.id} className="border-t border-border/40 hover:bg-secondary/20">
                    <td className="px-3 py-2 font-mono text-[11px] text-teal-300">{e.dataType}</td>
                    <td className="px-3 py-2 font-mono">{e.maskedSample}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{e.exposurePoint.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2"><StatusBadge status={e.actionTaken} /></td>
                    <td className="px-3 py-2"><RiskBadge level={e.riskLevel} /></td>
                    <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
