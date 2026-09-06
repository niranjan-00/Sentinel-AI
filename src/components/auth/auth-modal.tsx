"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Loader2, KeyRound, UserCog, Eye, User } from "lucide-react";
import { api } from "@/lib/client-api";
import { useApp } from "@/lib/store";

const DEMO_ACCOUNTS = [
  { label: "ADMIN", email: "admin@sentinel.ai", password: "Admin@123", icon: UserCog, tint: "text-teal-300" },
  { label: "ANALYST", email: "analyst@sentinel.ai", password: "Analyst@123", icon: ShieldCheck, tint: "text-emerald-300" },
  { label: "VIEWER", email: "viewer@sentinel.ai", password: "Viewer@123", icon: Eye, tint: "text-amber-300" },
];

export default function AuthModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const setUser = useApp((s) => s.setUser);
  const setScreen = useApp((s) => s.setScreen);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const submit = async (mode: "login" | "register") => {
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const res = await api<{ user: import("@/lib/store").SessionUser }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(res.user);
      onOpenChange(false);
      setScreen("dashboard");
      toast.success(mode === "login" ? "Welcome back" : "Account created", {
        description: `Signed in as ${res.user.name} · ${res.user.role.replace("_", " ")}`,
      });
    } catch (err) {
      toast.error("Authentication failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (email: string, password: string) => {
    setForm({ name: "", email, password });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            Access SENTINEL Platform
          </DialogTitle>
          <DialogDescription>
            JWT-secured session · role-based access control · audit-logged
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email" type="email" placeholder="admin@sentinel.ai" autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password" type="password" placeholder="••••••••" autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && form.email && form.password && submit("login")}
              />
            </div>
            <Button className="w-full" disabled={loading || !form.email || !form.password} onClick={() => submit("login")}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Sign In Securely
            </Button>
          </TabsContent>

          <TabsContent value="register" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Full name</Label>
              <Input
                id="reg-name" placeholder="Jordan Reyes" autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Work email</Label>
              <Input
                id="reg-email" type="email" placeholder="you@company.com" autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password" type="password" placeholder="Minimum 8 characters" autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && form.name && form.email && form.password.length >= 8 && submit("register")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              New accounts start with least-privilege <span className="font-mono">VIEWER</span> role.
              An ADMIN can elevate permissions.
            </p>
            <Button
              className="w-full"
              disabled={loading || !form.name || !form.email || form.password.length < 8}
              onClick={() => submit("register")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
              Create Account
            </Button>
          </TabsContent>
        </Tabs>

        <div className="mt-2 border-t border-border/60 pt-4">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Demo credentials — one-click sign-in
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc, i) => (
              <motion.button
                key={acc.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => quickFill(acc.email, acc.password)}
                className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-secondary/40 px-2 py-2.5 text-[11px] font-mono hover:border-primary/50 hover:bg-primary/5 transition-colors"
                aria-label={`Fill ${acc.label} demo credentials`}
              >
                <acc.icon className={`h-4 w-4 ${acc.tint}`} aria-hidden />
                {acc.label}
              </motion.button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
