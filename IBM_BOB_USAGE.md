# IBM Bob in the Sentinel AI Workflow

[IBM Bob](https://bob.ibm.com/) is IBM's AI-first software development lifecycle (SDLC)
partner — an agentic assistant that works across planning, coding, testing, documentation
and modernization, with human-in-the-loop approval at each step. On Sentinel AI, Bob was
used in two parts of the workflow: **code modernization / refactoring** and
**documentation & testing**.

## 1. Code Modernization & Refactoring

Sentinel AI's backend spans 20+ Next.js API route handlers plus several shared library
modules (`mask.ts`, `risk-engine.ts`, `ai/provider.ts`, `events.ts`, `simulator.ts`).
As these grew, Bob was used in **Code Mode** to keep them consistent rather than to
write them from scratch:

- **Consistency passes across API routes** — normalizing request validation (Zod
  schemas), error responses, and RBAC guard checks so every route in `src/app/api`
  follows the same shape.
- **Refactoring the masking and risk-scoring logic** — cleaning up `mask.ts` and
  `risk-engine.ts` as new sensitive-data patterns and scoring factors were added,
  removing duplication without changing behavior.
- **Provider abstraction upkeep** — keeping `ai/provider.ts`'s OpenAI → Groq →
  Ollama → fallback chain readable as new providers were wired in.

Each change went through Bob's approval checkpoints, so refactors were reviewed
before being applied rather than auto-merged.

## 2. Documentation & Testing

- **Inline documentation** — generating and updating code comments and docstrings
  for the masking service, risk engine, and API route handlers as they changed.
- **README maintenance** — keeping the API reference tables and architecture
  description in `README.md` in sync with the actual route handlers and modules.
- **Test scaffolding** — drafting initial test cases and fixtures for the masking
  functions (`maskSensitiveData`, `maskObject`) and the six threat-simulation
  scenarios, which were then reviewed and extended manually.

## Why Bob Fit This Project

Sentinel AI's codebase is a single TypeScript/Next.js repository with many small,
interdependent modules (masking, risk scoring, IAM, incident response). Bob's
project-wide contextual awareness made it useful for keeping those modules
consistent as features were added, while its approval-gated workflow matched the
project's security focus — no change lands without a human reviewing it first.

## Scope Note

Bob was used as a development-workflow aid during implementation. It is not part
of Sentinel AI's runtime architecture or its own AI provider chain (OpenAI / Groq /
Ollama / `sentinel-rules-v1`), which is documented separately in the main
[README](./README.md).
