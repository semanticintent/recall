# RECALL Roadmap

> Last updated: April 2026
> Current version: 0.3.17

---

## Design Law

RECALL is a structured document language. Three concerns are always kept separate:

| Concern | Mechanism | Changes via |
|---|---|---|
| Structure | Core elements (verbs) | Compiler release |
| Visual | Theme layer (palette, fonts, style-block) | `.rcpy` copybook |
| Reuse | Component library | `.rcpy` files / npm |

This separation is the invariant. New releases add elements or capabilities — they never break the contract between layers.

---

## Milestone Overview

| Version | Theme | Status |
|---|---|---|
| 0.3.x | Theme layer: PALETTE + FONT + STYLE-BLOCK | ✅ Complete |
| **0.4.x** | **Data display: TABLE + STAT-GRID** | 🔲 Next |
| 0.5.x | Component data binding | 🔲 Planned |
| 0.6.x | Component library resolution (npm) | 🔲 Planned |
| 1.0.0 | Stable language + first published component library | 🔲 Planned |

---

## v0.4 — Data Display Elements

**Goal:** Close the structural gap between RECALL's generic layout and data-rich document formats like StratIQX case studies.

Two new elements. Both read from the DATA DIVISION. No new syntax concepts — they follow the same `DISPLAY <ELEMENT> <data-ref> WITH <clauses>` pattern.

---

### TABLE

Renders a DATA DIVISION group as a `<table>`. Iterates `05`-level children; maps `10`-level fields to columns by position.

**Syntax:**
```cobol
DISPLAY TABLE DIMENSIONS
   WITH COLUMNS "Dimension, Score, Layer, Evidence".
```

**Data shape:**
```cobol
DATA DIVISION.
   ITEMS SECTION.
      01 DIMENSIONS.
         05 DIM-1.
            10 DIM-1-NAME   PIC X(30)  VALUE "Revenue (D3)".
            10 DIM-1-SCORE  PIC 9(2)   VALUE 75.
            10 DIM-1-LAYER  PIC X(8)   VALUE "origin".
            10 DIM-1-EVID   PIC X(400) VALUE "...evidence...".
         05 DIM-2.
            ...
```

**Rules:**
- Column count must match 10-level field count per row
- Column order maps to field declaration order
- Renders `<table class="recall-table">` — styled by base CSS (already exists)
- Optional modifier: `WITH STRIPED TRUE` — adds `.striped` class for alternating rows

---

### STAT-GRID

Renders a DATA DIVISION group as a metric display grid. Each `05`-level item becomes one stat card. Detects VALUE and LABEL fields by name suffix (`-VALUE`, `-LABEL`).

**Syntax:**
```cobol
DISPLAY STAT-GRID STATS
   WITH COLUMNS 6.
```

**Data shape:**
```cobol
DATA DIVISION.
   ITEMS SECTION.
      01 STATS.
         05 STAT-1.
            10 STAT-1-VALUE  PIC X(10)  VALUE "584M".
            10 STAT-1-LABEL  PIC X(20)  VALUE "Global Listeners".
         05 STAT-2.
            10 STAT-2-VALUE  PIC X(10)  VALUE "$2.3B".
            10 STAT-2-LABEL  PIC X(20)  VALUE "Ad Revenue".
```

**Rules:**
- `WITH COLUMNS <n>` sets the CSS grid column count (default: auto-fit)
- VALUE field: detected by `-VALUE` suffix → rendered large, accent color
- LABEL field: detected by `-LABEL` suffix → rendered small, muted, uppercase
- New CSS: `.stat-grid`, `.stat-card`, `.stat-value`, `.stat-label`

---

### v0.4 Implementation Checklist

- [ ] Parser: add `TABLE` and `STAT-GRID` to element union type
- [ ] Parser: parse `WITH COLUMNS "..."` as `string[]` clause
- [ ] Parser: parse `WITH COLUMNS <n>` as numeric clause
- [ ] Generator: `renderTable()` — group lookup, row iteration, column mapping
- [ ] Generator: `renderStatGrid()` — group lookup, VALUE/LABEL field detection
- [ ] Generator: add `.stat-grid`, `.stat-card`, `.stat-value`, `.stat-label` CSS
- [ ] Tests: TABLE rendering with 3, 4, 6 columns
- [ ] Tests: STAT-GRID with 3, 4, 6 stats
- [ ] Tests: mismatched column count error handling
- [ ] recall-site: add TABLE + STAT-GRID to docs and live demo
- [ ] Publish v0.4.0

---

## v0.5 — Component Data Binding

**Goal:** COMPONENT DIVISION components can declare data parameters and be invoked with DATA bindings from the calling program.

**Syntax (invoking):**
```cobol
PROCEDURE DIVISION.
   RENDER-HERO.
      DISPLAY CASE-HERO
         WITH DATA CASE-TITLE, CASE-SUBTITLE, FETCH-SCORE, SECTOR-BADGE.
      STOP SECTION.
```

**Syntax (defining in .rcpy):**
```cobol
COMPONENT DIVISION.
   DEFINE CASE-HERO.
      PARAMETER CASE-TITLE.
      PARAMETER CASE-SUBTITLE.
      PARAMETER FETCH-SCORE.
      PARAMETER SECTOR-BADGE.
      DISPLAY SECTION ID "hero"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY LABEL SECTOR-BADGE.
         DISPLAY HEADING-1 CASE-TITLE.
         DISPLAY PARAGRAPH CASE-SUBTITLE.
      STOP SECTION.
```

**Why this matters:** A full StratIQX case page becomes:
```cobol
PROCEDURE DIVISION.
   RENDER.
      DISPLAY CASE-HERO WITH DATA CASE-TITLE, CASE-SUBTITLE, STATS, SECTOR-BADGE.
      DISPLAY CASE-ANALYSIS WITH DATA INSIGHT-P1, INSIGHT-P2, DIMENSIONS.
      DISPLAY CASE-CASCADE WITH DATA FETCH-SCORE, CASCADE-CHAIN, CAL-TRACE.
      DISPLAY CASE-SOURCES WITH DATA SOURCES.
   STOP RUN.
```

---

## v0.6 — Component Library Resolution

**Goal:** Component `.rcpy` files can be resolved from npm packages, not just relative paths.

**Syntax:**
```cobol
COMPONENT DIVISION.
   COPY FROM "node_modules/@recall-ui/stratiqx/case-hero.rcpy".
   COPY FROM "@recall-ui/stratiqx/case-analysis.rcpy".   -- shorthand
```

**What ships:**
- `@semanticintent/recall-ui` — first published component library
- Components: navigation patterns, card grids, stat displays, data tables, hero layouts

---

## v1.0 — Stable Language

**Goal:** Language specification frozen. Compiler is a stable runtime. Component ecosystem exists.

**What 1.0 means for RECALL:**
- The core element vocabulary is complete and stable
- The theme layer (palette / font / style-block) is the documented extension point
- Component libraries are the unit of community contribution
- Breaking changes require a major version

**What 1.0 ships with:**
- `@semanticintent/recall` — stable compiler
- `@semanticintent/recall-ui` — standard component library (nav, hero, table, stat-grid, cards, forms, cascade, cta, footer)
- Full RECALL_SPEC.md language reference
- recall.cormorantforaging.dev — documentation site (built in RECALL)

---

## Element Vocabulary Status

| Element | v0.3 | v0.4 | v0.5 |
|---|---|---|---|
| HEADING-1/2/3 | ✅ | — | — |
| PARAGRAPH | ✅ | — | — |
| LABEL | ✅ | — | — |
| BUTTON | ✅ | — | — |
| CODE-BLOCK | ✅ | — | — |
| CARD-LIST | ✅ | — | — |
| NAVIGATION | ✅ | — | — |
| FOOTER | ✅ | — | — |
| SECTION (layout container) | ✅ | — | — |
| INPUT | ✅ | — | — |
| TABLE | 🔲 | ✅ | — |
| STAT-GRID | 🔲 | ✅ | — |
| Component invocation w/ data | 🔲 | 🔲 | ✅ |
| BANNER | 🔲 | — | — |
| TABS | ✅ | — | — |
| SIDEBAR | ✅ | — | — |
| CALLOUT | ✅ | — | — |
