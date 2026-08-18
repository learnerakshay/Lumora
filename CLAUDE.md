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
10. **`User.plan` has exactly one writer: `syncUserEntitlement`** (`lib/payments/entitlement-sync.ts`). It re-derives the plan from every `CAPTURED` `Payment` row (never a delta) inside a transaction holding the same `pg_advisory_xact_lock(hashtext(userId))` that `checkAndReserve` uses, so it is idempotent and can never interleave with a usage-limit check. No route, webhook, or middleware may call `prisma.user.update({ data: { plan } })`.
11. **The webhook route must stay mounted with `express.raw()` above `express.json()`** in `server.ts`. The signature is an HMAC over the exact raw bytes; once `express.json()` consumes the stream, `JSON.stringify(req.body)` is not byte-identical and every signature check breaks. Contract-tested.
12. **Payments are never metered.** No payment route calls `checkAndReserve` / `commitUsage` / `discardUsage`, and there is no `PAYMENT` value in `UsageActionType`. Payments read `Plan` and `PLAN_LIMITS`; the dependency arrow never points back.

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

1. **Skill Intelligence / Role Gap Analysis** — **Complete and frozen.** Resume/profile extraction (`lib/skills/extraction-*`), skill + evidence extraction, ~4–5 target roles (`lib/skills/role-matching.ts`), deterministic explainable gap analysis (`lib/skills/gap-analysis.ts`). API: `routes/skills.ts`. UI: `SkillIntelligencePage.tsx` / `SkillGapReport.tsx`. Change only for a blocking integration bug.
2. **Gap-to-Learning / Learning Path** — **Complete and frozen.** Turns a selected subset of Phase 1 gaps into a structured, staged learning plan (why it matters → priority → required competency → closure steps → evidence task → resources) plus a Career Readiness / Action Report, reusing Resource Intelligence unchanged. See "Gap-to-Learning / Learning Path (Phase 2)" below for the full architecture. Change only for a blocking integration bug.
3. **Payments** — **Payments Phases 1–2 (backend money path), 3A (payment-client foundation), 3B (premium pricing + real checkout), and 3C (billing + upgrade/renewal/expiry UX + structural pricing/checkout polish) are all COMPLETE and FROZEN; Payments Phase 3D (final cinematic polish) is the current next phase.** See "Payments (Razorpay Orders — one-time 30-day access)" below for the full architecture, exactly what is verified, and what remains. Do not reopen Phases 1–2, 3A, 3B, or 3C except for a blocking integration bug.
4. **Final Product Polish** — real-user UX and bug fixing, empty/loading/error states, source states, recovery, mobile, accessibility, general UI/UX refinement. Largely overlaps with Payments Phase 4 below.

YouTube ingestion is considered stable enough to build on: the timestamp-derivation defects and the GENERAL-fallback misrouting (see "Known issues" above) are both fixed locally with regression coverage. Production log confirmation of those fixes is still outstanding but is not a blocker for Payments or Polish.

## Gap-to-Learning / Learning Path (Phase 2)

Turns selected Skill Intelligence gaps into a learning plan. Entirely additive to Phase 1 — no Phase 1 file was changed except `SkillGapReport.tsx`, which gained optional selection props that leave the default (unselected) render path byte-identical to before.

- **Module:** `src/lib/learning/` — `types.ts` (`LearningPath`, `LearningStep`, `ReadinessReport`, …), `priority.ts` (deterministic score = severity rank × requirement weight × evidence shortfall; band comes directly from `Gap.severity`), `competency.ts`, `closure-plan.ts`, `evidence-task.ts` (all pure, rule-keyed by `ruleId`/observed level — never AI), `readiness.ts` (Career Readiness / Action Report, numbers read only from the Phase 1 `TargetRole.fitScore` and the selected gap set), `resource-bridge.ts` (maps a `Gap` to the *existing* `resolveResources()` input — no new ranking/discovery engine), `narrative-contract.ts` + `narrative-provider.ts` (the **one** AI call: prose only, strict JSON schema keyed by step id, structured labels only — never resume text — any missing/empty/mismatched field falls back to deterministic text and the plan still succeeds), `path-builder.ts` (composes all of the above; accepts only `GapReport` + `NormalizedSkill`/`RoleDefinition`-derived data, never `ExtractedProfile` free text, so it structurally cannot re-analyze the resume), `learning-plan-store.ts` (Prisma persistence, mirrors `skill-profile-store.ts`).
- **API:** `routes/learning.ts` at `/api/learning` — `POST /plan` (validates role + every gap id against the caller's own latest `RoleAnalysis` via `selectableGaps`, reserves `LEARNING_PATH` usage, builds, persists **immutable** — re-running Skill Intelligence analysis never mutates an existing plan), `GET /plan`, `GET /plan/:id`, `POST /plan/:id/workspace` (creates an **empty** Workspace and links it — idempotent per plan; contract-tested to import nothing from `lib/ingestion/*` and never read `plan.path[].resources`, so a recommendation can never become Workspace evidence), `DELETE /plan/:id` (free, unmetered, like the Phase 1 precedent).
- **Usage:** `LEARNING_PATH` added to `MeteredUsageAction` / `PLAN_LIMITS` (FREE 2 / CORE 6 / MAX 15) in `lib/usage/config.ts`, metered only on `POST /plan`, full reserve → commit/discard lifecycle including the build-failure path.
- **Schema:** `LearningPlan` (→ `User`, → `RoleAnalysis`, versioned like `SkillProfile`) and `LearningWorkspaceLink` (→ `LearningPlan`, → `Workspace`), plus `LearningPlanStatus` enum. Migration `20260817173428_learning_path_phase2`.
- **UI:** `/learning/:planId` (`LearningPathPage.tsx`) — `ReadinessReportCard`, `LearningStageList` / `LearningStepCard` (now/next/later stages), `CreateLearningWorkspaceDialog`. Gap selection lives in `components/skills/gap-selection.ts` (pure reducer, capped at `MAX_SELECTED_GAPS = 6`, one role at a time) wired into `SkillIntelligencePage.tsx`, which calls `POST /plan` and navigates to the new page on success.
- Tests: `npm run test:learning` (`src/lib/learning/*.test.ts`, `src/components/learning/*.test.ts`) plus the route contract in `src/routes/learning-route-contract.test.ts` (runs under `test:skills`'s `src/routes/*.test.ts` glob).
- **Not yet verified in production:** the full authenticated flow (resume → gap selection → build plan → view plan → create Learning Workspace) has not been exercised end-to-end against Clerk auth and a live Skill Profile; only unit/integration tests, typecheck, build, and an unauthenticated API/route smoke check have run.

## Payments (Razorpay Orders — one-time 30-day access)

**Model:** one-time Razorpay **Orders** only — no Subscriptions, no UPI Autopay, no mandates, no proration, no cancellation flow. CORE **₹499** / MAX **₹1,499**, each granting **30 days** of access. Renewal is manual and **stacks**: renewing early extends from the existing `accessUntil` instead of discarding remaining days. INR only; every amount is integer **paise**. Upgrading is simply buying MAX — `resolveEntitledPlan` picks the highest unexpired tier.

### Payments Phase 1 — COMPLETE / FROZEN

- **`src/lib/payments/`** — `config.ts` (launch vs list prices in paise, `PAID_PLANS`, `PLAN_ACCESS_DAYS_DEFAULT = 30`, `MIN_ORDER_AMOUNT_PAISE`), `types.ts`, `signature.ts`, `access.ts`, `coupon.ts`, `razorpay-client.ts`, `payment-store.ts`, `webhook-store.ts`, `coupon-store.ts`.
- **Signatures** (pure): order checkout = `HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)` — the **reverse** operand order from the unused Subscriptions formula; webhook = `HMAC_SHA256(rawBody, WEBHOOK_SECRET)`. Both compare timing-safe **behind a length guard**, because `crypto.timingSafeEqual` throws on mismatched lengths (an uncaught throw would turn a forged signature into a retried 500).
- **Access** (pure): `resolveEntitledPlan(payments, now)` — only `CAPTURED` rows with `accessUntil > now` entitle, highest tier wins, `accessUntil` is **exclusive**. `computeAccessWindow(...)` implements renewal stacking.
- **Coupons** (pure, server-authoritative): `normalizeCouponCode` (trim + uppercase) so `launch50` / ` LAUNCH50 ` collide. Discount clamps so the charge never drops below `MIN_ORDER_AMOUNT_PAISE` (₹1) — a 100%-off coupon still yields a valid chargeable order, never a ₹0 one Razorpay rejects. **No Razorpay Offers required**: with Orders the server sets `amount` directly.
- **Client:** raw `fetch` + Basic auth + `AbortController` timeout, matching the repo's no-SDK OpenAI convention. Orders surface only: `createOrder` (`payment_capture: 1`), `fetchOrder`, `fetchOrderPayments`, `fetchPayment`, `listOrders` (diagnostics). Never leaks `keySecret` into an error message.
- **Schema** (migration `20260817180000_payments_phase1`, purely additive): `Payment`, `WebhookEvent`, `Coupon`, plus `PaymentStatus` / `CouponKind` enums; `User` gains `planExpiresAt` / `planUpdatedAt`. A **CAPTURED `Payment` row is both the payment-history record and the entitlement grant** — there is deliberately no subscription table and no `CouponRedemption` table (per-user coupon use is counted off `Payment.couponId`).
- **Env** (`src/lib/env.ts`): `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`, `PAYMENTS_ENABLED` (default **false**, kill switch), `PAYMENTS_CURRENCY`, `PLAN_ACCESS_DAYS`, `ALLOW_RAZORPAY_TEST_KEYS` (default **false**). Booleans go through a `booleanFlag` helper because `z.coerce.boolean()` treats the literal string `"false"` as `true`.

### Payments Phase 2 — COMPLETE / FROZEN

The real backend money path, verified end-to-end against live Razorpay Test Mode and the deployed Render service:

`Create Order → Checkout → verify → webhook → Payment CAPTURED → 30-day access → User.plan → PLAN_LIMITS`

- **Routes:** `src/routes/payments.ts` at `/api/payments` (all behind `requireApiAuth`, all 503 when `PAYMENTS_ENABLED=false`) — `GET /config`, `GET /plans`, `GET /access`, `POST /order`, `POST /order/verify`, `POST /access/refresh`, `GET /payments`. Plus `src/routes/payments-webhook.ts` (unauthenticated, raw-body).
- **`POST /order`** accepts only `{ plan, couponCode? }`. Amount is always resolved server-side from `config.ts`; the handler never reads `amount` / `price` / `currency` from the body (contract-tested).
- **`POST /order/verify`** does ownership check → HMAC verify → **authoritative `GET /payments/:id` re-read from Razorpay** → `capturePayment`. Never grants access from the signature alone.
- **`capture-service.ts`** is the single grant routine shared by verify and the webhook. `markPaymentCaptured` is a `CREATED → CAPTURED` compare-and-swap; the loser of a race **re-fetches** the row rather than trusting its stale pre-race snapshot (a real bug found by the concurrency test — a paying user must never be told their payment failed because a webhook won a race).
- **`webhook-handler.ts`** — verify signature → record in `WebhookEvent` (unique `eventId` = the idempotency gate) → dispatch. Handles `payment.captured`, `order.paid`, `payment.failed`; everything else is recorded and ignored. **Always returns 200 for any signature-verified event**, even on processing failure (a 5xx just makes Razorpay retry into the same failure on a cold instance); only an invalid signature gets 400.
- **`expire-stale-access.ts`** — `app.use('/api', ...)` middleware. Nothing external ever fires at expiry for a one-time payment, so this re-derives entitlement when a user's cached `planExpiresAt` has passed, dropping them to FREE (or a lower still-unexpired tier). Per-user in-process 60s cache; every failure path (including `getUserId` throwing) is swallowed so a payments hiccup can never break a normal request. This replaces the reconciliation worker; `POST /access/refresh` is the user-triggered recovery for a dropped webhook.

**Verified with real Razorpay Test Mode payments** (not just unit tests):

- **Card success** — `order_TR5mIW6M183KjF` / `pay_TR5q4FYpNTilxp`, domestic Visa, `captured`.
- **Netbanking success** — `order_TR5yf7RP82jSRf` / `pay_TR62Ny4i2LIVY0`, bank `BARB_R`, `captured`.
- **MAX tier success (₹1,499)** — `order_TR6EeQbl1h2WEn` / `pay_TR6J2askDBW579`, `captured`; both webhooks processed once, exactly 30.000 days access, `User.plan = MAX`, live limits matching `PLAN_LIMITS.MAX` (150/50/80/15/15).
- **Real failed-payment webhook** — an international-card rejection delivered `payment.failed` to Render, processed, **no entitlement granted**.
- Both successes: signature-verified `payment.captured` **and** `order.paid` arrived as two distinct `eventId`s, both processed exactly once, and access was still **exactly 30.000 days — no double-grant**. `Payment.status = CAPTURED`, `signatureVerified = true`, `User.plan = CORE`, `planExpiresAt` matching `accessUntil`, and a live `getUsageSummary()` returning real `PLAN_LIMITS.CORE` (CHAT 40 / INGESTION 15 / AI_ACTION 25 / SKILL_INTELLIGENCE 6 / LEARNING_PATH 6).
- Also verified: forged/absent webhook signature → 400 on live Render; unauthenticated payment routes → 401; verify/webhook race safety; expiry → FREE; MAX expiry → fallback to an active CORE (not FREE); renewal stacking; coupon redemption counted exactly once.

**UPI — deliberately deferred, do NOT reopen Phase 2 for it.** UPI is supported by the backend via Razorpay Standard Checkout and needs **no** backend work: nothing in `capture-service` / `webhook-handler` branches on `method` (it is stored for display only), and netbanking + card already proved that exact shared path. The temporary test harness's Test Mode checkout surfaced only QR/Intent, which cannot be simulated headlessly (QR/Intent needs a real UPI app; only UPI **Collect** with `success@razorpay` / `failure@razorpay` is self-contained), so a UPI Collect capture was never completed. **Validate UPI checkout UX in Phase 3/4 against the real frontend integration and confirm it before Live Mode / demo sign-off.**

**Operational notes:**

- **Every purchase and every renewal must create a fresh Razorpay Order.** Reusing an order accumulates unrelated attempt history and makes a specific method's result ambiguous. `POST /order` already always creates a new one.
- **`ALLOW_RAZORPAY_TEST_KEYS=true` is temporary**, only so Render (which runs `NODE_ENV=production`) can accept an `rzp_test_` key during Test Mode E2E. **Must be disabled before Live Mode.** With it unset/false, production rejects test keys; it never relaxes the `rzp_test_`/`rzp_live_` format check or the secret requirements.
- **Webhook URL** points at the Render origin directly — `https://lumora-vtwo.onrender.com/api/payments/webhook` — not the Vercel domain, since `vercel.json` proxies `/api/*` and an extra hop risks re-encoding the bytes the signature covers. Subscribed events: `payment.captured`, `payment.failed`, `order.paid`.
- **Tests:** `npm run test:payments` (`src/lib/payments/*.test.ts` + `src/lib/env.test.ts`); route contracts in `src/routes/payments-route-contract.test.ts` (runs under `test:skills`'s `src/routes/*.test.ts` glob). DB-integration tests are gated behind `RUN_DATABASE_PAYMENTS_TESTS=true` and hit real Neon.
- **Manual test tooling:** `npm run payments:test-order -- <userId> <CORE|MAX>`, `payments:inspect-order -- <orderId>` (dumps raw Razorpay order + every attempt incl. `error_source` / `error_step` / `error_reason`), `payments:verify-order -- <orderId> <paymentId> <signature>`, `payments:smoke-order`. `public/e2e-checkout.html` is a **temporary** Checkout.js harness — delete it once Phase 3's real UI exists.
- **Official test credentials:** domestic Visa `4100 2800 0000 1007` (success — *not* `4111 1111 1111 1111`, which Razorpay flags international and this account rejects); `4100 2800 0006 0003` (declined); UPI Collect `success@razorpay` / `failure@razorpay`; netbanking requires clicking **Success** on the mock bank page, otherwise the payment sits at `created` forever.

### Payments Phase 3A — COMPLETE / FROZEN

Frontend/payment-client foundation, built entirely on top of the frozen Phase 1–2 money path with exactly one small backend addition:

- **Pricing presentation / source-of-truth**: `src/lib/payments/pricing-presentation.ts` — `PRICING_PLANS`, `LIMIT_COMPARISON_ROWS` (the 5 real `PLAN_LIMITS` differences), `SHARED_CAPABILITY_ROWS` (capabilities identical across all plans), rolling-window and access-terms labels. Every number is derived from `PLAN_LIMITS` / `PLAN_PRICING_PAISE` — a test asserts the module contains no hardcoded plan-limit or price digit literals, so pricing copy structurally cannot drift from what the backend enforces.
- **`POST /api/payments/quote`** (`src/routes/payments.ts`) — the only backend addition in Phase 3A. Lets the UI preview a coupon's effect (reusing `validateCoupon`/`findCouponByCode` verbatim) without creating a Razorpay order, a `Payment` row, or metering usage. **Verified against real Razorpay Test Mode**: a live order-count diff (9 before, 9 after) confirmed quoting creates zero orders; a valid coupon and an invalid coupon both returned correct, server-computed results. `POST /order` still independently revalidates and remains the sole authoritative charge path.
- **Checkout state machine** (`src/lib/payments/checkout-machine.ts`) — pure reducer (`idle → creating_order → gateway_opening → awaiting_payment → verifying → activating → success | failed | dismissed | awaiting_bank_confirmation`). Every non-terminal state has a proven success and failure/recovery exit; `dismissed` is a distinct terminal state, never routed through `failed`.
- **Razorpay Checkout.js loader** (`src/components/payments/useRazorpayCheckout.ts`) — loads on demand only (never in `index.html`), memoizes the load promise, exposes a real failure path (ad-blocker/network). Does not open the Checkout UI — that's Phase 3B.
- **`AccessProvider`** (`src/components/payments/AccessProvider.tsx`) — `{ plan, planExpiresAt, loading, error, refresh() }` off `GET /api/payments/access`; mounted in `App.tsx` inside `AuthProvider`, beside `UsageProvider`. Fetches once per authenticated session and on explicit `refresh()` only — **never polled**, since `GET /access` runs `syncUserEntitlement`'s advisory-lock transaction on every call.
- **`usePaymentHistory`** (`src/components/payments/usePaymentHistory.ts`) — read-only hook over `GET /api/payments/payments`.
- **Access/expiry presentation helpers** (`src/lib/payments/access-presentation.ts`) — `daysRemaining` (exclusive-boundary math matching `access.ts`), `expiryBand` (none/approaching ≤7d/urgent ≤2d/expired), `hadPaidAccess`, `purchaseDateFrom`, `latestCapturedAccess`, `stackingCopyFor` (describes, never reimplements, same-plan renewal stacking and CORE→MAX preservation).
- **Verification**: `npx tsc --noEmit` clean; `npm run test:payments` (139 pass / 13 DB-gated skip), `npm run test:skills` (134 pass, incl. new `/quote` route-contract tests), all other suites green (`test:ingestion`'s coordinator heartbeat test is the pre-existing documented flake, confirmed passing on rerun); `npm run build` succeeds; new component-level contract tests under `src/components/payments/*.test.ts` pass (16/16) but are **not yet wired into an npm script** — that wiring is explicitly Phase 3D scope.
- **Frozen Phase 1/2 invariants untouched**: `src/lib/usage/*`, `capture-service.ts`, `webhook-handler.ts`, `webhook-store.ts`, `entitlement-sync.ts`, `signature.ts`, `access.ts`, `coupon.ts`, `expire-stale-access.ts`, `razorpay-client.ts`, the webhook route, the raw-body mount order in `server.ts`, the Prisma schema, and `public/e2e-checkout.html` were not modified. `POST /order`, `/order/verify`, `/access/refresh` are unchanged and still pass every existing contract test.

### Payments Phase 3B — Premium Pricing + Real Checkout — COMPLETE / FROZEN

Premium FREE/CORE/MAX pricing UI (`PricingCards.tsx`, `PlanComparisonTable.tsx`, `PricingSection.tsx` on the landing page, standalone `PricingPage.tsx`) with every feature/limit derived from `PLAN_LIMITS` via Phase 3A's `pricing-presentation.ts`; coupon Apply/Remove UX (`CouponField.tsx`) wired to `POST /quote`; real Razorpay Standard Checkout (`CheckoutDialog.tsx`) wired to Phase 3A's checkout state machine and script loader, with no `method` restriction (Cards/UPI/Netbanking/Wallets all surface natively); explicit payment states end to end (creating → gateway → verifying → activating → success / failed / dismissed / awaiting_bank_confirmation — `dismissed` is not a failure). **`payments-api.ts` uses a string-literal `status: 'ok' | 'error'` discriminant, not a boolean one** — this repo's `tsconfig.json` doesn't enable `strict`, and without `strictNullChecks` TypeScript fails to narrow a boolean-literal discriminated union (confirmed via an isolated repro); a regression test guards this. **Verified with a real Test Mode CORE purchase completed from the actual frontend** (card, captured, 30.000 days access) — plus a verified invalid-coupon attempt confirmed to create zero Razorpay orders via a live order-count diff.

### Payments Phase 3C — Billing + Upgrade/Renewal/Expiry UX + Structural Premium Polish — COMPLETE / FROZEN

- **`/billing`** (`BillingPage.tsx`, `CurrentPlanCard.tsx`, `PaymentHistoryTable.tsx`) — current plan/badge, access start/expiry, days remaining, full payment history (amount/discount/method/status read verbatim off each historical `Payment` row, never recomputed from current pricing constants), Renew Plan, Upgrade to MAX (CORE only), Refresh payment status (refreshes both access and history). States: FREE-no-history, FREE-lapsed (`free_expired`, distinguished from never-purchased via the new `billingStatus()` helper in `access-presentation.ts`), active CORE/MAX, and per-row CREATED/CAPTURED/FAILED/REFUNDED. **Verified against a real successful CORE purchase** (`order_TR9uXdwvRFmcUa`, card, ₹499) — Billing correctly showed Core/Active, access-until exactly 30 days out, and the real payment row; Renew and Upgrade-to-MAX both opened Checkout with the exact live `stackingCopyFor()` sentence (confirmed via DOM inspection, not just unit tests).
- **`CheckoutDialog` gained an optional `currentPlan` prop** (purely presentational, never sent to the server) so every checkout entry point — pricing cards, landing section, and now `/billing`'s Renew/Upgrade buttons — shows the correct honest renewal-vs-upgrade sentence instead of generic purchase copy.
- **Upgrade entry points**: `UsageLimitNotice.tsx`'s `ACTION_LABELS` is now typed `Record<MeteredUsageAction, string>` (missing keys are a compile error) with real Skill Intelligence / Learning Path labels — fixes the shipped "FREE undefined capacity reached" bug — plus a contextual "Upgrade for more capacity" link for FREE/CORE only, never MAX. `UsagePage.tsx` plan cards mark the current plan and add a CTA only on strictly-higher tiers (never same-or-lower), still reading only `summary.planLimits`. `SettingsModal.tsx`'s Plan section now reads real plan/expiry from `useAccess()` and replaces the old placeholder copy and hardcoded-always-"Active" badge with a real state + "Manage billing" link to `/billing`.
- **`ExpiryBanner`** — mounted exactly once in `DashboardLayout`, never per-page. Renders nothing outside an expiry window; `approaching` (≤7d) and `urgent` (≤2d) are session-dismissible (keyed to the specific `planExpiresAt`, so renewing un-dismisses it for the new cycle); `expired` is persistent and never dismissible.
- **Structural premium UI pass** (explicitly scoped to layout/hierarchy, not deep motion — that's Phase 3D): fixed a real clipping bug where the "Most Popular" badge (absolutely positioned, `-top-3`) was a child of `.landing-card`, which sets `overflow: hidden` in `landing-motion.css` for its hover glow — the badge is now a sibling in an outer non-clipping wrapper (verified empirically in a live browser: the badge's bounding rect sits above the card's, and its parent is confirmed not to be the clipped element). CORE now reads as the recommended tier via a raised card, gradient border/glow, and matching "Recommended" tag on the comparison table's CORE column. The "what every plan includes" block changed from a 3-column table repeating an identical checkmark 45 times (15 rows × 3 plans, zero comparison information since every capability is on every plan) to a single compact chip grid — same facts, explicitly still stated per item, without the spreadsheet repetition. FAQ became a native `<details>/<summary>` accordion (accessible by construction, no extra JS state).
- **Tests**: `access-presentation.test.ts` (+`billingStatus` cases), `usage-presentation.test.ts` (+`ACTION_LABELS` exhaustiveness, real-rendered FREE/CORE-shows-CTA vs MAX-shows-no-CTA), `billing-presentation.test.tsx` (real render of `PaymentHistoryTable` incl. historical-amount-never-recomputed; source contracts for `CurrentPlanCard`/`BillingPage`/`SettingsModal`), `pricing-experience.test.tsx` updated for the new comparison-table shape and badge-clipping structural regression test, `checkout-contract.test.ts` unchanged and still green. `npx tsc --noEmit` clean; `npm run build` succeeds; all suites green (`test:ingestion`'s coordinator heartbeat test remains the pre-existing documented flake).
- **Frozen invariants confirmed untouched** (`git diff --stat` against every frozen path returns zero changes): `src/lib/usage/*`, `capture-service.ts`, `webhook-handler.ts`, `webhook-store.ts`, `entitlement-sync.ts`, `signature.ts`, `access.ts`, `coupon.ts`, `expire-stale-access.ts`, `razorpay-client.ts`, `payments-webhook.ts`, `server.ts`, `prisma/schema.prisma`, `public/e2e-checkout.html`. **Zero backend changes in Phase 3C** — `src/routes/payments.ts` is unchanged from Phase 3A.

### Payments Phase 3D — Final Cinematic Polish — NEXT

Deeper motion and micro-interactions (Framer Motion on dashboard/billing surfaces, GSAP on the landing pricing section only, `prefers-reduced-motion` guarded); final responsive/mobile pass across pricing, checkout, and billing; accessibility sweep (focus trap + restore on dialogs, `aria-live` on payment status transitions, keyboard traversal); visual-consistency sweep; refined gradients/glass effects where they add real value (premium ≠ noisy); **test-suite wiring** — fold the still-unwired component test files (`src/components/payments/*.test.ts`, `src/components/pricing/*.test.tsx`, `src/components/billing/*.test.tsx`) into an npm script, and wire the previously-orphaned `landing-polish.test.tsx` / `WorkspaceIcon.test.tsx` in too; a repo-wide forbidden-copy verification sweep (no `subscription`/`cancel anytime`/`monthly` anywhere) and a source-of-truth duplication grep; UPI checkout validation through the real frontend if Test Mode exposes the required flow (deferred from 3B/3C — Test Mode previously only offered QR/Intent, which needs a real UPI app); final regression + typecheck + full suite; freeze Phase 3 in this file.

### Payments Phase 4 — FINAL

Full Test Mode manual matrix; final UPI/card/netbanking confidence checks; coupon/renewal/expiry testing; webhook resend + idempotency; security/logging/rate-limit review (never log webhook payloads — they carry email/contact/VPA); legal pages incl. a real Refund & Cancellation policy (the current inline legal copy still says "hackathon preview", which fails Razorpay activation review); mobile pass; production env review; **disable `ALLOW_RAZORPAY_TEST_KEYS`**; switch to `rzp_live_*`; configure the Live webhook; final real-payment smoke test; regression + typecheck + full suite; hackathon demo readiness.
