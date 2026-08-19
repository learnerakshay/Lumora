<div align="center">

<img src="docs/screenshots/00-lumora-banner.png" alt="Lumora — AI Knowledge Workspace &amp; Career Intelligence" width="820" />

# Lumora

**An AI Knowledge Workspace that answers only from evidence it can actually cite — and a Career Intelligence engine that turns a résumé into a staged, role-targeted learning plan.**

Retrieval finds candidate evidence. Lumora decides whether that evidence is *enough* before it calls an answer grounded — and says so plainly when it isn't.

<br />

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Neon](https://img.shields.io/badge/Neon_Postgres-pgvector-00E599?style=for-the-badge&logo=postgresql&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-Live-0C2451?style=for-the-badge&logo=razorpay&logoColor=white)

![Tests](https://img.shields.io/badge/tests-759_passing_/_776-3FB950?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Typecheck](https://img.shields.io/badge/tsc_--noEmit-clean-3FB950?style=for-the-badge&logo=typescript&logoColor=white)
![Build](https://img.shields.io/badge/build-passing-3FB950?style=for-the-badge&logo=vite&logoColor=white)

</div>

---

## Table of Contents

- [What Lumora Is](#what-lumora-is)
- [Key Features & Capabilities](#key-features--capabilities)
- [Visual Tour & UI Showcase](#visual-tour--ui-showcase)
- [Architecture & Technical Pipeline](#architecture--technical-pipeline)
- [Repository Structure](#repository-structure)
- [Getting Started & Local Setup](#getting-started--local-setup)
- [Environment Variables](#environment-variables)
- [Testing & Repository Hygiene](#testing--repository-hygiene)
- [Plans & Usage Limits](#plans--usage-limits)
- [Protected Invariants](#protected-invariants)
- [Credits & License](#credits--license)

---

## What Lumora Is

Lumora is a single unified TypeScript application where users add **sources** — PDFs, websites, plain text, YouTube videos, VTT transcripts — to a **Workspace**, then ask questions against them. One chat surface answers in one of two honest modes:

| Mode | When it fires | What it emits |
|---|---|---|
| **GROUNDED** | Retrieved chunks genuinely cover every requested topic | An answer where every claim carries a `[Citation #N]` marker traceable to a page, timestamp, or passage |
| **GENERAL** | Workspace evidence does not cover the question | A plainly-labelled general-knowledge answer with **zero** citation markers — never a fabricated source |

> [!NOTE]
> **The core product rule:** returning chunks is never by itself sufficient to call an answer grounded. A deterministic lexical topic-coverage gate (`assessWorkspaceEvidenceSufficiency`) runs *after* vector retrieval and decides the mode. The grounding gate and the three layers of citation validation are treated as protected invariants — they are never relaxed to make a response succeed.

---

## Key Features & Capabilities

### 🧠 Grounded AI Workspace

- **Evidence-gated answers.** pgvector cosine retrieval (topK 5, threshold 0.15, shingle dedupe) plus one bounded recovery pass on a normalized topic query, then a deterministic sufficiency gate that picks GROUNDED or GENERAL.
- **Citation provenance, three times validated.** Trust is enforced at retrieval (`assertCandidateIntegrity`), at construction (`createCitation`), and at persistence (`validateCitationInput` → `CitationTrustError`). A page number or video timestamp is either derived from real chunk metadata or the citation is rejected — never invented.
- **Bi-directional Context Inspector.** Clicking an inline `[N]` marker scrolls and pulses the matching evidence card in the right pane; clicking a card in the Context pane scrolls and glows the matching marker back in the transcript.
- **Streaming SSE contract.** `user_persisted → start → chunk* → (web_sources | tool_status)* → done | error`, with a durable-success guarantee: once the assistant message is persisted, a later failure still emits `done` with the persisted message.
- **Five AI Actions** — Summarize, Explain, Compare, Generate Notes, Key Takeaways — and four answer modes (Concise, Detailed, Critical, Creative).
- **Workspace isolation by construction.** Nested handlers read `res.locals.workspace.id`, never `req.params.id`; retrieval independently re-verifies ownership and throws on any cross-Workspace row.

### 📥 Multi-Modal Ingestion

Ingestion is a persisted, resumable state machine — not a fire-and-forget upload.

```
coordinator.dispatch → processSourcePipeline → parseSourceContent
   → generateSemanticChunks (1200 chars / 200 overlap)
   → generateEmbeddingsBatch (OpenAI, 1536-dim)
   → saveSourceIndex (one Serializable transaction)
```

| Source | Handling |
|---|---|
| **PDF** | `pdfjs-dist` parse, per-page text retained so citations resolve to a real page. Stored as `Bytes` in `SourceContent.artifactData`. |
| **YouTube** | Configured relay fast path tried once, then Gemini-native (`@google/genai`) fallback. Inline `[HH:MM:SS.mmm]` markers survive chunking so timestamp citations are derivable. |
| **Website** | `cheerio` static extraction with a readable-content guard (JavaScript-only pages are rejected honestly, not half-ingested). |
| **VTT / Text** | Direct parse with the same timestamp-preserving chunker path as YouTube. |

Every stage is persisted to `SourceProcessingAttempt` / `SourceProcessingEvent` under a heartbeat lease, and `startRecoveryLoop` re-dispatches stale attempts after a crash or cold start.

> [!TIP]
> **Index promotion is atomic.** `saveSourceIndex` runs one Serializable transaction: create `BUILDING` → insert vectors → verify count and dimensions → supersede the old index → promote to `READY` → set `activeIndexId`. `activeIndexId` is never set before verification, so a half-built index can never serve a query.

### 🎯 Career Intelligence

- **Résumé → skills → evidence.** Structured extraction (`lib/skills/extraction-*`) pulls each skill along with the evidence backing it, using OpenAI strict-mode JSON schema output.
- **Role matching & explainable gaps.** 4–5 target roles (`lib/skills/role-matching.ts`) and a fully deterministic, rule-keyed gap analysis (`lib/skills/gap-analysis.ts`) — no LLM decides your fit score.
- **Interactive SVG Competency Radar.** Six dimensions (System Design, RAG Pipelines, TypeScript, Vector DBs, Cloud Architecture, API Security) with a GSAP-tweened benchmark polygon that morphs between target roles against the candidate's evidence polygon.
- **3-stage sprint roadmap.** Selected gaps become a staged plan — why it matters → priority → required competency → closure steps → evidence task → resources — plus a Career Readiness report. The one AI call in the pipeline emits **prose only**; every number comes from deterministic scoring, and any missing field falls back to deterministic text rather than failing the plan.
- **Plan → Workspace.** A learning plan can spawn an **empty** linked Workspace (idempotent per plan), contract-tested to import nothing from `lib/ingestion/*` — a recommendation can never silently become Workspace evidence.

### 🔎 Resource Discovery Engine

A curated catalog (`lib/resources/catalog.ts`) of real creators and providers across **YouTube**, **Udemy**, **Cohort**, and **Website** platforms, combined with optional Tavily discovery, canonical-URL deduplication, and intent-aware ranking. Recommendations render inline beneath the assistant answer that prompted them, each carrying a real platform badge, access type, delivery mode, and language — all read from resolved data, never hardcoded per card.

### 💳 Payments & Usage Metering

- **Razorpay Orders only** — one-time purchases granting 30 days of access. No subscriptions, no autopay, no mandates. Renewal **stacks** from the existing expiry rather than discarding remaining days.
- **Reserve → commit *or* discard.** Every metered action holds an atomic reservation under a `pg_advisory_xact_lock`; every early return, `catch`, and `finally` settles it.
- **Single writer for entitlement.** `User.plan` has exactly one writer (`syncUserEntitlement`), which re-derives the plan from every `CAPTURED` payment row inside the same advisory lock — idempotent, and impossible to interleave with a usage check.
- **Webhook integrity.** The webhook route is mounted with `express.raw()` *above* `express.json()` so the HMAC covers the exact bytes Razorpay signed; a unique `eventId` makes processing idempotent under retries and double-delivery.

---

## Visual Tour & UI Showcase

> [!NOTE]
> Screenshots live in [`docs/screenshots/`](docs/screenshots). Capture at **1920×1080** (or 2× retina) in dark mode — Lumora's "Deep Space" theme is the intended presentation. See the capture checklist at the end of this section.

<table>
<tr>
<td width="50%" valign="top">

### 1 · Deep Space Landing

<img src="docs/screenshots/01-hero-deepspace.png" alt="Lumora hero section with floating glass navbar, Three.js knowledge core, and one-click query chips" width="100%" />

Floating pill navbar, the Three.js knowledge-core sphere with animated source connectors, and one-click preset query chips that stream a scripted grounded preview.

</td>
<td width="50%" valign="top">

### 2 · ⌘K Spotlight Launcher

<img src="docs/screenshots/02-spotlight-command-palette.png" alt="Frosted-glass command palette opened with Cmd+K showing four quick actions" width="100%" />

Global `⌘K` / `Ctrl+K` palette with live filtering — jumps to the grounding demo, the Competency Radar, the architecture drawer, or the pricing page.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 3 · Grounded vs. General

<img src="docs/screenshots/03-grounded-vs-general-answer.png" alt="Self-playing Question to Claim to Evidence to Verdict demo contrasting a grounded cited answer with an honest general-knowledge fallback" width="100%" />

The self-playing **Question → Claim → Evidence → Verdict** demo, contrasting a cited Workspace answer against an honest, citation-free general-knowledge fallback.

</td>
<td width="50%" valign="top">

### 4 · Three-Pane Workspace

<img src="docs/screenshots/04-workspace-3pane-ide.png" alt="Full research workspace showing the sources sidebar, chat canvas, and context inspector" width="100%" />

Sources sidebar (status, type, size), the chat canvas with streamed Markdown, and the Context Inspector — each pane collapsible to a thin rail.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 5 · Bi-Directional Citations

<img src="docs/screenshots/05-bidirectional-citation-flow.png" alt="An active inline citation marker glowing cyan alongside its highlighted evidence card in the Context Inspector" width="100%" />

An active citation glows in both directions at once — inline marker in the transcript and its evidence card in the Context Inspector, linked by a shared evidence key.

</td>
<td width="50%" valign="top">

### 6 · Multi-Modal Ingestion

<img src="docs/screenshots/06-multimodal-waveform-ingestion.png" alt="YouTube ingestion preview showing an audio waveform and a timestamped transcript with the active line highlighted" width="100%" />

The YouTube ingestion preview: waveform plus a timestamped transcript where the active line highlights as embeddings are generated.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 7 · Competency Radar

<img src="docs/screenshots/07-career-competency-radar.png" alt="SVG radar chart comparing a candidate evidence polygon against a target role benchmark polygon" width="100%" />

Six-axis SVG radar. Cyan is the candidate's evidence; the dashed violet benchmark morphs as you switch between AI Systems Engineer, Full-Stack Lead, and RAG Specialist.

</td>
<td width="50%" valign="top">

### 8 · Sprint Roadmap

<img src="docs/screenshots/08-career-sprint-roadmap.png" alt="Three-stage sprint roadmap with Strong, Developing, and Missing gap severity pills" width="100%" />

Gaps ranked by real severity into a three-sprint plan, each carrying a `Strong` / `Developing` / `Missing` band derived from the benchmark delta.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 9 · Resource Discovery

<img src="docs/screenshots/09-resource-discovery-grid.png" alt="Recommended learning resources grid with YouTube, Udemy, and Cohort platform badges" width="100%" />

Auto-fitting recommendation grid with real platform badges (YouTube / Udemy / Cohort / Website), access type, delivery mode, and language.

</td>
<td width="50%" valign="top">

### 10 · Pricing & Architecture Dock

<img src="docs/screenshots/10-pricing-architecture-dock.png" alt="FREE, CORE, and MAX pricing cards above the expanded engineering architecture drawer" width="100%" />

FREE / CORE / MAX cards — every limit derived from `PLAN_LIMITS` — above the expanded engineering architecture drawer and the live `/api/health` beacon.

</td>
</tr>
</table>

<details>
<summary><b>📸 Screenshot capture checklist</b></summary>

<br />

| # | Filename | Route / State to capture |
|---|---|---|
| 0 | `00-lumora-banner.png` | Optional wide banner or logo lockup (820px+ wide) |
| 1 | `01-hero-deepspace.png` | `/` — top of page, navbar visible, one query chip expanded |
| 2 | `02-spotlight-command-palette.png` | `/` — press `⌘K` / `Ctrl+K` |
| 3 | `03-grounded-vs-general-answer.png` | `/` — scroll to "Answers are easy. Trust is the product." |
| 4 | `04-workspace-3pane-ide.png` | `/workspaces/:id` — a Workspace with ≥2 ready sources and chat history |
| 5 | `05-bidirectional-citation-flow.png` | `/workspaces/:id` — click an inline `[1]` marker so both sides glow |
| 6 | `06-multimodal-waveform-ingestion.png` | `/` — "How Lumora Works", expand the **YouTube Videos → Preview** row |
| 7 | `07-career-competency-radar.png` | `/` — Career Intelligence section, radar with a role selected |
| 8 | `08-career-sprint-roadmap.png` | `/` — directly below the radar |
| 9 | `09-resource-discovery-grid.png` | `/workspaces/:id` — an answer that returned ≥3 recommendations |
| 10 | `10-pricing-architecture-dock.png` | `/pricing` or `/` pricing section, with the footer architecture drawer open |

</details>

---

## Architecture & Technical Pipeline

**Single unified TypeScript app** — not a monorepo, and not split frontend/backend repos. `server.ts` runs Express *and* Vite middleware in one process in development.

```mermaid
flowchart TD
    A["Client · Vite 6 + React 19 SPA<br/>route-level code splitting"] -->|"POST /api/workspaces/:id/chat/stream"| B["Express 4 · server.ts"]
    B --> C["Clerk middleware<br/>requireApiAuth + ownership check"]
    C --> D["Grounding Router<br/>selectInitialChatRoute"]
    D --> E["Usage · checkAndReserve<br/>pg_advisory_xact_lock"]
    E --> F["Vector Retrieval<br/>pgvector cosine · topK 5 · 0.15"]
    F --> G{"assessWorkspaceEvidence<br/>Sufficiency"}
    G -->|covers topics| H["GROUNDED · buildRAGContext<br/>+ createCitation per chunk"]
    G -->|does not cover| I["GENERAL · no citation markers"]
    H --> J["Orchestrator · up to 4 tool rounds<br/>OpenAI /v1/responses + optional Tavily"]
    I --> J
    J --> K["Prisma 6 → Neon Postgres<br/>DATABASE_URL (-pooler)"]
    K --> L["SSE Stream Hydration<br/>start → chunk* → done"]
    L --> A

    M["Ingestion Coordinator<br/>heartbeat lease + recovery loop"] --> N["parse → chunk → embed"]
    N --> O["saveSourceIndex<br/>one Serializable transaction"]
    O --> K
```

### Request flow that matters most

`POST /api/workspaces/:id/chat/stream` is the system to understand first:

1. `requireApiAuth` → `workspaceRouter.param('id')` resolves and ownership-checks the Workspace into `res.locals.workspace`.
2. `selectInitialChatRoute` — no sources + meta question → deterministic reply; no sources otherwise → GENERAL without retrieval; else retrieve.
3. `checkAndReserve` (usage) → register in `activeChatGenerations` → persist USER message + a `SENDING` assistant placeholder.
4. `searchWorkspaceChunks` — pgvector cosine, topK 5, threshold 0.15, shingle dedupe, plus one bounded recovery retrieval.
5. `assessWorkspaceEvidenceSufficiency` → `selectResponseModeAfterRetrieval` picks GROUNDED or GENERAL.
6. `buildRAGContext` → `createCitation` per chunk (where transcript/page provenance is derived).
7. `orchestrateGroundedResponse` — up to 4 tool rounds, optional Tavily web search.
8. `replaceWorkspaceAssistantMessage` persists answer + citations → `commitUsage`.

### Data model

`Workspace` (owned by `userId`) → `Source` → `SourceContent` (versioned) / `SourceIndex` (versioned) → `Chunk` (`vector(1536)`) ; `Message` → `Citation`. Plus `User`, `UsageEvent`, `SkillProfile`, `RoleAnalysis`, `LearningPlan`, `LearningWorkspaceLink`, `Payment`, `WebhookEvent`, and `Coupon` — **18 models and 16 enums across 14 migrations**.

### API surface

| Router | Mount | Responsibility |
|---|---|---|
| `workspaces.ts` | `/api/workspaces` | Workspaces, sources, ingestion, and the SSE chat handler |
| `usage.ts` | `/api/usage` | Rolling-window usage summary |
| `skills.ts` | `/api/skills` | Résumé extraction, role matching, gap analysis |
| `learning.ts` | `/api/learning` | Learning-plan build, read, and Workspace linking |
| `payments.ts` | `/api/payments` | Config, plans, quote, order, verify, access, history |
| `payments-webhook.ts` | `/api/payments/webhook` | Raw-body Razorpay webhook (mounted above `express.json()`) |
| — | `/api/health` | Real PostgreSQL + pgvector readiness probe |

> [!IMPORTANT]
> Requests to `/api/*` must never fall through to the SPA. An `apiNotFoundHandler` sits between the routers and the Vite/static middleware so an unmatched API path returns structured JSON, never HTML. This is contract-tested.

### Deployment topology

Vercel serves the SPA and the protected transcript relay (`api/youtube-transcript.ts` — the one serverless function), and rewrites `/api/:path*` to the Render Express service. Local dev runs both halves in one process, so route-shadowing and rewrite behavior differ between local and production — verify API path changes against the deployed setup.

---

## Repository Structure

```
lumora/
├── server.ts                     # Express entry — Clerk → routers → health → API 404 → Vite/static
├── prisma/
│   ├── schema.prisma             # 18 models, 16 enums, pgvector extension
│   └── migrations/               # 14 migrations
├── api/
│   └── youtube-transcript.ts     # The one Vercel serverless function (protected relay)
├── src/
│   ├── App.tsx                   # Router + AuthProvider/AccessProvider/UsageProvider
│   ├── routes/                   # Express routers (server-side, despite living in src/)
│   │   ├── workspaces.ts         # ~1600 lines — most of the API, incl. SSE chat
│   │   ├── usage.ts  skills.ts  learning.ts  payments.ts  payments-webhook.ts
│   ├── lib/                      # ALL backend logic + shared client helpers
│   │   ├── ai/                   # Orchestrator, providers, action catalog
│   │   ├── chat/                 # Grounding router, conversation store/lifecycle
│   │   ├── retrieval/            # rag-service — pgvector search + citation build
│   │   ├── ingestion/            # Coordinator, parsers, chunker, embeddings
│   │   ├── skills/               # Extraction, role matching, gap analysis
│   │   ├── learning/             # Priority, competency, readiness, path builder
│   │   ├── resources/            # Curated catalog + discovery resolver
│   │   ├── payments/             # Razorpay client, signature, access, capture
│   │   ├── usage/                # Reserve/commit/discard + PLAN_LIMITS
│   │   └── env.ts                # zod-validated env (typeof window guard)
│   ├── pages/                    # 19 page components; 18 lazy-loaded routes
│   └── components/
│       ├── landing/              # Hero, SpotlightLauncher, CompetencyRadar, CitationTag
│       ├── workspace/            # ChatArea, SourcesSidebar, ContextPanel, composer
│       ├── skills/  learning/    # Phase 1 & 2 UI
│       ├── payments/  pricing/  billing/
│       └── usage/                # UsageIndicator (quota ring), drawer, limit notice
├── scripts/                      # Razorpay + coupon admin tooling
└── docs/                         # ARCHITECTURE.md · PRD.md · VALIDATION.md · PITCH.md
```

> [!NOTE]
> `src/lib/` holds **all backend logic** in the same tree the React client imports from. The boundary is convention plus the `typeof window` guard in `src/lib/env.ts` — not the build. **Never import a server module into a component.**

---

## Getting Started & Local Setup

### Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20+** | Required by Vite 6 and Prisma 6 |
| **Neon Postgres** (or any pgvector-capable Postgres) | The `vector` extension is mandatory |
| **Clerk** application | Publishable + secret key |
| **OpenAI** API key | Chat (`/v1/responses`, raw `fetch` — no SDK) and 1536-dim embeddings |
| **Gemini** API key | YouTube transcript fallback (`@google/genai`) |
| **Tavily** API key | *Optional* — enables web-search tool rounds |
| **Razorpay** keys | *Optional* — payments are off unless `PAYMENTS_ENABLED=true` |

### 1 · Install

```bash
git clone <your-fork-url> lumora
cd lumora
npm install
```

### 2 · Configure environment

```bash
cp .env.example .env
```

Then fill in the values described in [Environment Variables](#environment-variables) below.

### 3 · Sync the database

```bash
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

> [!WARNING]
> **Do not run `prisma migrate dev` against a live database in this project.** There is a known pgvector extension drift between Neon's installed version and the recorded migration history. `migrate dev` detects the drift and offers `prisma migrate reset` as the fix — **which drops and recreates the entire `public` schema, destroying every row in every table.** Use `migrate deploy` for applying existing migrations. For a *new* additive migration, hand-write the SQL, apply it via a throwaway `prisma.$executeRawUnsafe` script, then record it with `prisma migrate resolve --applied <name>`.

### 4 · Run

```bash
npm run dev          # tsx server.ts — Express + Vite middleware in ONE process on :3000
```

Open <http://localhost:3000>.

### Production build

```bash
npm run build        # prisma generate && vite build && esbuild server.ts → dist/server.cjs
npm start            # node dist/server.cjs
```

---

## Environment Variables

Every variable is zod-validated at boot and accessed only through `getServerEnv()`. See [`.env.example`](.env.example) for the fully annotated file.

### Database — the pooling split matters

```ini
DATABASE_URL="postgresql://user:pass@ep-host-pooler.region.aws.neon.tech/lumora?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-host.region.aws.neon.tech/lumora?sslmode=require"
```

> [!IMPORTANT]
> `DATABASE_URL` **must** use Neon's pooled endpoint (the `-pooler` hostname). Every request path — auth, chat, ingestion, payments — reuses this pool through the single `PrismaClient` in `src/lib/prisma.ts`. Pointing it at the direct endpoint adds real connection-setup latency to every cold Neon compute resume and risks exhausting Neon's direct connection limit under load. `DIRECT_URL` stays **non-pooled** because Prisma uses it only for migrations, which need a session-level (non-transaction-pooled) connection.

### Core services

| Variable | Purpose |
|---|---|
| `CLERK_SECRET_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` | Server + client auth |
| `OPENAI_API_KEY` | Chat completions and embeddings |
| `GEMINI_API_KEY` | YouTube transcript fallback (**server-only**) |
| `TAVILY_API_KEY` | Optional web-search tool |
| `CHAT_MODEL`, `CHAT_REASONING_EFFORT`, `CHAT_REQUEST_TIMEOUT_MS` | Provider tuning |

### Embedding contract — treat as migrations

```ini
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIMENSIONS=1536
EMBEDDING_VERSION="v1"
```

> [!CAUTION]
> Changing `EMBEDDING_MODEL`, `EMBEDDING_VERSION`, or `EMBEDDING_DIMENSIONS` **invalidates every existing index**. Retrieval requires an exact embedding-contract match and will throw rather than silently degrade to mismatched vectors. Treat these three as schema migrations, not config.

### Payments (optional)

`PAYMENTS_ENABLED="false"` is a full kill switch — every payment route and the webhook return `503` immediately, no redeploy needed. When `true`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are required and validated.

> [!NOTE]
> Booleans go through a `booleanFlag` helper because `z.coerce.boolean()` treats the literal string `"false"` as `true`. Never put a secret in a `VITE_`-prefixed variable — those are bundled into the client.

---

## Testing & Repository Hygiene

Tests use the **Node built-in test runner** via `tsx --test`. There is no Vitest, no Jest, no ESLint, and no Prettier in this repo.

```bash
npm test             # all 12 suites, chained with && (an early failure SKIPS the rest)
npm run typecheck    # tsc --noEmit  (npm run lint is an alias for the same command)
npm run build        # must succeed before any deploy
```

### Current state

| Metric | Result |
|---|---|
| Total tests | **776** |
| Passing | **759** |
| Failing | **0** |
| Skipped | **17** (DB-gated — require a live `DATABASE_URL` / `RUN_DATABASE_PAYMENTS_TESTS=true`) |
| `tsc --noEmit` | Clean |
| `npm run build` | Passing |

### Individual suites

```bash
npm run test:ingestion     npm run test:retrieval     npm run test:chat
npm run test:ai            npm run test:usage         npm run test:resources
npm run test:skills        npm run test:learning      npm run test:payments
npm run test:payments-ui   npm run test:ui-components npm run test:app-shell
```

```bash
npx tsx --test src/lib/retrieval/rag-service.test.ts                    # single file
npx tsx --test --test-name-pattern="citation" src/lib/**/*.test.ts      # by name
```

### Conventions worth knowing before contributing

- **No component-testing setup.** There is no React Testing Library and no jsdom. A component's *behavioral* contract — "this handler never touches that state", "this button is wired to the shared submission gate" — is verified by reading the component source as text (`readFileSync`) and asserting with `assert.match` / `assert.doesNotMatch`. See `src/components/workspace/workspace-interactions.test.ts` and `src/routes/payments-route-contract.test.ts` for the pattern. Reach for this before reaching for a new test framework.
- **`tsconfig.json` does not enable `strict`.** A clean typecheck is a weaker guarantee than it looks. Notably, without `strictNullChecks` TypeScript fails to narrow boolean-literal discriminated unions — which is why `payments-api.ts` uses a string-literal `status: 'ok' | 'error'` discriminant, guarded by a regression test.
- **Known flake:** `coordinator.test.ts`'s heartbeat-lease test is timing-sensitive and can fail under heavy system load. Re-run before treating it as a real failure, and check which suites actually ran (the `&&` chain stops at the first failure).
- Errors use `AppError` + `successResponse` / `errorResponse` envelopes with stable `SCREAMING_SNAKE` codes. Logging is `logger.info(message, { context })` — **never** log source content or secrets.
- Tests are colocated as `*.test.ts` beside the unit they cover.

---

## Plans & Usage Limits

Limits are **per user, per action, in a rolling 12-hour window** — not a calendar-day reset. Every value below is read from `PLAN_LIMITS` in `src/lib/usage/config.ts`; the pricing presentation layer is contract-tested to contain no hardcoded limit or price digits, so the UI structurally cannot drift from what the backend enforces.

| Action | FREE | CORE | MAX |
|---|---:|---:|---:|
| Chat answers | 10 | 40 | 150 |
| Sources ingested | 4 | 15 | 50 |
| AI Actions | 8 | 25 | 80 |
| Skill Intelligence analyses | 2 | 6 | 15 |
| Learning Paths | 2 | 6 | 15 |

| Plan | List price | Launch price | Access |
|---|---:|---:|---|
| **FREE** | ₹0 | ₹0 | Always free |
| **CORE** | ₹999 | **₹499** | 30 days, one-time |
| **MAX** | ₹2,499 | **₹1,499** | 30 days, one-time |

> [!NOTE]
> **Every capability is available on every plan.** Paid tiers raise how much you can do per window — they never gate a feature. Payments are one-time with no auto-renewal; renewing early *extends* from your existing expiry rather than discarding remaining days, and buying MAX while CORE is active preserves the higher tier.

---

## Protected Invariants

These are enforced by tests and must not be relaxed to make a feature or a response succeed:

1. **Workspace isolation.** Nested handlers use `res.locals.workspace.id`, never `req.params.id`. Retrieval independently re-verifies ownership; `assertCandidateIntegrity` throws on any cross-Workspace row.
2. **Retrieval reads only trusted vectors.** `chunk.indexId === Source.activeIndexId`, index `status = READY`, matching `sourceVersion`, and an exact embedding-contract match.
3. **Index promotion is one Serializable transaction.** `activeIndexId` is never set before count and dimension verification.
4. **Usage is always reserve → commit *or* discard.** Every early return, `catch`, and `finally` settles the reservation.
5. **Citation validation is defence in depth** at three layers. Fix derivation — never relax a validator, and never fabricate a page or timestamp.
6. **Durable success wins.** Once the assistant message is persisted, a later failure still emits `done` with the persisted message.
7. **`Message.parentMessageId` is `@unique`** — exactly one assistant reply per user turn.
8. **Grounded answers use `[Citation #N]` markers only**; GENERAL answers must never emit them (`GeneralResponseSafeStream` enforces this).
9. **`User.plan` has exactly one writer** — `syncUserEntitlement`. No route, webhook, or middleware may call `prisma.user.update({ data: { plan } })`.
10. **The webhook route stays mounted with `express.raw()` above `express.json()`.** Contract-tested.
11. **Payments are never metered.** No payment route calls `checkAndReserve` / `commitUsage` / `discardUsage`.

Terminology is enforced too: it is always a **Workspace** — never a project, folder, room, or tenant.

---

## Further Documentation

| Document | Contents |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Engineering guide — architecture, invariants, phase status, known issues |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture deep dive |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements |
| [`docs/VALIDATION.md`](docs/VALIDATION.md) | Validation evidence |
| [`docs/PITCH.md`](docs/PITCH.md) | Pitch and presentation data pack |

---

## Credits & License

**Author** — [@learnerakshay](https://github.com/learnerakshay)

**Built with** — React 19 · Vite 6 · TypeScript 5.8 · Tailwind CSS 4 · Express 4 · Prisma 6 · Neon Postgres + pgvector · Clerk · OpenAI · Google Gemini · Tavily · Razorpay · Three.js · GSAP · Framer Motion · Lenis · Lucide

**Resource catalog** — the curated learning catalog references real creators and platforms (including ChaiCode, Udemy, and YouTube channels). All trademarks and course content belong to their respective owners; Lumora links to them and does not host or redistribute their material.

### License

> [!IMPORTANT]
> **This repository currently has no `LICENSE` file and no `license` field in `package.json`.** Under default copyright law that means all rights are reserved and no reuse permissions are granted. If you intend this to be open source, add a `LICENSE` file (MIT and Apache-2.0 are the common choices for a project like this) and set the matching `"license"` field in `package.json` — then update this section.

---

<div align="center">

**Retrieval finds candidate evidence. Lumora decides whether it's enough.**

</div>
