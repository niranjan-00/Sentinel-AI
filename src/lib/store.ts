"use client";

import { create } from "zustand";

export type Role = "ADMIN" | "SECURITY_ANALYST" | "VIEWER";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status?: string;
  department?: string;
  mfaEnabled?: boolean;
  lastLoginAt?: string | null;
  riskScore?: number;
}

export type Screen = "landing" | "dashboard";

export type DashView =
  | "overview"
  | "threats"
  | "incidents"
  | "data"
  | "iam"
  | "assistant"
  | "analytics"
  | "quantum"
  | "settings";

export interface LiveEvent {
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
  maskedPayload: string;
  aiSummary: string | null;
  recommendation: string | null;
  timestamp: string;
}

interface AppState {
  booted: boolean;
  user: SessionUser | null;
  screen: Screen;
  dashView: DashView;
  authOpen: boolean;
  liveConnected: boolean;
  liveEvents: LiveEvent[];
  dataDirtyAt: number;

  setBooted: (v: boolean) => void;
  setUser: (u: SessionUser | null) => void;
  setScreen: (s: Screen) => void;
  setDashView: (v: DashView) => void;
  setAuthOpen: (v: boolean) => void;
  setLiveConnected: (v: boolean) => void;
  pushLiveEvent: (e: LiveEvent) => void;
  markDataDirty: () => void;
  logout: () => Promise<void>;
}

export const useApp = create<AppState>((set) => ({
  booted: false,
  user: null,
  screen: "landing",
  dashView: "overview",
  authOpen: false,
  liveConnected: false,
  liveEvents: [],
  dataDirtyAt: 0,

  setBooted: (v) => set({ booted: v }),
  setUser: (u) => set({ user: u }),
  setScreen: (s) => set({ screen: s }),
  setDashView: (v) => set({ dashView: v }),
  setAuthOpen: (v) => set({ authOpen: v }),
  setLiveConnected: (v) => set({ liveConnected: v }),
  pushLiveEvent: (e) =>
    set((state) => ({
      liveEvents: [e, ...state.liveEvents.filter((x) => x.id !== e.id)].slice(0, 120),
    })),
  markDataDirty: () => set({ dataDirtyAt: Date.now() }),
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    set({ user: null, screen: "landing", dashView: "overview", liveEvents: [] });
  },
}));

export function can(role: Role | undefined, minimum: Role): boolean {
  if (!role) return false;
  const rank: Record<Role, number> = { VIEWER: 1, SECURITY_ANALYST: 2, ADMIN: 3 };
  return rank[role] >= rank[minimum];
}
