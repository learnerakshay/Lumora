# Lumora

Lumora is an AI learning and research workspace. This repository contains the foundation plus **Phase 2 notebook management**: a production-oriented domain schema, notebook CRUD API, and temporary notebook-management UI.

## Stack

Next.js App Router, React, TypeScript (strict), Tailwind CSS, Prisma/PostgreSQL, Zod, TanStack Query, React Hook Form, Framer Motion, GSAP, Lenis, Lucide, React Markdown, ESLint, and Prettier.

## Setup

1. Copy `.env.example` to `.env.local` and provide the services you intend to use. `DATABASE_URL` is needed only for database-backed operations; the health endpoint reports `not-configured` without it.
2. Install dependencies: `npm install`
3. Create the initial PostgreSQL migration after configuring `DATABASE_URL`: `npm run prisma:migrate -- --name init`
4. Generate Prisma Client: `npm run prisma:generate`
5. Start the app: `npm run dev`

Visit `http://localhost:3000` and `http://localhost:3000/api/health`.

## Commands

`npm run lint`, `npm run typecheck`, `npm run build`, `npm run format`, `npm run format:check`, `npm run prisma:format`, `npm run prisma:validate`, `npm run prisma:generate`, `npm run prisma:migrate`, and `npm run prisma:studio`.

## Phase 2 API

- `GET` / `POST` `/api/notebooks`
- `GET` / `PATCH` / `DELETE` `/api/notebooks/:notebookId`

All API errors use a structured `error.code` and safe message. Prisma access is limited to server-side repositories and services.

## Domain model

`Notebook` owns sources, source chunks, conversations/messages/citations, and roadmaps. Sources carry future ingestion metadata; no ingestion is implemented. Referential actions explicitly cascade owned records, while roadmap source links and citation chunk links use set-null where their parent records may remain meaningful.

## Architecture

`src/app` contains routes and app shell; `src/components` contains UI by feature (including `motion`); `src/providers` contains client providers; `src/lib/db`, `env`, `validation`, and `utils` contain reusable boundaries. Future server repositories/services/jobs, RAG, AI clients, Qdrant integrations, and parsers will remain server-only.

`src/components/notebooks` contains temporary client management flows; `src/lib/api` centralizes client fetches; `src/server/repositories` provides direct Prisma access; `src/server/services` owns notebook business behavior. Future OpenAI, Qdrant, RAG, parsing, and feature directories remain deferred.

## Deliberately deferred

Source ingestion, embeddings, Qdrant search, RAG responses, citation generation/UI, source viewers, study bites, learning-roadmap generation UI, authentication, and deployment remain intentionally deferred.
