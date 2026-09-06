"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, LogIn, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import HeroNetwork from "./hero-network";
import {
  ArchitectureSection,
  CTASection,
  FeaturesSection,
  LogoMark,
  SiteFooter,
  StatsBand,
  TickerBand,
} from "./sections";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
] as const;

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function Wordmark() {
  return (
    <span className="flex flex-col leading-none">
      <span className="font-mono text-sm font-bold tracking-[0.18em] text-foreground">
        SENTINEL AI
      </span>
      <span className="mt-1 hidden w-fit items-center rounded border border-teal-300/25 bg-teal-300/5 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.22em] text-teal-300/80 sm:inline-flex">
        IBM Z DATATHON 2026
      </span>
    </span>
  );
}

export default function LandingPage({
  onLaunchDashboard,
  onGetStarted,
}: {
  onLaunchDashboard: () => void;
  onGetStarted: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Cursor parallax — transforms only the visual wrapper */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 55, damping: 18, mass: 0.6 });
  const springY = useSpring(mouseY, { stiffness: 55, damping: 18, mass: 0.6 });
  const visualX = useTransform(springX, [-1, 1], [-12, 12]);
  const visualY = useTransform(springY, [-1, 1], [-9, 9]);

  const handleHeroMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      mouseX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
      mouseY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
    },
    [mouseX, mouseY]
  );

  const handleHeroMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      {/* ---------------------------------------------------------- */}
      {/* Header / sticky nav                                        */}
      {/* ---------------------------------------------------------- */}
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-all duration-300",
          scrolled
            ? "border-teal-300/10 bg-background/80 shadow-lg shadow-black/30"
            : "border-transparent bg-background/40"
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Logo */}
          <a
            href="#home"
            className="group flex min-w-0 items-center gap-2.5"
            aria-label="SENTINEL AI — back to top"
          >
            <LogoMark className="transition-transform duration-300 group-hover:scale-105" />
            <Wordmark />
          </a>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={onLaunchDashboard}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              Dashboard
            </button>
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 lg:flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={onGetStarted}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <LogIn aria-hidden className="size-4" />
              Login
            </Button>
            <Button size="sm" onClick={onGetStarted} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Get Started
            </Button>
          </div>

          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                className="lg:hidden"
              >
                <Menu aria-hidden className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-teal-300/10 bg-background/95 backdrop-blur-xl"
            >
              <SheetTitle className="flex items-center gap-2.5">
                <LogoMark />
                <Wordmark />
              </SheetTitle>
              <SheetDescription className="sr-only">
                SENTINEL AI navigation menu
              </SheetDescription>
              <nav aria-label="Mobile" className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <SheetClose key={link.href} asChild>
                    <a
                      href={link.href}
                      className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <button
                    type="button"
                    onClick={onLaunchDashboard}
                    className="rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  >
                    Dashboard
                  </button>
                </SheetClose>
              </nav>
              <div className="mt-auto flex flex-col gap-2 pb-2">
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onGetStarted} className="justify-start gap-2">
                    <LogIn aria-hidden className="size-4" />
                    Login
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button onClick={onGetStarted} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Get Started
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1">
        {/* -------------------------------------------------------- */}
        {/* Hero                                                     */}
        {/* -------------------------------------------------------- */}
        <section
          id="home"
          aria-label="Hero"
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={handleHeroMouseLeave}
          className="relative flex min-h-[90vh] items-center overflow-hidden"
        >
          {/* backdrop: fading grid + radial teal glow */}
          <div aria-hidden className="bg-grid bg-grid-fade absolute inset-0" />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 55% at 72% 38%, oklch(0.78 0.14 175 / 0.13), transparent 70%)",
            }}
          />

          <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:py-20">
            {/* Left column */}
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="inline-flex items-center gap-2.5 rounded-full border border-teal-300/25 bg-teal-300/5 px-3.5 py-1.5"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-teal-200/90 sm:text-[11px]">
                  Live Threat Intelligence · IBM Z Ready
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="mt-6 text-4xl leading-[1.08] font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
              >
                AI Security{" "}
                <span className="text-glow text-teal-300">Without Data Exposure.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
              >
                Sentinel AI detects threats, protects sensitive data, and delivers
                real-time intelligence without compromising privacy.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <Button
                  size="lg"
                  onClick={onLaunchDashboard}
                  className="ring-glow group h-11 bg-primary px-6 text-base text-primary-foreground hover:bg-primary/90"
                >
                  Launch Dashboard
                  <ArrowRight
                    aria-hidden
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollToId("security")}
                  className="h-11 border-teal-300/30 bg-transparent px-6 text-base hover:bg-teal-300/10 hover:text-teal-200"
                >
                  <ShieldCheck aria-hidden className="size-4" />
                  Explore Security
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.45 }}
                className="mt-8 border-t border-border/50 pt-4 font-mono text-[10px] tracking-[0.18em] text-muted-foreground/80 uppercase sm:text-[11px]"
              >
                AES-256 · TLS 1.3 · RBAC · Zero-Trust · Quantum-Ready Assessment
              </motion.p>
            </div>

            {/* Right column — parallax visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              style={{ x: visualX, y: visualY }}
              className="relative"
            >
              <HeroNetwork />
            </motion.div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Sections                                                 */}
        {/* -------------------------------------------------------- */}
        <TickerBand />
        <StatsBand />
        <FeaturesSection />
        <ArchitectureSection />
        <CTASection onLaunchDashboard={onLaunchDashboard} onGetStarted={onGetStarted} />
      </main>

      <SiteFooter />
    </div>
  );
}
