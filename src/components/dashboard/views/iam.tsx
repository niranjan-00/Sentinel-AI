"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { can, useApp } from "@/lib/store";
import { api, type IamUser, type ActiveSession, type AccessLogRow, type AuditRow } from "@/lib/client-api";
import { RiskBadge, StatusBadge, SectionHeader, EmptyState } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Fingerprint, Search, MoreHorizontal, Lock, Unlock, ShieldAlert, UserCog,
  KeyRound, RotateCcw, Trash2, Ban, Users, ScrollText, History,
} from "lucide-react";

export default function IamView() {
  const user = useApp((s) => s.user);
  const isAdmin = can(user?.role, "ADMIN");
  const [users, setUsers] = useState<IamUser[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [logs, setLogs] = useState<AccessLogRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ users: IamUser[]; sessions: ActiveSession[]; accessLogs: AccessLogRow[]; auditLogs: AuditRow[] }>("/api/iam/overview");
      setUsers(res.users); setSessions(res.sessions); setLogs(res.accessLogs); setAudit(res.auditLogs);
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredUsers = users.filter((u) =>
    q.trim() === "" ? true : [u.email, u.name, u.department].some((v) => v.toLowerCase().includes(q.toLowerCase()))
  );

  const userAction = async (id: string, action: string, label: string, role?: string) => {
    try {
      const res = await api<{ user: IamUser }>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ action, role }) });
      setUsers((prev) => prev.map((u) => (u.id === id ? res.user : u)));
      toast.success(label, { description: res.user.email });
    } catch (err) {
      toast.error("Action failed", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const revoke = async (sessionId: string) => {
    try {
      await api("/api/iam/actions", { method: "POST", body: JSON.stringify({ action: "REVOKE_SESSION", sessionId }) });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Session revoked");
    } catch (err) {
      toast.error("Revoke failed", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const removeUser = async (id: string, email: string) => {
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User removed", { description: email });
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Identity & Access"
        sub={`${users.length} accounts · ${sessions.length} live sessions · zero-trust policies enforced`}
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="pl-8 h-8 w-48 text-xs" aria-label="Search users" />
        </div>
      </SectionHeader>

      <Tabs defaultValue="users">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5 text-xs"><Fingerprint className="h-3.5 w-3.5" /> Sessions</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" /> Logins</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs"><ScrollText className="h-3.5 w-3.5" /> Audit</TabsTrigger>
        </TabsList>

        {/* USERS */}
        <TabsContent value="users">
          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
              ) : filteredUsers.length === 0 ? (
                <EmptyState icon={Users} title="No users match" />
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-secondary/80 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-muted-foreground z-10">
                    <tr>
                      <th className="text-left px-3 py-2.5">User</th>
                      <th className="text-left px-3 py-2.5">Role</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">Last Login</th>
                      <th className="text-left px-3 py-2.5">Risk</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5 hidden sm:table-cell">MFA</th>
                      {isAdmin && <th className="text-right px-3 py-2.5">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-t border-border/40 hover:bg-secondary/20">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{u.email}</p>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-teal-300">{u.role.replace("_", " ")}</td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                          {u.lastLoginAt ? timeAgo(u.lastLoginAt) : "never"}
                        </td>
                        <td className="px-3 py-2.5"><RiskBadge level={riskLevelOf(u.riskScore)} score={u.riskScore} /></td>
                        <td className="px-3 py-2.5"><StatusBadge status={u.status} /></td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          {u.mfaEnabled
                            ? <span className="text-emerald-300 font-mono text-[10px]">ON</span>
                            : <span className="text-amber-300 font-mono text-[10px]">OFF</span>}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-2.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for ${u.email}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground">{u.email}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {u.status === "LOCKED" ? (
                                  <DropdownMenuItem onClick={() => userAction(u.id, "UNLOCK", "Account unlocked")}><Unlock className="h-3.5 w-3.5 mr-2" /> Unlock Account</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => userAction(u.id, "LOCK", "Account locked")}><Lock className="h-3.5 w-3.5 mr-2" /> Lock Account</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => userAction(u.id, "REQUIRE_MFA", "MFA enforced")}><ShieldAlert className="h-3.5 w-3.5 mr-2" /> Require MFA</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => userAction(u.id, "RESET_ACCESS", "Access reset — credentials rotated")}><RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset Access</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground">Change role</DropdownMenuLabel>
                                {(["ADMIN", "SECURITY_ANALYST", "VIEWER"] as const).map((r) => (
                                  <DropdownMenuItem key={r} disabled={u.role === r} onClick={() => userAction(u.id, "CHANGE_ROLE", `Role → ${r}`, r)}>
                                    <UserCog className="h-3.5 w-3.5 mr-2" /> {r.replace("_", " ")}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-300 focus:text-red-300" onClick={() => removeUser(u.id, u.email)}>
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete user
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* SESSIONS */}
        <TabsContent value="sessions">
          <div className="grid md:grid-cols-2 gap-3">
            {sessions.length === 0 ? (
              <div className="glass rounded-xl md:col-span-2"><EmptyState icon={Fingerprint} title="No active sessions" /></div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="glass rounded-xl p-4 flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.status === "SUSPICIOUS" ? "bg-amber-500/15" : "bg-emerald-500/15"}`}>
                    <Fingerprint className={`h-4 w-4 ${s.status === "SUSPICIOUS" ? "text-amber-300" : "text-emerald-300"}`} aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{s.userEmail}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground mt-1">
                      {s.device} · {s.ipAddress} · {s.location}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/70">
                      started {timeAgo(s.startedAt)} · active {timeAgo(s.lastActivity)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] shrink-0" onClick={() => revoke(s.id)}>
                    <Ban className="h-3 w-3" /> Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* LOGIN HISTORY */}
        <TabsContent value="logs">
          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/80 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2.5">User</th>
                    <th className="text-left px-3 py-2.5">Action</th>
                    <th className="text-left px-3 py-2.5">Resource</th>
                    <th className="text-left px-3 py-2.5">Result</th>
                    <th className="text-left px-3 py-2.5 hidden sm:table-cell">Location</th>
                    <th className="text-left px-3 py-2.5">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-border/40 hover:bg-secondary/20">
                      <td className="px-3 py-2 font-mono text-[11px]">{l.userEmail}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{l.action.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.resource ?? "—"}</td>
                      <td className="px-3 py-2"><StatusBadge status={l.result} /></td>
                      <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{l.location ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(l.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* AUDIT */}
        <TabsContent value="audit">
          <div className="glass rounded-xl p-4">
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {audit.map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-xs border-b border-border/30 pb-2.5 last:border-0">
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-36">{new Date(a.timestamp).toLocaleString()}</span>
                  <Badge variant="outline" className="font-mono text-[9px] shrink-0">{a.action.replace(/_/g, " ")}</Badge>
                  <div className="min-w-0">
                    <span className="font-medium">{a.actorEmail}</span>
                    {a.detail && <span className="text-muted-foreground"> — {a.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function riskLevelOf(score: number): string {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
