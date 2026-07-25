# Lumora — AI Knowledge Operating System

Lumora is an isolated Workspace for ingesting research sources and producing
grounded AI answers with persisted provenance.

## Architecture

- React 19, Vite, Tailwind CSS, and Motion on the client
- Express and TypeScript on the server
- Clerk session authentication
- Prisma with Neon PostgreSQL and pgvector
- Vercel Blob-compatible artifact persistence
- OpenAI embeddings and Responses API chat generation

The production path is database-backed. It does not fall back to an in-memory
store, placeholder content, deterministic embeddings, or substitute chat
answers when infrastructure fails.

## Required configuration

Copy `.env.example` to `.env` and provide valid database, Clerk, and OpenAI
credentials. Production startup also requires `DIRECT_URL`; startup fails if a
required value is absent or if pgvector/database readiness cannot be
established.

Embedding and chat model contracts are configured independently:

- `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `EMBEDDING_VERSION`
- `CHAT_MODEL`, `CHAT_REASONING_EFFORT`, `CHAT_REQUEST_TIMEOUT_MS`
- `CHAT_MAX_OUTPUT_TOKENS`

## Commands

- `npm run dev` — run the full-stack development server
- `npm run lint` — run the TypeScript lint gate
- `npm run typecheck` — run TypeScript validation
- `npm test` — run ingestion, vector, retrieval, and chat regression tests
- `npm run build` — generate Prisma Client and produce the production bundles
- `npm run start` — run the production server bundle
- `npm run prisma:validate` — validate the Prisma schema
- `npm run prisma:migrate` — create/apply development migrations

Deployments must apply every checked-in Prisma migration before starting the
new application version.
