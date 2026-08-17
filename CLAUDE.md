# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Lumora is

An AI learning / knowledge Workspace. Users add sources (PDF, website, text, YouTube, VTT) to a Workspace; one chat experience answers either from **general** model knowledge or from **grounded** Workspace evidence with citations.

Core product rule:

> Retrieval finds candidate evidence. Lumora decides whether the evidence is *enough*.

A grounded answer is only produced when retrieved chunks actually cover the requested topics. Returning chunks is never by itself sufficient to call an answer grounded. Never weaken the grounding gate or the citation validators to make a response succeed.

Terminology: always **Workspace** — never project, folder, room, or tenant.

Status: actively developed, deployed for live testing (Vercel + Render). Not a launched commercial SaaS.

## Working rules

- **The repository is the source of truth.** Prompts, docs (`README.md`, `docs/*`, `AGENTS.md`), and prior session summaries may be stale or wrong. Verify against code before acting on them.
- **Inspect before modifying.** Read the surrounding modules first; preserve existing working behavior; do not rewrite unrelated code or do broad cleanup.
- **Verify honestly.** Run `npm run typecheck` and the relevant test suite after changes. Never claim runtime success you did not observe. Passing local tests is not evidence about production — most failure modes here (Gemini output shape, Neon/pgvector state, Clerk sessions, Render cold starts) only appear against real data, so say plainly what was and wasn't verified.
- **Scope discipline.** Do not implement future phases early.
- No fake loading states, non-functional buttons, or placeholder features.
- Three.js/WebGL is confined to the landing page. Dashboard and Workspace UI use subtle Framer Motion micro-interactions only.

## Commands

```bash
npm run dev          # tsx server.ts — Express + Vite middleware in ONE process on :3000
npm run typecheck    # tsc --noEmit
npm run build        # prisma generate && vite build && esbuild server.ts -> dist/server.cjs
npm start            # node dist/server.cjs (production)
```

Tests use the **Node built-in test runner** via `tsx --test` (no Vitest/Jest):

```bash
npm test                     # all 6 suites, chained with && (an early failure SKIPS the rest)
npm run test:ingestion       # also: test:retrieval, test:chat, test:ai, test:usage, test:resources
npx tsx --test src/lib/retrieval/rag-service.test.ts       # single file
npx tsx --test --test-name-pattern="citation" src/lib/**/*.test.ts   # single test by name
```

Prisma: `npm run prisma:generate | prisma:validate | prisma:migrate | prisma:studio`.

Notes:
- `npm run lint` is an alias for `tsc --noEmit`. There is **no ESLint/Prettier/Biome** in this repo.
- `tsconfig.json` does **not** enable `strict`. A clean typecheck is a weaker guarantee than it looks.
- 4 usage tests skip without a live `DATABASE_URL`. `coordinator.test.ts`'s heartbeat-lease test is timing-flaky — rerun before treating it as a real failure, and check which suites actually ran.

## Architecture

**Single unified TypeScript app — not a monorepo, and not split frontend/backend repos.**

- `server.ts` — Express entry. Clerk middleware → `/api/workspaces` + `/api/usage` routers → `/api/health` → `apiNotFoundHandler` (API requests must never fall through to the SPA) → Vite middleware (dev) or static `dist` (prod). Starts `ingestionCoordinator.startRecoveryLoop`.
- `src/routes/` — only two routers. `workspaces.ts` (~1600 lines) holds nearly the whole API, including the ~830-line SSE chat handler.
- `src/lib/` — **all backend logic**, in the same tree the React client imports from. The boundary is convention plus the `typeof window` guard in `src/lib/env.ts`, not the build. Never import a server module into a component.
- `src/pages/`, `src/components/` — React 19 SPA (`/`, `/sign-in`, `/sign-up`, `/workspaces`, `/workspaces/:id`, `/usage`, legal pages).
- `api/youtube-transcript.ts` — the one Vercel serverless function (protected transcript relay).

Deployment: Vercel serves the SPA + relay and rewrites `/api/:path*` to the Render Express service (`vercel.json`). Local dev runs both halves in one process, so route-shadowing and rewrite behavior differ between local and production — verify API path changes against the deployed setup.

Stack: React 19 · Vite 6 · Tailwind 4 · Express 4 · Prisma 6 / Neon Postgres + pgvector · Clerk (`@clerk/express` server, `@clerk/clerk-react` client) · OpenAI (raw `fetch` to `/v1/responses`, **no SDK**) · `@google/genai` for YouTube · Tavily (optional) · zod for env.

PDFs are stored as `Bytes` in `SourceContent.artifactData`. There is **no** Vercel Blob, despite `AGENTS.md` saying otherwise.

### Request flow that matters most

Chat (`POST /api/workspaces/:id/chat/stream`) is the system to understand first:

1. `requireApiAuth` → `workspaceRouter.param('id')` resolves + ownership-checks the Workspace into `res.locals.workspace`.
2. `selectInitialChatRoute` (`lib/chat/grounding-router.ts`) — no sources + meta question → deterministic reply; no sources otherwise → GENERAL without retrieval; else retrieve.
3. `checkAndReserve` (usage) → register in `activeChatGenerations` → persist USER message + a `SENDING` assistant placeholder.
4. `searchWorkspaceChunks` (`lib/retrieval/rag-service.ts`) — pgvector cosine, topK 5, threshold 0.15, shingle dedupe, plus one bounded recovery retrieval on a normalized topic query.
5. `assessWorkspaceEvidenceSufficiency` — deterministic **lexical** topic-coverage gate over retrieved text; then `selectResponseModeAfterRetrieval` picks GROUNDED or GENERAL.
6. `buildRAGContext` → `createCitation` per chunk (this is where transcript/page provenance is derived and where it can throw).
7. `orchestrateGroundedResponse` (`lib/ai/orchestrator.ts`) — up to 4 tool rounds, optional Tavily.
8. `replaceWorkspaceAssistantMessage` persists answer + citations (second citation validation layer) → `commitUsage`.

SSE event contract: `user_persisted` → `start` → `chunk`* → (`web_sources` | `tool_status`)* → `done` | `error`.

### Ingestion flow

`coordinator.dispatch` → `processSourcePipeline` → `parseSourceContent` → `generateSemanticChunks` (1200 chars / 200 overlap) → `generateEmbeddingsBatch` (OpenAI, 1536-dim) → `saveSourceIndex`.

Stages are persisted (`SourceProcessingAttempt` / `SourceProcessingEvent`) with a heartbeat lease; `startRecoveryLoop` re-dispatches stale attempts. YouTube acquisition tries the configured relay fast path once, then falls back to Gemini-native (`gemini-3.6-flash`).

### Data model

`Workspace` (owned by `userId`) → `Source` → `SourceContent` (versioned) / `SourceIndex` (versioned) → `Chunk` (`Unsupported("vector(1536)")`) ; `Message` → `Citation`. Plus `User` / `UsageEvent`.

## Protected invariants

1. **Isolation.** Nested handlers use `res.locals.workspace.id`, never `req.params.id`. `searchWorkspaceChunks` independently re-verifies ownership; `assertCandidateIntegrity` throws on any cross-Workspace row.
2. **Retrieval only reads trusted vectors:** `chunk.indexId === Source.activeIndexId`, index `status = READY`, `chunk.sourceVersion === index.sourceVersion`, and an exact embedding-contract match (provider/model/version/dimensions). Note the integrity CTE aggregates over *all* active indexes in the Workspace — one corrupt index fails retrieval for the whole Workspace.
3. **Index promotion is one Serializable transaction** in `saveSourceIndex`: create BUILDING → insert vectors → verify count and dims → supersede the old index → promote to READY → set `activeIndexId`. Never set `activeIndexId` before verification.
4. **Usage is always reserve → commit *or* discard.** Every early return, `catch`, and `finally` must settle the reservation. `shouldCommitChatUsage` is the single policy for chat.
5. **Citation validation is defence in depth** at three layers — retrieval (`assertCandidateIntegrity`), construction (`createCitation`), persistence (`validateCitationInput` → `CitationTrustError`). Fix derivation, never relax a validator, and never fabricate a page or timestamp.
6. **Durable success wins.** Once the assistant message is persisted, a later failure must still emit `done` with the persisted message rather than an `error`.
7. `Message.parentMessageId` is `@unique` — exactly one assistant reply per user turn. Regeneration goes through `reserveAssistantRegeneration`.
8. Grounded answers use `[Citation #N]` markers only; GENERAL answers must never emit them (`GeneralResponseSafeStream` enforces this).
9. Changing `EMBEDDING_MODEL` / `EMBEDDING_VERSION` / `EMBEDDING_DIMENSIONS` invalidates every existing index — retrieval throws rather than degrading. Treat those env vars as migrations.

## Conventions

- Errors: `AppError` + `successResponse` / `errorResponse` envelopes with stable `SCREAMING_SNAKE` codes.
- Logging: `logger.info(message, { context })`. Never log source content or secrets.
- Env: zod-validated, accessed only via `getServerEnv()`.
- Pure functions take an injected dependencies object for testability (`RetrievalDependencies`, `CoordinatorDependencies`, provider deps).
- Tests are colocated as `*.test.ts` beside the unit.
- **There is no component-testing setup (no React Testing Library, no jsdom).** A component's *behavioral* contract — "this handler never touches that state," "this button is wired to the shared submission gate" — is instead verified by reading the component/route source as text (`readFileSync`) and asserting on it with `assert.match`/`assert.doesNotMatch`, after slicing out the relevant function/handler. See `src/lib/chat/grounding-route-contract.test.ts`, `src/components/workspace/workspace-interactions.test.ts`, and `src/routes/skills-route-contract.test.ts` / `src/components/skills/skill-intelligence-interactions.test.ts` for the pattern. Reach for it before reaching for a new test framework.
- Both `bun.lock` and `package-lock.json` are committed; npm is what the scripts assume.
- **OpenAI strict-mode JSON-schema output (`text.format.type: 'json_schema', strict: true`) requires every property in `required`, with no way to omit one the model has nothing to say about.** If a property's JSON-schema `type` is a bare `'string'` (not `['string', 'null']`), the model is left with no legal way to represent "not stated" and reliably emits `""` instead — which then fails a Zod `.min(1)` on that field and looks like a validation bug, not a schema-design bug. Any field that is genuinely optional must declare `type: ['string', 'null']` in the JSON schema *and* accept `""` alongside `null` on the Zod side (normalize both to `null`); only fields essential to identifying the item — the ones where empty content really does mean "reject and retry" — should stay a bare required string. See `src/lib/skills/extraction-contract.ts` (`optionalText`, `filteredStringArray`) for the pattern.

## Known issues (Phase 4)

**Resolved.** A YouTube source could reach READY while grounded chat failed with `CITATION_VALIDATION_FAILED` / "YOUTUBE citation timestamp could not be derived". Two confirmed, independent defects, both fixed:

- **Inline timestamp markers didn't survive chunking.** `parseYouTubeSource` emits `[HH:MM:SS.mmm - HH:MM:SS.mmm]` lines joined by single `\n`, so `cleanText` is one paragraph; `generateSemanticChunks`'s long-paragraph sentence splitter used a negated character class (`[^.!?]+[.!?]+(\s+|$)`) that treated every embedded `.` — including the non-terminal decimal point in `HH:MM:SS.mmm` — as a required boundary. Since that boundary is never followed by whitespace, no match could complete there, and the scan silently discarded everything up to the next real sentence-ending period, shredding or dropping the timestamp bracket entirely. Fixed in `generateSemanticChunks` (`src/lib/ingestion/chunker.ts`) by matching lazily up to a terminator that IS followed by whitespace/end (`[\s\S]+?[.!?]+(?=\s|$)\s*`), which keeps non-terminal periods (timestamps, decimal numbers, version strings) as ordinary content instead of dropping them. VTT was affected identically and is fixed the same way. Regression tests: `src/lib/ingestion/chunker.test.ts`, plus an end-to-end chunk→`createCitation` test in `src/lib/retrieval/rag-service.test.ts`.
- **Non-integer milliseconds.** Gemini offsets were `startSeconds * 1000` unrounded; `validateCitationInput` requires `Number.isInteger`. Fixed with `Math.round(...)` on both `offset` and `duration` in `fetchGeminiTranscript` (`src/lib/ingestion/youtube-transcript-provider.ts`). Regression test in `youtube-transcript-provider.test.ts`.

**Resolved.** A source-specific query about a READY YouTube source ("What does the speaker discuss in the first 2 minutes?", "What is the main topic discussed in this video?", and even genuine-topic questions phrased with narrator framing) could incorrectly fall back to GENERAL, sometimes with the model claiming it lacked access to a video that actually existed. Root cause: the lexical topic-coverage gate in `assessWorkspaceEvidenceSufficiency` (`src/lib/chat/grounding-router.ts`) treated discourse/structural words describing the *question's frame* — `speaker`, `discuss(ed/es/ing)`, `topic`, `main`, `suggest(ed/s)`, and ordinal/duration references like `first`, `minute(s)`, `second(s)`, `hour(s)` — as required content topics. A transcript never refers to itself as "the speaker" or narrates "the main topic discussed", so those tokens could never match, driving `coveredTopicGroupCount` to 0 even when the real requested subject was fully present in retrieved evidence. Fixed by adding those words to the existing `QUERY_SCAFFOLDING` set (same curated-list mechanism already used for `document`/`source`/`summarize`/etc.) so they're excluded from extracted topic groups; genuine content tokens (e.g. `viral`, `trend`, `project` in "...how does the speaker suggest developers turn viral trends into engineering projects?") remain required and checked. Off-topic questions in the same Workspace (e.g. asking a viral-trends video about Kubernetes) still correctly fall back to GENERAL — this did not weaken the gate globally, only stopped it from double-counting the question's own grammar as a topic. Regression tests in `src/lib/chat/grounding-router.test.ts` (all four production queries plus an unsupported-topic control and a GENERAL-fallback-text/citation-free check) and an end-to-end chunk→evidence→citation test in `src/lib/retrieval/rag-service.test.ts`.

**Still requires production verification:** this was validated with synthetic transcript-shaped evidence and the existing test suite (24+ pre-existing grounding-router tests unaffected), not against the real ingested video or a live model. Confirm against production logs that `coveredTopicGroupCount` now reaches its `topicGroupCount` for the reported queries, and that the model no longer claims it lacks video access once routed GROUNDED.

## Remaining phases

1. **Skill Intelligence / Role Gap Analysis** — resume/profile extraction, skill + evidence extraction, ~4–5 target roles, deterministic explainable gap analysis.
2. **Gap-to-Learning / Learning Path** — turn Phase 1 gaps into projects, skills, and resources via existing Resource Intelligence; "Create Learning Workspace" starts **empty** (never silently auto-ingest recommendations).
3. **Payments** — FREE/CORE/MAX, server-side verification, entitlement sync, upgrade/downgrade/cancel, failed-payment and webhook reliability, preserving the existing Usage architecture.
4. **YouTube pipeline / grounded citation repair** — the timestamp-derivation defects and the GENERAL-fallback misrouting are both fixed locally (see above); production log confirmation is still outstanding.
5. **Real-user UX, bugs, polish** — empty/loading/error states, source states, recovery, mobile, accessibility.

Phases 1–3 have **no implementation** today. `SKILL_INTELLIGENCE` and `LEARNING_PATH` exist only as unused `UsageActionType` enum values, and `PLAN_LIMITS` covers only `CHAT` / `INGESTION` / `AI_ACTION` — add limits there before metering either new action.
