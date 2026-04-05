# RECALL Roadmap

> Last updated: April 2026
> Current version: 0.6.0

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
| 0.4.x | Data display: TABLE + STAT-GRID | ✅ Complete |
| 0.5.x | Component data binding — WITH DATA clause | ✅ Complete |
| **0.6.x** | **Component library resolution (npm)** | ✅ Complete |
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

## v0.5 — Component Data Binding ✅ Complete

**Shipped:** `WITH DATA` clause — components receive DATA DIVISION fields by name.

**Syntax:**
```cobol
COMPONENT DIVISION.
   DEFINE CASE-HERO.
      ACCEPTS CASE-TITLE CASE-SUBTITLE SECTOR-BADGE STATS.
      DISPLAY SECTION ID "hero" WITH LAYOUT CENTERED WITH PADDING LARGE.
         DISPLAY LABEL SECTOR-BADGE.
         DISPLAY HEADING-1 CASE-TITLE.
         DISPLAY PARAGRAPH CASE-SUBTITLE.
         DISPLAY STAT-GRID STATS WITH COLUMNS 6.
      STOP SECTION.
   END DEFINE.

PROCEDURE DIVISION.
   RENDER.
      DISPLAY CASE-HERO
         WITH DATA CASE-TITLE, CASE-SUBTITLE, SECTOR-BADGE, STATS.
   STOP RUN.
```

**Binding rules:**
- Scalars (WORKING-STORAGE fields with a value) → resolved string passed into component
- Groups (ITEMS groups with children) → name passed as-is; TABLE/STAT-GRID/CARD-LIST resolve lazily from the live data object
- `WITH PARAM "literal"` clauses still work alongside WITH DATA for overrides

**A full StratIQX case page becomes:**
```cobol
PROCEDURE DIVISION.
   RENDER.
      DISPLAY CASE-HERO     WITH DATA CASE-TITLE, CASE-SUBTITLE, STATS, SECTOR-BADGE.
      DISPLAY CASE-ANALYSIS WITH DATA INSIGHT-P1, INSIGHT-P2, DIMENSIONS.
      DISPLAY CASE-CASCADE  WITH DATA FETCH-SCORE, CASCADE-CHAIN, CAL-TRACE.
      DISPLAY CASE-SOURCES  WITH DATA SOURCES.
   STOP RUN.
```

**Tests:** 66 passing (8 new in `tests/generator/component-data.test.ts`)

---

## v0.6 — Component Library Resolution ✅ Complete

**Goal:** Component `.rcpy` files can be resolved from npm packages, not just relative paths.

**Syntax:**
```cobol
COPY FROM "@semanticintent/recall-ui/components/nav.rcpy".
COPY FROM "@recall-ui/stratiqx/case-hero.rcpy".
```

Works in both ENVIRONMENT DIVISION (theme COPY FROM) and PROCEDURE DIVISION (component COPY FROM).

**Resolution algorithm:**
- Paths starting with `@` → npm package walk-up: search `node_modules/<specifier>` starting from the source file's directory, walking up to filesystem root
- All other paths → resolved relative to source file directory (existing behavior, unchanged)

**Error on missing package:** clear message `Cannot resolve package path: "@pkg/..." — is the package installed?` (surfaced as PARSE ERROR in `compile()` result)

**Tests:** 3 new tests in `tests/compiler/copy.test.ts` — procedure COPY, environment theme COPY, missing package error

**What ships next:**
- `@semanticintent/recall-ui` — first published component library (1.0.0 milestone)
- Components: navigation patterns, card grids, stat displays, data tables, hero layouts

---

## Design Observations — Toward 1.0

These are friction points identified while building with RECALL — places where the language
was implicit when it should have been explicit. They inform what 1.0 needs to harden.

**The pattern:** the language is cognitively lightweight when it is explicit. Every gap
below is a place where the compiler accepted ambiguous or invalid input silently.

---

### 1. `USING` vs `WITH DATA` vs `WITH PARAM` — three binding mechanisms

Three ways to pass data to elements, each with different semantics:
- `DISPLAY NAVIGATION USING NAV-ITEMS` — group reference for built-in elements
- `DISPLAY MY-COMP WITH DATA FIELD1, FIELD2` — DATA DIVISION binding for components
- `DISPLAY MY-COMP WITH FIELD "literal"` — literal override

The surface area is small but real. A writer new to RECALL has to track which mechanism
applies where. 1.0 should consider unifying or at minimum documenting the decision rule
clearly in the language spec.

---

### 2. SPLIT layout requires two sub-SECTION children — not enforced

A SECTION with `WITH LAYOUT SPLIT` expects exactly two child SECTION elements (left and
right columns). If you write children flat, it compiles and renders — with empty columns.
The failure is silent. This was caught during `hero.rcpy` component authoring.

**1.0 fix:** compiler should warn or error when LAYOUT SPLIT has no child SECTIONs, or
when child count doesn't match the layout's expectation.

---

### 3. Palette key period bug — silent failure

```cobol
COLOR-BG.  "#080a10".   ← wrong: key stored as "COLOR-BG." — lookup fails silently
COLOR-BG   "#080a10".   ← correct
```

The compiler accepted the invalid form. The palette default was used instead. No error,
no warning. Cost real debugging time in the StratIQX integration.

**1.0 fix:** palette parser should reject keys that contain a trailing period, with a
clear error message pointing to the offending line.

---

### 4. VALUE string content was not opaque to pre-processors and parser

Multi-line VALUE strings containing RECALL syntax (e.g. docs code examples with
`COMPONENT DIVISION.` or `COPY FROM @...`) confused both the pre-processor pipeline and
the parser's division tokenizer. Fixed in v0.7.1 (pre-processors) and v0.7.2 (parser),
but the root issue reveals a design principle:

**The source of truth is the DATA DIVISION, not the rendered output.** Anything inside
a VALUE string is content, not source. The compiler must treat it as opaque at every
processing stage. This principle should be tested explicitly in the spec.

---

### 5. The language is light when explicit — the design law for 1.0

Every place where RECALL felt effortless was a place where the language was explicit:
- What the program IS — declared in IDENTIFICATION DIVISION before anything else
- What data exists — declared in DATA DIVISION before any rendering
- What components are available — declared in COMPONENT DIVISION before PROCEDURE
- What an element renders — determined by the verb, not by context

Every place where friction appeared was a place where the compiler let implicit or
ambiguous input through. **1.0's goal is not more features — it is tighter contracts.**
Explicit over implicit, loud errors over silent defaults, the source being unambiguously
correct.

---

## v1.0 — Stable Language

**Goal:** Language specification frozen. Compiler is a stable runtime. Component ecosystem exists.

**What 1.0 means for RECALL:**
- The core element vocabulary is complete and stable
- The theme layer (palette / font / style-block) is the documented extension point
- Component libraries are the unit of community contribution
- Breaking changes require a major version
- Silent failures become loud errors (see Design Observations above)

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
