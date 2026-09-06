import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SENTINEL AI — Detect. Protect. Predict.",
  description:
    "AI Security Without Data Exposure. Sentinel AI detects threats, protects sensitive data, and delivers real-time intelligence without compromising privacy. Built for IBM Z Datathon 2026.",
  keywords: [
    "SENTINEL AI",
    "cybersecurity",
    "IBM Z",
    "Datathon 2026",
    "privacy-aware AI",
    "threat detection",
    "quantum-safe",
    "sensitive data protection",
  ],
  authors: [{ name: "SENTINEL AI" }],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          theme="dark"
          richColors
          closeButton
          position="top-right"
          toastOptions={{
            style: {
              background: "oklch(0.2 0.02 210 / 0.9)",
              border: "1px solid oklch(1 0 0 / 10%)",
              color: "oklch(0.96 0.005 180)",
            },
          }}
        />
      </body>
    </html>
  );
}
