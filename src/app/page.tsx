"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import LandingPage from "@/components/landing/landing-page";
import AuthModal from "@/components/auth/auth-modal";
import DashboardShell from "@/components/dashboard/shell";
import { api } from "@/lib/client-api";
import { ShieldCheck } from "lucide-react";

export default function Home() {
  const booted = useApp((s) => s.booted);
  const user = useApp((s) => s.user);
  const screen = useApp((s) => s.screen);
  const authOpen = useApp((s) => s.authOpen);
  const setBooted = useApp((s) => s.setBooted);
  const setUser = useApp((s) => s.setUser);
  const setScreen = useApp((s) => s.setScreen);
  const setAuthOpen = useApp((s) => s.setAuthOpen);

  useEffect(() => {
    api<{ user: import("@/lib/store").SessionUser | null }>("/api/auth/me")
      .then((d) => {
        setUser(d.user);
        if (d.user) setScreen("landing"); // land on marketing, dashboard via CTA
      })
      .catch(() => setUser(null))
      .finally(() => setBooted(true));
  }, [setUser, setScreen, setBooted]);

  if (!booted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 ring-glow flex items-center justify-center animate-pulse">
          <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
          Initialising Sentinel…
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {screen === "dashboard" && user ? (
        <DashboardShell />
      ) : (
        <LandingPage
          onLaunchDashboard={() => {
            if (user) setScreen("dashboard");
            else setAuthOpen(true);
          }}
          onGetStarted={() => setAuthOpen(true)}
        />
      )}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </main>
  );
}
