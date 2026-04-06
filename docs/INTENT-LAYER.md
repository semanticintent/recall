# RECALL Intent Layer — Design Proposal

> Status: **Concept** — not yet implemented
> Originated: April 2026
> Target milestone: Post-1.0

---

## The Idea

RECALL already separates concerns into divisions. The next evolution is
separating **what** from **how** at the PROCEDURE DIVISION level.

Today an author writes both the layout decision and the intent:

```cobol
DISPLAY SECTION ID "hero"
   WITH LAYOUT CENTERED
   WITH PADDING LARGE
   WITH STYLE GRID-BG.
   DISPLAY LABEL PRODUCT-NAME.
   DISPLAY HEADING-1 PRODUCT-TAGLINE
      WITH STYLE MONO.
   DISPLAY PARAGRAPH PRODUCT-BODY.
STOP SECTION.
```

With the Intent Layer, the author writes only intent:

```cobol
DISPLAY HERO
   WITH INTENT "dramatic opening, single product, dark energy, urgency without hype"
   WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, PRODUCT-BODY, CTA-PRIMARY, CTA-SECONDARY.
```

An AI compositor — aware of the declared DATA, ENVIRONMENT theme, and
RECALL schema — expands the intent clause into valid RECALL source. The
expanded source is what the compiler receives.

---

## Design Principles

### 1. The output is always valid RECALL

The AI does not generate HTML. It generates RECALL source — constrained
to the live element schema (`recall schema`), the declared palette, and
the available DATA DIVISION fields. Invalid output is a compiler error,
not a silent failure.

### 2. The source is always auditable

The expanded RECALL source is embedded in the compiled HTML alongside the
original intent clause. An author can read exactly what the AI decided,
edit any decision, and recompile. Nothing is hidden.

### 3. Intent is a constraint, not a free prompt

`WITH INTENT` is not a general-purpose AI prompt. It operates within the
bounds of:

- The RECALL element vocabulary (cannot invent elements)
- The declared ENVIRONMENT theme (cannot override palette or fonts)
- The declared DATA fields (can only arrange what exists)
- The ACCEPTS contract of any component in scope

The AI is a **layout compositor**, not a designer. It fills structure,
not content.

### 4. Human intent, AI structure, compiler correctness

The three-layer model:

```
Author    → declares DATA + WITH INTENT
AI        → expands intent into valid RECALL PROCEDURE statements  
Compiler  → validates and compiles to self-contained HTML
```

Each layer has one job. None overlaps.

---

## Conceptual Layout Primitives

The Intent Layer introduces high-level layout tokens — above element
level, below full component level. These are **intention slots**, not
HTML constructs.

| Token | Intent | AI decision space |
|---|---|---|
| `HERO` | First thing seen. Establish the frame. Highest stakes. | Layout, heading hierarchy, CTA placement, background treatment |
| `SHOWCASE` | Feature or product on display. Evidence follows claim. | Grid vs stack, image placement, label hierarchy |
| `PROOF` | Social proof, statistics, validation. Trust signals. | Stat grid vs card list, density, ordering |
| `BRIDGE` | Transition between ideas. Narrative connective tissue. | Divider, callout, short paragraph, tone shift |
| `NARRATIVE` | Long-form explanation. Sustain attention. | Section rhythm, heading cadence, callout placement |
| `CTA` | Conversion moment. Single clear action. | Button style, surrounding whitespace, supporting copy |
| `FOOTER` | Close. Legal, nav, identity. | Link grouping, disclosure placement |

These tokens are not elements — they have no direct HTML equivalent.
They are resolved entirely by the AI compositor before the compiler sees
the source.

---

## Full Example

**Author writes:**

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.   LAUNCH-PAGE.
   PAGE-TITLE.   "Meridian — Risk Intelligence Platform".

ENVIRONMENT DIVISION.
   COPY FROM "themes/dark.rcpy".

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 PRODUCT-NAME    PIC X(30)  VALUE "Meridian".
      01 PRODUCT-TAGLINE PIC X(80)  VALUE "Know the risk before the market does.".
      01 PRODUCT-BODY    PIC X(300) VALUE "Meridian ingests 40 data streams in real time...".
      01 CTA-PRIMARY     PIC X(20)  VALUE "Request Access".
      01 CTA-SECONDARY   PIC X(20)  VALUE "See the Data".
      01 STAT-1-VALUE    PIC X(10)  VALUE "40".
      01 STAT-1-LABEL    PIC X(20)  VALUE "Live Data Streams".
      01 STAT-2-VALUE    PIC X(10)  VALUE "< 80ms".
      01 STAT-2-LABEL    PIC X(20)  VALUE "Signal Latency".
      01 STAT-3-VALUE    PIC X(10)  VALUE "99.97%".
      01 STAT-3-LABEL    PIC X(20)  VALUE "Uptime SLA".

PROCEDURE DIVISION.

   RENDER.
      DISPLAY HERO
         WITH INTENT "dramatic opening, single product, dark energy, urgency without hype"
         WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, PRODUCT-BODY, CTA-PRIMARY, CTA-SECONDARY.

      DISPLAY PROOF
         WITH INTENT "three hard numbers, no softening language, let the data speak"
         WITH DATA STAT-1-VALUE, STAT-1-LABEL, STAT-2-VALUE, STAT-2-LABEL, STAT-3-VALUE, STAT-3-LABEL.

      DISPLAY CTA
         WITH INTENT "single action, no distraction, high contrast"
         WITH DATA CTA-PRIMARY.

   STOP RUN.
```

**AI expands to valid RECALL — fully auditable:**

```cobol
PROCEDURE DIVISION.

   RENDER.
      * ── Expanded from: DISPLAY HERO WITH INTENT "dramatic opening..." ──
      DISPLAY SECTION ID "hero"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE
         WITH STYLE GRID-BG.
         DISPLAY LABEL PRODUCT-NAME.
         DISPLAY HEADING-1 PRODUCT-TAGLINE
            WITH STYLE MONO.
         DISPLAY PARAGRAPH PRODUCT-BODY.
         DISPLAY SECTION WITH LAYOUT STACK.
            DISPLAY BUTTON CTA-PRIMARY
               WITH STYLE PRIMARY.
            DISPLAY BUTTON CTA-SECONDARY
               WITH STYLE GHOST.
         STOP SECTION.
      STOP SECTION.

      * ── Expanded from: DISPLAY PROOF WITH INTENT "three hard numbers..." ──
      DISPLAY SECTION ID "proof"
         WITH LAYOUT CENTERED
         WITH PADDING MEDIUM.
         DISPLAY STAT-GRID
            WITH COLUMNS 3
            WITH DATA STAT-1-VALUE, STAT-1-LABEL,
                       STAT-2-VALUE, STAT-2-LABEL,
                       STAT-3-VALUE, STAT-3-LABEL.
      STOP SECTION.

      * ── Expanded from: DISPLAY CTA WITH INTENT "single action..." ──
      DISPLAY SECTION ID "cta"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY BUTTON CTA-PRIMARY
            WITH STYLE PRIMARY.
      STOP SECTION.

   STOP RUN.
```

---

## What the AI Knows

When expanding a `WITH INTENT` clause, the AI compositor has access to:

- **`recall schema --json`** — live element registry, all valid clauses
- **The ENVIRONMENT DIVISION** — palette, fonts, color mode
- **The DATA DIVISION** — every declared field and its PIC type
- **The COMPONENT DIVISION** — every component in scope and its ACCEPTS list
- **The intent string** — tone, energy, purpose
- **The layout token** — the structural role of this block

It has no access to anything outside the program. It cannot fetch
external data, invoke APIs, or produce output that references undeclared
fields.

---

## Relationship to Existing COMMENT Clause

The `COMMENT` clause (v0.8) attaches intent metadata to DATA fields:

```cobol
01 FETCH-SCORE PIC X(10) VALUE "2978"
   COMMENT "CAL fetch score — higher is better; cascade header uses this".
```

The Intent Layer is the PROCEDURE-level equivalent — `COMMENT` declares
field intent, `WITH INTENT` declares layout intent. Together they give
the AI compositor a complete picture of what each piece of data *means*
and how each block should *feel*.

---

## Connection to ReAct Pattern

The Intent Layer is structurally analogous to the ReAct (Reason + Act)
AI pattern:

| ReAct | RECALL Intent Layer |
|---|---|
| Thought | `WITH INTENT "..."` |
| Action | AI expands to RECALL source |
| Observation | Compiler validates output |
| Correction | Author edits expanded source |

Both patterns make AI reasoning auditable and correctable at each step.
Neither produces black-box output.

---

## Implementation Path

### Phase 1 — Spec (now)
Define the token vocabulary. Define what information the compositor
receives. Define the output contract (valid RECALL, no invented
elements).

### Phase 2 — Compositor (post-1.0)
Build `recall expand <file>` — reads intent clauses, calls the AI
compositor, writes expanded RECALL source alongside the original.
Original intent clauses preserved as comments in the expanded output.

### Phase 3 — Compiler integration (post-1.0)
`recall build` detects unresolved intent clauses and calls the
compositor automatically before compilation. One command, full pipeline.

### Phase 4 — Intent vocabulary hardening
Refine the layout token set based on real usage. Add domain-specific
tokens (e.g. `CASE-STUDY`, `PRICING`, `TIMELINE-HERO`) as the ecosystem
develops.

---

## Open Questions

1. **Persistence** — does the expanded source live alongside the `.rcl`
   file (e.g. `.rcl.expanded`) or replace it? The original intent clause
   should always be recoverable.

2. **Determinism** — same intent + same data + same schema should
   produce the same expansion. Temperature=0, schema pinned to compiler
   version.

3. **Partial expansion** — can a file mix explicit PROCEDURE statements
   and intent clauses freely? Answer should be yes — the compositor only
   touches `WITH INTENT` clauses.

4. **RECORD integration** — can intent clauses reference RECORD types
   for their data binding? Should work naturally.

5. **Token extensibility** — can third-party component libraries declare
   their own intent tokens? E.g. `DISPLAY STRATIQX-CASE` as a domain
   token. Worth speccing.

---

*This document is the authoritative record of the Intent Layer concept.
Update as the design evolves. Do not implement ahead of RECALL 1.0.*
