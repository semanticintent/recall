# RECALL

[![npm](https://img.shields.io/npm/v/@semanticintent/recall-compiler)](https://www.npmjs.com/package/@semanticintent/recall-compiler)
[![tests](https://img.shields.io/badge/tests-124%20passing-brightgreen)](#contributing)
[![license](https://img.shields.io/badge/license-MIT-blue)](#license)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.19463347.svg)](https://doi.org/10.5281/zenodo.19463347)

**A COBOL-inspired compiler for the web. Authorship is a type constraint. The source is the artifact.**

**[→ Try the live playground](https://recall.semanticintent.dev/playground.html)**

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.    MY-SITE.
   AUTHOR.        "Michael Shatny".
   PAGE-TITLE.    "Still Here.".
   DATE-WRITTEN.  2026-04-11.

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-HEADING  PIC X(40)  VALUE "BUILT FOR THE AI ERA.".
      01 HERO-BODY     PIC X(120) VALUE "Declare intent. Compile to HTML. The source knows who wrote it.".

PROCEDURE DIVISION.
   RENDER-HERO.
      DISPLAY SECTION ID "hero" WITH LAYOUT CENTERED.
         DISPLAY HEADING-1 HERO-HEADING.
         DISPLAY PARAGRAPH HERO-BODY.
      STOP SECTION.
   STOP RUN.

AUDIT DIVISION.
   CREATED-BY.   Human.
   CREATED-DATE. 2026-04-11.
   CHANGE-LOG.
      2026-04-11  Hero copy updated. Human. "Sharpened for launch."
```

```sh
recall compile my-site.rcl
# → my-site.html  (self-contained, zero dependencies)
```

View source on the compiled output:

```html
<!--
  RECALL AUDIT
  created-by:   Human
  created-date: 2026-04-11
  changes:
    2026-04-11  Hero copy updated   Human   "Sharpened for launch."
-->
```

The artifact knows who wrote it. Not as a commit message. As a compiled fact.

---

## What is RECALL?

RECALL is a compiler. You write `.rcl` source files in a division-based, English-like syntax inspired by COBOL. The compiler produces a single self-contained HTML file — inline CSS, no JavaScript framework, no runtime, no build step to run the result.

**Three things set RECALL apart:**

**1. Authorship is a compile-time constraint.**
`CREATED-BY` in the AUDIT DIVISION accepts exactly three values: `Human`, `AI compositor`, `AI agent`. Anything else aborts compilation. The provenance of every page is a type, not a comment.

**2. The source is embedded in the artifact.**
Every compiled `.html` file carries its original `.rcl` source in an HTML comment. View source on any RECALL page and the origin is right there. The source and the output travel together, permanently.

**3. AI composition is a first-class clause.**
`WITH INTENT` lets you declare what a section should do. `recall expand` calls an AI compositor, generates real RECALL source, and the result is validated by the same compiler that validates everything else.

RECALL is not a COBOL runtime, not a React wrapper, not a templating engine. It is a domain-specific language for producing structured, auditable, AI-composable web interfaces.

---

## Install

```sh
npm install -g @semanticintent/recall-compiler
```

Or as a library:

```sh
npm install @semanticintent/recall-compiler
```

---

## CLI

```sh
# Compile a .rcl file to HTML
recall compile my-site.rcl
recall compile my-site.rcl --out dist/

# Type-check without compiling
recall check my-site.rcl
recall check my-site.rcl --strict       # warnings promoted to errors
recall check my-site.rcl --format json  # machine-readable diagnostics

# Semantic diff between two .rcl sources
recall diff v1.rcl v2.rcl
recall diff HEAD~1 HEAD page.rcl        # compare git revisions
recall diff HEAD~1 HEAD page.rcl --suggest-audit

# Print the AUDIT DIVISION change log
recall audit page.rcl
recall audit page.rcl --since 2026-04-08
recall audit page.rcl --format json

# Pipeline telemetry — aggregate across all compiled cases
recall stats                            # reads uc-000/index.json in CWD
recall stats page.rcl                   # single-file orientation summary

# Expand WITH INTENT clauses using an AI compositor
recall expand page.rcl
recall expand page.rcl --dry-run

# Look up a diagnostic code
recall explain RCL-007
recall explain --list

# Auto-fix safe diagnostics
recall fix page.rcl --dry-run
recall fix page.rcl --yes

# Print the Pipeline Manifest
recall manifest
recall manifest --json

# Scaffold a new .rcl from a component library
recall scaffold PAGE-HERO --plugin @semanticintent/recall-ui
```

---

## Language Structure

Every RECALL program is built from up to six divisions:

```
IDENTIFICATION DIVISION.   who this is — program ID, title, author, date
ENVIRONMENT DIVISION.      how it looks — viewport, theme, palette, fonts, plugins
DATA DIVISION.             what it holds — typed fields, lists, groups
COMPONENT DIVISION.        custom reusable elements defined in RECALL syntax
AUDIT DIVISION.            who changed what, when, and why — compiled into the artifact
PROCEDURE DIVISION.        what it renders — DISPLAY statements, sections
```

### IDENTIFICATION DIVISION

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.    MY-SITE.
   AUTHOR.        "Semanticintent".
   DATE-WRITTEN.  2026-04-10.
   PAGE-TITLE.    "My Site".
   DESCRIPTION.   "A site about things.".
   FAVICON.       "/favicon.ico".
```

### DATA DIVISION

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-HEADING  PIC X(60)   VALUE "Hello, World.".
      01 HERO-BODY     PIC X(200)  VALUE "Built to last.".
      01 LAUNCH-DATE   DATE        VALUE "2026-04-10".
      01 COVERAGE      PCT         VALUE "94".

   ITEMS SECTION.
      01 NAV-ITEMS.
         05 NAV-ITEM-1       PIC X(20) VALUE "HOME".
         05 NAV-ITEM-1-HREF  PIC X(80) VALUE "/".
         05 NAV-ITEM-2       PIC X(20) VALUE "ABOUT".
         05 NAV-ITEM-2-HREF  PIC X(80) VALUE "/about".
```

**PIC types:** `X(n)` string, `9(n)` integer, `DATE`, `URL`, `PCT`, `BOOL`

### PROCEDURE DIVISION

```cobol
PROCEDURE DIVISION.
   RENDER-NAV.
      DISPLAY NAVIGATION USING NAV-ITEMS
         WITH STICKY YES
         WITH LOGO "MY SITE".

   RENDER-HERO.
      DISPLAY SECTION ID "hero" WITH LAYOUT CENTERED.
         DISPLAY HEADING-1 HERO-HEADING.
         DISPLAY PARAGRAPH HERO-BODY.
         DISPLAY BUTTON "Get Started" ON-CLICK GOTO "#install".
      STOP SECTION.

   STOP RUN.
```

### COMPONENT DIVISION

Define custom elements once. Use them like built-ins. Pure compile-time — zero-dependency HTML output.

```cobol
COMPONENT DIVISION.
   DEFINE PRICING-CARD.
      ACCEPTS TIER, PRICE, FEATURES, CTA-LABEL REQUIRED, CTA-HREF REQUIRED.
      DISPLAY SECTION WITH LAYOUT STACK.
         DISPLAY HEADING-3 TIER.
         DISPLAY LABEL PRICE.
         DISPLAY CARD-LIST USING FEATURES.
         DISPLAY BUTTON CTA-LABEL ON-CLICK GOTO CTA-HREF WITH STYLE PRIMARY.
      STOP SECTION.
   END DEFINE.
```

### AUDIT DIVISION

Formal provenance as a language construct. Compiled into the artifact — permanent, structured, invisible to the reader.

```cobol
AUDIT DIVISION.
   CREATED-BY.    Michael Shatny.
   CREATED-DATE.  2026-04-07.
   CHANGE-LOG.
      2026-04-07  HERO-HEADING updated. Human. "Sharpened the opening line."
      2026-04-08  RENDER-WHY expanded. AI compositor. "Added third card per WITH INTENT."
      2026-04-10  HERO-BADGE added. Human. "New badge for launch week."
```

Author-kind is formally constrained to: `Human`, `AI compositor`, `AI agent`.

The AUDIT DIVISION compiles into an HTML comment in the output — and into the brief JSON — so every compiled artifact carries its own provenance.

---

## Elements

| Element | Description |
|---|---|
| `HEADING-1` / `HEADING-2` / `HEADING-3` | Section headings |
| `PARAGRAPH` | Body text block |
| `LABEL` | Small inline label or caption |
| `CODE-BLOCK` | Preformatted code block with optional language |
| `BUTTON` | CTA button with `ON-CLICK GOTO` |
| `LINK` | Hyperlink |
| `IMAGE` | Responsive image |
| `DIVIDER` | Horizontal rule |
| `SECTION` | Layout container — `CENTERED`, `STACK`, `GRID` |
| `NAVIGATION` | Sticky nav bar with logo and links |
| `FOOTER` | Page footer |
| `BANNER` | Full-width announcement strip |
| `CARD-LIST` | Grid of cards from a data group |
| `TABLE` | Data table with header row |
| `STAT-GRID` | Grid of metric statistics |
| `INPUT` | Text / textarea input field |
| `BADGE` | Inline badge / tag |
| `CALLOUT` | Highlighted callout block |

---

## WITH INTENT

The AI compositor clause. Write the intent; the compositor writes the RECALL.

```cobol
RENDER-COMPARISON.
   DISPLAY CALLOUT
      WITH INTENT "Explain when to write RECALL by hand vs. using WITH INTENT."
      WITH DATA INTRO.
```

Run `recall expand page.rcl` to call the compositor and replace the WITH INTENT block with real RECALL source. The expanded file compiles cleanly — intent becomes structure.

---

## Diagnostics

RECALL has 33 structured diagnostic codes across errors and warnings:

| Range | Area |
|---|---|
| `RCL-001` – `RCL-015` | Core type, value, and structural errors |
| `RCL-016` – `RCL-027` | Statement, plugin, and reference errors |
| `RCL-028` – `RCL-030` | AUDIT DIVISION errors |
| `RCL-W01` – `RCL-W11` | Warnings (promotable to errors with `--strict`) |
| `CRD-001` – `CRD-004` | Common Record Description validation |

```sh
recall explain RCL-007       # human-readable entry
recall explain --list        # all 33 codes
recall check page.rcl        # run full diagnostic pass
```

---

## Semantic Diff

`recall diff` understands RECALL structure — not just text.

```sh
recall diff v1.rcl v2.rcl

RECALL DIFF  v1.rcl → v2.rcl
────────────────────────────────────────────────────────────
DATA DIVISION
  CHANGED   HERO-HEADING   "STILL HERE." → "BUILT FOR THE AI ERA."
  ADDED     HERO-BADGE     PIC X(20)
  REMOVED   INSTALL-HINT   PIC X(100)

PROCEDURE DIVISION
  REMOVED   RENDER-INSTALL   (1 statement)
  ADDED     RENDER-BADGE     (1 statement)
```

```sh
recall diff HEAD~1 HEAD page.rcl --suggest-audit
# Suggested AUDIT DIVISION entry:
#   2026-04-10  HERO-HEADING changed, HERO-BADGE added. Human. "".
```

---

## Pipeline Telemetry

Every non-preview compile captures and stores:

| Metric | Description |
|---|---|
| `compile_ms` | Wall-clock compile time |
| `output_chars` | Character count of generated HTML |
| `coverage_pct` | Populated fields / total fields × 100 |
| `truncations` | Fields where value was truncated to PIC X(n) limit |
| `human_touches` | Manually incremented when a post-compile fix is applied |

```sh
recall stats    # aggregate across all compiled cases
# Compiled cases:       228
# Avg compile_ms:       138
# Avg coverage_pct:     91%
# Total truncations:    3
```

---

## Library Usage

```ts
import {
  parse, generate, compile,
  parseFromSource, compileFromSource,
  diff, check,
} from '@semanticintent/recall-compiler'
import type {
  ReclProgram, DataField, DisplayStatement,
  AuditDivision, DiffResult,
} from '@semanticintent/recall-compiler'

// Compile file → HTML file
const result = compile('my-site.rcl', 'dist/')

// Compile from in-memory source (Workers, serverless, playground)
const { ok, html, diagnostics } = compileFromSource(source)

// Parse source → AST
const program = parse(source)

// Semantic diff
const changes = diff(sourceA, sourceB, 'v1', 'v2')
```

---

## Editor Support

Install the [RECALL VS Code extension](https://github.com/semanticintent/recall-vscode) for:

- Inline diagnostics as you type (all 33 RCL codes)
- Autocomplete — element names, PIC types, DATA field references
- Hover — PIC type, VALUE, and COMMENT for any field
- Go-to-definition — jump from PROCEDURE reference to DATA DIVISION declaration
- Rename — rename a field and update all references simultaneously

The extension uses the [RECALL Language Server](https://github.com/semanticintent/recall-lsp) (`@semanticintent/recall-lsp`) under the hood. Copilot and Cursor both consume LSP data — RECALL fields, types, and diagnostics are visible to AI coding assistants.

---

## Plugin System

Extend RECALL with domain-specific element libraries:

```cobol
ENVIRONMENT DIVISION.
   LOAD PLUGIN @stratiqx/recall-components.
   COPY FROM "@stratiqx/recall-components/themes/stratiqx-case.rcpy".
```

Plugins register custom renderers via `registerElement()`:

```ts
import { registerElement } from '@semanticintent/recall-compiler'

registerElement('CASE-HERO', (stmt, data) => {
  const title = data.workingStorage.find(f => f.name === 'CASE-TITLE')
  return `<div class="case-hero">${title?.value ?? ''}</div>`
})
```

---

## Examples

**Live examples** — compiled and deployed, view source to see the `.rcl` origin:

- [recall.semanticintent.dev](https://recall.semanticintent.dev) — RECALL documentation site, built in RECALL
- [recall.semanticintent.dev/changelog.html](https://recall.semanticintent.dev/changelog.html) — personal project changelog, compiled from `changelog.json` via `LOAD FROM`
- [recall.semanticintent.dev/playground.html](https://recall.semanticintent.dev/playground.html) — live compiler in the browser

**Source examples** — working `.rcl` files in [`examples/`](examples/):

- [`landing.rcl`](examples/landing.rcl) — RECALL's own landing page
- [`portfolio.rcl`](examples/portfolio.rcl) — personal portfolio page
- [`pricing.rcl`](examples/pricing.rcl) — component-driven pricing page

---

## Docs

Full language reference in [`docs/`](docs/):

- [`RECALL_SPEC.md`](docs/RECALL_SPEC.md) — complete language specification
- [`RECALL-GRAMMAR.md`](docs/RECALL-GRAMMAR.md) — formal EBNF grammar
- [`ERROR-REFERENCE.md`](docs/ERROR-REFERENCE.md) — all diagnostic codes
- [`PIPELINE-OVERVIEW.md`](docs/PIPELINE-OVERVIEW.md) — AI pipeline integration
- [`POST-1.0-SCOPE.md`](docs/POST-1.0-SCOPE.md) — telemetry, diff, AUDIT DIVISION, LSP

---

## Contributing

```sh
git clone https://github.com/semanticintent/recall-compiler
cd recall-compiler
npm install
npm test        # 124 tests
npm run build   # compile TypeScript → dist/
recall compile examples/landing.rcl
```

Open an issue before sending a large PR. Diagnostics and parser changes are the most sensitive areas — include tests.

---

## A note on COBOL

RECALL is an independent language inspired by COBOL's syntax and design philosophy. It shares no code with any COBOL implementation. The COBOL vocabulary — divisions, sections, `DISPLAY`, `WORKING-STORAGE` — is borrowed because it encodes business intent at the language level in a way that no modern web syntax does. That position, not nostalgia, is what RECALL inherits.

---

## License

MIT © [semanticintent](https://github.com/semanticintent)
