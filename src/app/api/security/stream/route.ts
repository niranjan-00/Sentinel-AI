import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { ensureSimulator } from "@/lib/simulator";
import { bus } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream — pushes live security events, alerts and
 * incident updates to the dashboard in real time.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    await ensureSeeded();
    ensureSimulator();

    // Authentication is optional for the demo build; sessions are validated when present.
    const session = await getSession(req);
    const role = session?.role ?? "VIEWER";

    const encoder = new TextEncoder();
    let unsub: (() => void) | undefined;
    let heartbeat: NodeJS.Timeout | undefined;

    const stream = new ReadableStream({
      start(controller) {
        const send = (msg: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
          } catch {
            /* client gone */
          }
        };

        send({ type: "hello", data: { connected: true, role, at: Date.now() } });

        unsub = bus.subscribe((msg) => {
          // viewers receive everything in demo mode; RBAC tightening point lives here
          send(msg);
        });

        heartbeat = setInterval(() => send({ type: "heartbeat", data: { at: Date.now() } }), 20_000);

        req.signal.addEventListener("abort", () => {
          unsub?.();
          if (heartbeat) clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      },
      cancel() {
        unsub?.();
        if (heartbeat) clearInterval(heartbeat);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[sse]", err);
    return new Response("stream error", { status: 500 });
  }
}
