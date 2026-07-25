# Lumora — AI Knowledge Operating System

Lumora is a production-grade AI Knowledge Operating System designed to illuminate and organize complex knowledge through workspace isolation, vector retrieval, and intelligent chat answers.

## Architecture & Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Motion
- **Backend**: Node.js, Express, TypeScript (`server.ts`)
- **Database & ORM**: Neon PostgreSQL with `pgvector`, Prisma ORM v6
- **Authentication**: Clerk (schema prepared, prompt integration pending)
- **AI & Integrations**: OpenAI, Tavily, Vercel Blob (schema prepared)

## Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure the following variables are set:

- `DATABASE_URL`: Connection string for Neon PostgreSQL database.
- `DIRECT_URL`: Direct database URL for migrations.
- `CLERK_SECRET_KEY`: Clerk authentication secret key.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable client key.
- `OPENAI_API_KEY`: OpenAI API key.
- `TAVILY_API_KEY`: Tavily Search API key.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage token.

## Available Scripts

- `npm run dev`: Start full-stack development server on port 3000.
- `npm run build`: Generate Prisma Client, build Vite frontend, and bundle Express server.
- `npm run start`: Run production server (`dist/server.cjs`).
- `npm run lint`: Run TypeScript typechecks.
- `npm run typecheck`: Run TypeScript compilation check.
- `npm run prisma:generate`: Generate Prisma Client from schema.
- `npm run prisma:validate`: Validate Prisma schema syntax.
- `npm run prisma:migrate`: Run Prisma migrations.
- `npm run prisma:studio`: Open Prisma Studio database viewer.

## Current Scope (Prompt 1)

Prompt 1 establishes the production-grade foundation for Lumora:
- Production rulebook (`AGENTS.md`)
- Typed environment system with Zod (`src/lib/env.ts`)
- Database models with Prisma (`Workspace`, `Source`, `SourceContent`, `Chunk`, `Message`, `Citation`) with `pgvector` 1536-dim field preparation
- Health Check API (`/api/health`) with database connectivity verification
- Aurora Observatory global design tokens
- Foundation temporary homepage

## Future Prompt Roadmap

- **Prompt 2**: Authentication & User Management (Clerk)
- **Prompt 3**: Lumora Landing Page & Three.js Canvas
- **Prompt 4**: Workspace Dashboard & CRUD
- **Prompt 5**: Knowledge Source Ingestion Infrastructure (PDF, Web, Text)
- **Prompt 6**: Chunking Engine & Vector Store Embeddings (`pgvector`)
- **Prompt 7**: Multimodal Sources (YouTube, VTT)
- **Prompt 8**: Intelligent RAG Retrieval & Hybrid Search
- **Prompt 9**: Real-time Chat & Answer Synthesizer
- **Prompt 10**: Interactive Citations & Source Highlights
- **Prompt 11**: Search Grounding & Tavily Integration
- **Prompt 12**: Polish, Security Hardening & Production Deployment
