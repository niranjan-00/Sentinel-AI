"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Activity, BrainCircuit, EyeOff, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/* Palette — teal primary, red/amber threat accents (no blue/indigo) */
const TEAL = "94, 234, 212";
const RED = "248, 113, 113";
const AMBER = "251, 191, 36";
const TAU = Math.PI * 2;

type NodeKind = "normal" | "threat" | "warn";

interface NetNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: NodeKind;
  phase: number;
}

interface NetEdge {
  a: number;
  b: number;
  d: number;
}

interface Pulse {
  a: number;
  b: number;
  t: number;
  speed: number;
  dir: 1 | -1;
  color: string;
}

/** Threat nodes (red) + warn nodes (amber) — indices into the 28-node field */
const THREAT_INDICES = new Set([4, 13, 21, 26]);
const WARN_INDICES = new Set([9, 18]);

function nodeColor(kind: NodeKind): string {
  if (kind === "threat") return RED;
  if (kind === "warn") return AMBER;
  return TEAL;
}

/**
 * Animated "AI security network" — canvas node graph with drifting nodes,
 * teal edges, occasional packet pulses, overlaid by a glowing shield,
 * radar rings, floating glass chips and a mono telemetry readout.
 * Degrades to a static frame when canvas is unavailable or the user
 * prefers reduced motion.
 */
export default function HeroNetwork({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    let width = 0;
    let height = 0;
    let elapsed = 0;
    let nodes: NetNode[] = [];
    let edges: NetEdge[] = [];
    const pulses: Pulse[] = [];
    let spawnTimer = 0.6;

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const makeNodes = () => {
      const count = 28;
      nodes = Array.from({ length: count }, (_, i) => {
        const kind: NodeKind = THREAT_INDICES.has(i)
          ? "threat"
          : WARN_INDICES.has(i)
            ? "warn"
            : "normal";
        const angle = rand(0, TAU);
        const speed = rand(4, 14);
        return {
          x: rand(20, Math.max(21, width - 20)),
          y: rand(20, Math.max(21, height - 20)),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: kind === "normal" ? rand(1.6, 2.4) : rand(2.4, 3.2),
          kind,
          phase: rand(0, TAU),
        };
      });
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeNodes();
      pulses.length = 0;
    };

    const update = (dt: number) => {
      elapsed += dt;
      const linkDist = Math.min(width, height) * 0.3;
      const margin = 14;

      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < margin) {
          n.x = margin;
          n.vx = Math.abs(n.vx);
        } else if (n.x > width - margin) {
          n.x = width - margin;
          n.vx = -Math.abs(n.vx);
        }
        if (n.y < margin) {
          n.y = margin;
          n.vy = Math.abs(n.vy);
        } else if (n.y > height - margin) {
          n.y = height - margin;
          n.vy = -Math.abs(n.vy);
        }
      }

      edges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < linkDist) edges.push({ a: i, b: j, d });
        }
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].t += pulses[i].speed * dt;
        if (pulses[i].t >= 1) pulses.splice(i, 1);
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0 && edges.length > 0 && pulses.length < 9) {
        spawnTimer = rand(0.35, 0.85);
        const e = edges[Math.floor(Math.random() * edges.length)];
        const hot = nodes[e.a].kind !== "normal" || nodes[e.b].kind !== "normal";
        pulses.push({
          a: e.a,
          b: e.b,
          t: 0,
          speed: rand(0.45, 1.05),
          dir: Math.random() < 0.5 ? 1 : -1,
          color: hot ? RED : TEAL,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const linkDist = Math.min(width, height) * 0.3;

      // edges
      ctx.lineWidth = 1;
      for (const e of edges) {
        const alpha = 0.04 + 0.16 * (1 - e.d / linkDist);
        ctx.strokeStyle = `rgba(${TEAL}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(nodes[e.a].x, nodes[e.a].y);
        ctx.lineTo(nodes[e.b].x, nodes[e.b].y);
        ctx.stroke();
      }

      // nodes — soft halo + bright core, threats get a breathing ring
      for (const n of nodes) {
        const color = nodeColor(n.kind);
        ctx.fillStyle = `rgba(${color}, 0.14)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (n.kind === "normal" ? 5 : 9), 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${color}, 0.9)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, TAU);
        ctx.fill();
        if (n.kind !== "normal") {
          const ringR = n.r + 6 + 3 * Math.sin(elapsed * 2.4 + n.phase);
          ctx.strokeStyle = `rgba(${color}, 0.28)`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, TAU);
          ctx.stroke();
        }
      }

      // traveling packet pulses
      for (const p of pulses) {
        const a = nodes[p.a];
        const b = nodes[p.b];
        if (!a || !b) continue;
        const t = p.dir === 1 ? p.t : 1 - p.t;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        ctx.fillStyle = `rgba(${p.color}, 0.18)`;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${p.color}, 0.95)`;
        ctx.beginPath();
        ctx.arc(x, y, 2.1, 0, TAU);
        ctx.fill();
      }
    };

    const frameOnce = () => {
      update(0.016);
      draw();
    };

    let last = performance.now();
    const loop = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    resize();

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      frameOnce(); // static frame only — no animation loop
    } else {
      raf = requestAnimationFrame(loop);
    }

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        resize();
        if (prefersReduced) frameOnce();
      });
      ro.observe(container);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative mx-auto aspect-square w-full max-w-[520px] select-none",
        className
      )}
      role="img"
      aria-label="Animated network visualization: AI nodes scanning for threats around a glowing shield"
    >
      {/* soft ambient glow behind the graph */}
      <div
        aria-hidden
        className="absolute inset-[8%] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.78 0.14 175 / 0.14), transparent 65%)",
        }}
      />

      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />

      {/* radar rings — expand & fade from the shield every ~3s */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute top-1/2 left-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-300/40"
          initial={{ scale: 0.32, opacity: 0 }}
          animate={{ scale: [0.32, 1.12], opacity: [0.55, 0] }}
          transition={{
            duration: 3,
            ease: "easeOut",
            repeat: Infinity,
            delay: i * 1,
          }}
        />
      ))}

      {/* centered shield with breathing glow */}
      <motion.div
        aria-hidden
        className="absolute top-1/2 left-1/2 flex size-[27%] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        animate={{ scale: [0.97, 1.03, 0.97], opacity: [0.82, 1, 0.82] }}
        transition={{ duration: 5.5, ease: "easeInOut", repeat: Infinity }}
        style={{
          filter: "drop-shadow(0 0 16px rgba(94, 234, 212, 0.45))",
        }}
      >
        <svg viewBox="0 0 100 112" className="h-full w-full">
          <defs>
            <linearGradient id="sentinel-shield-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgb(94 234 212)" />
              <stop offset="55%" stopColor="rgb(52 211 153)" />
              <stop offset="100%" stopColor="rgb(45 212 191)" />
            </linearGradient>
            <radialGradient id="sentinel-shield-fill" cx="0.5" cy="0.32" r="0.85">
              <stop offset="0%" stopColor="rgb(94 234 212)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="rgb(6 78 59)" stopOpacity="0.10" />
            </radialGradient>
          </defs>
          <path
            d="M50 4 L88 19 V52 C88 78 71 96 50 106 C29 96 12 78 12 52 V19 Z"
            fill="url(#sentinel-shield-fill)"
            stroke="url(#sentinel-shield-stroke)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M50 16 L77 27 V52 C77 71 64 85 50 93 C36 85 23 71 23 52 V27 Z"
            fill="none"
            stroke="rgb(94 234 212)"
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="4 5"
          />
        </svg>
        <ShieldCheck
          aria-hidden
          className="absolute size-[34%] text-teal-200"
          strokeWidth={1.8}
        />
      </motion.div>

      {/* floating glass chips */}
      <div
        aria-hidden
        className="glass float-slow pointer-events-none absolute top-[13%] left-[2%] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ring-teal-300/25"
      >
        <BrainCircuit className="size-3.5 text-teal-300" />
        <span className="font-mono text-[10px] tracking-[0.14em] text-teal-100/90">
          AI ANALYSIS
        </span>
      </div>
      <div
        aria-hidden
        className="glass float-slow pointer-events-none absolute top-[42%] right-[0%] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ring-teal-300/25"
        style={{ animationDelay: "-2.4s" }}
      >
        <EyeOff className="size-3.5 text-emerald-300" />
        <span className="font-mono text-[10px] tracking-[0.14em] text-emerald-100/90">
          MASKED PII
        </span>
      </div>
      <div
        aria-hidden
        className="glass float-slow pointer-events-none absolute bottom-[17%] left-[8%] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ring-red-400/30"
        style={{ animationDelay: "-4.8s" }}
      >
        <Activity className="size-3.5 text-red-400" />
        <span className="font-mono text-[10px] tracking-[0.14em] text-red-200/90">
          THREAT PULSE
        </span>
      </div>

      {/* telemetry readout */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-3 left-3 font-mono text-[9px] leading-relaxed text-teal-200/70 sm:text-[10px]"
      >
        <p>
          risk_engine: <span className="text-teal-300">scoring 14 events/s</span>
        </p>
        <p>
          pii_masked: <span className="text-emerald-300">100%</span>
          <span className="caret-blink ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-teal-300/80" />
        </p>
      </div>
    </div>
  );
}
