"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import { useApp, can } from "@/lib/store";
import { SectionHeader } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Bot, ShieldCheck, ScrollText, LogOut, Database, Lock } from "lucide-react";

export default function SettingsView() {
  const user = useApp((s) => s.user);
  const logout = useApp((s) => s.logout);
  const setScreen = useApp((s) => s.setScreen);
  const [aiStatus, setAiStatus] = useState<{ provider: string; label: string; mockFallback: string } | null>(null);

  useEffect(() => {
    api<{ provider: string; label: string; mockFallback: string }>("/api/ai/status")
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, []);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* profile */}
      <div className="glass rounded-xl p-5">
        <SectionHeader title="Profile & Session" sub="JWT session · 7-day expiry · httpOnly cookie" />
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-base font-bold">
                {user.name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="text-[10px] font-mono tracking-widest text-muted-foreground">ROLE</p>
                <p className="font-mono text-teal-300 mt-1">{user.role.replace("_", " ")}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="text-[10px] font-mono tracking-widest text-muted-foreground">DEPARTMENT</p>
                <p className="mt-1">{user.department ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="text-[10px] font-mono tracking-widest text-muted-foreground">MFA</p>
                <p className={`mt-1 font-mono ${user.mfaEnabled ? "text-emerald-300" : "text-amber-300"}`}>
                  {user.mfaEnabled ? "ENABLED" : "NOT ENFORCED"}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="text-[10px] font-mono tracking-widest text-muted-foreground">STATUS</p>
                <p className="mt-1 font-mono text-emerald-300">{user.status ?? "ACTIVE"}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { logout(); toast("Signed out"); }}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setScreen("landing")}>
                Back to site
              </Button>
            </div>
          </div>
        ) : (
          <Skeleton className="h-48 rounded-xl" />
        )}
      </div>

      {/* AI provider */}
      <div className="glass rounded-xl p-5">
        <SectionHeader title="AI Engine" sub="Provider abstraction — replaceable via environment variables" />
        {aiStatus === null ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-primary mb-1">
                <Bot className="h-3 w-3" /> ACTIVE PROVIDER
              </p>
              <p className="text-sm font-semibold">{aiStatus.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{aiStatus.mockFallback}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-widest text-muted-foreground mb-1.5">SWITCH PROVIDERS</p>
              <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
                <p><span className="text-teal-300">OPENAI_API_KEY=</span> → OpenAI chat models</p>
                <p><span className="text-teal-300">GROQ_API_KEY=</span> → Groq (Llama 3.3 70B)</p>
                <p><span className="text-teal-300">OLLAMA_BASE_URL=</span> → self-hosted Ollama</p>
                <p><span className="text-teal-300">(none set)</span> → platform runtime + sentinel-rules-v1 fallback</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* security posture */}
      <div className="glass rounded-xl p-5">
        <SectionHeader title="Security Controls" sub="Platform hardening (this deployment)" />
        <div className="space-y-2">
          {[
            { icon: Lock, label: "Password hashing", detail: "bcrypt, per-user salt" },
            { icon: ShieldCheck, label: "JWT sessions", detail: "HS256, httpOnly + sameSite cookies" },
            { icon: ShieldCheck, label: "RBAC", detail: "ADMIN / SECURITY_ANALYST / VIEWER enforced server-side" },
            { icon: Database, label: "Input validation", detail: "Zod schemas on every mutation endpoint" },
            { icon: ScrollText, label: "Rate limiting", detail: "Login, register, AI chat, masking playground" },
            { icon: ScrollText, label: "Audit trail", detail: "Auth, IAM, incident & simulation actions logged" },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5">
              <c.icon className="h-4 w-4 text-emerald-300 shrink-0" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">{c.detail}</p>
              </div>
              <Badge variant="outline" className="font-mono text-[9px] border-emerald-500/40 text-emerald-300">ON</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* about */}
      <div className="glass rounded-xl p-5">
        <SectionHeader title="About SENTINEL AI" sub="IBM Z Datathon 2026" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Detect. Protect. Predict.</span> — SENTINEL AI is an
          AI-powered cybersecurity, privacy and sensitive-data protection platform demonstrating{" "}
          <span className="text-teal-300">AI innovation without exposure</span>: anomaly detection, threat
          classification, risk scoring, incident response, quantum-safe readiness assessment and a secure AI
          assistant — with sensitive data masked before every AI hop.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["Next.js 16", "TypeScript", "Prisma", "JWT + RBAC", "SSE realtime", "z-ai / OpenAI / Groq / Ollama", "Privacy-aware AI"].map((t) => (
            <Badge key={t} variant="outline" className="font-mono text-[9px]">{t}</Badge>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Role tier: <span className="font-mono">{can(user?.role, "ADMIN") ? "full administration" : can(user?.role, "SECURITY_ANALYST") ? "analyst response" : "read-only"}</span>
        </p>
      </div>
    </div>
  );
}
