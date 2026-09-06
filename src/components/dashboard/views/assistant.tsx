"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/client-api";
import { useApp } from "@/lib/store";
import { SectionHeader } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, ShieldCheck, EyeOff, User, Sparkles } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  privacyNote?: string | null;
}

const SUGGESTIONS = [
  "Why was the last login flagged?",
  "Show today's biggest security risks.",
  "How can we reduce the risk?",
  "Explain the most critical incident.",
];

export default function AssistantView() {
  const user = useApp((s) => s.user);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "SENTINEL ASSISTANT online. I analyse the live security estate — events, anomalies and incidents — using masked data only. Identities appear as masked_user_****; raw PII never enters my context. Ask me why an alert is critical, what caused an anomaly, or how to reduce risk.",
      model: "sentinel",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await api<{ reply: string; model: string; privacyNote: string | null }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 600) })),
        }),
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply, model: res.model, privacyNote: res.privacyNote }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `I could not complete that analysis: ${err instanceof Error ? err.message : "unknown error"}. The deterministic rules engine remains available for all events regardless.` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-4">
      <div className="glass rounded-xl flex flex-col h-[calc(100vh-230px)] min-h-[480px]">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
          <div className="h-9 w-9 rounded-xl bg-primary/10 ring-glow flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">SENTINEL Assistant</p>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider">SECURE AI · MASKED CONTEXT · SOC-GRADED</p>
          </div>
          <Badge variant="outline" className="font-mono text-[9px] tracking-widest border-emerald-500/40 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1 threat-pulse" aria-hidden /> ONLINE
          </Badge>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-primary" aria-hidden />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-primary/15 border border-primary/25" : "bg-secondary/50 border border-border/50"}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                {m.privacyNote && (
                  <p className="mt-2 text-[10px] font-mono text-teal-300/90 flex items-center gap-1 border-t border-border/40 pt-1.5">
                    <EyeOff className="h-3 w-3 shrink-0" aria-hidden /> {m.privacyNote}
                  </p>
                )}
                {m.model && m.role === "assistant" && (
                  <p className="mt-1 text-[9px] font-mono text-muted-foreground/60">{m.model === "sentinel" ? "sentinel" : `model: ${m.model}`}</p>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 rounded-lg bg-secondary/70 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
              )}
            </motion.div>
          ))}
          {busy && (
            <div className="flex gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" aria-hidden />
              </div>
              <div className="bg-secondary/50 border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }}
                    aria-hidden
                  />
                ))}
                <span className="sr-only">Assistant is thinking</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/50 p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about an alert, anomaly, incident or risk posture…"
              rows={1}
              className="min-h-10 resize-none text-sm"
              aria-label="Message SENTINEL Assistant"
            />
            <Button onClick={() => send()} disabled={busy || !input.trim()} size="icon" className="h-10 w-10 shrink-0" aria-label="Send message">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass rounded-xl p-4">
          <SectionHeader title="Suggested Prompts" />
          <div className="space-y-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="w-full text-left rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-xs hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3 inline mr-1.5 text-primary" aria-hidden />
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <SectionHeader title="Privacy Guarantees" />
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden /> Your message is masked before inference — pasted PII never reaches the model.</li>
            <li className="flex gap-2"><EyeOff className="h-4 w-4 text-teal-300 shrink-0 mt-0.5" aria-hidden /> Context is aggregated and anonymised (masked_user_****, masked IPs).</li>
            <li className="flex gap-2"><Bot className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden /> Provider abstraction: OpenAI / Groq / Ollama via env, platform runtime fallback, deterministic rules as last resort.</li>
          </ul>
        </div>

        <p className="text-[10px] font-mono text-muted-foreground px-1">
          Signed in as {user?.email} · rate-limited to 20 queries/min
        </p>
      </div>
    </div>
  );
}
