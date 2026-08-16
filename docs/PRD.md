# Lumora Product Requirements

> Documentation snapshot — repository inspected 2026-08-16 at commit `07192bd`; statuses reflect current code/tests.

## Vision and problem

Lumora is a personal AI learning and knowledge **Workspace** where someone can ingest material, ask questions, review evidence, and retain the conversation. Learning material is usually fragmented across PDFs, websites, notes, and video. Generic chat can respond plausibly without showing whether the user’s sources support it.

## Target users and Jobs To Be Done

| User | Job To Be Done |
|---|---|
| Learner | Turn course material into an explorable, attributable study base |
| Builder/researcher | Consolidate technical references before deciding or implementing |
| Career switcher | Find credible learning resources and project-proof directions |

## Goals and pillars

1. **IMPLEMENTED — Workspace knowledge:** preserve a user’s sources, conversation, and source lifecycle in one owner-isolated Workspace.
2. **IMPLEMENTED — Evidence-aware AI:** make the distinction between General and Grounded responses explicit and cite grounded material.
3. **IMPLEMENTED — Learning-resource intelligence:** match recommendations to learning intent while retaining uncertainty about external catalog data.
4. **IMPLEMENTED — Sustainable operations:** reserve/commit bounded Usage before expensive work.

## Core journey

Authenticate with Clerk, create/open a Workspace, add PDF/website/text/YouTube/VTT material, observe processing, then ask a question. Sufficient Workspace evidence produces a Grounded answer and citations. An ordinary unsupported question can receive a clearly labeled General answer; a no-source Workspace question receives an explicit no-source response.

## Product behavior

### Workspace, sources, and provenance

**IMPLEMENTED:** each Workspace belongs to one user. Ingestion persists original/clean content, parser metadata, processing attempts, chunks, and a versioned source index. A replacement index becomes active only after validation; a failed reprocess preserves the previous valid index. Citation records retain message, chunk, source, index, snippet, score, URL, page/timestamp, and text origin for Context and history.

### General/Grounded AI and Actions

**IMPLEMENTED:** General and Grounded response modes; Concise, Detailed, Critical, and Creative answer modes; and built-in AI Actions. Grounded routing requires context and evidence sufficiency, except explicit Workspace-meta and Action behavior. The product does not present partial topic evidence as complete Workspace grounding.

### Learning-resource intelligence

**IMPLEMENTED:** normalize a request into topic, use case, language, platform, and free/paid preference; merge curated resources with optional Tavily discovery; validate HTTPS URLs; canonicalize/deduplicate; rank relevance and provider diversity. Discovery failure falls back to the catalog. It is not a marketplace and does not claim live external price or availability.

### Usage and plans

**IMPLEMENTED:** Chat, Ingestion, and AI Action are metered in a rolling 12-hour window. A pending reservation precedes work; successful work commits, failed/aborted work can discard, and stale reservations expire after five minutes.

| Plan | Chat | Ingestion | AI Action |
|---|---:|---:|---:|
| Free | 10 | 4 | 8 |
| Core | 40 | 15 | 25 |
| Max | 150 | 50 | 80 |

Customer pricing, checkout, and subscriptions are **PLANNED**; the only plan-change path is environment-gated for demo use.

## UX, constraints, and non-goals

**IMPLEMENTED:** responsive web UI, keyboard-accessible controls, status/empty states, safe remote fetch/upload validation, Workspace ownership enforcement, bounded streaming, and explicit failure states.

**PLANNED:** native mobile application; payments; feedback collection; Skill Intelligence; Learning Workspace; shared Workspaces; OCR/image ingestion; voice; quizzes; flashcards; and study planning.

## Success metrics and future status

No production product metrics are stored in the repository. Future measurement should include source-ready rate, grounded-citation rate, insufficient-evidence rate, retrieval/stream latency, successful completion, retention, and provider cost per active user. Event-level token/cost telemetry exists today; aggregate customer/admin cost analytics are **PLANNED**. See [PITCH.md](PITCH.md) for scenario—not forecast—economics.
