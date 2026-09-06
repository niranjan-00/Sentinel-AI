"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useTransform, type Variants } from "framer-motion";
import {
  Atom,
  BadgeCheck,
  Bell,
  BrainCircuit,
  Database,
  EyeOff,
  FileCheck2,
  FileLock,
  Fingerprint,
  Gauge,
  LayoutDashboard,
  Lock,
  MessageSquareLock,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/** Shield logo mark shared by header + footer */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "ring-glow flex size-9 shrink-0 items-center justify-center rounded-lg border border-teal-300/30 bg-teal-300/10",
        className
      )}
    >
      <ShieldCheck aria-hidden className="size-5 text-teal-300" strokeWidth={2} />
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="mx-auto mb-12 max-w-2xl text-center sm:mb-14"
    >
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-teal-300/80">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Ticker band — live threat feed marquee                              */
/* ------------------------------------------------------------------ */

type DotTone = "teal" | "amber" | "red";

const DOT_CLASS: Record<DotTone, string> = {
  teal: "bg-teal-300",
  amber: "bg-amber-400",
  red: "bg-red-400 threat-pulse",
};

const FEED_ITEMS: { time: string; tone: DotTone; text: string }[] = [
  { time: "10:42:15", tone: "red", text: "▲ BLOCKED brute-force from 203.x.x.x — risk 92" },
  { time: "10:43:02", tone: "red", text: "● CRITICAL data-exfiltration attempt contained" },
  { time: "10:43:37", tone: "amber", text: "masked_user_**** quarantined — anomaly 74" },
  { time: "10:44:10", tone: "teal", text: "✓ PII scan complete — 1,284 fields auto-masked" },
  { time: "10:44:52", tone: "amber", text: "▲ Privilege-escalation flagged on LPAR-03" },
  { time: "10:45:20", tone: "teal", text: "✓ Quantum-risk assessment refreshed — 68% ready" },
  { time: "10:45:58", tone: "red", text: "● Ransomware signature quarantined — risk 88" },
  { time: "10:46:31", tone: "teal", text: "✓ Zero-trust policy sync OK across 12 services" },
];

export function TickerBand() {
  return (
    <section
      aria-label="Live threat intelligence feed"
      className="relative overflow-hidden border-y border-border/60 bg-card/30 py-3"
    >
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {[0, 1].map((dup) => (
          <div
            key={dup}
            aria-hidden={dup === 1}
            className="flex items-center gap-10 pr-10"
          >
            {FEED_ITEMS.map((item) => (
              <span
                key={item.time}
                className="flex items-center gap-2.5 font-mono text-[11px] whitespace-nowrap text-muted-foreground"
              >
                <span className="text-teal-300/60">{item.time}</span>
                <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[item.tone])} />
                <span>{item.text}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent"
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stats band — count-up glass cards                                   */
/* ------------------------------------------------------------------ */

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${Math.round(v).toLocaleString("en-US")}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, mv, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
}

const STATS: { value: number; suffix: string; label: string; sub: string; icon: LucideIcon }[] = [
  { value: 247, suffix: "", label: "Blocked Attacks", sub: "last 24 hours", icon: ShieldAlert },
  { value: 92, suffix: "/100", label: "Security Score", sub: "composite zero-trust rating", icon: BadgeCheck },
  { value: 38, suffix: "", label: "Sensitive-Data Events", sub: "auto-masked in real time", icon: FileLock },
  { value: 68, suffix: "%", label: "Quantum-Readiness", sub: "post-quantum migration index", icon: Atom },
];

export function StatsBand() {
  return (
    <section aria-label="Platform statistics" className="relative py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              className="glass group rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:ring-1 hover:ring-teal-300/30"
            >
              <div className="mb-4 flex size-9 items-center justify-center rounded-lg border border-teal-300/25 bg-teal-300/10">
                <stat.icon aria-hidden className="size-4.5 text-teal-300" />
              </div>
              <p className="text-glow font-mono text-3xl font-bold tracking-tight text-teal-300 sm:text-4xl">
                <CountUp value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{stat.label}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {stat.sub}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features — platform capabilities grid                               */
/* ------------------------------------------------------------------ */

const FEATURES: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Real-Time Threat Detection",
    description:
      "Streaming anomaly models score every event in milliseconds, surfacing attacks before they can spread across the estate.",
    icon: Radar,
  },
  {
    title: "Privacy-Aware AI",
    description:
      "Models learn from masked data only — intelligence is produced without ever exposing the personal information behind it.",
    icon: EyeOff,
  },
  {
    title: "Identity Protection",
    description:
      "Continuous behavioral signals and zero-trust checks keep every session tied to a verified, legitimate human.",
    icon: Fingerprint,
  },
  {
    title: "Sensitive Data Monitoring",
    description:
      "Automatic discovery, classification and masking of PII across databases, files and mainframe datasets.",
    icon: FileLock,
  },
  {
    title: "Quantum-Safe Readiness",
    description:
      "Crypto-inventory and PQC migration scoring show exactly where you stand on the post-quantum timeline.",
    icon: Atom,
  },
  {
    title: "Secure AI Assistant",
    description:
      "Ask security questions in natural language — answers are generated with zero raw-data exposure.",
    icon: MessageSquareLock,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" aria-label="Platform capabilities" className="relative scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Modules"
          title="Platform Capabilities"
          description="Six integrated engines working on masked data — detection, protection and prediction in one platform."
        />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => (
            <motion.article
              key={feature.title}
              variants={fadeUp}
              className="glass group relative rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300/30 hover:shadow-[0_12px_48px_-16px_rgba(94,234,212,0.35)]"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-teal-300/25 bg-teal-300/10 transition-colors duration-300 group-hover:bg-teal-300/15">
                <feature.icon aria-hidden className="size-5 text-teal-300" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Security architecture — pipeline flow + pillars                     */
/* ------------------------------------------------------------------ */

interface FlowNode {
  label: string;
  icon: LucideIcon;
  masked?: boolean;
}

const FLOW: FlowNode[] = [
  { label: "Data Sources", icon: Database },
  { label: "Event Ingestion", icon: Waypoints },
  { label: "Sensitive-Data Masking", icon: EyeOff, masked: true },
  { label: "AI Anomaly Detection", icon: BrainCircuit },
  { label: "Risk Scoring", icon: Gauge },
  { label: "Alert Engine", icon: Bell },
  { label: "Sentinel Dashboard", icon: LayoutDashboard },
  { label: "Human / Automated Response", icon: Users },
];

const PILLARS: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "AI Innovation Without Exposure",
    description:
      "Train and run AI on masked pipelines — extract full insight without leaking a single raw record.",
    icon: BrainCircuit,
  },
  {
    title: "Zero-Trust by Design",
    description:
      "Every request is verified, least-privileged and logged. Trust is never assumed, only proven.",
    icon: ShieldCheck,
  },
  {
    title: "Compliance-Ready Audit Trails",
    description:
      "Immutable, exportable audit logs mapped to GDPR, HIPAA and SOC 2 controls out of the box.",
    icon: FileCheck2,
  },
];

export function ArchitectureSection() {
  return (
    <section
      id="security"
      aria-label="Security architecture"
      className="relative scroll-mt-20 overflow-hidden py-16 sm:py-24"
    >
      <div aria-hidden className="bg-grid bg-grid-fade absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Architecture"
          title="Security Without Exposure, by Design"
          description="Every event flows through a privacy-preserving pipeline — PII is masked before AI processing, never after."
        />

        {/* Flow diagram: vertical on mobile, horizontal row on lg+ */}
        <motion.ol
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="flex list-none flex-col items-stretch lg:flex-row lg:items-center lg:gap-0"
        >
          {FLOW.map((node, i) => (
            <li key={node.label} className="contents">
              {/* vertical connector (mobile) */}
              {i > 0 && (
                <div
                  aria-hidden
                  className="mx-auto flex h-6 items-center justify-center lg:hidden"
                >
                  <span className="flow-line block h-px w-6 rotate-90" />
                </div>
              )}
              {/* horizontal connector (lg+) */}
              {i > 0 && (
                <span
                  aria-hidden
                  className="flow-line hidden h-px w-8 shrink-0 self-center lg:block xl:w-10"
                />
              )}
              <motion.div
                variants={fadeUp}
                className={cn(
                  "relative w-full lg:min-w-0 lg:flex-1",
                  node.masked && "z-10"
                )}
              >
                {node.masked && (
                  <span
                    title="PII is masked before AI processing"
                    className="absolute -top-2.5 -right-2.5 z-20 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-teal-300/30"
                  >
                    <Lock aria-hidden className="size-3" strokeWidth={2.5} />
                  </span>
                )}
                <div
                  className={cn(
                    "flex h-full flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-center transition-colors duration-300",
                    node.masked
                      ? "border-teal-300/60 bg-teal-300/5 ring-glow"
                      : "border-border/70 bg-card/40 hover:border-teal-300/30"
                  )}
                >
                  <node.icon
                    aria-hidden
                    className={cn("size-5", node.masked ? "text-teal-300" : "text-teal-300/70")}
                  />
                  <span className="font-mono text-[9px] tracking-[0.25em] text-teal-300/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[10px] uppercase leading-tight tracking-wider text-foreground/90">
                    {node.label}
                  </span>
                  {node.masked && (
                    <span className="mt-1 text-[9px] leading-tight text-teal-200/80">
                      PII is masked before AI processing
                    </span>
                  )}
                </div>
              </motion.div>
            </li>
          ))}
        </motion.ol>

        {/* Pillars */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {PILLARS.map((pillar) => (
            <motion.div
              key={pillar.title}
              variants={fadeUp}
              className="glass rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:ring-1 hover:ring-teal-300/30"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-teal-300/25 bg-teal-300/10">
                  <pillar.icon aria-hidden className="size-4 text-teal-300" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">{pillar.title}</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{pillar.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA                                                                 */
/* ------------------------------------------------------------------ */

export function CTASection({
  onLaunchDashboard,
  onGetStarted,
}: {
  onLaunchDashboard: () => void;
  onGetStarted: () => void;
}) {
  return (
    <section aria-label="Get started" className="relative overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 60% at 50% 55%, oklch(0.78 0.14 175 / 0.10), transparent 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative mx-auto max-w-3xl px-4 text-center sm:px-6"
      >
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-teal-300/80">
          Detect · Protect · Predict
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ready to see AI security{" "}
          <span className="text-glow text-teal-300">without exposure?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Spin up the live SOC dashboard or create an account — the full pipeline,
          from masked ingestion to automated response, runs in seconds.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={onLaunchDashboard}
            className="ring-glow w-full bg-primary px-8 text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            Launch Dashboard
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onGetStarted}
            className="w-full border-teal-300/30 bg-transparent px-8 hover:bg-teal-300/10 hover:text-teal-200 sm:w-auto"
          >
            Get Started
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Platform",
    links: [
      { label: "Threat Detection", href: "#features" },
      { label: "Data Masking", href: "#security" },
      { label: "Risk Scoring", href: "#features" },
      { label: "AI Assistant", href: "#features" },
    ],
  },
  {
    heading: "Security",
    links: [
      { label: "Zero-Trust Architecture", href: "#security" },
      { label: "Audit Trails", href: "#security" },
      { label: "Quantum Readiness", href: "#features" },
      { label: "Access Control (RBAC)", href: "#security" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#home" },
      { label: "IBM Z Datathon 2026", href: "#home" },
      { label: "Documentation", href: "#home" },
      { label: "Contact", href: "#home" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-card/20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="font-mono text-sm font-bold tracking-[0.18em] text-foreground">
                SENTINEL AI
              </span>
            </div>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-teal-300/80">
              Detect. Protect. Predict.
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI-powered cybersecurity, privacy and sensitive-data protection for the
              mainframe era — built for the IBM Z Datathon 2026.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-teal-300/70">
                {column.heading}
              </h3>
              <ul className="list-none space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-teal-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 sm:flex-row">
          <p className="text-center font-mono text-xs text-muted-foreground sm:text-left">
            © 2026 SENTINEL AI — Built for the IBM Z Datathon 2026 · Not affiliated with IBM
          </p>
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60">
            DETECT · PROTECT · PREDICT
          </p>
        </div>
      </div>
    </footer>
  );
}
