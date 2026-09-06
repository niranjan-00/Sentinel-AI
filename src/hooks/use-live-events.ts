"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApp, type LiveEvent } from "@/lib/store";

/**
 * Subscribes to the SENTINEL SSE stream. New security events, alerts and
 * incident updates stream straight into the store; consumers re-fetch
 * aggregated data when `dataDirtyAt` changes.
 */
export function useLiveEvents(enabled: boolean) {
  const pushLiveEvent = useApp((s) => s.pushLiveEvent);
  const markDataDirty = useApp((s) => s.markDataDirty);
  const setLiveConnected = useApp((s) => s.setLiveConnected);
  const lastDirty = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/security/stream");

      es.onopen = () => setLiveConnected(true);

      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as {
            type: string;
            data?: LiveEvent & { title?: string; message?: string; severity?: string };
          };
          if (parsed.type === "hello" || parsed.type === "heartbeat") {
            setLiveConnected(true);
            return;
          }
          if (parsed.type === "event" && parsed.data?.id) {
            pushLiveEvent(parsed.data);
            // throttle aggregated refetches to once per 3s
            if (Date.now() - lastDirty.current > 3000) {
              lastDirty.current = Date.now();
              markDataDirty();
            }
            const risk = parsed.data.riskLevel;
            if (risk === "CRITICAL") {
              toast.error(`CRITICAL — ${parsed.data.eventType.replace(/_/g, " ")}`, {
                description: parsed.data.description,
              });
            } else if (risk === "HIGH") {
              toast.warning(`HIGH risk — ${parsed.data.eventType.replace(/_/g, " ")}`, {
                description: parsed.data.description,
              });
            }
          }
          if (parsed.type === "incident" || parsed.type === "alert") {
            markDataDirty();
          }
        } catch {
          /* malformed frame — ignore */
        }
      };

      es.onerror = () => {
        setLiveConnected(false);
        // EventSource auto-reconnects; nothing else to do
      };
    };

    connect();
    return () => {
      closed = true;
      es?.close();
      setLiveConnected(false);
    };
  }, [enabled, pushLiveEvent, markDataDirty, setLiveConnected]);
}
