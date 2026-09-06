"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { can, useApp } from "@/lib/store";
import { api, type Incident } from "@/lib/client-api";
import { RiskBadge, StatusBadge, SectionHeader, EmptyState } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown, FolderKanban, Sparkles, Plus, Search, Lock, MessagesSquare, UserRound, Waypoints,
} from "lucide-react";

const FLOW = ["DETECTED", "INVESTIGATING", "CONTAINED", "RESOLVED"] as const;

export default function IncidentsView() {
  const user = useApp((s) => s.user);
  const dataDirtyAt = useApp((s) => s.dataDirtyAt);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [assignDraft, setAssignDraft] = useState("");
  const canAct = can(user?.role, "SECURITY_ANALYST");

  const load = useCallback(async () => {
    try {
      const res = await api<{ incidents: Incident[] }>("/api/incidents");
      setIncidents(res.incidents);
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, dataDirtyAt]);

  const patch = async (id: string, body: Record<string, unknown>, okMsg: string) => {
    try {
      const res = await api<{ incident: Incident }>(`/api/incidents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setIncidents((prev) => prev.map((i) => (i.id === id ? res.incident : i)));
      toast.success(okMsg);
    } catch (err) {
      toast.error("Update failed", { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Incident Register"
        sub={`${incidents.filter((i) => i.status !== "RESOLVED").length} open · ${incidents.length} total`}
      >
        <NewIncidentDialog onCreated={(inc) => { setIncidents((p) => [inc, ...p]); }} />
      </SectionHeader>

      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
      ) : incidents.length === 0 ? (
        <div className="glass rounded-xl"><EmptyState icon={FolderKanban} title="No incidents" hint="Trigger Threat Simulation Mode to generate one." /></div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const open = expanded === inc.id;
            const stepIdx = FLOW.indexOf(inc.status);
            let notes: Array<{ author: string; text: string; at: string }> = [];
            try { notes = JSON.parse(inc.notes); } catch { /* noop */ }
            return (
              <motion.div layout key={inc.id} className="glass rounded-xl">
                <button className="w-full text-left px-4 py-3.5" onClick={() => setExpanded(open ? null : inc.id)} aria-expanded={open}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] tracking-wider">{inc.code}</Badge>
                    <p className="text-sm font-semibold flex-1 min-w-[200px]">{inc.title}</p>
                    <RiskBadge level={inc.severity} />
                    <StatusBadge status={inc.status} />
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                  </div>
                  {/* workflow stepper */}
                  <div className="flex items-center gap-1.5 mt-3" aria-hidden>
                    {FLOW.map((s, i) => (
                      <div key={s} className="flex items-center gap-1.5 flex-1">
                        <div className={`h-1.5 flex-1 rounded-full ${i <= stepIdx ? (inc.status === "RESOLVED" ? "bg-emerald-400" : "bg-primary") : "bg-secondary"}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                    <span>System: <span className="text-foreground/80">{inc.affectedSystem}</span></span>
                    <span>Detected: {new Date(inc.detectionTime).toLocaleString()}</span>
                    {inc.assignedAnalyst && <span>Analyst: <span className="text-foreground/80">{inc.assignedAnalyst}</span></span>}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="border-t border-border/50 px-4 py-4 space-y-4 bg-background/40">
                        <p className="text-xs text-muted-foreground leading-relaxed">{inc.description}</p>

                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                            <p className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-primary mb-1">
                              <Sparkles className="h-3 w-3" /> AI ANALYSIS
                            </p>
                            <p className="text-xs leading-relaxed">{inc.aiAnalysis ?? "Not yet generated."}</p>
                            {inc.recommendedAction && (
                              <p className="text-xs text-muted-foreground mt-1.5">
                                <span className="text-foreground/80 font-medium">Action: </span>{inc.recommendedAction}
                              </p>
                            )}
                          </div>
                          <div className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5">
                            <p className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-muted-foreground mb-1.5">
                              <MessagesSquare className="h-3 w-3" /> RESPONSE NOTES
                            </p>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                              {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
                              {notes.map((n, i) => (
                                <div key={i} className="text-xs">
                                  <span className="font-medium">{n.author}</span>
                                  <span className="text-muted-foreground/60 font-mono text-[10px] ml-1.5">{new Date(n.at).toLocaleTimeString()}</span>
                                  <p className="text-muted-foreground">{n.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {canAct ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={inc.status === "INVESTIGATING" || inc.status === "RESOLVED"}
                                onClick={() => patch(inc.id, { action: "INVESTIGATE" }, `${inc.code} → INVESTIGATING`)}>
                                Investigate
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-teal-500/40 text-teal-300 hover:bg-teal-500/10" disabled={inc.status === "CONTAINED" || inc.status === "RESOLVED"}
                                onClick={() => patch(inc.id, { action: "CONTAIN" }, `${inc.code} contained`)}>
                                Contain
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" disabled={inc.status === "RESOLVED"}
                                onClick={() => patch(inc.id, { action: "RESOLVE" }, `${inc.code} resolved`)}>
                                Resolve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => patch(inc.id, { regenerateAi: true }, "AI analysis regenerated")}>
                                <Sparkles className="h-3 w-3" /> Re-run AI
                              </Button>
                            </div>
                            <div className="grid md:grid-cols-2 gap-2">
                              <div className="flex gap-2">
                                <Input value={assignDraft} onChange={(e) => setAssignDraft(e.target.value)} placeholder="Assign analyst name…" className="h-8 text-xs" aria-label="Assign analyst" />
                                <Button size="sm" variant="secondary" className="h-8 gap-1 text-xs shrink-0" disabled={!assignDraft.trim()}
                                  onClick={() => { patch(inc.id, { assignedAnalyst: assignDraft.trim() }, "Analyst assigned"); setAssignDraft(""); }}>
                                  <UserRound className="h-3 w-3" /> Assign
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add investigation note…" rows={1} className="min-h-8 h-8 py-1.5 text-xs resize-none" aria-label="Incident note" />
                                <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" disabled={!noteDraft.trim()}
                                  onClick={() => { patch(inc.id, { note: noteDraft.trim() }, "Note added"); setNoteDraft(""); }}>
                                  Add
                                </Button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Lock className="h-3 w-3" /> Read-only role — incident response requires ANALYST or ADMIN.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewIncidentDialog({ onCreated }: { onCreated: (inc: Incident) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "MEDIUM", affectedSystem: "" });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await api<{ incident: Incident }>("/api/incidents", { method: "POST", body: JSON.stringify(form) });
      onCreated(res.incident);
      setOpen(false);
      setForm({ title: "", description: "", severity: "MEDIUM", affectedSystem: "" });
      toast.success(`Incident ${res.incident.code} created`);
    } catch (err) {
      toast.error("Creation failed", { description: err instanceof Error ? err.message : undefined });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New Incident</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Waypoints className="h-4 w-4 text-primary" /> Declare Incident</DialogTitle>
          <DialogDescription>Opens in DETECTED state with triage guidance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Incident title" />
          <Input placeholder="Affected system" value={form.affectedSystem} onChange={(e) => setForm({ ...form, affectedSystem: e.target.value })} aria-label="Affected system" />
          <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} aria-label="Description" />
          <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
            <SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">LOW</SelectItem>
              <SelectItem value="MEDIUM">MEDIUM</SelectItem>
              <SelectItem value="HIGH">HIGH</SelectItem>
              <SelectItem value="CRITICAL">CRITICAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy || !form.title || !form.description || !form.affectedSystem}>
            {busy ? "Creating…" : "Declare Incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
