# Lumora UI Bible

**Version:** 1.0  
**Status:** LOCKED  
**Applies to:** Entire Lumora product

## Mission

Lumora is a flagship AI SaaS application built correctly, not quickly. Every design decision must support a polished, memorable, premium, and trustworthy product. Optimize for product quality, never merely task completion.

## Product philosophy

Lumora is **not** a chatbot, admin dashboard, CRUD application, or NotebookLM clone. It is an AI Research & Learning Workspace that helps people collect, organize, connect, understand, remember, and learn from knowledge.

The interface should make users feel: **“I am in complete control of my knowledge.”**

## Design philosophy

### Theme

**Aurora Observatory** — knowledge is represented as light. The product should feel like a calm digital observatory where scattered information becomes structured understanding.

Design for confidence, clarity, and elegance—not excitement.

### Quality references

Aim for the quality bar of Apple, Linear, Arc Browser, Raycast, and Vercel. Never resemble Bootstrap, Material dashboard templates, generic SaaS templates, gaming/RGB interfaces, AI-generated landing pages, or student portfolio projects.

### Brand identity

Lumora means **Illuminate Knowledge.** The visual progression is:

```text
Knowledge → Understanding → Mastery
```

Never center the product around:

```text
Prompt → AI → Response
```

Learning is more important than chatting.

## Locked brand assets

Do not redesign the Lumora logo, startup animation, Aurora identity, approved typography direction, or color palette unless explicitly instructed.

## Locked color system

| Token      | Value                    |
| ---------- | ------------------------ |
| Background | `#09090B`                |
| Surface    | `#12131A`                |
| Primary    | `#7C5CFF`                |
| Secondary  | `#5FD3FF`                |
| Glow       | `#B8F5FF`                |
| Border     | `rgba(255,255,255,0.08)` |

Do not introduce additional accent colors. Avoid excessive gradients and use color with restraint.

## Typography and spacing

Typography creates hierarchy through size, spacing, and weight—not excessive color. Headlines are editorial; body copy is quiet. Whitespace should do more work than borders.

Prefer generous spacing. Avoid crowded layouts, unnecessary separators, and excessive cards.

## Motion

Motion communicates understanding; it never exists only for decoration.

- **GSAP:** page timelines and cinematic transitions.
- **Framer Motion:** hover, reveal, interaction, and small transitions.

Motion must be calm, slow, intentional, premium, and never flashy.

## Landing-page purpose

The public landing page answers:

1. What is Lumora?
2. Why is it different?
3. How does it work?
4. Why should users trust it?

### Landing-page flow

1. Startup animation
2. Navigation
3. Hero
4. Living Knowledge System
5. How Lumora Works
6. Research Capabilities
7. Explore Research Workspaces
8. Final CTA

“Try Lumora Now” navigates to the application. Landing work must not redesign the application.

## Living Knowledge System

Lumora’s signature visual replaces generic product illustrations. It comprises:

- Aurora Core
- Glowing center dot
- Three concentric rings
- Floating source nodes
- Connection paths
- Subtle particles
- Continuous, restrained motion

It represents knowledge flowing toward understanding—never AI thinking or fake AI processing. The system should evolve through landing-page scrolling, avoid abrupt restarts and GIF-like looping, and remain alive without distracting users.

## Component principles

- Buttons: elegant, never oversized.
- Cards: editorial; avoid dashboard appearance.
- Icons: minimal.
- Borders: subtle, only when necessary.
- Inputs: clean and quiet.
- Whitespace: the primary layout tool.

## Engineering principles

Never break working architecture or business logic. Prefer extending existing systems, reusable components, clean TypeScript, semantic HTML, accessibility, responsiveness, performance, and composition over complexity.

Do not consider the UI production-ready simply because it is attractive. Evaluate architecture, UX, UI, motion, accessibility, and performance separately.

## Required implementation process

For every approved phase:

1. Inspect current implementation.
2. Explain current architecture.
3. Explain the implementation plan.
4. Implement only the approved phase.
5. Preserve architecture.
6. Validate responsiveness.
7. Run lint, typecheck, and build.
8. Produce an implementation report.

## Landing implementation roadmap

1. Architecture Inspection & Design Freeze — no implementation.
2. Landing Page Foundation.
3. Hero & Aurora Identity.
4. Living Knowledge System.
5. Storytelling Sections.
6. Motion & Interaction Polish.
7. Production QA.

Never combine phases or continue without approval.

## End-of-phase report

Every phase report must include: summary, files modified, design decisions, architecture impact, lint/typecheck/build results, known limitations, and next-phase readiness.

## Final principle

Before accepting a design decision, ask: **“Would this make someone stop for a moment and think, ‘This feels like a real premium software product’?”** If not, it is not complete.
