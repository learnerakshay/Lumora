# Lumora Pitch and PPT Data Pack

> Documentation snapshot — repository inspected 2026-08-16 at commit `07192bd`; financial figures below are explicitly labeled planning assumptions or scenarios.

## Hook

**The hard part of learning from many sources is not finding another chat box. It is knowing which answer came from your material—and whether the material really supports it.**

## Problem, insight, and solution

Learning workflows fracture across tabs, PDFs, notes, and video. Existing chat/RAG tools can retrieve a relevant fragment yet present an answer as if the full question were supported. Lumora creates an AI learning and knowledge **Workspace**: ingest material, ask naturally, distinguish Grounded from General AI, inspect Context/citations, then discover the next resource.

## Why Lumora is different

- **IMPLEMENTED:** versioned source ingestion with validated active vector indexes.
- **IMPLEMENTED:** Workspace-scoped retrieval and a deterministic topic-coverage gate before Grounded status.
- **IMPLEMENTED:** persistent citation provenance and Context—not transient prompt snippets.
- **IMPLEMENTED:** curated/discovered resource intelligence with canonical dedupe and intent constraints.
- **IMPLEMENTED:** reservation/commit Usage controls and backend event-level model telemetry.

## Core demo story

1. Open a Workspace and add a PDF, website, text, YouTube, or VTT source.
2. Show the source lifecycle becoming ready.
3. Ask a supported question; open citations and Context for the evidence.
4. Ask a partially covered question; explain the General fallback rather than pretending grounding.
5. Ask for a free Docker resource or project-proof idea; show intent-aware recommendations.
6. Show the Usage drawer and explain rolling capacity.

## Engineering depth and product practicality

The system couples source isolation, parser safety, versioned pgvector indexes, retrieval integrity checks, deterministic evidence coverage, SSE/recovery lifecycle, citation consistency, optional tool/search attribution, resource normalization, and transactionally reserved action limits. It is practical for a solo learner/researcher now; responsive web UI is **IMPLEMENTED**. Native mobile, payments, feedback, Skill Intelligence, Learning Workspace, and collaboration are **PLANNED**.

## Business model and pricing rationale

**IMPLEMENTED:** Free/Core/Max Usage tiers: 10/4/8, 40/15/25, and 150/50/80 chat/ingestion/AI Action units per rolling 12 hours. Customer pricing, checkout, and subscription billing are **PLANNED**.

Value (persistent, attributable Workspace knowledge) drives willingness to pay; embeddings, chat/actions, and occasional search drive cost; action limits bound cost exposure. The following model is a transparent owner-adjustable **SCENARIO**, not a forecast or actual commercial result.

### Configured cost-estimation constants

**IMPLEMENTED:** repository constants are `gpt-5.6-sol` `$5/$30`, `gpt-5.6-terra` `$2.5/$15`, `gpt-5.6-luna` `$1/$6` input/output per million tokens, and `text-embedding-3-small` `$0.02` input per million. They are **CONFIGURED COST-ESTIMATION CONSTANTS IN THE REPOSITORY**, not guarantees of current provider pricing; update them when provider terms change.

### Usage-driven unit economics

**CALCULATED ESTIMATE:** monthly variable AI cost = `(chat actions × average chat cost) + (ingestions × average ingestion cost) + (AI Actions × average action cost) + search/tool costs`.

**ASSUMPTIONS:** the scenario uses a 100% `gpt-5.6-terra` chat/action model mix; a Terra chat = 2,000 input + 600 output tokens = `$0.014`; a search occurs for 15% of chats at `$0.005`, so average chat cost is `$0.01475`. AI Action averages `$0.020` including optional tools. Search/tool usage and model mix are owner-adjustable.

| Source size | Embedding tokens | Embedding cost | Parsing/storage allocation | Total estimated cost |
|---|---:|---:|---:|---:|
| Small | 5,000 | $0.0001 | $0.0030 | $0.0031 |
| Medium | 30,000 | $0.0006 | $0.0100 | $0.0106 |
| Large | 150,000 | $0.0030 | $0.0300 | $0.0330 |

All source rows are **ASSUMPTION + CALCULATED ESTIMATE**. Lumora does not sell documents individually. Cost coverage is assessed against a plan’s monthly revenue and expected plan capacity; any “markup” is only an illustrative planning metric, not billing.

### Two-year usage-driven scenarios

**SCENARIO assumptions:** Core `$12/month`, Max `$30/month`; plan mix and MAU are owner-selected; average monthly actions per active user are Free 8 chats/1 ingestion/2 actions, Core 24/4/10, Max 70/10/28; fixed hosting/database/auth/storage = `$250/month` Year 1 and `$450/month` Year 2; payment processing = 3% of paid revenue. Variable AI uses the unit costs above.

| Scenario/year | MAU; Free/Core/Max | Paid users | MRR | Annual revenue | Variable AI | Infra + payment | Gross profit / margin |
|---|---|---:|---:|---:|---:|---:|---:|
| Conservative Y1 | 120; 90/8/2% | 12 | $187 | $2,246 | $336 | $3,067 | -$1,157 / -52% |
| Conservative Y2 | 240; 90/8/2% | 24 | $374 | $4,493 | $672 | $5,535 | -$1,714 / -38% |
| Base Y1 | 300; 85/12/3% | 45 | $702 | $8,424 | $957 | $3,253 | $4,214 / 50% |
| Base Y2 | 800; 82/14/4% | 144 | $2,304 | $27,648 | $2,778 | $6,229 | $18,641 / 67% |
| Strong-growth Y1 | 600; 80/16/4% | 120 | $1,872 | $22,464 | $2,147 | $3,674 | $16,643 / 74% |
| Strong-growth Y2 | 1,800; 78/17/5% | 396 | $6,372 | $76,464 | $6,865 | $7,694 | $61,905 / 81% |

**CALCULATED ESTIMATE:** total monthly cost = variable AI + fixed infrastructure + payment fees; gross margin = `(revenue − total cost) / revenue`. The table excludes unverified invoices and support/labor. Real UsageEvent telemetry can later support aggregate cost analytics, pricing revision, and gross-margin evaluation; customer lifetime token dashboards and admin finance dashboards are **PLANNED**.

## Risks and defensible answers

External model/search/video availability and transcript quality are **IMPLEMENTED / LIVE UNVERIFIED** operational risks; the transcript fast path falls back to Gemini-native acquisition, while search discovery falls back to curated results. Production scale/load limits and live E2E outcomes remain **IMPLEMENTED / LIVE UNVERIFIED**.

1. **How is this more than RAG?** It verifies Workspace/index integrity and requested-topic coverage before using Grounded status, then preserves citations historically.
2. **How do you control cost?** Atomic reservations, rolling action limits, and provider/model/token/cost telemetry; it is not token-priced billing.
3. **Why recommendations here?** The user’s next step follows comprehension; intent-aware resources make the Workspace action-oriented.
4. **Can it ingest any YouTube video?** No. It validates fast-path cues, then tries Gemini fallback; unavailable/no-speech/provider outcomes are surfaced.
5. **What is next?** Validate real usage/cost, then add billing/feedback before broader collaboration and learning artifacts.

## PPT Data Pack

**Strongest claims:** grounded answers earn evidence; Workspace isolation is enforced through storage/retrieval; citation provenance survives conversation history; resource intelligence is separate from answer evidence; ingestion uses versioned active indexes; Usage has atomic rolling limits; responsive web is ready for a live demo.

**Key engineering metrics:** five source types; 1,536-dimensional vectors; 1,200-character chunks with 200 overlap; 3,500-token context budget; four tool rounds; 12-hour Usage window; five-minute stale reservation expiry.

**Strongest validation:** focused automated tests cover ingestion, retrieval, citations, lifecycle/recovery, tools, resources, Usage, and UI helpers. Live production verification is intentionally not claimed.

**Recommended 10-slide story:** problem; insight; Lumora solution; demo journey; evidence/Context; resource intelligence; architecture; reliability/validation; usage-driven business model; roadmap/closing.

**Screenshots:** `assets/screenshots/01-landing-page-animation.png`, `assets/screenshots/03-authentication-page.png`, `assets/screenshots/04-dashboardUI.png`, `assets/screenshots/05-workspaceUI.png`; capture live processing, Context, Usage drawer, and resource cards. Reuse system, ingestion/RAG, resource, and Usage diagrams from [ARCHITECTURE.md](ARCHITECTURE.md).

**Closing:** **Lumora makes an AI learning Workspace useful not by adding more chat, but by making knowledge, evidence, next-step guidance, and cost-aware operations work together.**
