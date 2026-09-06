"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api, type QuantumAsset } from "@/lib/client-api";
import { useApp } from "@/lib/store";
import { SectionHeader, StatusBadge, RiskBadge, EmptyState } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Atom, Info, Sparkles, ShieldQuestion } from "lucide-react";

interface QuantumResponse {
  assets: QuantumAsset[];
  readiness: number;
  distribution: { strong: number; review: number; legacy: number; total: number };
  disclaimer: string;
}

export default function QuantumView() {
  const user = useApp((s) => s.user);
  const [data, setData] = useState<QuantumResponse | null>(null);
  const [briefing, setBriefing] = useState<{ summary: string; model: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<QuantumResponse>("/api/quantum/assessment")); } catch { /* keep */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const runBriefing = async () => {
    setBusy(true);
    try {
      const res = await api<{ summary: string; model: string }>("/api/quantum/analyze", { method: "POST" });
      setBriefing(res);
      toast.success("AI quantum-readiness briefing generated", { description: `model: ${res.model}` });
    } catch (err) {
      toast.error("Briefing failed", { description: err instanceof Error ? err.message : undefined });
    } finally { setBusy(false); }
  };

  const canAct = user?.role === "ADMIN" || user?.role === "SECURITY_ANALYST";
  const d = data?.distribution;

  return (
    <div className="space-y-4">
      {/* disclaimer */}
      <div className="glass rounded-xl p-3.5 flex items-start gap-3 border-amber-500/25 bg-amber-500/5">
        <Info className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-amber-200">Quantum-Safe Readiness Assessment.</span>{" "}
          This module evaluates your cryptographic inventory and produces migration-planning guidance. It does{" "}
          <span className="font-semibold">not</span> implement quantum-safe cryptography.
        </p>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* score panel */}
        <div className="glass rounded-xl p-5 flex flex-col items-center justify-center gap-4">
          {data ? (
            <>
              <div className="relative">
                <motion.svg
                  width="170" height="170" viewBox="0 0 170 170"
                  initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: -90, opacity: 1 }} transition={{ duration: 0.6 }}
                  role="img" aria-label={`Quantum readiness ${data.readiness}%`}
                >
                  <circle cx="85" cy="85" r="72" fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="10" />
                  <motion.circle
                    cx="85" cy="85" r="72" fill="none" stroke="#a78bfa" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 72}
                    initial={{ strokeDashoffset: 2 * Math.PI * 72 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 72 * (1 - data.readiness / 100) }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                  />
                </motion.svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tabular-nums">{data.readiness}%</span>
                  <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">Readiness</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full text-center">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 py-2">
                  <p className="text-lg font-bold text-emerald-300">{d?.strong}</p>
                  <p className="text-[9px] font-mono tracking-wider text-muted-foreground">STRONG</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 py-2">
                  <p className="text-lg font-bold text-amber-300">{d?.review}</p>
                  <p className="text-[9px] font-mono tracking-wider text-muted-foreground">REVIEW</p>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/25 py-2">
                  <p className="text-lg font-bold text-red-300">{d?.legacy}</p>
                  <p className="text-[9px] font-mono tracking-wider text-muted-foreground">LEGACY</p>
                </div>
              </div>
              {canAct && (
                <Button onClick={runBriefing} disabled={busy} className="w-full gap-1.5">
                  {busy ? <Atom className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate AI Briefing
                </Button>
              )}
            </>
          ) : (
            <Skeleton className="h-56 w-full rounded-xl" />
          )}
        </div>

        {/* briefing + table */}
        <div className="space-y-4">
          {briefing && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 border-violet-500/25 bg-violet-500/5">
              <p className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-violet-300 mb-1.5">
                <Sparkles className="h-3 w-3" /> AI MIGRATION BRIEFING · {briefing.model}
              </p>
              <p className="text-sm leading-relaxed">{briefing.summary}</p>
            </motion.div>
          )}

          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 pt-4">
              <SectionHeader title="Cryptographic Asset Inventory" sub={`${data?.assets.length ?? 0} systems assessed`} />
            </div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              {data === null ? (
                <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
              ) : data.assets.length === 0 ? (
                <EmptyState icon={ShieldQuestion} title="No assets inventoried" />
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-secondary/80 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2.5">System</th>
                      <th className="text-left px-3 py-2.5">Encryption</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5">Quantum Risk</th>
                      <th className="text-left px-3 py-2.5 hidden lg:table-cell">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assets.map((a) => (
                      <tr key={a.id} className="border-t border-border/40 hover:bg-secondary/20">
                        <td className="px-3 py-2.5 font-medium">{a.systemName}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          {a.encryption}
                          {a.keyLength && a.keyLength !== "n/a" ? <span className="text-muted-foreground"> · {a.keyLength}</span> : null}
                        </td>
                        <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                        <td className="px-3 py-2.5"><RiskBadge level={a.quantumRisk} /></td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground max-w-xs">{a.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["ML-KEM (Kyber)", "ML-DSA (Dilithium)", "Harvest-now-decrypt-later", "Crypto-agility", "Hybrid TLS"].map((tag) => (
              <Badge key={tag} variant="outline" className="font-mono text-[10px] border-violet-500/30 text-violet-300/90">{tag}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
