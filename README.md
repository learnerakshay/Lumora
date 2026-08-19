<div align="center">

# Lumora

### AI Knowledge Workspace & Career Intelligence Platform

**Answers are easy. Trust is the product.**

Lumora is a single unified TypeScript application where you add sources — PDFs, websites, plain text, YouTube videos, VTT transcripts — to a **Workspace**, then ask questions against them. Retrieval finds candidate evidence; a deterministic gate then decides whether that evidence is actually *enough* before any answer is allowed to call itself grounded. When it isn't enough, Lumora says so and answers from general knowledge with zero citation markers, instead of dressing up a weak match as a sourced fact.

<br />

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Neon](https://img.shields.io/badge/Neon_Postgres-pgvector-00E599?style=for-the-badge&logo=postgresql&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-Orders-0C2451?style=for-the-badge&logo=razorpay&logoColor=white)

![Tests](https://img.shields.io/badge/tests-759_pass_·_0_fail_·_17_skipped-3FB950?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Typecheck](https://img.shields.io/badge/tsc_--noEmit-clean-3FB950?style=for-the-badge&logo=typescript&logoColor=white)
![Build](https://img.shields.io/badge/build-passing-3FB950?style=for-the-badge&logo=vite&logoColor=white)

</div>

### Screenshot #01 — Deep Space Hero

![Screenshot #01 — Lumora Deep Space Hero with floating navigation, 3D knowledge sphere and one-click preset queries](docs/screenshots/01-hero-deepspace.png)

The landing experience: a floating island navbar, the Three.js knowledge-core canvas — the only WebGL surface in the product, deliberately confined to the landing page — and one-click preset query chips. Those chips play a clearly-scripted grounded preview: they demonstrate the shape of an answer, they are not live API calls.

---

## Table of Contents

**Product** — [Why Lumora Exists](#why-lumora-exists) · [Product Experience](#product-experience) · [Core Capabilities](#core-capabilities)

**Engineering** — [System Architecture](#system-architecture) · [How Grounded Answers Work](#how-grounded-answers-work) · [Ingestion Pipeline](#ingestion-pipeline) · [Career Intelligence](#career-intelligence) · [Resource Discovery](#resource-discovery) · [Usage, Plans & Payments](#usage-plans--payments) · [Engineering Guarantees](#engineering-guarantees)

**Running it** — [Tech Stack](#tech-stack) · [Local Development](#local-development) · [Testing & Validation](#testing--validation) · [Project Structure](#project-structure) · [Deployment](#deployment) · [Status](#status)

---

## Why Lumora Exists

The interesting failure mode in retrieval-augmented systems is not "the search returned nothing." It is that the search returned *something plausible* and the system treated that as permission to answer with citations.

A similarity match above a threshold proves some text is near the question. It does not prove the retrieved passages cover what the question actually asked. Conflating the two produces the most dangerous possible output: a confident, well-formatted, cited answer whose citations do not support it. Lumora separates them explicitly.

```text
Question
   ↓
Candidate Evidence          (pgvector cosine · topK 5 · threshold 0.15)
   ↓
Evidence Sufficiency        (deterministic lexical topic-coverage gate)
   ├── Insufficient → GENERAL   · plainly labelled · zero citation markers
   └── Sufficient   → GROUNDED  · validated [Citation #N] markers
```

| Mode | When it fires | What it emits |
|---|---|---|
| **GROUNDED** | Retrieved chunks genuinely cover the requested topics | An answer with validated `[Citation #N]` markers tied to Workspace evidence — every marker resolves to a real retrieved chunk with a real page, timestamp, or passage |
| **GENERAL** | Workspace evidence does not cover the question | A labelled general-knowledge answer with **no** citation markers — never a fabricated source |

The gate is deterministic and lexical, not another model call. It extracts distinctive topic groups from the question, filters out query scaffolding — words like *document*, *source*, *summarize*, *speaker* that describe the question's own grammar rather than its subject — then requires each remaining topic group to actually appear in retrieved source text.

Two stream-level rules back this up: a GENERAL answer is structurally prevented from emitting any citation marker, and a GROUNDED answer must reference at least one retrieved citation, with every marker validated against the retrieved set as it streams. What the system does *not* claim is per-sentence coverage — it guarantees the citations present are real, not that every sentence carries one.

This gate and the layered citation validation behind it are protected invariants here. They are never relaxed to make a response succeed.

---

## Product Experience

### Screenshot #02 — Spotlight Launcher

![Screenshot #02 — Lumora Command Palette and Spotlight Launcher](docs/screenshots/02-spotlight-launcher.png)

A global `⌘K` / `Ctrl+K` command palette with live filtering, reachable anywhere the navbar renders. Four real actions: jump to the grounding demo, the Career Competency Radar, the engineering architecture drawer, or the plan comparison. Every action navigates for real, including cross-route jumps that route first and then scroll to the target.

### Screenshot #03 — Grounding Inspector

![Screenshot #03 — Lumora Grounding Inspector comparing grounded evidence against unsupported AI output](docs/screenshots/03-grounding-inspector.png)

The `Question → Claim → Evidence → Verdict` walkthrough, which makes the GROUNDED/GENERAL distinction legible before you sign in. Toggle between a claim the Workspace evidence covers and one it doesn't, and the verdict changes: one side yields a cited Workspace answer, the other an honest, citation-free general answer. This is a self-playing explanatory demo of the real routing rule — not a live hallucination detector, and not a claim to be one.

### Screenshot #04 — Multi-Source Ingestion

![Screenshot #04 — Lumora multimodal source ingestion with YouTube transcript indexing](docs/screenshots/04-multimodal-ingestion.png)

Five source types reach the same pipeline: `PDF`, `WEBSITE`, `YOUTUBE`, `VTT`, `TEXT`. YouTube is the interesting one — transcripts are acquired, timestamped, chunked with their `[HH:MM:SS.mmm]` markers intact, and embedded, so a citation can resolve to a real moment in the video rather than to "somewhere in this transcript." Note that "multi-source" here means multiple *source formats*, all reduced to text before embedding; Lumora does not perform image or audio understanding.

### Screenshot #05 — Three-Pane Research Workspace

![Screenshot #05 — Lumora three-pane research Workspace with Sources, Chat and Context](docs/screenshots/05-workspace-3pane-ide.png)

The canonical product surface, and the reason the mental model is a research IDE rather than a chat window: a Sources sidebar (type, status, version), the chat canvas with streamed Markdown, and the Context inspector holding the evidence behind the current answer. Side panes collapse to thin rails when you want the reasoning canvas at full width.

### Screenshot #06 — Bi-Directional Citations

![Screenshot #06 — Lumora bidirectional citation highlighting between answer and source Context](docs/screenshots/06-bidirectional-citations.png)

Citations are navigable in both directions: selecting an inline `[N]` marker activates the matching evidence card in the Context pane, and selecting a card activates the marker back in the answer. Both sides share one synchronized selection state, so the highlight can never drift out of sync. Where the source supports it, the citation also resolves outward — a PDF citation opens the document at its real page, and a YouTube citation opens the video at its derived timestamp, but only while the citation's source version still matches the source.

### Screenshot #07 — Active Generation Pipeline

![Screenshot #07 — Lumora active RAG pipeline with staged retrieval and generation progress](docs/screenshots/07-active-rag-loading.png)

The live generation state. Notice what is and isn't shown: a status line derived from the actual action and answer mode in flight, a **real** elapsed timer measured from request start, and skeleton placeholders. As the SSE stream reports them, a response-mode disclosure badge appears — *From your Workspace* or *General knowledge* — alongside live tool-status chips and any external web sources consulted. Lumora deliberately does not render a fake multi-stage backend pipeline; it shows only states the stream actually reports.

### Screenshot #08 — Career Competency Radar

![Screenshot #08 — Lumora Career Intelligence competency radar and skill-gap analysis](docs/screenshots/08-career-competency-radar.png)

An interactive six-axis SVG radar (System Design, RAG Pipelines, TypeScript, Vector DBs, Cloud Architecture, API Security) whose benchmark polygon morphs between three target roles against a candidate evidence polygon, with per-axis `strong` / `developing` / `missing` bands and a derived three-stage sprint roadmap. This landing visualization uses fixed, hand-set benchmark values to demonstrate the model — the real, résumé-driven analysis runs in the authenticated Career Intelligence surface, described [below](#career-intelligence).

### Screenshot #09 — Resource Discovery

![Screenshot #09 — Lumora Resource Discovery recommendations across ChaiCode, Udemy and YouTube](docs/screenshots/09-resource-discovery-grid.png)

Recommendations render inline beneath the answer that prompted them, and inside learning-plan steps, from the same component. Each card's platform badge (YouTube / Udemy / Cohort / Website), access type, delivery mode, and language is read from resolved resource data — nothing is hardcoded per card. The curated catalog holds 69 real resources across those four platforms; Tavily discovery, when configured, adds to that pool rather than replacing it.

### Screenshot #10 — Pricing & Engineering Architecture

![Screenshot #10 — Lumora pricing tiers and expandable Engineering Architecture blueprint](docs/screenshots/10-pricing-architecture.png)

FREE / CORE / MAX with CORE marked as the recommended tier, every limit and price derived from the backend's own constants rather than restated in the UI. Below the fold, the footer carries an expandable **View Engineering Architecture** drawer and a live `/api/health` beacon that reports operational / degraded state from a real probe of Postgres and pgvector readiness — not a decorative status dot.

---

## Core Capabilities

| Capability | Engineering implementation |
|---|---|
| **Evidence-aware answers** | pgvector cosine retrieval (topK 5, threshold 0.15, deduplicated) plus one bounded recovery pass, then a deterministic topic-coverage gate that selects GROUNDED or GENERAL |
| **Source ingestion** | Five source types through one persisted, resumable pipeline; 1,200-character chunks with 200-character overlap; 1,536-dimensional embeddings; index promotion in a single Serializable transaction |
| **Citation provenance** | Validated at three independent layers — retrieval, construction, and persistence. Page numbers and timestamps are derived from real chunk metadata or the citation is rejected |
| **Streaming chat** | SSE contract `user_persisted → start → chunk* → (web_sources \| tool_status)* → done \| error`, with a durable-success rule: a persisted answer is always returned, even if a later step fails |
| **AI actions & modes** | Five actions (Summarize, Explain, Compare, Generate Notes, Key Takeaways) across four answer modes (`CONCISE`, `DETAILED`, `CRITICAL`, `CREATIVE`) |
| **Career Intelligence** | Résumé extraction → normalized skills with evidence levels → deterministic role matching over a 12-role catalog → rule-keyed, explainable gap analysis. No model decides a fit score |
| **Learning Paths** | Selected gaps become a staged `now` / `next` / `later` plan with a readiness report. Scoring and sequencing are deterministic; one constrained AI call supplies prose only, falling back to deterministic text if unusable |
| **Resource Discovery** | 69-resource curated catalog plus optional Tavily discovery, canonical-URL deduplication, and ranking with provider diversity; fails closed to curated content |
| **Usage controls** | Five metered actions under a 12-hour rolling window, enforced by an atomic reserve → commit *or* discard lifecycle under a per-user lock |
| **Payments** | Razorpay **Orders** — one-time purchases granting 30 days of access. Server-authoritative pricing, signature verification, an authoritative provider re-read before any grant, idempotent webhooks |
| **Responsive & accessible UX** | Route-level code splitting across 18 routes, dialog focus traps with focus restore, `aria-live` status transitions, and a global `prefers-reduced-motion` clamp |

---

## System Architecture

**A single unified TypeScript application** — not a monorepo, and not split frontend/backend repositories. In development, `server.ts` runs Express *and* Vite middleware in one process on one port.

```mermaid
flowchart TB
    USER["User"] --> UI["React 19 + Vite 6 SPA"]
    UI <-->|"session"| CLERK["Clerk"]
    UI -->|"REST + SSE"| API["Express 4 · server.ts"]
    API --> AUTH["Authorization + Workspace ownership"]
    AUTH --> ING["Ingestion coordinator"]
    AUTH --> RAG["Retrieval + evidence gate"]
    AUTH --> CAREER["Career Intelligence"]
    AUTH --> LEARN["Learning Path engine"]
    AUTH --> USAGE["Usage reservation"]
    AUTH --> PAY["Payments / entitlements"]
    RAG --> RES["Resource discovery"]
    LEARN --> RES
    ING --> DB[("Neon PostgreSQL + pgvector")]
    RAG --> DB
    CAREER --> DB
    LEARN --> DB
    USAGE --> DB
    PAY --> DB
    ING --> EMB["OpenAI embeddings · 1536d"]
    ING --> GEM["Gemini · YouTube acquisition fallback"]
    RAG --> AI["AI orchestration · OpenAI /v1/responses"]
    CAREER --> AI
    LEARN --> AI
    AI --> TAVILY["Tavily · optional web search"]
    RES --> TAVILY
    PAY --> RZP["Razorpay"]
    UI -. "production frontend + transcript relay" .-> VERCEL["Vercel"]
    API -. "production backend" .-> RENDER["Render"]
```

**Clerk authenticates; Express authorizes.** Identity comes from Clerk, but every authorization decision is made server-side: a Workspace is resolved and ownership-checked once, before any nested handler runs, and handlers operate only on that verified Workspace. Retrieval re-verifies ownership independently rather than trusting the caller.

**Prisma and Neon hold all state, with pgvector doing retrieval in the same database.** Keeping vectors beside their ownership rows is deliberate — it means a retrieval query cannot reach across Workspace boundaries through a second, separately-authorized system. AI providers sit strictly at the edges: OpenAI for embeddings and generation, Gemini for YouTube transcript acquisition, Tavily optionally for web search.

**Critical state changes are serialized rather than eventually consistent.** Usage reservations and entitlement synchronization take the same per-user lock, so a quota check can never interleave with a plan change, and index promotion happens inside a single transaction so a half-built index can never serve a query.

**Deployment splits along one line:** Vercel serves the SPA and the transcript relay; Render runs the Express API. API requests are terminated by an explicit not-found handler before the SPA fallback, so a missing route returns structured JSON rather than an HTML page pretending to be a successful response.

### API surface

| Area | Responsibility |
|---|---|
| Workspace API | Workspaces, sources, ingestion, messages, SSE chat |
| Career API | Résumé profile extraction and role/gap analysis |
| Learning API | Staged learning paths and linked Workspaces |
| Usage API | Rolling-window quota visibility |
| Payments API | Checkout, verification, access, billing history |
| Webhook | Unauthenticated raw-body Razorpay endpoint |
| Health | PostgreSQL + pgvector readiness probe |

### Data model

Workspaces own Sources, their versioned content and indexes, the resulting `vector(1536)` chunks, and the Messages and Citations produced from them. Separate models persist usage events, Career Intelligence profiles and analyses, Learning Paths, and Razorpay payment state — **18 models and 16 enums across 14 migrations**. PDFs are stored as bytes in the database; there is no external blob store.

---

## How Grounded Answers Work

`POST /api/workspaces/:id/chat/stream` is the system to understand first.

```mermaid
flowchart TD
    A["1 · Authenticate + resolve Workspace ownership"] --> B{"2 · Select initial route"}
    B --> C["3 · Reserve usage + persist user message"]
    C -->|"no sources · meta question"| M["Deterministic reply"]
    C -->|"no sources"| G2["GENERAL · no retrieval"]
    C -->|"sources present"| D["4 · Retrieve active READY chunks"]
    D --> E["5 · Validate candidate integrity"]
    E --> F["6 · Assess topic coverage"]
    F -->|"insufficient"| G2
    F -->|"sufficient"| H["7 · GROUNDED"]
    H --> I["8 · Build citation-safe context"]
    G2 --> J["9 · Orchestrate + stream (max 4 tool rounds)"]
    I --> J
    J --> K["10 · Validate + persist answer and citations"]
    K --> L["11 · Commit or discard usage"]
```

1. **Authenticate and resolve the Workspace.** Ownership is verified once, up front, before any handler touches Workspace data. A Workspace with no sources short-circuits here — a meta question ("what's in here?") gets a deterministic reply, anything else routes to GENERAL without spending a retrieval.
2. **Reserve usage and persist recoverable state.** The reservation is atomic; the user message and a pending assistant placeholder are written immediately, so an interrupted stream can be recovered rather than lost.
3. **Retrieve only trusted evidence.** pgvector cosine similarity over the Workspace's chunks, ranked and deduplicated, plus one bounded recovery pass when the first looks thin. Candidates must sit on the source's *active*, `READY` index with a matching source version and an exact embedding-contract match — anything else throws rather than quietly degrading.
4. **Assess coverage and choose the mode.** The deterministic lexical gate decides: GROUNDED only if the retrieved text actually covers the requested topics, otherwise GENERAL.
5. **Build context and stream the answer.** Grounded context derives real page or timestamp provenance per chunk — a citation that cannot derive provenance is rejected, never invented. Generation runs up to four tool rounds, with optional web search surfacing as distinct web citations.
6. **Validate, persist, and settle.** Citations pass a second independent validation layer before persistence, and the usage reservation is committed on success or discarded on every other exit path.

**Grounded is a trust decision, not a retrieval result.** Finding chunks is a necessary condition for a grounded answer. Stage 4 is the sufficient one.

---

## Ingestion Pipeline

```text
Source (PDF · WEBSITE · YOUTUBE · VTT · TEXT)
→ Acquire      relay fast path / Gemini fallback / upload / fetch
→ Validate     type, size, URL safety, readable-content guard
→ Parse+Clean  page, timestamp, and cue provenance preserved
→ Chunk        1,200 chars target · 200 char overlap
→ Embed        OpenAI · 1,536 dimensions · batched
→ Index        BUILDING → insert vectors → verify count + dims
→ Promote      supersede old index → READY → set activeIndexId
```

Ingestion is a persisted, resumable state machine rather than a fire-and-forget upload. Every stage is written to the database under a heartbeat lease, and a recovery loop re-dispatches attempts that go stale after a crash or a cold start. Parsing preserves provenance throughout — page numbers for PDFs, timestamps for transcripts — because that provenance is what a citation later resolves to.

Index promotion is the part worth reading twice: it runs as **one Serializable transaction** that builds the new index, inserts the vectors, verifies both row count and vector dimensions, supersedes the previous index, and only then marks it active. The active pointer is never set before verification, so a half-built index can never serve a query.

**YouTube acquisition** tries the configured authenticated relay fast path once, then falls back to Gemini-native acquisition (`gemini-3.6-flash`) on any unavailable, empty, malformed, or blocked result. That is a fallback with two chances, not a guarantee that every URL is ingestible — a video without usable captions fails honestly. Websites are extracted statically behind a readable-content guard, so a JavaScript-only page is rejected rather than half-ingested.

---

## Career Intelligence

Career Intelligence is a deterministic analysis engine with a narrow, well-fenced AI boundary — not a radar chart with an LLM behind it.

**1 · Extraction.** A résumé (PDF or image, with an image fallback path for scanned documents) is parsed into a structured profile using OpenAI strict-mode JSON-schema output. Each extracted skill carries the evidence backing it, classified as `MENTIONED`, `APPLIED`, or `SHIPPED`.

**2 · Normalization.** Skills are normalized against a taxonomy so "React.js", "ReactJS", and "React" collapse into one competency with one evidence level.

**3 · Role matching.** A 12-role catalog is scored deterministically — highest fit first, ties broken by shipped-evidence depth, with a cap on how many roles may come from one family so you don't get five flavours of the same stack. Four to five target roles are returned, each with a fit score and a confidence-floor flag.

**4 · Gap analysis.** Fully deterministic and rule-keyed. Each gap carries a category (`technical-gap`, `project-proof`, `interview-prep`), a severity (`LOW` / `MEDIUM` / `HIGH`) derived from requirement weight against the shortfall between required and observed evidence, and the evidence that produced it. **No model assigns your fit score or your severity.**

**5 · Learning path.** Up to six selected gaps become a staged plan (`now` / `next` / `later`, capped at eight steps): why it matters → priority → required competency → closure steps → an evidence task → resources, plus a readiness report. Priority is a deterministic score of severity rank × requirement weight × evidence shortfall. Exactly **one** AI call participates, and it emits prose only against a strict schema; any missing or mismatched field falls back to deterministic text and the plan still succeeds. The builder accepts only structured gap and role data — never résumé free text — so it structurally cannot re-analyze the résumé.

A plan can spawn an **empty** linked Workspace, contract-tested to import nothing from the ingestion modules: a recommendation can never silently become Workspace evidence.

---

## Resource Discovery

```text
Intent → curated catalog + optional Tavily discovery → normalization
       → canonical-URL dedupe → ranking with provider diversity → recommendations
```

The curated catalog holds 69 real resources across four platforms (`YouTube`, `Udemy`, `Cohort`, `Website`) and seven resource types, attributed to real creators and organizations including ChaiCode. Tavily discovery is optional, cache-bounded, and **fails closed to curated content** when unavailable.

Two honesty rules are enforced in the resolver: URLs are canonicalized before deduplication, so the same course arriving from two paths collapses into one card; and search metadata can never establish a price, so a resource whose access type cannot be determined is labelled `unknown`, never "free".

---

## Usage, Plans & Payments

Two independent concepts, deliberately not conflated:

- **Usage limits** are per user, per action, in a **rolling 12-hour window**. Not a calendar-day reset, and not affected by when you paid.
- **Paid access** is a **one-time 30-day window**. Not a subscription. Nothing auto-renews and there is nothing to cancel.

### Limits

Every value below is read from `PLAN_LIMITS` in `src/lib/usage/config.ts`. The pricing presentation layer is contract-tested to contain no hardcoded limit or price digits, so the UI structurally cannot drift from what the backend enforces.

| Metered action | FREE | CORE | MAX |
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

**Every capability is available on every plan.** Paid tiers raise how much you can do per window; they never gate a feature.

### The payment path

Razorpay **Orders** only — no Subscriptions, no UPI Autopay, no mandates, no proration. Amounts are integer paise, INR only.

- **Server-authoritative amounts.** Order creation accepts only a plan and an optional coupon code; the price is resolved server-side, never read from the request body, and a contract test enforces that.
- **Signature verification is necessary but not sufficient.** After checking the signature, the payment is **re-read authoritatively from Razorpay** before anything is granted. Access is never granted on a signature alone.
- **Capture and entitlement are idempotent.** Checkout verification and the webhook share one capture routine, so a double grant is impossible whichever wins the race; webhooks are deduplicated by event id, and plan state is re-derived from captured payments rather than applied as a delta, serialized against usage checks.
- **Access is one-time and stacking.** Renewing early extends from your existing expiry rather than discarding remaining days, and buying MAX while CORE is active preserves the higher tier. Expiry is re-derived on request, since nothing external fires when a one-time window simply ends.
- **`PAYMENTS_ENABLED=false` is a complete kill switch** — every payment route and the webhook return 503, no redeploy needed.

---

## Engineering Guarantees

These are enforced by tests and are not relaxed to make a feature or a response succeed.

1. **Workspace isolation.** Handlers operate only on a pre-verified Workspace, and retrieval independently re-verifies ownership, throwing on any cross-Workspace row.
2. **Retrieval reads only trusted vectors** — active index, `READY` status, matching source version, exact embedding-contract match. Changing the embedding model, version, or dimensions invalidates every existing index, and retrieval throws rather than silently mixing incompatible vectors.
3. **Atomic index promotion.** One Serializable transaction; the active pointer is never set before count and dimension verification.
4. **Reserve → commit *or* discard.** Every metered path settles its reservation on every exit, including error and cleanup paths. Payment routes are never metered.
5. **Citation validation is defence in depth** across retrieval, construction, and persistence. Fix derivation; never relax a validator, and never fabricate a page or a timestamp.
6. **GENERAL answers cannot emit citation markers**, and a grounded answer's markers are validated against the retrieved set as they stream — both enforced at the stream level.
7. **Durable success wins, and entitlement is single-writer.** Once an assistant message is persisted, a later failure still returns the persisted message rather than an error; on the payments side, plan state has exactly one writer and is idempotent under retries and duplicate webhooks.

---

## Tech Stack

Versions below are the ranges declared in `package.json`.

| Layer | Technology |
|---|---|
| Frontend | React `^19.0.1`, Vite `^6.2.3`, TypeScript `~5.8.2`, React Router `^7.18.1` |
| Styling & motion | Tailwind CSS `^4.1.14`; Framer Motion `^12`, GSAP `^3.15`, Lenis `^1.3`, Three.js `^0.185` (landing page only) |
| API | Express `^4.21.2` |
| Database & ORM | Neon PostgreSQL with pgvector (fixed `vector(1536)`), Prisma `^6.4.0` |
| Authentication | Clerk — `@clerk/express` `^2.1.46`, `@clerk/clerk-react` `^5.61.3` |
| AI — chat | OpenAI `/v1/responses` via raw `fetch` (**no SDK**); `CHAT_MODEL` ∈ `gpt-5.6-sol` \| `gpt-5.6-terra` \| `gpt-5.6-luna`, default `gpt-5.6-sol` |
| AI — embeddings | OpenAI `text-embedding-3-small`, 1,536 dimensions |
| AI — YouTube | `@google/genai` `^2.16.0`, model `gemini-3.6-flash` |
| Search | Tavily (optional) |
| Parsing | `pdfjs-dist` 4.10.38, `cheerio` 1.0.0, `multer` 2.2.0 |
| Payments | Razorpay Orders via raw `fetch` + Basic auth |
| Validation | zod `^4.4.3` |
| Deployment | Vercel (SPA + transcript relay) → Render (Express) |
| Testing | Node's built-in test runner via `tsx --test` |

There is **no ESLint, Prettier, or Biome** in this repository, and no Vitest or Jest. `npm run lint` is an alias for `tsc --noEmit`.

---

## Local Development

### Prerequisites

`package.json` does not currently declare a minimum Node version. This documentation validation pass was completed successfully on **Node v24.15.0 / npm 11.12.1**.

| Requirement | Notes |
|---|---|
| Node.js + npm | Both `bun.lock` and `package-lock.json` are committed, but the scripts assume npm |
| PostgreSQL with pgvector | Neon is what this project targets; the `vector` extension is mandatory |
| Clerk application | Publishable + secret key |
| OpenAI + Gemini API keys | Chat and embeddings; Gemini covers the YouTube transcript fallback |
| Tavily API key | *Optional* — enables web-search tool rounds and resource discovery |
| Razorpay keys | *Optional* — payments stay off unless `PAYMENTS_ENABLED=true` |

### 1 · Clone and install

```bash
git clone https://github.com/learnerakshay/Lumora.git lumora && cd lumora && npm install
```

### 2 · Configure environment

```bash
cp .env.example .env
```

Every variable is zod-validated at boot, and [`.env.example`](.env.example) is annotated in full. The groups are: **database** (`DATABASE_URL`, `DIRECT_URL`), **authentication** (`CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`), **AI providers** (`OPENAI_API_KEY`, `GEMINI_API_KEY`, plus chat and embedding tuning), **YouTube transcript relay**, optional **Tavily search**, optional **Razorpay payments** (behind the `PAYMENTS_ENABLED` kill switch), and **runtime** settings.

```env
DATABASE_URL="postgresql://user:your_value_here@ep-host-pooler.region.aws.neon.tech/lumora?sslmode=require"
DIRECT_URL="postgresql://user:your_value_here@ep-host.region.aws.neon.tech/lumora?sslmode=require"
```

**The database split matters.** `DATABASE_URL` must use Neon's pooled (`-pooler`) endpoint — every request path shares that pool, and pointing it at the direct endpoint adds connection-setup latency to every cold Neon resume and risks exhausting the direct connection limit. `DIRECT_URL` stays non-pooled because migrations need a session-level connection.

> **Treat the four embedding variables as migrations.** Changing the embedding provider, model, dimensions, or version invalidates every existing index — retrieval requires an exact contract match and throws rather than degrading to mismatched vectors.

> Never put a secret in a `VITE_`-prefixed variable; those are bundled into the client.

### 3 · Prisma

Validate and generate, then apply the committed migration history to your **local development database**:

```bash
npm run prisma:validate && npm run prisma:generate && npx prisma migrate deploy
```

> ### ⚠️ Production migration note
>
> The Neon production database has known **pgvector extension drift** relative to Prisma's migration history. `prisma migrate dev` detects that drift and offers `prisma migrate reset` as the fix — which would drop and recreate the entire schema. Do **not** run `prisma migrate dev` or `prisma migrate reset` against production. Existing migrations deploy normally; see [`CLAUDE.md`](CLAUDE.md) for the repository's safe procedure when authoring a new production migration.

### 4 · Run

```bash
npm run dev
```

This starts Express **and** Vite middleware in a **single process on port 3000** — there is no separate frontend dev server and no second port. Open <http://localhost:3000>.

For production, `npm run build && npm start` generates the Prisma client, builds the SPA, bundles the server with esbuild, and runs that bundle.

---

## Testing & Validation

Tests use **Node's built-in test runner** through `tsx --test`, colocated beside the unit they cover.

```bash
npm run typecheck && npm test && npm run build
```

### Results at documentation time

All three were executed against this repository while writing this document:

| Check | Result |
|---|---|
| `npm run typecheck` | **Clean** (exit 0, no diagnostics) |
| `npm test` | **776 tests · 759 passing · 0 failing · 17 skipped**, across all 12 suites in one chain |
| `npm run build` | **Passing** (Vite build + esbuild server bundle) |

The 17 skipped tests are database-gated, not broken — they require a live database connection and an explicit opt-in flag.

> **Known flake, stated plainly.** The ingestion coordinator's heartbeat-lease test uses real timers and can fail under system load. It failed once during this documentation pass and passed cleanly on the immediate re-run with no code change. Because `npm test` chains its suites with `&&`, an early failure **skips every later suite** — check which suites actually ran before reading a red result as a regression.

### Suites

```bash
npm run test:ingestion      # 90    npm run test:retrieval     # 12
npm run test:chat           # 111   npm run test:ai            # 33
npm run test:usage          # 28    npm run test:resources     # 63
npm run test:skills         # 136   npm run test:learning      # 57
npm run test:payments       # 156   npm run test:payments-ui   # 71
npm run test:ui-components  # 13    npm run test:app-shell     # 6
```

Component and route behavioral contracts — "this handler never touches that state", "this router never imports that module" — are covered by source-level contract tests alongside the unit suites; the repository does not use React Testing Library or jsdom. One caveat worth stating: `tsconfig.json` does not enable `strict`, so a clean typecheck is a weaker guarantee than it looks.

---

## Project Structure

```text
lumora/
├── server.ts                  # Express entry — Clerk → webhook(raw) → json → routers → health → API 404 → Vite/static
├── api/
│   └── youtube-transcript.ts  # The one Vercel serverless function (protected transcript relay)
├── prisma/
│   ├── schema.prisma          # 18 models · 16 enums · pgvector
│   └── migrations/            # 14 migrations
├── src/
│   ├── App.tsx                # Router + Auth/Access/Usage providers; 18 lazy routes
│   ├── routes/                # Express routers (server-side, despite living under src/)
│   ├── lib/                   # ALL backend logic + shared client helpers
│   │   ├── chat/              # Grounding router, conversation store & lifecycle
│   │   ├── retrieval/         # pgvector search + citation construction
│   │   ├── ingestion/         # Coordinator, parsers, chunker, embedder, YouTube
│   │   ├── ai/                # Orchestrator, tool registry, action catalog
│   │   ├── skills/  learning/ # Extraction, role matching, gaps → staged plans
│   │   ├── resources/         # Curated catalog, discovery, ranking
│   │   ├── payments/  usage/  # Razorpay + entitlement; reserve/commit/discard
│   │   └── env.ts             # zod-validated environment
│   ├── pages/                 # 19 page components
│   └── components/            # landing · workspace · skills · learning · pricing · payments · billing · usage
├── scripts/                   # Razorpay + coupon admin tooling
├── docs/                      # screenshots/ · ARCHITECTURE · PRD · VALIDATION · PITCH
├── CLAUDE.md                  # Engineering guide — invariants, phase status, known issues
└── vercel.json
```

---

## Deployment

| Concern | Provider |
|---|---|
| SPA assets + protected transcript relay | Vercel |
| Express API | Render |
| PostgreSQL + pgvector | Neon |
| Authentication | Clerk |
| Payments | Razorpay |

Vercel rewrites `/api/:path*` to the Render origin and everything else to the SPA. The single serverless function is the protected YouTube transcript relay.

**Local and production routing are not identical.** In development everything runs in one Express + Vite process, so route shadowing and rewrite behavior differ from the deployed split — verify any API path change against the deployed setup, not just locally. Relatedly, the Razorpay webhook points at the **Render origin directly** rather than the Vercel domain, because the extra rewrite hop risks re-encoding the exact bytes the signature covers.

---

## Status

Lumora is actively developed and deployed for live testing. It is not a launched commercial product.

| Area | State |
|---|---|
| Grounded chat, retrieval, citations | Implemented, test-covered, exercised against real data |
| Multi-source ingestion (PDF / website / text / YouTube / VTT) | Implemented and test-covered. YouTube timestamp-derivation and grounding-fallback defects are fixed with regression coverage; production log confirmation of those fixes is still outstanding |
| Career Intelligence (extraction → roles → gaps) | Implemented and frozen |
| Learning Paths | Implemented and frozen. The full authenticated résumé → plan → Workspace flow has unit and contract coverage but has not been run end to end against live auth |
| Resource Discovery · Usage metering & quotas | Implemented and test-covered |
| Payments | Money path verified end to end in Razorpay Test Mode; Live Mode is active with a real payment confirmed. Coupon-exhaustion and decline/retry matrices remain outstanding before payments are closed |
| Mobile & accessibility | Hardened across payment and landing surfaces; no automated device matrix |

Passing tests are evidence about logic, not about production. Most of the failure modes that matter here — provider output shape, pgvector state, Clerk sessions, cold starts — only appear against real data, and this document tries to say which is which.

### Documentation map

| Document | Contents |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Engineering guide — architecture, protected invariants, phase status, known issues |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architecture deep dive |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements |
| [`docs/VALIDATION.md`](docs/VALIDATION.md) | Validation evidence |
| [`docs/PITCH.md`](docs/PITCH.md) | Pitch data pack |
| [`docs/screenshots/README.md`](docs/screenshots/README.md) | Screenshot capture runbook |

### License

No `LICENSE` file is currently included. Unless a license is added, standard copyright applies and no open-source reuse rights are granted.

The curated learning catalog references real creators and platforms, including ChaiCode, Udemy, and YouTube channels. All trademarks and course content belong to their respective owners; Lumora links to them and hosts nothing.

---

<div align="center">

**Answers are easy. Trust is the product.**

Lumora turns your sources into evidence you can verify, your résumé into a role-fit picture you can defend, and the gap between them into a next step you can actually take.

</div>
