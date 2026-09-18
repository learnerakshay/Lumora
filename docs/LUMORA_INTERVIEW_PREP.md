# Lumora — 30 Interview Questions You Must Be Able to Answer

> Audit note: this handbook is based on the repository as inspected on 2026-08-27. Code and migrations take precedence over older documentation. In particular, `docs/PRD.md`, `docs/PITCH.md`, and `docs/VALIDATION.md` still describe payments, Skill Intelligence, and Learning Workspaces as planned, but their routes, persistence, UI, and tests are present in the current repository. Treat them as implemented code paths whose live production coverage varies by feature.

## Section 1 — Product / Founder Thinking

## Q1. What problem does Lumora solve?

### Strong Interview Answer

Lumora solves the trust problem in personal learning and knowledge work. People learn from PDFs, websites, notes, video, and transcripts, but conventional chat can produce a convincing answer without making it clear whether the answer came from their material. Lumora turns those materials into a private Workspace where users can ask naturally, inspect citations, and distinguish a source-backed answer from a general-knowledge answer.

The key product decision is that retrieval is not automatically evidence. I built the system around the question: “Does the Workspace actually cover what the user asked?” That is why Lumora has a visible GENERAL versus GROUNDED distinction instead of presenting every answer as if it were derived from uploads.

### Repository Evidence

- `docs/PRD.md` — vision, target users, and core journey.
- `docs/PITCH.md` — problem statement and product differentiation.
- `src/lib/chat/grounding-router.ts` — GENERAL/GROUNDED routing policy.
- `src/pages/WorkspaceDetailPage.tsx` and `src/components/workspace/WorkspaceChatArea.tsx` — Workspace chat surface.

### Likely Follow-up

- Why is attribution important for a learner rather than only for enterprise compliance?
- What user behavior would tell you that Lumora is solving this problem?

## Q2. Why build Lumora instead of another generic AI chatbot?

### Strong Interview Answer

A generic chatbot optimizes for broad answer generation. Lumora is intentionally narrower: it organizes a user’s own material into an owner-isolated Workspace, creates a versioned searchable index, and preserves source provenance with the answer. The product is designed for the moment when plausible language is not enough and the user needs to know what supports a claim.

I would not claim that Lumora replaces general chat. When a Workspace cannot support a question, Lumora can explicitly give a GENERAL answer. The difference is honesty about the answer’s basis: a grounded answer must pass retrieval, evidence-sufficiency, citation, and persistence checks; a general answer is not allowed to masquerade as Workspace evidence.

### Repository Evidence

- `src/lib/retrieval/rag-service.ts` — owned-Workspace retrieval and RAG context.
- `src/lib/chat/citation-consistency.ts` — GENERAL responses reject Workspace citation markers.
- `src/lib/chat/conversation-store.ts` — citation provenance is persisted with messages.
- `docs/ARCHITECTURE.md` — system-level rationale.

### Likely Follow-up

- How is this different from NotebookLM?
- When would you deliberately choose GENERAL over GROUNDED?

## Q3. Who is Lumora for, and why use the term “Workspace”?

### Strong Interview Answer

The repository identifies learners, builders or researchers, and career switchers as the main users. They have slightly different goals, but the common pattern is consolidating fragmented material and turning it into an explorable evidence base. A learner can study a course; a builder can reason across technical references; a career switcher can connect a résumé analysis to a learning plan.

I use “Workspace” because the object is more than a file container. It owns sources, versioned indexes, chunks, messages, citations, and optional Learning Workspace links. It is also a security boundary: every Workspace belongs to one authenticated user, and server queries are scoped to that ownership.

### Repository Evidence

- `docs/PRD.md` — user groups and jobs to be done.
- `prisma/schema.prisma` — `Workspace` relations to sources, chunks, messages, and learning links.
- `src/lib/workspace-store.ts` — Workspace CRUD always accepts `userId`.
- `src/routes/workspaces.ts` — router parameter middleware verifies ownership before handlers run.

### Likely Follow-up

- Could Lumora support shared Workspaces later?
- How do you enforce Workspace isolation today?

## Q4. Explain Lumora’s GENERAL versus GROUNDED philosophy.

### Strong Interview Answer

GENERAL and GROUNDED describe the basis of an answer, not its writing style. GROUNDED means Lumora found usable Workspace evidence, verified that it covers the requested topics, generated against that evidence, and retained valid citations. GENERAL means Lumora either has no relevant Workspace evidence or the retrieved evidence does not cover the full request; it labels that outcome rather than overstating certainty.

There are deliberate exceptions. A no-source meta-question such as “What have I uploaded?” gets a deterministic Workspace-specific response. AI Actions that require selected Workspace material fail if the required context is unavailable. The trade-off is more fallbacks than a chatbot that always answers, but the user sees a more truthful contract.

### Repository Evidence

- `src/lib/chat/grounding-router.ts` — `selectInitialChatRoute` and `selectResponseModeAfterRetrieval`.
- `src/routes/workspaces.ts` — no-source response, evidence route, and fallback preamble.
- `src/lib/chat/grounding-router.test.ts` and `src/lib/chat/grounding-route-contract.test.ts`.

### Likely Follow-up

- Can a retrieved chunk still lead to GENERAL?
- Why not make every answer GROUNDED whenever a Workspace exists?

## Q5. How did the product evolve based on user feedback?

### Strong Interview Answer

I would be precise here: the repository does not contain user interviews, analytics, or a feedback system that proves a particular feature came from user feedback. I should not invent that story. What the repository does show is technical iteration driven by observed failure modes: YouTube citation timestamps were being lost or invalid, source-specific YouTube questions could fall back to GENERAL incorrectly, and the code added targeted fixes plus regression tests.

So my defensible answer is that the product evolved through implementation feedback and reliability findings visible in the codebase, while formal user-feedback evidence is not stored here. The next product step would be to capture qualitative feedback and product metrics rather than infer them after the fact.

### Repository Evidence

- `CLAUDE.md` “Known issues (Phase 4)” — resolved YouTube defects and their causes.
- `src/lib/ingestion/chunker.ts` — timestamp-preserving sentence split.
- `src/lib/chat/grounding-router.ts` — added question-scaffolding handling.
- `src/lib/ingestion/chunker.test.ts` and `src/lib/retrieval/rag-service.test.ts` — regressions.

### Likely Follow-up

- What is the difference between product feedback and production telemetry?
- What feedback instrumentation would you add first?

## Q6. What makes Lumora’s product shape more than “chat over documents”?

### Strong Interview Answer

The product has three connected layers. First, a Workspace turns multiple source types into versioned, searchable evidence. Second, chat makes an explicit grounding decision and preserves citations historically. Third, Career Intelligence turns résumé evidence into deterministic role-fit, gap, and learning-path decisions, then links users to resources without silently treating those recommendations as Workspace evidence.

That separation matters. A recommended YouTube course is useful next-step guidance, but it is not automatically trustworthy source material for a chat answer. The Learning Workspace created from a plan starts empty, so users choose what becomes evidence.

### Repository Evidence

- `src/lib/ingestion/` — source processing pipeline.
- `src/lib/chat/` — retrieval, response mode, citations, lifecycle.
- `src/lib/skills/` and `src/lib/learning/` — career and learning engines.
- `src/routes/learning.ts` — linked Learning Workspace is explicitly created empty.

### Likely Follow-up

- Why not automatically ingest every recommended resource?
- Which layer is the most important to the product’s trust promise?

## Section 2 — Core RAG / Grounding Architecture

## Q7. What is RAG, and how does it work in Lumora specifically?

### Strong Interview Answer

RAG combines retrieval with generation. In Lumora, I convert validated source chunks into embeddings, store them in PostgreSQL with pgvector, embed the user’s query, retrieve similar chunks from the current owned Workspace, and build the model context from those chunks.

But Lumora adds a second decision after retrieval. It verifies active-index integrity and checks whether the retrieved evidence covers the distinctive topics in the request. Only then does the response qualify as GROUNDED. That distinction is important because vector similarity finds candidate evidence; it does not prove a complete answer is supported.

### Repository Evidence

- `src/lib/ingestion/embedder.ts` — OpenAI embeddings and contract validation.
- `src/lib/retrieval/rag-service.ts` — pgvector retrieval, ranking, and context construction.
- `src/lib/chat/grounding-router.ts` — deterministic evidence sufficiency.
- `prisma/schema.prisma` — `Chunk.embedding` as `vector(1536)`.

### Likely Follow-up

- Why use embeddings rather than keyword search alone?
- Why is retrieval not sufficient proof of grounding?

## Q8. Walk me through Lumora’s complete grounded-answer flow from question to persistence.

### Strong Interview Answer

First, the authenticated Workspace route checks ownership and reserves a usage unit. It persists the user message and a `SENDING` assistant placeholder. For a normal Workspace question, it embeds the query and retrieves only compatible, READY chunks from the owned Workspace. Lumora then builds a bounded context and runs the evidence-sufficiency gate; a bounded recovery search can query missing topic groups before falling back.

If the evidence is sufficient, the route selects GROUNDED, constructs canonical citations, streams the LLM response, validates every `[Citation #N]` marker against the retrieved set, and persists the assistant message and its cited provenance in a serializable transaction. It then commits usage. If evidence is insufficient, it routes to GENERAL or returns an action-specific insufficiency response instead of inventing grounded support.

### Repository Evidence

- `src/routes/workspaces.ts` — `POST /:id/chat/stream`.
- `src/lib/retrieval/rag-service.ts` — search, context, and citation construction.
- `src/lib/chat/evidence-recovery.ts` — bounded topic-recovery pass.
- `src/lib/chat/citation-consistency.ts` and `src/lib/chat/conversation-store.ts` — stream and persistence validation.
- `src/lib/usage/service.ts` — reserve, commit, and discard lifecycle.

### Likely Follow-up

- What happens if the browser disconnects midway through SSE?
- Which steps are deterministic and which call a model?

## Q9. How does Lumora use pgvector, embeddings, chunking, and similarity search safely?

### Strong Interview Answer

Lumora chunks cleaned source text at roughly 1,200 characters with a 200-character overlap, then generates 1,536-dimensional OpenAI embeddings in batches of up to 64. The embedding contract includes provider, model, dimensions, and version. That contract is stored with each `SourceIndex`, so a model or dimensionality change requires re-indexing rather than silently comparing incompatible vectors.

For retrieval, Lumora first confirms that the caller owns the Workspace. Its SQL searches only active, `READY` indexes whose chunk count, vector dimensions, source version, and embedding contract all match. It ranks cosine similarity, applies a 0.15 threshold, and removes exact or near-duplicate passages before selecting the top results. pgvector keeps vector search and ownership data together, at the cost of fixed schema dimensions and database-centric scaling.

### Repository Evidence

- `src/lib/ingestion/chunker.ts` and `src/lib/ingestion/embedder.ts`.
- `src/lib/chunk-store.ts` — atomic index promotion and vector verification.
- `src/lib/retrieval/rag-service.ts` — retrieval SQL, threshold, and deduplication.
- `prisma/migrations/20260726020000_vector_index_integrity/migration.sql` — pgvector extension and HNSW index.

### Likely Follow-up

- Why use a 1,536-dimensional fixed vector column?
- How would you tune the threshold or top-K value?

## Q10. How does Lumora decide that evidence is sufficient rather than merely relevant?

### Strong Interview Answer

Lumora first uses semantic retrieval to find candidate chunks. It then extracts distinctive topic groups from the question, removes scaffolding words such as “summarize,” “speaker,” or “main topic,” and checks whether every meaningful group is represented in the selected context. A longer topic group requires about 60% lexical token coverage; a topic-specific recovery retrieval can also establish semantic coverage if its validated result survives the final context budget.

The design is intentionally conservative. It avoids calling an answer grounded because one nearby fragment exists while another requested topic is absent. The trade-off is false fallbacks for ambiguous wording, which the repository has addressed through carefully scoped scaffolding rules and regression tests rather than weakening the gate globally.

### Repository Evidence

- `src/lib/chat/grounding-router.ts` — `assessWorkspaceEvidenceSufficiency`.
- `src/lib/chat/evidence-recovery.ts` — up to six bounded topic-specific searches.
- `src/lib/chat/grounding-router.test.ts` — coverage and routing cases.
- `CLAUDE.md` — resolved source-specific YouTube GENERAL-fallback issue.

### Likely Follow-up

- What false positive and false negative does this gate trade off?
- Why not ask an LLM whether the evidence is sufficient?

## Q11. How are GENERAL and GROUNDED responses routed and kept honest during generation?

### Strong Interview Answer

With no sources, ordinary questions take GENERAL without retrieval, while Workspace-meta questions get a deterministic explanation that there are no sources. With sources, Lumora retrieves, assesses sufficiency, and chooses GROUNDED only when context is both present and sufficient. If partial evidence exists but does not cover the request, it deliberately prepends a disclosure that the answer is general.

The response contract continues through streaming. `CitationSafeStream` holds output until it sees a valid Workspace citation, while `GeneralResponseSafeStream` rejects any Workspace-style citation marker. This prevents the UI from briefly displaying a fabricated citation even before final validation runs.

### Repository Evidence

- `src/lib/chat/grounding-router.ts`.
- `src/routes/workspaces.ts` — response-mode decision and streaming setup.
- `src/lib/chat/citation-consistency.ts`.
- `src/lib/chat/response-mode-contract.ts` — answer-depth contracts separate from response basis.

### Likely Follow-up

- Can GENERAL use web search?
- Why are response depth and grounding basis separate settings?

## Q12. How do PDF page citations and YouTube timestamp citations work?

### Strong Interview Answer

Lumora derives citations from source metadata and chunk content; it does not let the model invent locations. For PDFs, the parser records page text and character offsets. Citation construction tries a `[Page N]` marker, then a source-text offset, then a normalized text match; if no page can be derived, citation creation fails.

For YouTube and VTT, ingestion preserves timestamped cues and also puts inline timestamp ranges into the text before chunking. Citation creation derives the earliest and latest valid range in the chunk, with metadata-cue matching as a fallback. If the location cannot be derived as integers, grounded citation persistence fails rather than storing a misleading timestamp.

### Repository Evidence

- `src/lib/ingestion/parsers.ts` — PDF page metadata, YouTube cue preservation, and VTT parsing.
- `src/lib/retrieval/rag-service.ts` — `findPdfPage`, `findTranscriptRange`, and `createCitation`.
- `src/lib/chat/conversation-store.ts` — citation-input and canonical-provenance validation.
- `src/lib/retrieval/rag-service.test.ts`.

### Likely Follow-up

- Why fail a grounded response instead of showing a citation without a location?
- How are YouTube timestamp links rendered in the client?

## Q13. What prevents fabricated citations in Lumora?

### Strong Interview Answer

Lumora uses defense in depth. The model receives numbered citations only for validated retrieved chunks. During streaming, citation syntax and index ranges are checked. At completion, a grounded answer must reference at least one available citation; an out-of-range, malformed, or absent marker makes the response invalid.

Before persistence, the server opens a serializable transaction, re-queries every cited chunk from the current active READY index in the current Workspace, recomputes its canonical citation, and compares every provenance field. That protects against stale indexes, cross-Workspace rows, modified source metadata, and a caller trying to persist handcrafted citations. Historical citations remain attached to the message so a later re-index does not rewrite the evidence record of an earlier answer.

### Repository Evidence

- `src/lib/chat/citation-consistency.ts`.
- `src/lib/chat/conversation-store.ts` — `validateCitationsForWorkspace`.
- `prisma/schema.prisma` and `prisma/migrations/20260726030000_retrieval_citation_integrity/migration.sql`.
- `src/lib/chat/citation-consistency.test.ts` and `src/lib/chat/conversation-provenance.test.ts`.

### Likely Follow-up

- Why retain historical citations when the active index changes?
- What citation attacks are still possible at the natural-language level?

## Section 3 — Ingestion + YouTube Failure Story

## Q14. How does source ingestion work across PDF, website, text, VTT, and YouTube?

### Strong Interview Answer

The client submits one of five source types. The route validates input, size, URLs, and duplicates; stores the original artifact in the database; reserves ingestion usage; and dispatches an in-process coordinator. The coordinator claims a versioned processing attempt using database compare-and-swap, then moves through persisted stages: queued, processing, fetching when required, parsing, chunking, embedding, indexing, and completion or failure.

PDFs preserve uploaded bytes and extract page-aware text. Websites use SSRF-protected HTTPS fetching and static HTML extraction. Text and VTT are parsed locally, with VTT keeping cue timing. YouTube validates the video URL, acquires timestamped transcript cues, persists them as a transcript artifact, and then follows the same chunk/embed/index path. An index becomes active only after every expected vector is validated in a serializable transaction.

### Repository Evidence

- `src/routes/workspaces.ts` — source creation and reprocess routes.
- `src/lib/ingestion/pipeline.ts` and `src/lib/ingestion/coordinator.ts`.
- `src/lib/ingestion/parsers.ts`, `safe-fetch.ts`, and `validators.ts`.
- `src/lib/chunk-store.ts` and `src/lib/source-store.ts`.

### Likely Follow-up

- Why persist original artifacts before processing?
- What happens to a working index when reprocessing fails?

## Q15. Tell me about the hardest production-style bug you faced in Lumora: the YouTube citation failure.

### Strong Interview Answer

The strongest repository-backed incident is that a YouTube source could become ready, but a grounded answer later failed citation validation because a timestamp could not be derived. The audit records two independent causes. First, the long-paragraph sentence splitter mishandled non-terminal periods in inline timestamps such as `00:00:00.000`, which could shred or drop the timestamp bracket during chunking. Second, Gemini timestamps were converted from fractional seconds without rounding, while citation persistence requires integer milliseconds.

I fixed the chunker to match sentence terminators only when followed by whitespace or the end of text, preserving decimal points inside timestamps. I also round Gemini offsets and durations to integer milliseconds. The lesson was that an ingestion pipeline is not “done” when text is embedded; provenance metadata must survive every transformation needed to make an answer defensible.

### Repository Evidence

- `CLAUDE.md` — “Known issues (Phase 4)” documents both defects and fixes.
- `src/lib/ingestion/chunker.ts` — timestamp-safe sentence splitting.
- `src/lib/ingestion/youtube-transcript-provider.ts` — rounded milliseconds.
- `src/lib/ingestion/chunker.test.ts`, `youtube-transcript-provider.test.ts`, and `src/lib/retrieval/rag-service.test.ts`.

### Likely Follow-up

- How did the bug evade an ordinary successful-ingestion test?
- What invariant would you add for every timestamped source type?

## Q16. How does the YouTube transcript relay and Gemini fallback behave when YouTube fails?

### Strong Interview Answer

Lumora has a configurable fast path: direct transcript extraction by default, or an authenticated Vercel relay when proxy mode is configured. The relay validates a bearer token, JSON body, video ID, response size, and cue ordering. It also observes real upstream HTTP statuses because the underlying transcript library can collapse a 403, 429, or 5xx into an ambiguous “unavailable” error.

The fast path is intentionally bounded. A proxy retries transient 429 or 5xx responses once in runtime configuration, but times out without a second full wait. A confirmed missing transcript or per-video transient 429/502/503/504 can fall back to Gemini-native video acquisition. A relay auth or configuration failure fails fast instead: calling a costly Gemini fallback for every video would hide a broken relay and add latency. Gemini itself uses structured output, validates ordered segments, has a per-request and total budget, retries bounded transient or malformed cases, and verifies an empty “no speech” result once before declaring it permanent.

### Repository Evidence

- `api/youtube-transcript.ts` — Vercel relay, upstream-status reclassification, and 30-second function configuration.
- `src/lib/ingestion/youtube-transcript-provider.ts` — fast path, retry, fallback, and cue validation.
- `src/lib/ingestion/gemini-youtube-acquisition.ts` — schema, retries, and timeout budgets.
- `vercel.json`, `youtube-transcript-provider.test.ts`, `youtube-transcript-relay.test.ts`, and `gemini-youtube-acquisition.test.ts`.

### Likely Follow-up

- Why not retry a proxy timeout repeatedly?
- How do you distinguish a broken relay from a video-specific upstream failure?

## Q17. What other ingestion reliability trade-offs did you make?

### Strong Interview Answer

I made processing state durable rather than treating an in-memory promise as a queue. Each source version has a processing attempt and ordered stage events. The coordinator runs in-process today, but it claims work in the database, heartbeats long YouTube work, detects stale attempts, and can create a bounded number of recovery versions. Reprocessing retains the previous active index until a replacement has passed count and dimension checks.

I also treat fetch safety as part of ingestion reliability and security: remote sources must be HTTPS, cannot contain credentials, resolve only to public addresses, have bounded redirects and response sizes, and report user-safe categorized failures. The trade-off is that JavaScript-only or authenticated pages are explicitly unsupported rather than scraped unreliably.

### Repository Evidence

- `src/lib/source-store.ts` — attempt claiming, stage transitions, reprocessing, and stale recovery.
- `src/lib/ingestion/coordinator.ts` and `pipeline.ts`.
- `src/lib/ingestion/safe-fetch.ts` and `errors.ts`.
- `src/lib/ingestion/coordinator.test.ts`, `reprocess.test.ts`, and `vector-integrity.test.ts`.

### Likely Follow-up

- What would change when you move from in-process dispatch to a real queue?
- Why is a failed reprocess not allowed to replace the last known-good index?

## Section 4 — Skill Intelligence + Learning Paths

## Q18. Explain Lumora’s complete résumé-to-learning-plan pipeline.

### Strong Interview Answer

The pipeline is Resume → extracted profile → normalized skills → target roles → deterministic gaps → selected learning plan. A user uploads PDF, image, or pasted text. PDFs use text extraction first; scanned, textless PDFs can render up to three pages into images for the existing vision extraction path. The OpenAI extraction call is constrained to a strict schema and instructed to transcribe rather than infer.

The resulting profile is normalized against a taxonomy. Lumora then scores the role catalog deterministically, produces evidence-backed gaps for a chosen role, and builds a staged plan with competencies, closure steps, evidence tasks, and resources. The only optional AI contribution to the plan is short narration over already-decided structured data; it cannot change the decisions or re-read résumé text.

### Repository Evidence

- `src/routes/skills.ts` and `src/routes/learning.ts`.
- `src/lib/skills/extraction-provider.ts`, `normalize.ts`, `role-matching.ts`, and `gap-analysis.ts`.
- `src/lib/learning/path-builder.ts` and `narrative-provider.ts`.
- `src/lib/skills/resume-pdf-image-fallback.ts`.

### Likely Follow-up

- Where can a model affect this pipeline, and where can it not?
- Why do you store source text only when it actually exists?

## Q19. How does Lumora extract and normalize skills without inventing a résumé?

### Strong Interview Answer

The extraction prompt explicitly tells the model to transcribe literal résumé content, not rate proficiency or infer unstated skills, projects, employers, or dates. Lumora requests strict JSON-schema output, parses it with Zod, rejects blank or invalid results, and retries once before returning a stable unreadable-resume error. It assigns identifiers server-side so downstream evidence references cannot be model-invented.

Normalization is deterministic. Taxonomy aliases map equivalent labels to a common topic, and each normalized skill receives the strongest evidence seen across the profile: `MENTIONED` for a skills list, `APPLIED` for project or experience context, and `SHIPPED` when project links or outcomes, or sustained experience, meet the coded rules. The model provides structured transcription; the evidence level is not an LLM opinion.

### Repository Evidence

- `src/lib/skills/extraction-provider.ts` and `extraction-contract.ts`.
- `src/lib/skills/normalize.ts`, `evidence.ts`, and `taxonomy.ts`.
- `src/lib/skills/extraction-provider.test.ts`, `extraction-contract.test.ts`, and `normalize.test.ts`.

### Likely Follow-up

- What happens with a résumé that says “React” but has no project evidence?
- What privacy risks remain when sending résumé content to a model provider?

## Q20. Why are multiple roles returned, and why should role-fit scores and gap severity not be generated by an LLM?

### Strong Interview Answer

Lumora scores a fixed 12-role catalog against normalized skills. Each role requirement has a weight and minimum evidence level; the score is a weighted sum of deterministic evidence credits. Results are ordered by fit, then shipped-evidence depth, then catalog order. The selector returns four to five roles and caps each role family so a user does not receive five near-identical frontend or backend labels.

Gaps are also rule-based. Technical severity comes from requirement weight multiplied by the shortfall between required and observed evidence. Separate rules identify missing project proof and missing interview signals. I chose deterministic scoring because a score and severity look like decisions; they should be reproducible, inspectable, and stable across model runs, not persuasive but arbitrary LLM output.

### Repository Evidence

- `src/lib/skills/roles.ts` — role catalog and weighted requirements.
- `src/lib/skills/role-matching.ts` — score, family cap, and tie breaks.
- `src/lib/skills/gap-analysis.ts` — technical, project-proof, and interview-prep rules.
- `src/lib/skills/role-matching.test.ts` and `gap-analysis.test.ts`.

### Likely Follow-up

- How would you calibrate the evidence credits with real hiring outcomes?
- What limitation comes from a fixed role catalog?

## Q21. How is a Learning Path generated, and where do recommendations come from?

### Strong Interview Answer

The user selects gaps already present in a role analysis; the route never trusts client-supplied gap content. Lumora prioritizes the selected gaps deterministically, caps a plan at eight steps, assigns each step to now, next, or later, and builds a competency target, concrete closure plan, evidence task, readiness report, and resource request. Resource resolution merges a curated catalog with optional Tavily discovery, validates HTTPS sources, canonicalizes URLs, deduplicates, ranks relevance, and fails closed to curated results when discovery fails.

The narration call is optional and only improves short explanatory prose through a strict schema. If it fails, deterministic fallback text is used and the plan still succeeds. Creating a Learning Workspace makes an empty linked Workspace; no recommended resource is silently ingested into the evidence system.

### Repository Evidence

- `src/lib/learning/path-builder.ts`, `priority.ts`, `closure-plan.ts`, `evidence-task.ts`, and `readiness.ts`.
- `src/lib/learning/narrative-provider.ts` and `narrative-contract.ts`.
- `src/lib/resources/resolver.ts` and `discovery.ts`.
- `src/routes/learning.ts` and `src/lib/learning/resource-bridge.test.ts`.

### Likely Follow-up

- What happens if Tavily is unavailable?
- Why is a resource recommendation not allowed to become evidence automatically?

## Section 5 — Payments + Business Infrastructure

## Q22. Explain Lumora’s Razorpay Orders flow and why it is not a subscription.

### Strong Interview Answer

Lumora uses Razorpay Orders for one-time CORE or MAX purchases, not Razorpay Subscriptions, Autopay, mandates, or proration. The server receives only a plan and optional coupon code, resolves the amount in integer paise from server configuration, creates the Razorpay order, and stores a local `CREATED` payment record.

After checkout, the verification route checks the Razorpay HMAC signature and then re-reads the payment from Razorpay. It confirms the provider payment belongs to the local order and is captured or authorized before calling the shared capture service. A captured purchase creates a 30-day `[accessFrom, accessUntil)` window. Same-plan early renewals extend from the existing expiry; concurrent higher-tier access resolves to the higher plan. Nothing renews automatically.

### Repository Evidence

- `src/routes/payments.ts` — quote, order creation, verify, and access refresh.
- `src/lib/payments/config.ts`, `access.ts`, `capture-service.ts`, and `razorpay-client.ts`.
- `prisma/schema.prisma` — `Payment`, `Coupon`, and access fields.
- `src/lib/payments/access-window.test.ts` and `capture-flow.db.test.ts`.

### Likely Follow-up

- Why permit an `authorized` payment status in verification?
- How do you handle access expiry without a subscription event?

## Q23. What could go wrong if Lumora trusted the payment amount sent by the frontend?

### Strong Interview Answer

The frontend is an untrusted client. If the server accepted an amount or currency from it, a user could alter the request and create a low-value order while asking for a high-tier plan, or apply a discount the server never approved. It would break revenue integrity and could lead to entitlement being granted for an underpayment.

Lumora prevents that by taking only the plan and coupon code from the request. The server calculates the launch price, validates coupon eligibility and redemption limits, clamps discounts above Razorpay’s minimum order amount, creates the order with that amount, and persists the same amount locally. The quote endpoint is only preview UX; order creation independently validates again.

### Repository Evidence

- `src/routes/payments.ts` — comments and implementation of `POST /quote` and `POST /order`.
- `src/lib/payments/config.ts` — integer-paise plan prices.
- `src/lib/payments/coupon.ts` and `coupon-store.ts`.
- `src/routes/payments-route-contract.test.ts` and `src/lib/payments/coupon.test.ts`.

### Likely Follow-up

- Can a coupon race still exceed its global redemption limit?
- Why retain a separate local payment row if Razorpay has an order record?

## Q24. How do webhook signatures, provider re-verification, and idempotency protect the payment path?

### Strong Interview Answer

There are two trust paths. The client callback verifies an HMAC derived from order ID and payment ID, then re-fetches the payment from Razorpay; a signature alone is not enough to grant access. The webhook path verifies an HMAC over the exact raw request bytes before parsing JSON. That is why the Express webhook route is mounted with `express.raw()` before `express.json()`.

Both paths call the same capture service. It performs a compare-and-swap transition from `CREATED` to `CAPTURED`, so a webhook and browser verification racing each other cannot double-grant access or double-credit a coupon. Webhook event IDs are unique in a durable ledger, so redelivery becomes a no-op. Entitlement is re-derived from all captured payments under the same per-user advisory lock used by usage reservations, rather than being incremented by whichever event arrives.

### Repository Evidence

- `server.ts` and `src/routes/payments-webhook.ts`.
- `src/lib/payments/signature.ts`, `webhook-handler.ts`, `webhook-store.ts`, and `capture-service.ts`.
- `src/lib/payments/entitlement-sync.ts`.
- `src/lib/payments/signature.test.ts`, `webhook-handler.test.ts`, and `capture-flow.db.test.ts`.

### Likely Follow-up

- Why return 200 for a verified webhook whose processing later failed?
- What recovery path handles a lost webhook or browser callback?

## Section 6 — Usage Limits / Cost Control

## Q25. How do Lumora’s rolling limits and reserve → commit/discard lifecycle control AI cost?

### Strong Interview Answer

Lumora meters five expensive action types: ingestion, chat, AI Actions, Skill Intelligence, and Learning Paths. Limits differ by FREE, CORE, and MAX, and apply in a rolling 12-hour window rather than resetting at midnight. That avoids a burst just before and after a calendar reset and gives users a more predictable capacity rule.

Before work begins, Lumora creates a `PENDING` usage reservation. Successful work commits it, optionally retaining provider, model, token, and repository-estimated cost metadata. Failed or intentionally abandoned work discards it. Pending reservations expire after five minutes, so a crashed request cannot block a user forever. These are action caps, not token-priced customer billing, but they bound exposure to generation, embedding, and model-assisted workflows.

### Repository Evidence

- `src/lib/usage/config.ts` — window, reservation timeout, action types, and plan limits.
- `src/lib/usage/service.ts` — calculation, reserve, commit, discard, and telemetry.
- `src/routes/workspaces.ts`, `src/routes/skills.ts`, and `src/routes/learning.ts` — metering at work boundaries.
- `src/lib/usage/usage-window.test.ts` and `api-routing.test.ts`.

### Likely Follow-up

- Why use action units instead of enforcing an exact token budget?
- When should a chat be committed after a client transport disconnects?

## Q26. How would you prevent a user from bypassing usage limits with simultaneous requests?

### Strong Interview Answer

I would serialize the decision at the database boundary, not rely on an in-memory counter. Lumora’s `checkAndReserve` opens a transaction, obtains `pg_advisory_xact_lock(hashtext(userId))`, removes stale reservations, counts committed and live pending events for that user and action, and only then inserts a new `PENDING` row. The lock means two simultaneous requests for the same user cannot both observe the last available unit and reserve it.

That is stronger than client-side disabling because clients can open parallel tabs, replay requests, or call the API directly. The plan-entitlement sync uses the same per-user lock, which prevents a payment-driven plan change from interleaving with a limit check. Database-gated tests cover the locking behavior when an explicit live database configuration is available; those tests are not proof of production load behavior.

### Repository Evidence

- `src/lib/usage/service.ts` — `checkAndReserve` and `pg_advisory_xact_lock`.
- `src/lib/payments/entitlement-sync.ts` — shared lock for plan updates.
- `src/lib/usage/usage-service.db.test.ts`.
- `docs/VALIDATION.md` — marks database/live validation separately.

### Likely Follow-up

- What happens if the process crashes after reserving but before committing?
- How would this design change for a globally distributed database?

## Section 7 — Deployment / Testing / Engineering

## Q27. Why is Lumora deployed as Vercel + Render + Neon + Clerk, and what are the boundary trade-offs?

### Strong Interview Answer

Lumora is one TypeScript repository with a React/Vite SPA and an Express API. In local development, Express hosts Vite middleware in one process. In production, the SPA and the protected transcript relay are on Vercel; Vercel rewrites ordinary `/api` traffic to the Render Express service; Neon PostgreSQL with pgvector holds application and vector data; Clerk handles identity.

That split keeps the standard Express runtime available for SSE, ingestion recovery, Prisma, and payment webhooks while Vercel serves the frontend and the dedicated relay. The trade-off is that local and production routing are not identical. The Razorpay webhook intentionally points to Render directly because an extra rewrite hop could alter raw bytes needed for signature verification. `/api/health` checks both PostgreSQL and pgvector readiness. The repository does not prove live deployment behavior merely because these configurations exist.

### Repository Evidence

- `server.ts` — startup order, API mount, health check, Vite/dev and static/prod behavior.
- `vercel.json` — transcript function and Render rewrite.
- `api/youtube-transcript.ts` — Vercel relay.
- `.env.example`, `src/lib/env.ts`, `README.md`, and `docs/ARCHITECTURE.md`.

### Likely Follow-up

- How do pooled and direct Neon URLs serve different Prisma needs?
- What deployment issue would not reproduce locally?

## Q28. What is Lumora’s testing strategy, and what does it prove?

### Strong Interview Answer

Lumora uses Node’s built-in test runner through `tsx --test`, with tests colocated beside the modules they protect. The test strategy focuses on invariants: input safety, ingestion transitions, vector integrity, retrieval isolation, grounding routes, citation provenance, stream lifecycle, usage reservations, payment signatures and idempotency, role and learning decisions, plus UI and route contracts.

The repository does not use React Testing Library or jsdom. Some component and route behavior is guarded by source-level contract tests that assert a handler is wired correctly or a prohibited import is absent. The README records a historical validation snapshot of 776 tests, 759 passing, and 17 database-gated skips; I would call that a documented snapshot, not claim it as a timeless count. A clean typecheck is also not a full guarantee because `tsconfig.json` does not enable `strict`.

### Repository Evidence

- `package.json` — 12 chained test suites and validation scripts.
- `README.md` — documented test snapshot and suite breakdown.
- `CLAUDE.md` — test-runner, flaky heartbeat-test, and component-contract caveats.
- Representative tests: `rag-service.test.ts`, `grounding-router.test.ts`, `vector-integrity.test.ts`, `webhook-handler.test.ts`, and `path-builder.test.ts`.

### Likely Follow-up

- Why use source-level contract tests instead of a browser-like component test stack?
- Which important failures can unit tests not prove?

## Q29. What are the most important production risks or limitations you would state honestly?

### Strong Interview Answer

The important distinction is implemented versus live-verified. Provider behavior is external: OpenAI, Gemini, Tavily, YouTube availability, Clerk sessions, Render cold starts, pgvector connectivity, and Vercel-to-Render relay behavior can fail in ways mocks cannot prove. The repository has retries, timeouts, safe failure messages, test fixtures, and health checks, but not a stored production load test or comprehensive live E2E record for every path.

I would also call out architectural limits: ingestion runs in the Express process rather than a durable queue worker; the access-expiry middleware uses an unbounded in-process per-user cache for hackathon-scale traffic; vector dimensions are fixed at 1,536; and cost telemetry uses repository constants that are not a current provider invoice. These are conscious starting points, not claims of internet-scale completion.

### Repository Evidence

- `docs/VALIDATION.md` — explicitly distinguishes live-unverified areas.
- `src/lib/ingestion/coordinator.ts` and `pipeline.ts` — in-process dispatch and recovery.
- `src/lib/payments/expire-stale-access.ts` — in-process expiry cache.
- `src/lib/usage/config.ts` and `docs/ARCHITECTURE.md` — configured cost-estimation constants.

### Likely Follow-up

- Which risk would you instrument first after launch?
- What operational SLOs would you define for grounded chat and ingestion?

## Section 8 — Final System-Design Question

## Q30. If Lumora grew from a handful of users to 100,000 active users, what would break first and how would you redesign it?

### Strong Interview Answer

The first pressure points would be the externally bounded and currently in-process parts of the system: OpenAI and Gemini rate limits, YouTube availability, and ingestion work dispatched inside the Render API process. I would not claim the database is already the first bottleneck without load data, but vector retrieval, embedding batches, serializable index promotion, and connection management would need measurement as traffic rises. The current code provides useful seams: durable source attempts, stages, versions, usage rows, and structured logs already exist.

I would move ingestion to a durable queue with independently scalable workers, retries and dead-letter handling, while keeping database compare-and-swap as the ownership authority. I would add provider-aware rate limiting, backpressure, concurrency controls, caching for repeat retrieval and resource discovery where correctness allows it, and connection-pool monitoring for Neon. For chat, I would horizontally scale stateless API workers, preserve SSE through appropriate load-balancer settings, stream provider output, and add tracing across retrieval, tool calls, generation, citation validation, and persistence. For vectors, I would benchmark HNSW query latency, partition or index by Workspace characteristics if needed, and introduce caching only after measuring access patterns.

Cost control would remain central: preserve atomic reservations, add per-provider budgets and queue admission controls, and alert on token and failed-ingestion anomalies. I would add dashboards, structured error classification, queue depth, source-ready rate, citation-validation failures, fallback rate, provider latency, and recovery outcomes. The goal is not merely more servers; it is resilient recovery with evidence integrity still intact.

### Repository Evidence

- `src/lib/ingestion/coordinator.ts`, `pipeline.ts`, and `source-store.ts` — current in-process dispatch with durable state and recovery.
- `src/lib/retrieval/rag-service.ts`, `chunk-store.ts`, and pgvector migration — current vector design.
- `src/lib/chat/openai-provider.ts` and `ai/orchestrator.ts` — streaming, retries, timeouts, and tool rounds.
- `src/lib/usage/service.ts` and `src/lib/ingestion/errors.ts` — cost events and failure classification.
- `docs/VALIDATION.md` and `docs/ARCHITECTURE.md` — explicit lack of production-scale verification.

### Likely Follow-up

- What data would tell you whether to scale vectors, ingestion, or model capacity first?
- Which integrity guarantees must survive the queue and horizontal-scaling redesign?
