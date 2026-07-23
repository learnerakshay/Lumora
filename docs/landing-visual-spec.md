# Lumora Landing Page — Visual Specification

> Status: Approved (v1)
> Last Updated: July 2026

---

# Purpose

This document defines the approved visual design of the Lumora public landing page.

This document is the visual source of truth.

The landing page must be implemented exactly as specified here and by the approved reference images.

Do not redesign.

Do not reinterpret.

---

# Product Positioning

Lumora is not:

- an AI chatbot
- a notes application
- a PDF summarizer

Lumora is a Knowledge Operating System.

Core message:

Sources
↓

Understanding
↓

Knowledge
↓

Learning

---

# Theme

Permanent Aurora Observatory Theme.

Requirements:

- Single dark theme
- No light mode
- No theme toggle
- No alternate color palettes

The Aurora identity is part of the product branding.

---

# Landing Page Structure

The landing page consists of six sections.

---

## Section 1

Hero

Contents:

- Navigation
- Editorial headline
- Supporting copy
- Primary CTA
- Lumora Core illustration
- Aurora atmosphere
- Scroll indicator

CTA:

Try Lumora Now

Button destination:

/start

---

## Section 2

How Lumora Works

Purpose:

Explain the transformation pipeline.

Flow:

Collect

↓

Understand

↓

Transform

Animation:

- Sources appear
- Connection lines animate
- Core pulses
- Outputs reveal

---

## Section 3

Living Knowledge System

Purpose:

Show Lumora's core intelligence.

Pipeline:

Sources

↓

Lumora Core

↓

Understanding Layer

↓

Knowledge Graph

↓

Outputs

Outputs:

- AI Conversations
- Knowledge Graph
- Source Insights
- Study Guides
- Flashcards
- Podcasts
- Learning Roadmaps

Animation:

- Floating source nodes
- Continuous pulses
- Slow breathing Core
- Static background
- Calm premium motion

---

## Section 4

Feature Grid

Contains:

- AI Conversations
- Knowledge Graph
- Source Insights
- Study Guides
- Flashcards
- Podcasts
- Learning Roadmaps
- Research Workspace

Hover interactions only.

---

## Section 5

Featured Research Workspaces

Public showcase of example notebooks.

Examples:

- Artificial Intelligence
- Machine Learning
- Financial Markets
- History

Purpose:

Demonstrate real-world usage.

---

## Section 6

Final CTA

Heading:

Ready to rethink how you learn?

CTA:

Try Lumora Now

Destination:

/start

Footer included.

---

# Navigation

Top navigation:

- Lumora Logo
- Overview
- Plans
- GitHub
- X

No theme toggle.

---

# Routing

Landing:

/

CTA:

/start

Authentication:

Clerk

Authenticated destination:

/notebooks

Notebook dashboard is NOT part of the landing page.

---

# Motion Principles

Scrolling:

Lenis

Micro interactions:

Framer Motion

Scroll animations:

GSAP + ScrollTrigger

Animation philosophy:

Elegant.

Scientific.

Calm.

Never distracting.

---

# Design References

The following images are the approved implementation references:

- landing-hero-approved.png
- landing-how-it-works-approved.png
- landing-features-cta-approved.png

These three images together represent ONE continuous landing page.

They are not separate pages.

---

# Implementation Rule

When conflicts exist:

Approved Images

>

This document

>

Any previous implementation

>

Developer assumptions

The images are the highest visual authority.
