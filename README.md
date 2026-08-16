# Lumora

**An AI learning and knowledge Workspace that turns sources into grounded conversations, evidence, and next-step resources.**

> Documentation snapshot — repository inspected 2026-08-16 at commit `07192bd`; product claims are grounded in current code and tests.

Lumora helps learners, builders, and researchers turn PDFs, websites, notes, videos, and transcripts into a searchable working memory. Its journey is deliberate: **Sources → Grounded/General AI → Evidence/Context → Resource Intelligence → Usage**.

## Product tour

| View | What it shows |
|---|---|
| ![Landing page](assets/screenshots/01-landing-page-animation.png) | Public product story and Workspace entry point |
| ![Authentication](assets/screenshots/03-authentication-page.png) | Clerk-based sign-in/sign-up experience |
| ![Workspaces dashboard](assets/screenshots/04-dashboardUI.png) | Authenticated Workspace dashboard |
| ![Lumora Workspace](assets/screenshots/05-workspaceUI.png) | Sources, chat, citations, Context, and AI Actions |

## Why Lumora is different

- **IMPLEMENTED — Evidence-gated grounding:** retrieval is Workspace-scoped, restricted to active compatible indexes, deduplicated, then checked for requested-topic coverage.
- **IMPLEMENTED — Durable provenance:** messages and citations persist together; Context can reveal a source passage, URL, page, or timestamp for a historical answer.
- **IMPLEMENTED — Resource intelligence:** learning-resource requests combine a curated catalog with optional Tavily discovery, canonical URL deduplication, and intent-aware ranking.
- **IMPLEMENTED — Cost-aware Usage:** chat, ingestion, and AI Actions use atomic reservations and 12-hour rolling limits.

## Technology and delivery

React 19, Vite, TypeScript, Tailwind CSS, Motion/Framer Motion, Express, Clerk, Prisma, Neon PostgreSQL with pgvector, OpenAI, Tavily, and Gemini-native YouTube acquisition. A configured protected transcript fast path can be tried first; unavailable/invalid fast-path results fall back to Gemini-native acquisition. Three.js/WebGL is confined to the landing page.

The Vite client and bundled Express server build to `dist`; Vercel provides the protected transcript relay and routes API traffic to Render. `/api/health` checks PostgreSQL and pgvector readiness.

## Current plan limits

**IMPLEMENTED:** limits are per user/action in a rolling 12-hour window. Customer pricing and checkout are **PLANNED**.

| Plan | Chat | Ingestion | AI Action |
|---|---:|---:|---:|
| Free | 10 | 4 | 8 |
| Core | 40 | 15 | 25 |
| Max | 150 | 50 | 80 |

## Local setup

Node.js 20+, pgvector-capable PostgreSQL/Neon, Clerk, and OpenAI credentials are required; Tavily is optional for web intelligence.

```powershell
npm install
Copy-Item .env.example .env
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run dev
```

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Populate `.env` from [.env.example](.env.example); never put secrets in `VITE_` variables.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Validation evidence](docs/VALIDATION.md)
- [Pitch and PPT data pack](docs/PITCH.md)

## Product status

**IMPLEMENTED:** responsive web UI, owner-isolated Workspaces, PDF/website/text/YouTube/VTT ingestion, versioned RAG, citations/Context, General/Grounded AI, AI modes/actions, resource intelligence, and Usage.

**PLANNED:** payments, feedback collection, Skill Intelligence, Learning Workspace, collaboration, OCR/image ingestion, voice, quizzes, flashcards, and a native mobile application. `SKILL_INTELLIGENCE` and `LEARNING_PATH` are reserved Usage enum values, not shipped features.
