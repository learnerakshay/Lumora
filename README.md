# Lumora

Lumora is an AI learning and research workspace. This repository currently contains **Phase 1 only**: a production-ready application foundation, not product workflows.

## Stack

Next.js App Router, React, TypeScript (strict), Tailwind CSS, Prisma/PostgreSQL, Zod, TanStack Query, React Hook Form, Framer Motion, GSAP, Lenis, Lucide, React Markdown, ESLint, and Prettier.

## Setup

1. Copy `.env.example` to `.env.local` and provide the services you intend to use. `DATABASE_URL` is needed only for database-backed operations; the health endpoint reports `not-configured` without it.
2. Install dependencies: `npm install`
3. Generate Prisma Client: `npm run prisma:generate`
4. Start the app: `npm run dev`

Visit `http://localhost:3000` and `http://localhost:3000/api/health`.

## Commands

`npm run lint`, `npm run typecheck`, `npm run build`, `npm run format`, `npm run format:check`, `npm run prisma:format`, `npm run prisma:validate`, `npm run prisma:generate`, `npm run prisma:migrate`, and `npm run prisma:studio`.

## Architecture

`src/app` contains routes and app shell; `src/components` contains UI by feature (including `motion`); `src/providers` contains client providers; `src/lib/db`, `env`, `validation`, and `utils` contain reusable boundaries. Future server repositories/services/jobs, RAG, AI clients, Qdrant integrations, and parsers will remain server-only.

The `components/notebooks`, `sources`, `chat`, `viewer`, `study`, `ui`; `lib/openai`, `qdrant`, `rag`, `parsers`; `server`; `styles`; and `types` directories are reserved for Phase 2 rather than padded with empty files today.

## Deliberately deferred

RAG, source ingestion, notebooks, chat, citations, source inspection, study bites, learning roadmaps, authentication, and deployment are not implemented in Phase 1.
