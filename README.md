# SENTINEL AI — Detect. Protect. Predict.

**AI-powered cybersecurity, privacy & sensitive-data protection platform**
Built for the **IBM Z Datathon 2026** challenge — demonstrating *AI Innovation Without Exposure*.

> SENTINEL AI detects threats, protects sensitive data, and delivers real-time
> intelligence without compromising privacy.

---

## 1. Project Overview

Organizations increasingly run AI across systems containing personal, financial,
healthcare and operational data — but innovation must never compromise privacy,
security, trust or compliance.

**SENTINEL AI** is a real-time security-intelligence platform that continuously
monitors system activity, uses AI to identify risks, and guarantees that
**sensitive data is masked before it ever reaches an AI model** — identities,
payloads, and prompts included.

### Demo Credentials

| Role | Email | Password | Capabilities |
|---|---|---|---|
| ADMIN | `admin@sentinel.ai` | `Admin@123` | Full administration: user management, IAM actions, simulate attacks, respond to incidents |
| SECURITY_ANALYST | `analyst@sentinel.ai` | `Analyst@123` | View alerts, investigate threats, contain/resolve incidents, simulate attacks |
| VIEWER | `viewer@sentinel.ai` | `Viewer@123` | Read-only dashboard access |

---

## 2. Problem Statement

- AI is being adopted across critical infrastructure that holds sensitive data.
- Feeding raw PII into AI models creates exposure, compliance and trust risk.
- Security teams lack real-time, explainable, privacy-aware threat intelligence.
- Cryptographic estates are unprepared for quantum-era adversaries ("harvest now, decrypt later").

**SENTINEL AI answers with:** masking-by-default AI pipelines, real-time anomaly
detection, explainable risk scoring, incident response workflows, IAM/zero-trust
controls, and a quantum-safe readiness assessment.

---

## 3. Features

| # | Feature | Highlights |
|---|---|---|
| 1 | **Landing page** | Animated AI-network hero (canvas), architecture flow, IBM Z framing |
| 2 | **Authentication** | Register / login / logout, bcrypt hashing, JWT (httpOnly cookie), sessions |
| 3 | **RBAC** | `ADMIN` / `SECURITY_ANALYST` / `VIEWER` enforced server-side on every endpoint |
| 4 | **Real-time dashboard** | 8 live KPIs (Security Score, Active Threats, Blocked Attacks, Quantum Readiness…), priority alerts |
| 5 | **Live threat monitoring** | SSE event stream, filters & search, Investigate / Block / Mark-safe / Resolve actions |
| 6 | **AI anomaly detection** | Deterministic behavioural scoring (0-100 + LOW/MEDIUM/HIGH/CRITICAL) + LLM narrative analysis |
| 7 | **Sensitive-data protection** | `maskSensitiveData()` service (emails, cards, SSNs, API keys, passwords, IBANs, phones, IDs), masking playground, interception log |
| 8 | **Identity & Access** | 55-account directory, sessions revocation, login history, audit trail, lock/MFA/role actions |
| 9 | **SENTINEL Assistant** | Secure AI chat grounded in masked context; user prompts are masked pre-inference |
| 10 | **Threat analytics** | Timeline (stacked by severity), risk distribution, attack types, top systems, risky actors, geo activity |
| 11 | **Incident response** | DETECTED → INVESTIGATING → CONTAINED → RESOLVED workflow, notes, analyst assignment, AI re-analysis |
| 12 | **Quantum-Safe Readiness Assessment** | Crypto asset inventory, readiness score, AI migration briefing (clearly labelled as an *assessment*) |
| 13 | **Threat Simulation Mode** | One-click demo: Brute Force, Suspicious Login, Data Exfiltration, Unauthorized Access, AI Data Exposure, Insider Threat — full pipeline replay with incident creation |

---

## 4. Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, Framer Motion, lucide-react, Zustand
- **Backend**: Next.js API route handlers (Node runtime), Zod validation, in-memory rate limiting
- **Database**: Prisma ORM. The sandbox ships **SQLite**; the schema is portable — switch `provider = "mysql"` in `prisma/schema.prisma` and update `DATABASE_URL` for IBM Z / production MySQL (Db2 for z/OS would follow the same repository pattern).
- **Real-time**: Server-Sent Events (`/api/security/stream`) with heartbeat + auto-reconnect
- **Auth**: JWT (jose, HS256) + bcryptjs + RBAC guards
- **AI**: provider abstraction — `OPENAI_API_KEY` / `GROQ_API_KEY` / `OLLAMA_BASE_URL` → platform runtime (z-ai-web-dev-sdk) → deterministic `sentinel-rules-v1` fallback. **The app is fully functional with zero external AI keys.**

---

## 5. Architecture

```
DATA SOURCES (auth, IAM, DLP, IDS, WAF, AI guardrail, endpoints)
        ↓
REAL-TIME EVENT INGESTION            /api/security/events · /api/security/simulate
        ↓
SENSITIVE-DATA MASKING               src/lib/mask.ts  (maskSensitiveData / maskObject)
        ↓
AI ANOMALY DETECTION                 src/lib/risk-engine.ts + src/lib/ai/*
        ↓
RISK SCORING ENGINE                  0-100 → LOW / MEDIUM / HIGH / CRITICAL
        ↓
SECURITY ALERT ENGINE                SecurityAlert + audit log
        ↓
SENTINEL AI DASHBOARD                SSE fan-out (/api/security/stream) → live UI
        ↓
HUMAN RESPONSE / AUTOMATED ACTION    block · contain · resolve · lock · revoke
```

Raw identifiers never cross the masking boundary: actors are anonymised
(`masked_user_****`), IPs truncated (`103.223.x.x`), and payloads redacted
(`{"card": "4532 **** **** 9010"}`) before storage or inference.

---

## 6. Installation

The project ships **pre-configured** — `.env` is included and the SQLite database
(`db/custom.db`) comes pre-seeded, so setup is just two commands:

```bash
# 1. install dependencies (auto-generates the Prisma client)
bun install        # or: npm install

# 2. run
bun run dev        # or: npm run dev
```

Open http://localhost:3000. The database **self-seeds on first request**
(55 users, 375+ security events across 48h, incidents, sessions, alerts,
quantum assessments) — the platform is demo-ready immediately.

<details>
<summary>Recreating the database from scratch (optional)</summary>

```bash
rm db/custom.db
cp .env.example .env      # then set DATABASE_URL + JWT_SECRET
db:push                   # npx prisma db push
```

The next request re-seeds the database automatically.
</details>

---

## 7. Environment Variables

See [.env.example](.env.example):

```ini
# Relative "file:" paths resolve against prisma/schema.prisma,
# so ../db/custom.db points to <project-root>/db/custom.db.
DATABASE_URL=file:../db/custom.db
JWT_SECRET=change-me-to-a-long-random-secret

# Optional AI providers — first configured wins
OPENAI_API_KEY=
GROQ_API_KEY=
OLLAMA_BASE_URL=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**No AI key?** The platform runtime serves narrative analysis, and if no LLM is
reachable the deterministic `sentinel-rules-v1` engine takes over — every feature
keeps working offline.

---

## 8. API Documentation

### Authentication
| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/register` | name/email/password → creates VIEWER, sets JWT cookie |
| POST | `/api/auth/login` | rate-limited, audit-logged, bcrypt verify |
| POST | `/api/auth/logout` | clears session cookie |
| GET | `/api/auth/me` | current session user |

### Security
| Method | Route | Role | Notes |
|---|---|---|---|
| GET | `/api/security/events` | any | filters: `level`, `status`, `type`, `q`, `limit` |
| POST | `/api/security/events` | ANALYST+ | manual ingestion (payload masked server-side) |
| PATCH | `/api/security/events/:id` | ANALYST+ | action: `INVESTIGATE`/`BLOCK`/`SAFE`/`RESOLVE` |
| GET | `/api/security/alerts` | any | latest 30 alerts |
| PATCH | `/api/security/alerts` | ANALYST+ | acknowledge |
| POST | `/api/security/analyze` | any | AI risk scoring on behavioural features |
| POST | `/api/security/simulate` | ANALYST+ | threat simulation (6 attack types) |
| GET | `/api/security/stream` | any | **SSE** live event/alert/incident stream |

### Incidents
| Method | Route | Role |
|---|---|---|
| GET / POST | `/api/incidents` | any / ANALYST+ |
| PATCH | `/api/incidents/:id` | ANALYST+ — status, notes, assignment, `regenerateAi` |

### Users / IAM
| Method | Route | Role |
|---|---|---|
| GET | `/api/users` | ANALYST+ |
| PATCH | `/api/users/:id` | ADMIN — `LOCK`/`UNLOCK`/`FLAG_SUSPICIOUS`/`CHANGE_ROLE`/`REQUIRE_MFA`/`RESET_ACCESS` |
| DELETE | `/api/users/:id` | ADMIN |
| GET | `/api/iam/overview` | ANALYST+ — users + sessions + login history + audit |
| POST | `/api/iam/actions` | ANALYST+ — `REVOKE_SESSION` |

### AI
| Method | Route | Role | Notes |
|---|---|---|---|
| POST | `/api/ai/chat` | any | SENTINEL Assistant (prompt masked pre-inference, 20/min) |
| POST | `/api/ai/analyze` | any | alias of security analyze |
| GET | `/api/ai/status` | any | active provider info (never exposes keys) |

### Quantum & Data Protection
| Method | Route | Role |
|---|---|---|
| GET | `/api/quantum/assessment` | any — inventory + readiness score |
| POST | `/api/quantum/analyze` | ANALYST+ — AI migration briefing |
| POST | `/api/data-protection/mask` | any — masking playground |
| GET | `/api/data-protection/events` | any — interception log |

### Dashboards
| Method | Route | Role |
|---|---|---|
| GET | `/api/dashboard/summary` | any — KPIs + feed + alerts |
| GET | `/api/analytics` | any — all chart datasets |

---

## 9. AI Integration Setup

1. **Deterministic engine (always on).** `src/lib/risk-engine.ts` scores events
   from behavioural features: hour-of-day, geo familiarity, device freshness,
   failed attempts, data volume, request rate, resource sensitivity, impossible
   travel, AI-service access. Explainable — every point is attributed.
2. **LLM narrative (configurable provider).** `src/lib/ai/provider.ts` picks:
   OpenAI → Groq → Ollama → platform runtime. Prompts are built from **masked
   payloads only**; the system prompt forbids inventing identities.
3. **Fallback.** If every provider fails, template-based analysis keeps the
   product fully functional (visible as `sentinel-rules-v1` model tags).

---

## 10. IBM Z Challenge Alignment

| IBM Z security capability | Where SENTINEL AI demonstrates it |
|---|---|
| AI-powered fraud & threat detection | Risk engine + anomaly detection + simulation mode |
| Privacy-aware AI / secure AI assistants | Masking service gates every prompt; SENTINEL Assistant |
| Sensitive-data protection & monitoring | Data Protection Center + interception ledger |
| Identity & access management | IAM dashboard, RBAC, session revocation, audit trail |
| Cybersecurity anomaly detection | Behavioural scoring with factor attribution |
| Encryption & cryptographic protection | Crypto asset inventory (AES-256, RSA, ECC, TLS 1.3) |
| Quantum-safe security readiness | Clearly-labelled **Quantum-Safe Readiness Assessment** (evaluation & migration planning — not an implementation) |
| Secure execution of critical workloads | Rate limiting, input validation, protected routes, audit logs |
| Z-ready framing | Seeded estate includes Db2 on IBM Z, HSM cluster, secure gateway |

> **Honesty note:** the quantum module is an *assessment* of cryptographic
> posture and migration planning. It does not claim to implement quantum-safe
> cryptography.

---

## 11. Project Layout

```
src/
├── app/
│   ├── page.tsx                  # SPA root: landing ⇄ auth ⇄ dashboard
│   ├── layout.tsx                # dark SOC theme + sonner toasts
│   └── api/                      # 20+ REST route handlers (see §8)
├── components/
│   ├── landing/                  # marketing page (animated canvas hero)
│   ├── auth/auth-modal.tsx       # login/register + demo quick-fill
│   └── dashboard/                # shell + 9 views + widgets
├── lib/
│   ├── auth.ts                   # JWT (jose) + bcrypt + RBAC guards
│   ├── mask.ts                   # maskSensitiveData / maskObject / anonymize
│   ├── risk-engine.ts            # deterministic anomaly scoring
│   ├── events.ts                 # ingestion pipeline + SSE event bus
│   ├── simulator.ts              # background telemetry + 6 attack scenarios
│   ├── ai/provider.ts            # OpenAI/Groq/Ollama/z-ai abstraction
│   ├── ai/analysis.ts            # event analysis, assistant, quantum briefing
│   ├── seed.ts                   # idempotent demo dataset (55 users, 375+ events)
│   └── store.ts                  # Zustand SPA state
└── hooks/use-live-events.ts      # SSE client with toasts
```

---

## 12. Notes for Judges / Demo Script

1. Land on the marketing page — watch the live-network hero and architecture flow.
2. **Launch Dashboard** → one-click ADMIN demo login.
3. Topbar **SIMULATE ATTACK → Data Exfiltration**: watch CRITICAL events stream in
   via SSE, an incident open automatically, and AI analysis attach within seconds.
4. **Threat Monitor**: expand an event → masked payload viewer → **Block**.
5. **Data Protection**: paste anything sensitive in the playground — see exactly
   what the AI receives.
6. **AI Assistant**: ask *"Show today's biggest security risks."*
7. **Quantum Readiness**: generate the AI migration briefing.
8. Sign out, log in as **VIEWER** — note the read-only experience (RBAC in action).

---

© 2026 SENTINEL AI — built for the IBM Z Datathon 2026. Not affiliated with IBM.
