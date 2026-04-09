# RECALL Pipeline Overview

> Version: 1.0 — April 2026
> A high-level map of all layers, their lineage, and their intent.
> The document an AI orchestrator — or a new human collaborator — reads first.

---

## Why This Document Exists

RECALL is built from five named layers. Each layer has a distinct job, a distinct
audience, and a distinct origin. Without a map, the layers look like complexity.
With the map, they reveal a philosophy.

The philosophy: **source is the artifact, AI is the author, the compiler enforces
the contract, and the pipeline carries its own institutional memory.**

This document is that map.

---

## The Five Layers

| Layer | Artifact / Command | Audience | Job |
|---|---|---|---|
| **Language Schema** | `recall schema --json` | AI compositor, tooling | Declares all valid RECALL syntax — elements, PIC types, divisions, clauses |
| **Component Manifest** | `components/index.json` / `recall scaffold` | AI author, scaffold tooling | Declares what plugin components exist and what fields each accepts |
| **Common Record Description** | MCP `inputSchema` + brief JSON + DATA DIVISION | AI author, MCP tool, compiler | Field agreement across authoring, storage, and rendering for a publishing use case |
| **Compositor Contract** | `recall expand` / `COMPOSITOR-CONTRACT.md` | AI compositor, `recall expand` CLI | Runtime protocol for expanding `WITH INTENT` clauses into valid RECALL source |
| **Pipeline Manifest** | `recall manifest --json` *(planned)* | AI orchestrator, autonomous pipeline | Unified entry point — assembles all four layers into one machine-readable declaration |

---

## Lineage — Where Each Layer Comes From

| Layer | Origin | What the lineage encodes |
|---|---|---|
| **Language Schema** | `recall schema` CLI — RECALL-native | What the language can express. The compiler's own vocabulary made legible. |
| **Component Manifest** | Grace Hopper's COPY books, 1959 COBOL | Shared definitions included at compile time. What exists to render with. |
| **Common Record Description** | COBOL record layouts, 1959 — named by Grace Hopper | The field agreement that travels across every system that touches the same data. |
| **Compositor Contract** | AI-native, 2026 | The runtime protocol born from the need to let an AI expand intent into structure. No 1959 precedent. |
| **Pipeline Manifest** | Hopper's Program Library Directory, 1959 | The catalogue of what exists and what contract each entry honours. Unified institutional memory. |

Three layers have 1959 DNA. Two are purely AI-era inventions. The fact that they
connect without friction is the legitimacy of the architecture.

---

## ASCII Workflow

```
╔══════════════════════════════════════════════════════════════╗
║                    PIPELINE MANIFEST                         ║
║           recall manifest --json  (AI entry point)          ║
║  "What can I express? What do I fill in? Why does this exist?"║
╚══════════╤═══════════════════╤══════════════════════════════╝
           │                   │
           ▼                   ▼
  ┌─────────────────┐  ┌──────────────────┐
  │ LANGUAGE SCHEMA │  │ COMPONENT        │
  │ recall schema   │  │ MANIFEST         │
  │                 │  │ components/      │
  │ What is valid   │  │ index.json       │
  │ RECALL syntax?  │  │                  │
  │                 │  │ What can render? │
  └────────┬────────┘  └────────┬─────────┘
           │                    │
           └─────────┬──────────┘
                     │
                     ▼
        ╔════════════════════════════╗
        ║  COMMON RECORD DESCRIPTION ║
        ║  inputSchema (MCP tool)    ║
        ║                            ║
        ║  What fields does the AI   ║
        ║  author need to fill?      ║
        ╚═════════════╤══════════════╝
                      │
              AI AUTHORS BRIEF
                      │
                      ▼
             ┌────────────────┐
             │  brief.json    │  ← persisted, versioned
             │  (storage)     │
             └───────┬────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
  ┌───────────────┐   ┌─────────────────────┐
  │  RECALL DATA  │   │  COMPOSITOR         │
  │  DIVISION     │   │  CONTRACT           │
  │  (compiler)   │   │  recall expand      │
  │               │   │                     │
  │  PIC X fields │   │  WITH INTENT →      │
  │  group shapes │   │  AI expansion →     │
  │               │   │  valid RECALL source│
  └───────┬───────┘   └─────────┬───────────┘
          │                     │
          └──────────┬──────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │  RECALL COMPILER    │
          │  + plugin renderers │
          │  (@stratiqx/recall- │
          │   components)       │
          └─────────┬───────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │  self-contained     │
          │  HTML               │
          │  + brief.json       │
          │  + index.json       │
          └─────────────────────┘
```

---

## How the Layers Relate

**Language Schema + Component Manifest → inform the author**
Before writing a single field, the AI author (or `recall scaffold`) reads what
elements exist and what components are available. These are read-only reference
layers — they don't change during authoring.

**Common Record Description → governs authoring**
The field contract the AI follows when assembling a brief. Expressed three times
in three syntaxes: MCP `inputSchema` (instructions to Claude), brief JSON
(what gets stored), RECALL DATA DIVISION (what the compiler receives). All three
must agree — when they diverge, the compiler truncates silently or renders nothing.

**Compositor Contract → handles intent**
Only engaged when a `WITH INTENT` clause is present. An optional layer — the case
study pipeline does not use it. Relevant for generative composition where the AI
expands natural language intent into valid RECALL PROCEDURE statements.

**Pipeline Manifest → unifies all four**
The document that answers "what are the rules here?" in a single read. Planned
as `recall manifest --json` — a command that assembles Language Schema, Component
Manifest, Common Record Description pointers, and Compositor Contract reference
into one machine-readable payload. Carries the pipeline's institutional memory
across models, tools, and environments.

---

## The Philosophy Encoded in the Architecture

Every layer answers one of three questions:

| Question | Layer(s) that answer it |
|---|---|
| **What can I express?** | Language Schema, Component Manifest |
| **What do I need to fill in?** | Common Record Description |
| **Why does any of this exist?** | Pipeline Manifest (methodology + philosophy block) |

The first two questions are answered by every publishing tool. The third is not.

A human author reads documentation once and builds a mental model. An AI author
re-enters the pipeline fresh on every run — it has no persistent mental model.
The Pipeline Manifest encodes the *why* in machine-readable form so the AI can
reconstruct institutional knowledge without a human in the loop.

That is the AI-first thesis made architectural.

---

## The Autonomy Trajectory

The pipeline is designed to reduce human touches per published artifact over time.

| Phase | Human role | Pipeline state |
|---|---|---|
| **Early** (UC-001–100) | Writes HTML directly | No pipeline |
| **Formalised** (UC-100–200) | Assembles brief, reviews HTML | MCP tool + RECALL |
| **Current** (UC-200–230+) | Reviews output, deploys | Full pipeline, brief persisted |
| **Near-term** | Approves cluster selection | Model proposes, pipeline renders |
| **Target** | Editorial gate only | Pipeline runs autonomously within declared constraints |

The Pipeline Manifest is the precondition for the target state. An autonomous
pipeline that cannot read its own rules cannot make judgment calls at the edges.
The manifest is what makes autonomous operation principled rather than just fast.

---

## Document Index

| Document | Location | Read when |
|---|---|---|
| This overview | `docs/PIPELINE-OVERVIEW.md` | First read — orientation |
| Language Schema | `recall schema --json` | Before writing any `.rcl` source |
| Component Manifest | `@stratiqx/recall-components/components/index.json` | Before scaffolding or rendering |
| Common Record Description | `docs/COMMON-RECORD-DESCRIPTION.md` | Before assembling a brief |
| Compositor Contract | `docs/COMPOSITOR-CONTRACT.md` | Before using `recall expand` / `WITH INTENT` |
| Grammar | `docs/RECALL-GRAMMAR.md` | Deep reference — full EBNF |
| Roadmap | `docs/ROADMAP.md` | What is planned and why |
