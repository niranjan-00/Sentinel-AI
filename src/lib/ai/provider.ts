/**
 * SENTINEL AI — AI Provider Abstraction
 * -------------------------------------
 * Supports external AI APIs via environment variables so the provider can be
 * replaced without code changes:
 *   OPENAI_API_KEY=      → https://api.openai.com/v1
 *   GROQ_API_KEY=        → https://api.groq.com/openai/v1
 *   OLLAMA_BASE_URL=     → local Ollama server
 * Falls back to the platform-bundled AI runtime, then to a deterministic
 * rule-based mock engine so the product remains fully functional offline.
 */

import ZAI from "z-ai-web-dev-sdk";

export type AiProviderName = "openai" | "groq" | "ollama" | "zai" | "mock";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResult {
  content: string;
  model: string;
}

export function activeProvider(): Exclude<AiProviderName, "mock"> {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OLLAMA_BASE_URL) return "ollama";
  return "zai";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 20_000
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function openAiCompatible(
  url: string,
  key: string,
  model: string,
  messages: ChatMessage[]
): Promise<LlmResult | null> {
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 700 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    return content ? { content, model } : null;
  } catch {
    return null;
  }
}

async function ollamaChat(
  base: string,
  messages: ChatMessage[]
): Promise<LlmResult | null> {
  try {
    const model = process.env.OLLAMA_MODEL || "llama3.2";
    const res = await fetchWithTimeout(`${base.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    return content ? { content, model } : null;
  } catch {
    return null;
  }
}

async function zaiChat(messages: ChatMessage[]): Promise<LlmResult | null> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: messages as unknown as Parameters<typeof zai.chat.completions.create>[0]["messages"],
      thinking: { type: "disabled" },
    });
    const content = completion.choices[0]?.message?.content ?? null;
    return content ? { content, model: "zai-glm" } : null;
  } catch {
    return null;
  }
}

/**
 * Try every configured provider in order. Returns null when all fail —
 * callers MUST fall back to the deterministic mock engine.
 */
export async function llmChat(messages: ChatMessage[]): Promise<LlmResult | null> {
  const provider = activeProvider();
  if (provider === "openai") {
    return openAiCompatible(
      "https://api.openai.com/v1/chat/completions",
      process.env.OPENAI_API_KEY!,
      process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages
    );
  }
  if (provider === "groq") {
    return openAiCompatible(
      "https://api.groq.com/openai/v1/chat/completions",
      process.env.GROQ_API_KEY!,
      process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages
    );
  }
  if (provider === "ollama") {
    return ollamaChat(process.env.OLLAMA_BASE_URL!, messages);
  }
  return zaiChat(messages);
}
