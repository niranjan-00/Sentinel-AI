"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, can, type DashView } from "@/lib/store";
import { useLiveEvents } from "@/hooks/use-live-events";
import { api } from "@/lib/client-api";
import {
  LayoutDashboard, Radar, FolderKanban, FileLock2, Fingerprint, Bot,
  ChartColumnBig, Atom, Settings, ShieldCheck, LogOut, Menu, Zap, Bell,
  RefreshCcw, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast as sonner } from "sonner";

import OverviewView from "@/components/dashboard/views/overview";
import ThreatsView from "@/components/dashboard/views/threats";
import IncidentsView from "@/components/dashboard/views/incidents";
import DataProtectionView from "@/components/dashboard/views/data-protection";
import IamView from "@/components/dashboard/views/iam";
import AssistantView from "@/components/dashboard/views/assistant";
import AnalyticsView from "@/components/dashboard/views/analytics";
import QuantumView from "@/components/dashboard/views/quantum";
import SettingsView from "@/components/dashboard/views/settings";

const NAV: Array<{ id: DashView; label: string; icon: typeof LayoutDashboard; min?: "ADMIN" | "SECURITY_ANALYST" }> = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "threats", label: "Threat Monitor", icon: Radar },
  { id: "incidents", label: "Incidents", icon: FolderKanban },
  { id: "data", label: "Data Protection", icon: FileLock2 },
  { id: "iam", label: "Identity & Access", icon: Fingerprint },
  { id: "assistant", label: "AI Assistant", icon: Bot },
  { id: "analytics", label: "Analytics", icon: ChartColumnBig },
  { id: "quantum", label: "Quantum Readiness", icon: Atom },
  { id: "settings", label: "Settings", icon: Settings },
];

const ATTACKS = [
  { id: "BRUTE_FORCE", label: "Brute Force Attack" },
  { id: "SUSPICIOUS_LOGIN", label: "Suspicious Login" },
  { id: "DATA_EXFILRATION", label: "Data Exfiltration" },
  { id: "UNAUTHORIZED_ACCESS", label: "Unauthorized Access" },
  { id: "AI_DATA_EXPOSURE", label: "AI Data Exposure Attempt" },
  { id: "INSIDER_THREAT", label: "Insider Threat" },
] as const;

const VIEW_META: Record<DashView, { title: string; sub: string }> = {
  overview: { title: "Security Operations", sub: "Real-time enterprise security intelligence" },
  threats: { title: "Live Threat Monitor", sub: "Streaming events · investigate, block, resolve" },
  incidents: { title: "Incident Response Center", sub: "Detect → Investigate → Contain → Resolve" },
  data: { title: "Data Protection Center", sub: "Sensitive-data masking before AI processing" },
  iam: { title: "Identity & Access Management", sub: "Users, sessions, login history & audit trail" },
  assistant: { title: "SENTINEL Assistant", sub: "Privacy-aware AI security analyst" },
  analytics: { title: "Threat Analytics", sub: "24-hour threat landscape" },
  quantum: { title: "Quantum-Safe Readiness Assessment", sub: "Cryptographic inventory & migration planning" },
  settings: { title: "Settings", sub: "Profile, AI provider & platform configuration" },
};

export default function DashboardShell() {
  const user = useApp((s) => s.user);
  const dashView = useApp((s) => s.dashView);
  const setDashView = useApp((s) => s.setDashView);
  const setScreen = useApp((s) => s.setScreen);
  const logout = useApp((s) => s.logout);
  const liveConnected = useApp((s) => s.liveConnected);

  useLiveEvents(true);

  // keyboard: escape hatch to landing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (e.target as HTMLElement)?.tagName === "BODY") setScreen("landing");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setScreen]);

  const nav = useMemo(
    () => NAV.filter((n) => !n.min || can(user?.role, n.min)),
    [user?.role]
  );

  const simulate = async (attackType: string, label: string) => {
    try {
      const res = await api<{
        headline: string; incidentCode: string | null; aiSummary: string; recommendation: string;
      }>("/api/security/simulate", {
        method: "POST",
        body: JSON.stringify({ attackType }),
      });
      sonner.success(`Simulation complete — ${label}`, {
        description: `${res.headline}${res.incidentCode ? ` · ${res.incidentCode} opened` : ""}`,
        duration: 8000,
      });
    } catch (err) {
      toast.error("Simulation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 ring-glow flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-mono font-bold tracking-widest text-sm leading-none">SENTINEL AI</p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1 tracking-wider">DETECT · PROTECT · PREDICT</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 overflow-y-auto" aria-label="Dashboard sections">
        {nav.map((item) => {
          const active = dashView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setDashView(item.id)}
              aria-current={active ? "page" : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
              {active && <motion.span layoutId="nav-pill" className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-secondary/40 p-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {user?.name?.slice(0, 2).toUpperCase() ?? "??"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[10px] font-mono text-muted-foreground truncate">{user?.role.replace("_", " ")}</p>
          </div>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-300"
            onClick={() => { logout(); toast("Signed out — session cleared"); }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar">
        {SidebarContent}
      </aside>

      {/* mobile sidebar */}
      <Sheet>
        <div className="lg:hidden">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute left-3 top-3.5 z-40" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          {SidebarContent}
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        {/* topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur px-4 lg:px-6">
          <div className="lg:hidden w-8" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold truncate">{VIEW_META[dashView].title}</h1>
            <p className="text-[11px] text-muted-foreground truncate hidden sm:block">{VIEW_META[dashView].sub}</p>
          </div>

          {/* live indicator */}
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1" aria-live="polite">
            <Radio className={`h-3.5 w-3.5 ${liveConnected ? "text-emerald-400" : "text-muted-foreground"}`} aria-hidden />
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground">
              {liveConnected ? "LIVE STREAM" : "CONNECTING…"}
            </span>
            {liveConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 threat-pulse" aria-hidden />}
          </div>

          {/* simulate attack */}
          {can(user?.role, "SECURITY_ANALYST") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 hover:text-red-200 font-mono text-xs tracking-wider">
                  <Zap className="h-3.5 w-3.5" aria-hidden />
                  SIMULATE ATTACK
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[10px] font-mono tracking-widest text-muted-foreground">
                  THREAT SIMULATION MODE
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ATTACKS.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => simulate(a.id, a.label)} className="text-xs">
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <AlertsButton />

          <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8" onClick={() => setScreen("landing")} aria-label="Back to site">
            <RefreshCcw className="h-4 w-4 rotate-90 text-muted-foreground" />
          </Button>
        </header>

        {/* content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={dashView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="p-4 lg:p-6 max-w-[1500px] mx-auto"
            >
              {dashView === "overview" && <OverviewView />}
              {dashView === "threats" && <ThreatsView />}
              {dashView === "incidents" && <IncidentsView />}
              {dashView === "data" && <DataProtectionView />}
              {dashView === "iam" && <IamView />}
              {dashView === "assistant" && <AssistantView />}
              {dashView === "analytics" && <AnalyticsView />}
              {dashView === "quantum" && <QuantumView />}
              {dashView === "settings" && <SettingsView />}
            </motion.div>
          </AnimatePresence>

          <footer className="mt-auto border-t border-border/60 px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              © 2026 SENTINEL AI — Built for the IBM Z Datathon 2026. Privacy-aware AI: sensitive data is masked before inference.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[9px] tracking-widest">JWT + RBAC</Badge>
              <Badge variant="outline" className="font-mono text-[9px] tracking-widest">SSE LIVE</Badge>
              <Badge variant="outline" className="font-mono text-[9px] tracking-widest">PII MASKED</Badge>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function AlertsButton() {
  const [alerts, setAlerts] = useState<Array<{ id: string; title: string; message: string; severity: string; acknowledged: boolean; createdAt: string }>>([]);
  const [open, setOpen] = useState(false);

  const load = () => {
    api<{ alerts: typeof alerts }>("/api/security/alerts")
      .then((d) => setAlerts(d.alerts))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const unack = alerts.filter((a) => !a.acknowledged).length;

  const ack = async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    await api("/api/security/alerts", { method: "PATCH", body: JSON.stringify({ id, acknowledged: true }) }).catch(() => {});
  };

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label={`Alerts${unack ? ` — ${unack} unacknowledged` : ""}`}>
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unack > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-0.5 threat-pulse">
              {unack}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] font-mono tracking-widest text-muted-foreground">SECURITY ALERTS</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 && <p className="text-xs text-muted-foreground p-3">No alerts — all quiet.</p>}
        {alerts.map((a) => (
          <div key={a.id} className={`px-3 py-2.5 text-xs border-b border-border/40 last:border-0 ${a.acknowledged ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium truncate">{a.title}</p>
              {!a.acknowledged && (
                <button className="text-[10px] font-mono text-primary hover:underline shrink-0" onClick={() => ack(a.id)}>
                  ACK
                </button>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
