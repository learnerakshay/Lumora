# AGENTS.md — Lumora Engineering Rulebook

## 1. Product Identity
- **Product Name**: Lumora — AI Knowledge Operating System
- **Terminology**: Always use the term **Workspace** (never project, room, folder, or tenant).

## 2. Approved Routes
- `/` — Homepage / Landing Page
- `/sign-in` — Clerk Sign In
- `/sign-up` — Clerk Sign Up
- `/workspaces` — Workspaces Dashboard
- `/workspaces/[workspaceId]` — Active Workspace View

## 3. Approved Tech Stack
- **Framework**: React / Vite / Express Full-Stack (App Router style structure)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion / Motion
- **Authentication**: Clerk
- **ORM & Database**: Prisma with Neon PostgreSQL (`pgvector` enabled)
- **AI & Tools**: OpenAI, Tavily
- **Storage**: Vercel Blob

## 4. Engineering Principles & Guardrails
- **Preserve Functionality**: Preserve all existing working functionality. Never rewrite unrelated code.
- **Inspect First**: Always inspect existing repository files before making modifications.
- **Verification**: Run lint, typecheck, and build verification after every prompt.
- **Honesty**: Never fake runtime success or mock build outputs.
- **Workspace Isolation**: Workspace isolation is strictly mandatory at database and API levels. All queries must be workspace-scoped.
- **Secrets Security**: Never expose secrets or server environment variables to client components or API outputs.
- **Visuals & Animations**:
  - Landing page is the ONLY place where Three.js / WebGL heavy canvases may be used.
  - Dashboard and workspace UI must only use subtle micro-interactions (Framer Motion).
- **No AI Slop / Fake UI**:
  - No fake loading states.
  - No non-functional / fake buttons.
  - No placeholder features.
- **Scope Discipline**: Do NOT implement features from future prompts early. Strictly adhere to the prompt scope.
