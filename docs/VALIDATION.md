# Lumora Validation Evidence

> Documentation snapshot — repository inspected 2026-08-16 at commit `07192bd`; no live-provider or production outcome is inferred from code alone.

## A. Automated validation

| Area | Expected behavior | Evidence | Status |
|---|---|---|---|
| General/no-source | Ordinary no-source questions use General routing; Workspace-meta questions are explicit | grounding router + route-contract tests | VALIDATED |
| Grounded/citations | Sufficient evidence grounds; missing coverage does not; citations retain provenance | grounding-router, rag-service, citation tests | VALIDATED |
| Streaming/recovery | lifecycle, history, stop/recovery, and one reservation boundary | conversation/generation lifecycle + route-contract tests | VALIDATED |
| Source isolation | active READY compatible chunks from the owned Workspace only | rag-service + vector-integrity tests | VALIDATED |
| Ingestion | parsing, recovery/reprocess, embeddings, index promotion, URL safety | ingestion test suite | VALIDATED |
| YouTube acquisition | URL/provider/relay validation and Gemini fallback paths | YouTube acquisition/provider/relay tests | VALIDATED |
| Resource intent | intent gating, JS YouTube recommendations, Udemy canonical dedupe/access metadata, project-proof, free-only Docker | normalization/resolver/phase tests | VALIDATED |
| Usage | rolling limits, one CHAT event route boundary, centralized cost estimation | usage-window, API-routing, route-contract tests | VALIDATED |
| Usage database | locks, isolation, token/cost persistence when DB test config is available | usage-service.db test | IMPLEMENTED / LIVE UNVERIFIED |
| Responsive Workspace | responsive UI/component behavior | component tests; no device matrix | IMPLEMENTED / LIVE UNVERIFIED |

Repository commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run prisma:validate`, `npm run build`.

## B. Manual production validation

No stored production test record was found. The following are **IMPLEMENTED / LIVE UNVERIFIED** owner checks:

- General/no-source response; grounded answer with citations; insufficient-evidence fallback.
- Resource intent gating; JavaScript YouTube recommendation; Udemy canonical dedupe/access metadata; project-proof recommendation; free-only Docker request.
- Workspace Usage drawer; responsive Workspace across target devices; one CHAT Usage event per completed request.
- SSE streaming, tab/transport recovery, Stop behavior, source isolation across two authenticated users.
- PDF/website/text/YouTube/VTT ingestion with real credentials and a deployed pgvector database.

## Known external/live risks

**IMPLEMENTED / LIVE UNVERIFIED:** Tavily availability, OpenAI/Gemini quotas and provider output, YouTube transcript/video availability, Vercel-to-Render relay configuration, Clerk configuration, and deployed Neon/pgvector connectivity. Payments, feedback, Skill Intelligence, Learning Workspace, and native mobile are **PLANNED**.
