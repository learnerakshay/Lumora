# Lumora Screenshot Capture Guide

This directory holds the ten images referenced by the root [`README.md`](../../README.md). The PNG files are **not** committed yet — capture them with this runbook, using the exact filenames below. Every image link in the root README will render as broken until the matching file lands here.

Do not invent, mock, or generate these images. Every one is a capture of the real running application.

---

## Global capture rules

Apply to **all ten** screenshots:

- **Browser:** Chromium or Chrome.
- **Zoom:** 100%. Device scale factor `1` where controllable (use DevTools device toolbar to set an exact viewport, then close DevTools before capturing).
- **Chrome UI:** bookmarks bar hidden; no extensions overlay; no DevTools visible in the final image.
- **Theme:** Lumora's dark "Deep Space" theme throughout. Keep it identical across all ten — a single light-mode capture in the set looks like a mistake.
- **Data:** production or purpose-built demo data only. Real, credible content — no `test test test` sources, no `asdf` Workspace names.
- **Privacy:** no personal email address, no postal address, no payment-instrument details, no real card or UPI identifiers, no Clerk user id, no API key or token anywhere on screen (including in a visible URL).
- **State hygiene:** no console error overlays, no red error banners, no failed-to-load images, no empty states where content is the point, no browser password/save prompts, no cookie or consent dialogs.
- **Cursor:** move the pointer away from text you want read — *unless* the hover state is the point of the shot (#06 in particular).
- **Output:** sharp PNG at the stated viewport. Do not upscale a smaller capture.

Filenames are load-bearing. The root README links to these exact paths; renaming one breaks the document.

---

## Screenshot #01 — Deep Space Hero

- **Filename:** `01-hero-deepspace.png`
- **Viewport:** 1440 × 900
- **Route:** `/` — scrolled to the very top

Verify before capturing:

- [ ] Lumora wordmark visible in the floating island navbar
- [ ] Hero headline fully visible, not clipped by the fold
- [ ] The Three.js knowledge-core canvas is fully inside the viewport and mid-animation (not a blank frame during load)
- [ ] The one-click preset query chips are visible below the headline
- [ ] Optionally, one chip activated so its scripted preview panel is showing
- [ ] No animated element clipped at an edge; no banner obstruction

This is the opening image of the README. Give it more attempts than the others.

---

## Screenshot #02 — Spotlight Launcher

- **Filename:** `02-spotlight-launcher.png`
- **Viewport:** 1440 × 900
- **Route:** `/` (or any route rendering the navbar) — press `⌘K` / `Ctrl+K`

Verify:

- [ ] The command palette is open and visually centered
- [ ] The search input is focused (caret visible)
- [ ] All four real actions are listed — Test RAG Grounding, Career Competency Radar, Inspect Architecture, Compare Plans — each with its hint text readable
- [ ] The `⌘K` / `Ctrl+K` affordance is visible if the UI renders one
- [ ] Blurred background still reads as Lumora, not as an anonymous dark rectangle
- [ ] The list is not filtered down to a single lonely result

---

## Screenshot #03 — Grounding Inspector

- **Filename:** `03-grounding-inspector.png`
- **Viewport:** 1440 × 900
- **Route:** `/#grounding` — the Evidence & Trust section

Verify:

- [ ] Both sides of the comparison are visible: the GROUNDED (evidence covers it) state and the GENERAL (evidence doesn't) state
- [ ] The `Question → Claim → Evidence → Verdict` step rail is visible with a step active
- [ ] The evidence-to-citation relationship is legible, not cropped
- [ ] Body text is readable at README width
- [ ] Pause the self-playing sequence if the UI allows, so the frame is not caught mid-transition

Accuracy note: this section is a **self-playing explanatory demo** of the real GROUNDED/GENERAL routing rule. It is not a live hallucination detector. Do not stage or caption it as one.

---

## Screenshot #04 — Multi-Source Ingestion

- **Filename:** `04-multimodal-ingestion.png`
- **Viewport:** 1440 × 900
- **Preferred route:** `/workspaces/:workspaceId` — a Workspace containing a real ingested YouTube source

Verify:

- [ ] The YouTube source title is visible and real
- [ ] Its processing state is intentional and legible (a clean `COMPLETED`, or a genuine in-progress state — not a stale spinner)
- [ ] YouTube provenance is visible (source type icon / badge)
- [ ] Timestamps visible where the UI surfaces them
- [ ] At least one other source type visible in the sidebar, to show the pipeline is multi-format
- [ ] No broken thumbnail, no failed-source row

Fallback if no suitable Workspace exists: capture `/` → *How Lumora Works* → expand the **YouTube Videos → Preview** row. Be aware the waveform bars in that landing preview are a fixed illustrative treatment, not a rendering of real audio — do not describe it as analysis output.

---

## Screenshot #05 — Three-Pane Workspace

- **Filename:** `05-workspace-3pane-ide.png`
- **Viewport:** 1440 × 900
- **Route:** `/workspaces/:workspaceId`

Verify:

- [ ] Sources pane visible with ≥ 2 ready sources
- [ ] Chat pane visible with real conversation history
- [ ] Context inspector pane visible and populated
- [ ] Workspace title visible in the header
- [ ] At least one grounded answer with inline `[N]` citation markers on screen
- [ ] No pane accidentally collapsed to its rail; column widths look balanced

This is the canonical product screenshot. It should be the most polished of the ten after #01.

---

## Screenshot #06 — Bi-Directional Citations

- **Filename:** `06-bidirectional-citations.png`
- **Viewport:** 1440 × 900
- **Route:** `/workspaces/:workspaceId` — click an inline `[1]` marker so both sides activate

Verify:

- [ ] An inline citation marker is in its active/selected state
- [ ] The corresponding evidence card in the Context pane is simultaneously highlighted
- [ ] The citation number and its source reference are both readable
- [ ] Source provenance is visible — page number for a PDF, timestamp for a YouTube source
- [ ] The active state does not cover the answer text it belongs to

This is the one shot where the cursor may remain over the target, since the interaction is the subject.

---

## Screenshot #07 — Active Generation Pipeline

- **Filename:** `07-active-rag-loading.png`
- **Viewport:** 1440 × 900
- **Route:** `/workspaces/:workspaceId` — captured during a real in-flight query

Verify:

- [ ] The generating state is genuinely active (pulsing indicator, skeleton bars)
- [ ] The contextual status line is readable
- [ ] The real elapsed timer is visible and showing a non-zero value
- [ ] Skeleton placeholders are crisp, not mid-fade
- [ ] The response-mode disclosure badge and/or a tool-status chip is visible if the stream has emitted one
- [ ] The final answer has **not** already replaced this state
- [ ] No error or fallback state captured by accident

This state is short-lived. Trigger a real query against a Workspace with several sources and capture deliberately — a query that invokes web search buys extra seconds and adds the tool-status chip. Only capture states the UI genuinely renders; do not stage a fabricated multi-stage pipeline.

---

## Screenshot #08 — Career Competency Radar

- **Filename:** `08-career-competency-radar.png`
- **Viewport:** 1440 × 900
- **Route:** `/#career-intelligence`

Verify:

- [ ] The six-axis SVG radar is fully visible and not clipped
- [ ] All six axis labels are readable (System Design, RAG Pipelines, TypeScript, Vector DBs, Cloud Architecture, API Security)
- [ ] A target role is selected and its title visible; the benchmark polygon has settled after the GSAP morph
- [ ] The `strong` / `developing` / `missing` band pills are visible
- [ ] The three-stage sprint roadmap below the radar is visible
- [ ] No tooltip covering the center of the chart unless the tooltip is the point

Accuracy note: this landing radar demonstrates the model using fixed, hand-set benchmark numbers. The real, résumé-driven analysis — deterministic fit scores and `LOW`/`MEDIUM`/`HIGH` gap severities — renders on the authenticated `/skills` page. If you want a second career capture showing real data, use `/skills`, but keep **this** filename for the radar.

---

## Screenshot #09 — Resource Discovery

- **Filename:** `09-resource-discovery-grid.png`
- **Viewport:** 1440 × 900
- **Route:** `/workspaces/:workspaceId` (an answer that returned recommendations) or a `/learning/:planId` step card

Verify:

- [ ] At least three recommendation cards visible in the grid
- [ ] A ChaiCode / Cohort result visible
- [ ] A Udemy result visible
- [ ] A YouTube result visible
- [ ] Platform badges and icons rendering correctly for each
- [ ] Resource titles, creator, and provider text readable
- [ ] Access type and delivery mode metadata visible
- [ ] No broken external thumbnail, no card in an error state

---

## Screenshot #10 — Pricing

- **Filename:** `10-pricing-architecture.png`
- **Viewport:** 1440 × 1000 width; **full-page capture** (see note)
- **Route:** `/pricing`, with the plan comparison and production footer visible

Verify:

- [ ] FREE / CORE / MAX cards all visible
- [ ] CORE's recommended-tier treatment visible (raised card, gradient border, "Recommended" tag)
- [ ] Prices and the one-time / 30-day access language accurate and readable
- [ ] The real quota differences are visible in the comparison table
- [ ] The footer retains Product, Company, Legal, and Contact navigation
- [ ] No engineering diagnostics or backend health link appears in the public footer
- [ ] No test-payment credentials, no coupon codes you don't want public, no personal billing information

**Viewport note — read before capturing.** On `/pricing` the real page order is: pricing cards → comparison table → FAQ accordion → footer (which is where the architecture drawer and the health beacon live). Those two subjects are separated by roughly a full page of content, so **no single 1440 × 1000 viewport contains both.** Rather than fabricating a composite layout that does not exist, capture this one as a **full-page screenshot at 1440 CSS px width** with the drawer already expanded, so pricing and architecture appear in one continuous, truthful image. If a full-page capture is unavailable, collapse the FAQ accordion items first to shorten the page, then take the tallest single capture your tool allows — and prioritize the pricing cards plus the expanded drawer over the FAQ.

---

## Final Verification

- [ ] All 10 PNG files use the exact required filenames
- [ ] All screenshots match the documented feature state
- [ ] No secrets or private account information are visible
- [ ] No broken assets are visible
- [ ] No debug/dev overlays are visible
- [ ] Text is readable at normal GitHub README width
- [ ] Screenshots use a consistent theme and capture style
- [ ] Root README image links resolve correctly
- [ ] Every screenshot number matches its filename
- [ ] Screenshot claims match current repository behavior

---

Legacy captures from an earlier documentation pass remain in [`assets/screenshots/`](../../assets/screenshots) and are no longer referenced by the root README.
