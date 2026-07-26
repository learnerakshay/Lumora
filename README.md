# Lumora — AI Knowledge Operating System

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=0B0F17)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Production-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![pgvector](https://img.shields.io/badge/Vector_Search-pgvector-336791)](https://github.com/pgvector/pgvector)
[![License](https://img.shields.io/badge/License-All_Rights_Reserved-6B7280)](#license)

</div>

## Project Introduction

**Lumora** is a production-oriented AI research and learning Workspace that turns fragmented documents, webpages, transcripts, and notes into a private, queryable knowledge system. Users can create isolated Workspaces, ingest multiple source formats, and receive streaming AI answers grounded in validated vector retrieval with source-level citations.

<img src="assets/screenshots/01-landing-page-animation.png" alt="Lumora landing page with animated knowledge system visualization" width="100%" />

Lumora is built as a full-stack TypeScript SaaS: React and Vite power the client, Express serves authenticated APIs and production assets, Clerk establishes user identity, and Prisma persists Workspace data in Neon PostgreSQL with `pgvector`.

> [!IMPORTANT]
> Lumora does not silently fall back to mock data, in-memory persistence, fabricated source content, or deterministic substitute embeddings. Infrastructure and provider failures remain explicit.

<details>
<summary><strong>Table of contents</strong></summary>

- [Vision](#vision)
- [Mission](#mission)
- [Why Lumora exists](#why-lumora-exists)
- [Why Lumora?](#why-lumora)
- [Problems it solves](#problems-it-solves)
- [Target users](#target-users)
- [Demo Placeholders](#demo-placeholders)
- [Tech Stack](#tech-stack)
- [Core Features](#core-features)
- [AI Features](#ai-features)
- [RAG Architecture](#rag-architecture)
- [AI Actions](#ai-actions)
- [Workspace Architecture](#workspace-architecture)
- [Dashboard Overview](#dashboard-overview)
- [Landing Page Experience](#landing-page-experience)
- [Authentication](#authentication)
- [AI Workspace / Chat Experience](#ai-workspace--chat-experience)
- [UI & UX](#ui--ux)
- [Folder Structure](#folder-structure)
- [System Architecture](#system-architecture)
- [Indexing Pipeline](#indexing-pipeline)
- [Query Pipeline](#query-pipeline)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Security](#security)
- [Performance Optimizations](#performance-optimizations)
- [Future Roadmap](#future-roadmap)
- [Contribution Guide](#contribution-guide)
- [License](#license)
- [Author](#author)

</details>

## Vision

Create a knowledge operating system where research is not merely stored—it is parsed, understood, connected, and made immediately useful through grounded AI.

## Mission

Help researchers, engineers, students, founders, and knowledge-intensive teams transform trusted source material into explainable answers and reusable insights without sacrificing provenance, Workspace isolation, or data integrity.

## Why Lumora exists

Research rarely lives in one format. Critical context is distributed across papers, technical documentation, webpages, transcripts, captions, and personal notes. Traditional tools preserve files but do not reliably synthesize them; generic AI chat interfaces generate fluent answers but often lack durable source context and verifiable evidence.

Lumora closes that gap with a deterministic ingestion lifecycle, durable artifacts, versioned vector indexes, retrieval validation, and citation-aware response generation.

## Why Lumora?

| Traditional notes | Generic AI chat | Lumora |
|---|---|---|
| Stores content for manual recall | Answers from broad model knowledge | Builds a private, source-grounded knowledge Workspace |
| Search is usually lexical | Context is often temporary | Sources are parsed, chunked, embedded, versioned, and persisted |
| Limited synthesis across formats | Provenance may be unclear | Responses cite validated chunks from active indexes |
| Organization-first workflow | Conversation-first workflow | Research workflow spanning ingestion, retrieval, actions, and conversation |
| Minimal processing visibility | Provider behavior can be opaque | Explicit lifecycle, readiness, failure, and processing states |

## Problems it solves

- **Fragmented research:** consolidates five source formats inside one isolated Workspace.
- **Unverifiable AI output:** grounds generated answers in retrieved evidence and persisted citations.
- **Lost source context:** preserves original artifacts, clean content, parser metadata, checksums, and versions.
- **Cross-Workspace leakage risk:** scopes protected reads, mutations, retrieval, chat, and deletion by authenticated ownership.
- **Unreliable indexing:** validates embedding contracts and promotes indexes only after complete transactional persistence.
- **Repetitive knowledge work:** exposes structured actions for summarization, explanation, comparison, notes, and takeaways.
- **Conversation discontinuity:** persists user queries, assistant responses, citations, modes, and turn relationships.

## Target users

| Audience | Typical use |
|---|---|
| Researchers | Analyze papers, references, transcripts, and web research with citations |
| Engineers | Query specifications, architecture documents, release notes, and technical sources |
| Students | Build study Workspaces and convert source material into explanations and notes |
| Startup teams | Centralize product research, market references, and internal knowledge |
| Consultants & freelancers | Create isolated client Workspaces and produce evidence-backed insights |
| Knowledge workers | Search and synthesize mixed-format information without losing provenance |

## Demo Placeholders

| Resource | Status |
|---|---|
| Live application | _Deployment link placeholder_ |
| Product walkthrough | _Demo video placeholder_ |
| Architecture deep dive | _Technical article placeholder_ |

> Replace these placeholders when public deployment and walkthrough links are available.

## Tech Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, React Router, Vite, TypeScript | SPA routing, protected views, Workspace state, chat, and source management |
| Styling | Tailwind CSS 4, `tailwind-merge`, `clsx`, Lucide | Responsive design system, component styling, and icons |
| Backend | Node.js, Express, TypeScript, `tsx` | Authenticated APIs, ingestion coordination, SSE chat, and production serving |
| Database | Neon PostgreSQL, Prisma ORM | Durable Workspace, source, processing, message, and citation persistence |
| Vector search | `pgvector` | Version-compatible vector storage and cosine similarity retrieval |
| Authentication | Clerk React + Clerk Express | Client sessions and server-derived authenticated identity |
| AI | OpenAI embeddings and Responses API | Embedding generation and grounded response generation |
| AI tools | Tavily (optional), modular tool registry | External web intelligence with structured attribution |
| Parsing | PDF.js, Cheerio, YouTube Transcript, WebVTT parser | Server-side extraction for supported source formats |
| Deployment | Vite client bundle + esbuild Express bundle | Static frontend and Node production server output |
| Animations | Motion, Framer Motion, GSAP, Three.js, Lenis | Landing-page visuals and restrained product micro-interactions |
| Tooling | Prisma CLI, Node test runner, TypeScript, esbuild | Schema generation, migrations, testing, validation, and builds |

## Core Features

Only functionality implemented in the repository is marked as available.

| Feature | Status | Implementation |
|---|:---:|---|
| AI Research Workspace & management | ✅ | Create, rename, list, open, and delete owner-scoped Workspaces |
| Multiple source support | ✅ | PDF, Website, Plain Text, YouTube, and VTT sources |
| PDF processing | ✅ | Server-side MIME/signature validation, text extraction, page metadata, and encrypted-file rejection |
| Website processing | ✅ | HTTPS-only safe fetch, redirect validation, size limits, HTML extraction, and metadata |
| Plain Text processing | ✅ | Full-content preservation, validation, cleaning, and durable reprocessing input |
| YouTube processing | ✅ | Transcript ingestion with preserved timing and language metadata |
| VTT processing | ✅ | Caption parsing with timestamps, speakers, original content, and cue validation |
| Versioned ingestion lifecycle | ✅ | Explicit processing stages, attempts, events, failure states, checksums, and parser versions |
| RAG & context-aware retrieval | ✅ | Query embedding, similarity ranking, deduplication, context budgeting, and insufficient-context handling |
| Source and Workspace isolation | ✅ | Authenticated ownership checks across APIs, nested resources, and retrieval |
| AI chat & streaming responses | ✅ | SSE token delivery, cancellation, completion validation, and provider error propagation |
| Grounded citations | ✅ | Persisted source, chunk, page, URL, timestamp, and text-origin provenance |
| Hybrid web intelligence | ✅ | Optional Tavily search through the tool registry with external source attribution |
| Summarize | ✅ | Summaries for selected sources, conversations, or complete Workspaces |
| Explain | ✅ | Beginner or detailed explanations using selected text or source-scoped evidence |
| Compare | ✅ | Independent retrieval and validation for two selected sources |
| Generate Notes & Key Takeaways | ✅ | Structured Markdown notes, insights, action items, conclusions, and recommendations |
| Conversation persistence & controls | ✅ | Durable turns, regeneration, copy actions, paired deletion, and history restoration |
| Clerk authentication | ✅ | Protected routes plus server-side Clerk identity as the authentication source of truth |
| Production UI states | ✅ | Responsive layouts, skeletons, processing badges, empty states, disabled states, and explicit errors |

## AI Features

Lumora coordinates retrieval, AI Actions, optional tools, response generation, and attribution through a lightweight orchestration layer.

- **Grounded Workspace chat** uses only validated chunks from active, ready source indexes.
- **Hybrid intelligence** supports Workspace-only, web-only, or combined Workspace + web responses.
- **Shared embedding contract** prevents document/query provider, model, version, and dimension drift.
- **Citation-safe streaming** validates source markers and external links before presenting them.
- **Conversation context** replays bounded, complete, successfully persisted turns.
- **Tool execution** includes registration, argument validation, timeouts, structured failures, and development logging.

## RAG Architecture

Lumora separates source processing from query-time retrieval. Original artifacts remain durable, while only validated active index versions participate in search.

```mermaid
flowchart LR
    A["Supported source"] --> B["Durable source artifact"]
    B --> C["Server-side parser"]
    C --> D["Clean, versioned content"]
    D --> E["Semantic chunks"]
    E --> F["OpenAI embeddings"]
    F --> G["Transactional pgvector index"]
    G --> H["Active READY index"]
    Q["User query"] --> I["Compatible query embedding"]
    I --> J["Workspace-scoped similarity retrieval"]
    H --> J
    J --> K["Ranked and deduplicated context"]
    K --> L["AI orchestrator"]
    L --> M["Streaming grounded response"]
    M --> N["Persisted message and citations"]
```

### Retrieval invariants

- Only active `READY` indexes are eligible.
- Query and document embeddings must share provider, model, version, and dimensions.
- Deleted, inactive, stale, corrupt, or cross-Workspace chunks are rejected.
- Context respects a bounded token budget and never truncates a chunk mid-passage.
- Missing or weak evidence produces an explicit insufficient-context response.

## AI Actions

| Action | Supported context | Behavior |
|---|---|---|
| Summarize | Conversation, selected source, Workspace | Produces a structured summary scoped to the chosen material |
| Explain | Selected text or selected source | Generates beginner or detailed explanations with retrieved evidence where required |
| Compare | Two completed sources | Retrieves each source independently and refuses comparison when either side lacks usable context |
| Generate Notes | Conversation, selected source, Workspace | Produces organized Markdown headings, concepts, key ideas, and conclusions |
| Key Takeaways | Conversation, selected source, Workspace | Extracts concise insights, action items, conclusions, and recommendations |

Actions register through the shared action registry, validate their own inputs, produce an execution plan, and flow through the existing orchestrator without embedding action logic in presentation components.

## Workspace Architecture

Each Workspace is an ownership boundary and the parent for sources, indexes, chunks, messages, and citations.

```mermaid
flowchart TD
    U["Authenticated Clerk user"] --> W["Owned Workspace"]
    W --> S["Sources"]
    S --> SC["Versioned source content"]
    S --> SA["Processing attempts and events"]
    S --> SI["Source indexes"]
    SI --> CH["Chunks + pgvector embeddings"]
    W --> MSG["Conversation messages"]
    MSG --> CIT["Persisted citations"]
    CIT --> CH
```

The server derives identity from Clerk middleware. Workspace middleware resolves the owned Workspace once, and downstream operations use that verified identifier rather than trusting client-provided ownership.

## Dashboard Overview

The dashboard is the control plane for owned Workspaces. It supports creation, navigation, rename, deletion, loading states, empty states, and responsive presentation without exposing another user's records.

<img src="assets/screenshots/04-dashboardUI.png" alt="Lumora Workspaces dashboard" width="100%" />

## Landing Page Experience

The public experience introduces Lumora through a premium, motion-led knowledge-system narrative. Heavy Three.js/WebGL visuals are isolated to the landing page, while product screens use lightweight micro-interactions.

<img src="assets/screenshots/02-landingpage-continuouscard.png" alt="Lumora landing page continuous feature cards" width="100%" />

Highlights include:

- animated knowledge-core visualization and connected source cards;
- responsive navigation and authenticated Workspace entry points;
- system workflow, capabilities, security, and roadmap sections;
- reduced-motion-aware interaction design;
- production tab branding and Lumora favicon.

## Authentication

Clerk is the sole identity provider. The React client uses Clerk session state, while protected Express APIs derive the user from Clerk server authentication—never from custom identity headers or user IDs supplied by the browser.

<img src="assets/screenshots/03-authentication-page.png" alt="Lumora Clerk authentication experience" width="100%" />

- `/sign-in` and `/sign-up` are public-only routes.
- `/workspaces` and `/workspaces/:workspaceId` require authentication.
- Protected APIs return explicit `401` or authorization-aware errors.
- Workspace reads and mutations are owner-scoped.

## AI Workspace / Chat Experience

The active Workspace combines source management, processing visibility, AI Actions, grounded chat, streaming output, Markdown rendering, citations, and durable conversation controls.

<img src="assets/screenshots/05-workspaceUI.png" alt="Lumora AI Workspace with sources and grounded chat" width="100%" />

The composer remains unavailable until at least one source reaches the completed indexing state. Streaming responses are persisted only after successful completion, and message history is reconciled without overwriting newer local turns.

## UI & UX

- Responsive desktop, tablet, and mobile layouts.
- Source-specific icons and restrained color accents.
- Clear pending, processing, completed, and failed states.
- Skeleton loading and actionable empty states.
- Auto-growing chat composer with Enter/Shift+Enter behavior.
- Markdown headings, tables, lists, blockquotes, links, and code blocks.
- Code and message copy feedback.
- Keyboard focus states, ARIA labels, and accessible controls.
- Minimal product animations; richer visuals remain isolated to the landing page.

## User Workflow

```mermaid
flowchart LR
    A["Sign in with Clerk"] --> B["Create or open Workspace"]
    B --> C["Add PDF, Website, Text, YouTube, or VTT"]
    C --> D["Observe processing lifecycle"]
    D --> E{"Index READY?"}
    E -- "No" --> D
    E -- "Yes" --> F["Ask a question or run AI Action"]
    F --> G["Review streaming grounded answer"]
    G --> H["Open citations or continue conversation"]
    H --> F
```

## Folder Structure

| Path | Responsibility |
|---|---|
| `assets/screenshots/` | Product screenshots used by project documentation |
| `public/` | Static production assets, including Lumora branding |
| `prisma/schema.prisma` | Canonical relational and vector data model |
| `prisma/migrations/` | Ordered baseline and production schema migrations |
| `src/pages/` | Route-level landing, authentication, dashboard, and Workspace views |
| `src/components/landing/` | Public landing sections, motion, atmosphere, and Three.js canvases |
| `src/components/dashboard/` | Workspace dashboard layout and CRUD dialogs |
| `src/components/workspace/` | Source sidebar, upload modal, chat, citations, composer, and AI Actions UI |
| `src/lib/ingestion/` | Validation, safe fetching, parsing, cleaning, chunking, embeddings, and indexing pipeline |
| `src/lib/retrieval/` | Workspace-scoped pgvector retrieval, ranking, context assembly, and citation creation |
| `src/lib/chat/` | Provider integration, history construction, persistence, citation safety, and lifecycle utilities |
| `src/lib/ai/` | Orchestrator, tool registry/executor, Tavily integration, attribution, and action framework |
| `src/routes/` | Authenticated Express Workspace, source, message, and streaming chat endpoints |
| `src/lib/env.ts` | Typed environment validation and production startup requirements |
| `server.ts` | Express bootstrap, Clerk middleware, readiness endpoint, Vite middleware, and production serving |

## System Architecture

```mermaid
flowchart TB
    Browser["React + Vite client"]
    Clerk["Clerk authentication"]
    API["Express Workspace API"]
    Ingestion["Ingestion pipeline"]
    Retrieval["RAG retrieval"]
    Orchestrator["AI orchestrator"]
    Tools["Tool registry / Tavily"]
    OpenAI["OpenAI APIs"]
    DB[("Neon PostgreSQL + pgvector")]

    Browser <-->|"Session"| Clerk
    Browser -->|"Protected API + SSE"| API
    API -->|"Verify identity"| Clerk
    API --> Ingestion
    API --> Retrieval
    API --> Orchestrator
    Ingestion --> OpenAI
    Ingestion <--> DB
    Retrieval --> OpenAI
    Retrieval <--> DB
    Orchestrator --> OpenAI
    Orchestrator --> Tools
    API <--> DB
```

### Runtime boundaries

| Boundary | Guarantee |
|---|---|
| Browser → API | Client input never establishes identity or ownership |
| API → Database | Workspace-scoped durable persistence; no production memory fallback |
| Ingestion → Index | Index promotion occurs only after complete vector validation and commit |
| Retrieval → Context | Only compatible chunks from active indexes are admitted |
| Generation → Persistence | Completed assistant responses and their citations are stored together |

## Indexing Pipeline

```mermaid
flowchart TD
    A["CREATED"] --> B["QUEUED"]
    B --> C["PROCESSING"]
    C --> D["PARSING"]
    D --> E["Persist raw + clean content and parser metadata"]
    E --> F["CHUNKING"]
    F --> G["READY_FOR_INDEXING"]
    G --> H["Generate and validate embeddings"]
    H --> I["Transactional chunk + vector persistence"]
    I --> J["Validate expected chunks and vectors"]
    J --> K["Atomically promote active index"]
    K --> L["COMPLETED"]
    C -. "failure" .-> X["FAILED"]
    D -. "failure" .-> X
    F -. "failure" .-> X
    H -. "failure" .-> X
    I -. "rollback" .-> X
```

The persisted source artifact—not a metadata preview—is the input for reprocessing. A failed replacement keeps the previous valid active index intact.

## Query Pipeline

```mermaid
flowchart TD
    A["Authenticated query"] --> B["Verify Workspace ownership"]
    B --> C["Validate active source readiness"]
    C --> D["Generate compatible query embedding"]
    D --> E["Search active READY indexes"]
    E --> F["Reject stale, corrupt, or incompatible candidates"]
    F --> G["Rank and remove duplicate passages"]
    G --> H{"Sufficient context?"}
    H -- "No" --> I["Return explicit insufficient-context response"]
    H -- "Yes" --> J["Assemble bounded attributed context"]
    J --> K["Orchestrate model and optional tools"]
    K --> L["Validate citations and external links"]
    L --> M["Stream response"]
    M --> N["Persist completed turn and citations"]
```

## Installation

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL-compatible Neon database
- `pgvector` support
- Clerk application
- OpenAI API credentials
- Tavily API credentials only when web intelligence is enabled

### 1. Clone

```bash
git clone https://github.com/learnerakshay/Lumora.git
cd Lumora
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Populate `.env` with real development credentials. Never commit secrets.

### 4. Initialize the database

```bash
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

### 5. Start development

```bash
npm run dev
```

The full-stack development server defaults to `http://localhost:3000`.

### 6. Production build

```bash
npm run build
npm run start
```

## Environment Variables

The following is a documentation-safe `.env.example`. Replace every credential placeholder before running the application.

```dotenv
# Runtime
NODE_ENV="development"
PORT="3000"

# Neon PostgreSQL
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST/DATABASE?sslmode=require"

# Clerk
VITE_CLERK_PUBLISHABLE_KEY="pk_test_REPLACE_ME"
CLERK_SECRET_KEY="sk_test_REPLACE_ME"

# OpenAI
OPENAI_API_KEY="sk-REPLACE_ME"
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIMENSIONS="1536"
EMBEDDING_VERSION="v1"
CHAT_MODEL="REPLACE_WITH_SUPPORTED_CHAT_MODEL"
CHAT_REASONING_EFFORT="medium"
CHAT_REQUEST_TIMEOUT_MS="60000"
CHAT_MAX_OUTPUT_TOKENS="2048"

# Optional Tavily web intelligence
TAVILY_API_KEY="tvly-REPLACE_ME"
TAVILY_MAX_RESULTS="5"
TAVILY_TIMEOUT_MS="10000"

# Optional/reserved storage configuration
BLOB_READ_WRITE_TOKEN=""
```

| Variable | Required | Notes |
|---|:---:|---|
| `DATABASE_URL` | Yes | Pooled PostgreSQL application connection |
| `DIRECT_URL` | Production | Direct database connection for production migration workflows |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk server secret; never exposed to the client |
| `OPENAI_API_KEY` | Production | Required for production embeddings and chat |
| `EMBEDDING_PROVIDER` | Yes | Currently validated as `openai` |
| `EMBEDDING_MODEL` | Yes | `text-embedding-3-small` or `text-embedding-3-large` |
| `EMBEDDING_DIMENSIONS` | Yes | Must be `1536` for the current pgvector schema |
| `EMBEDDING_VERSION` | Yes | Version label persisted with indexes |
| `CHAT_MODEL` | Yes | Must match one of the models accepted by `src/lib/env.ts` |
| `CHAT_REASONING_EFFORT` | Yes | `none`, `low`, `medium`, `high`, or `xhigh` |
| `CHAT_REQUEST_TIMEOUT_MS` | Yes | Provider timeout between 1,000 and 300,000 ms |
| `CHAT_MAX_OUTPUT_TOKENS` | Yes | Bounded between 128 and 16,384 |
| `TAVILY_API_KEY` | No | Enables external web intelligence |
| `BLOB_READ_WRITE_TOKEN` | No | Reserved; current source artifacts are persisted in PostgreSQL |

> [!CAUTION]
> Variables prefixed with `VITE_` are bundled for the browser. Never place a secret in a `VITE_` variable.

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run the Express + Vite development server |
| `npm run build` | Generate Prisma Client and build client/server production bundles |
| `npm run start` | Start the bundled production server |
| `npm run preview` | Preview the Vite client bundle |
| `npm run lint` | Run the TypeScript lint gate |
| `npm run typecheck` | Run TypeScript validation |
| `npm run test` | Run ingestion, retrieval, chat, and AI regression suites |
| `npm run test:ingestion` | Run parser, lifecycle, embedding, and index integrity tests |
| `npm run test:retrieval` | Run ranking, isolation, compatibility, and citation tests |
| `npm run test:chat` | Run conversation, streaming, provider, and citation-safety tests |
| `npm run test:ai` | Run actions, orchestrator, tools, Tavily, and attribution tests |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create/apply development migrations |
| `npm run prisma:studio` | Open Prisma Studio |

## Deployment

Lumora builds into:

- `dist/assets/*` and `dist/index.html` for the Vite client;
- `dist/server.cjs` for the bundled Express server.

Recommended production sequence:

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run start
```

Production infrastructure must provide:

1. a Node-compatible host for the Express server;
2. a Neon PostgreSQL database with all checked-in migrations applied;
3. Clerk production credentials;
4. OpenAI credentials and a compatible model configuration;
5. Tavily credentials only when external web search is desired.

The readiness endpoint at `/api/health` verifies database connectivity and `pgvector` availability instead of returning a synthetic healthy state.

## Security

- Clerk server authentication is the only accepted source of user identity.
- Every protected Workspace route verifies ownership.
- Nested source, message, deletion, chat, and retrieval operations use the verified Workspace ID.
- Remote ingestion requires HTTPS and rejects private/local network targets.
- Website downloads enforce timeouts, redirect checks, content types, and response-size limits.
- Uploads enforce MIME, extension, signature, and size validation.
- Database failures remain visible and do not switch to in-memory persistence.
- Citation persistence validates that chunks belong to the active source index.
- Secrets are parsed server-side and are never returned through APIs.
- Production startup validates critical configuration and vector readiness.

## Performance Optimizations

- Batched embedding generation with retry/backoff for transient provider failures.
- Transactional index persistence and atomic active-index replacement.
- pgvector similarity search over validated active indexes.
- Candidate over-fetching followed by deterministic ranking and deduplication.
- Token-budgeted context assembly using complete chunks.
- Bounded conversation history and provider output.
- SSE streaming for low-perceived-latency responses.
- Parallel independent retrieval for two-source Compare actions.
- Polling only while sources remain pending or processing.
- Vite/esbuild production bundling and GPU-accelerated landing animation.

## Future Roadmap

The following capabilities are planned and are **not implemented** in the current repository.

| Planned capability | Direction |
|---|---|
| Voice conversations | Speech input and spoken grounded responses |
| Image understanding | Multimodal source ingestion and visual question answering |
| OCR support | Text extraction from scanned and image-based documents |
| Knowledge graph visualization | Interactive entities, topics, and source relationships |
| Flashcards | Evidence-backed spaced-repetition cards |
| AI quiz generator | Configurable assessments from Workspace material |
| Study planner | Goal-aware learning schedules and progress tracking |
| Team collaboration | Member roles, comments, and coordinated research |
| Shared Workspaces | Controlled sharing and public/private access policies |
| Version history | Source, note, and generated-artifact history with restoration |
| Browser extension | One-click capture from supported webpages |
| Mobile application | Native mobile research and review experience |

## Contribution Guide

Lumora currently prioritizes controlled, production-safe changes.

1. Fork the repository and create a focused branch.
2. Preserve Workspace ownership, durable persistence, and retrieval invariants.
3. Keep changes within the existing React/Vite/Express architecture.
4. Add or update focused tests for behavior changes.
5. Run the complete quality gate:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

6. Submit a pull request describing the problem, implementation, verification, and any migration impact.

> Avoid mock production paths, fake source content, fabricated citations, deterministic embedding fallbacks, and silent error suppression.

## License

No open-source license file is currently included. Unless a license is added, the source code is **all rights reserved** and may not be copied, modified, or redistributed without permission from the author.

## Author

**Akshay Krishna**<br />
GitHub: [@learnerakshay](https://github.com/learnerakshay)

Built as a production-oriented demonstration of full-stack SaaS engineering, secure multi-Workspace architecture, durable AI ingestion, vector retrieval, orchestration, and polished product delivery.
