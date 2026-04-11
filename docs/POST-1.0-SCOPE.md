# RECALL Post-1.0 Feature Scope

> Version: 0.1 (draft)
> Status: Scoped — not yet implemented
> Covers: LSP, recall diff, AUDIT DIVISION, Performance Telemetry

---

## Overview

Four features that extend the RECALL philosophy without changing the foundation.
The language is stable at 1.0. These features deepen the tooling, the provenance
model, and the observability of the pipeline.

None of these touch the core element vocabulary or the compiler contract.
Breaking changes are not required. Each feature is independently implementable
in the order below.

---

## 1. Performance Telemetry

**Status:** Scoped
**Effort:** Small — instrumentation only, no new language constructs
**Why first:** Unblocks measurement of everything that follows. Once telemetry
runs, every subsequent feature ships with observable impact data.

---

### What it adds

Compile-time metrics captured automatically during `generate()` and written
to brief JSON and `index.json` on every non-preview compile.

### Metrics

| Metric | Description |
|---|---|
| `compile_ms` | Total time from `parseFromSource()` to HTML string |
| `output_chars` | Character count of final HTML |
| `fields_populated` | DATA DIVISION fields with non-empty VALUES |
| `fields_total` | Total fields declared |
| `coverage_pct` | `fields_populated / fields_total × 100` |
| `truncations` | Fields where value was truncated to PIC X(n) limit |
| `human_touches` | Manually incremented when post-compile fix applied |

### Output shape

Added to brief JSON alongside existing fields:

```json
{
  "CASE-ID": "UC-230",
  "meta": {
    "compile_ms": 142,
    "output_chars": 81311,
    "coverage_pct": 94,
    "truncations": 0,
    "human_touches": 0
  }
}
```

Added to `uc-000/index.json` per-case entry:

```json
{
  "num": "230",
  "fetch": 3610,
  "meta": {
    "compile_ms": 142,
    "output_chars": 81311,
    "coverage_pct": 94,
    "truncations": 0,
    "human_touches": 0
  }
}
```

### New CLI flag

```sh
recall compile page.rcl --telemetry    # emit metrics to stdout alongside output
recall stats                           # aggregate across all compiled cases
```

`recall stats` reads all `index.json` entries with `meta` blocks and reports:

```
Compiled cases:      228
Avg compile_ms:      138
Avg output_chars:    79,402
Avg coverage_pct:    91%
Total truncations:   3
Avg human_touches:   0.4
```

### Implementation

Telemetry lives in the tool layer that calls the compiler — not in the
compiler itself. The compiler is a pure function. `generate()` returns the
HTML string; the caller measures elapsed time and character count.

```typescript
// In generate-case-html.ts (semantic-cal-workflow-mcp)
const t0 = Date.now()
const html = await compile(source, options)
const meta = {
  compile_ms:       Date.now() - t0,
  output_chars:     html.length,
  fields_populated: countPopulated(plan.fields),
  fields_total:     Object.keys(plan.fields).length,
  coverage_pct:     Math.round(populated / total * 100),
  truncations:      plan.diagnostics.filter(d => d.code === 'RCL-W02').length,
  human_touches:    0,
}
```

`truncations` surfaces RCL-W02 (value near PIC X limit) as a pipeline
quality metric — currently visible only in diagnostic output, now tracked
across the full case library.

### New diagnostic

| Code | Severity | Trigger |
|---|---|---|
| `RCL-W10` | warning | `truncations > 0` at end of compile — surfaced in telemetry summary |

---

## 2. `recall diff` — Semantic Diff

**Status:** Scoped
**Effort:** Medium — new module, builds on existing AST
**Why second:** Immediately useful once telemetry shows which cases are
changing most. Also the foundation the AUDIT DIVISION needs.

---

### What it adds

A diff that understands RECALL structure, not just text. Compares two
`.rcl` sources — or two git revisions — and reports what changed at the
field and section level.

### CLI

```sh
recall diff v1.rcl v2.rcl              # compare two files
recall diff HEAD~1 HEAD page.rcl       # compare git revisions
recall diff --format json v1.rcl v2.rcl  # machine-readable output
```

### Output

```
RECALL DIFF  v1.rcl → v2.rcl

DATA DIVISION
  CHANGED   HERO-HEADING     "STILL HERE." → "BUILT FOR THE AI ERA."
  ADDED     HERO-BADGE       PIC X(20) VALUE "NEW"
  REMOVED   INSTALL-HINT     PIC X(100)

PROCEDURE DIVISION
  CHANGED   RENDER-WHY       CARD-LIST WITH COLUMNS 3 → WITH COLUMNS 2
  REMOVED   RENDER-INSTALL   section (3 statements)
  ADDED     RENDER-BADGE     DISPLAY BADGE WITH HERO-BADGE

IDENTIFICATION DIVISION
  CHANGED   DATE-WRITTEN     2026-04-07 → 2026-04-10
```

### JSON output

```json
{
  "schema": "recall-diff/1.0",
  "from": "v1.rcl",
  "to":   "v2.rcl",
  "changes": [
    {
      "division":  "DATA",
      "operation": "changed",
      "field":     "HERO-HEADING",
      "from":      "STILL HERE.",
      "to":        "BUILT FOR THE AI ERA."
    },
    {
      "division":  "PROCEDURE",
      "operation": "removed",
      "section":   "RENDER-INSTALL",
      "statements": 3
    }
  ]
}
```

### Implementation

```typescript
// src/diff/index.ts

interface DiffResult {
  schema:  'recall-diff/1.0'
  from:    string
  to:      string
  changes: Change[]
}

type Change =
  | { division: 'DATA';      operation: 'added' | 'removed' | 'changed'; field: string; pic?: string; from?: string; to?: string }
  | { division: 'PROCEDURE'; operation: 'added' | 'removed' | 'changed'; section: string; statements?: number }
  | { division: 'IDENTIFICATION'; operation: 'changed'; field: string; from: string; to: string }

function diff(sourceA: string, sourceB: string): DiffResult
```

The diff function:
1. Parses both sources into ASTs using the existing parser
2. Walks DATA DIVISION fields — compare by field name, detect added/removed/changed
3. Walks PROCEDURE DIVISION sections — compare by section name, detect added/removed
4. Within changed sections, compare statement-level — element name + WITH DATA fields
5. Returns structured `DiffResult`

The existing parser handles both sources. No new grammar required.

### Git integration

```sh
recall diff HEAD~1 HEAD page.rcl
```

Shells out to `git show HEAD~1:page.rcl` and `git show HEAD:page.rcl`,
feeds both strings to `diff()`. Same output format.

### New CLI command

```typescript
// src/cli/commands/diff.ts
// thin wrapper around src/diff/index.ts
// supports --format json, --format text (default)
```

---

## 3. AUDIT DIVISION

**Status:** Scoped
**Effort:** Medium — new division, parser change, generator change
**Why third:** Builds on `recall diff` (change detection feeds the audit log).
The most philosophically significant feature — formal provenance as a
language construct.

---

### What it adds

A new optional division that records who changed what, when, and with what
intent. Compiled into the artifact. Permanent. Structured.

### Syntax

```cobol
AUDIT DIVISION.
   CREATED-BY.    Michael Shatny.
   CREATED-DATE.  2026-04-07.
   CHANGE-LOG.
      2026-04-07  HERO-HEADING updated. Human. "Sharpened the opening line."
      2026-04-08  RENDER-WHY expanded. AI compositor. "Added third card per WITH INTENT."
      2026-04-10  HERO-BADGE added. Human. "New badge for launch week."
```

### Grammar addition

```ebnf
program =
    IDENTIFICATION_DIVISION
    [ ENVIRONMENT_DIVISION ]
    [ DATA_DIVISION ]
    [ COMPONENT_DIVISION ]
    [ AUDIT_DIVISION ]           ← new, optional, before PROCEDURE
    PROCEDURE_DIVISION ;

AUDIT_DIVISION =
    "AUDIT DIVISION" "."
    "CREATED-BY." name "."
    "CREATED-DATE." iso-date "."
    [ "CHANGE-LOG." change-entry+ ]

change-entry =
    iso-date  change-subject  author-kind  quoted-string "."

change-subject = identifier { identifier }
author-kind    = "Human" | "AI compositor" | "AI agent"
```

### Compiled output

The AUDIT DIVISION compiles into an HTML comment block embedded in the
generated output — invisible to the reader, present for tooling:

```html
<!--
  RECALL AUDIT
  created-by:   Michael Shatny
  created-date: 2026-04-07
  changes:
    2026-04-07  HERO-HEADING updated        Human           "Sharpened the opening line."
    2026-04-08  RENDER-WHY expanded         AI compositor   "Added third card per WITH INTENT."
    2026-04-10  HERO-BADGE added            Human           "New badge for launch week."
-->
```

Also embedded in the brief JSON:

```json
{
  "audit": {
    "createdBy":   "Michael Shatny",
    "createdDate": "2026-04-07",
    "changeLog": [
      { "date": "2026-04-07", "subject": "HERO-HEADING", "author": "Human",         "note": "Sharpened the opening line." },
      { "date": "2026-04-08", "subject": "RENDER-WHY",   "author": "AI compositor", "note": "Added third card per WITH INTENT." }
    ]
  }
}
```

### `recall audit` CLI command

```sh
recall audit page.rcl              # print change log
recall audit page.rcl --format json  # machine-readable
recall audit page.rcl --since 2026-04-08  # filter by date
```

### Integration with `recall diff`

When `recall diff` detects changes between two revisions, it can suggest
an AUDIT DIVISION entry:

```sh
recall diff HEAD~1 HEAD page.rcl --suggest-audit

Suggested AUDIT DIVISION entry:
  2026-04-10  HERO-HEADING updated, HERO-BADGE added. Human. "".
```

The author fills in the quoted note. One command, one edit, provenance recorded.

### New diagnostic codes

| Code | Severity | Trigger |
|---|---|---|
| `RCL-W11` | warning | AUDIT DIVISION present but CHANGE-LOG is empty |
| `RCL-028` | error | CREATED-DATE is not valid ISO 8601 |
| `RCL-029` | error | Change entry date is earlier than CREATED-DATE |
| `RCL-030` | error | Change entry author-kind is not a recognised value |

### Implementation

```typescript
// src/parser/rcl.ts — add AUDIT_DIVISION parsing
// src/typechecker/index.ts — add RCL-028, RCL-029, RCL-030 checks
// src/generator/index.ts — emit audit HTML comment block
// src/cli/commands/audit.ts — new CLI command
// src/diff/index.ts — add --suggest-audit flag
```

AST addition:

```typescript
interface AuditDivision {
  kind:        'AuditDivision'
  createdBy:   string
  createdDate: string      // ISO 8601
  changeLog:   ChangeEntry[]
}

interface ChangeEntry {
  date:       string       // ISO 8601
  subject:    string       // field or section name
  authorKind: 'Human' | 'AI compositor' | 'AI agent'
  note:       string
}
```

---

## 4. LSP — Language Server Protocol

**Status:** Scoped
**Effort:** Large — new package, incremental parsing, protocol layer
**Why last:** Highest effort, most infrastructure. Everything above
makes RECALL more useful in the pipeline. The LSP makes RECALL feel
like a real language to anyone who opens a `.rcl` file for the first time.

---

### What it adds

RECALL as a first-class language in VS Code, Neovim, JetBrains, and any
LSP-capable editor. The same contract the compiler enforces — available
as you type, not just at compile time.

### Features

| Feature | Description |
|---|---|
| Diagnostics | Inline RCL errors and warnings as you type — no compile step |
| Autocomplete | Element names, PIC types, clause keywords, field references |
| Hover | PIC type, VALUE, and COMMENT clause for any field reference |
| Go-to-definition | From PROCEDURE DIVISION reference → DATA DIVISION declaration |
| Rename | Rename a field — all references update simultaneously |
| Signature help | DISPLAY element — show required and optional WITH DATA fields |
| Code actions | Apply `recall fix` suggestions inline |

### Why the foundation is already there

| LSP requirement | RECALL already has |
|---|---|
| Grammar | `docs/RECALL-GRAMMAR.md` — formal EBNF |
| Symbol table | `check()` builds a full symbol table per compile |
| Diagnostic codes | 29 codes across errors and warnings |
| Schema | `recall schema --json` — live element registry |
| Error recovery | Parser never aborts — always produces partial AST |

The hard parts of an LSP are already implemented. The protocol layer is
the surface. The incremental parsing layer is the main new work.

### Package structure

```
@semanticintent/recall-lsp/
├── src/
│   ├── server.ts          — LSP server entry point (stdio transport)
│   ├── documents.ts       — document store, incremental parse cache
│   ├── diagnostics.ts     — compile() → LSP Diagnostic[]
│   ├── completion.ts      — autocomplete provider
│   ├── hover.ts           — hover provider
│   ├── definition.ts      — go-to-definition provider
│   ├── rename.ts          — rename provider
│   ├── codeActions.ts     — code action provider (recall fix integration)
│   └── signature.ts       — signature help provider
├── package.json
└── tsconfig.json
```

Separate npm package — `@semanticintent/recall-lsp` — keeps the compiler
package clean. The LSP depends on `@semanticintent/recall-compiler`. The
compiler does not know the LSP exists.

### VS Code extension

```
recall-vscode/
├── package.json          — contributes .rcl language, starts LSP server
├── src/
│   └── extension.ts      — activates LSP client
└── syntaxes/
    └── recall.tmLanguage.json  — TextMate grammar for syntax highlighting
```

Two-step release: syntax highlighting ships first (TextMate grammar only,
no LSP dependency), full LSP ships second.

### Incremental parsing

The LSP calls `compile()` on every keystroke — within debounce. The
existing `compile()` is fast enough for single files (target: < 50ms).
No incremental AST required for v1 of the LSP — full reparse on change
is acceptable given the compiler's speed.

If profiling shows reparse latency > 50ms on large files, incremental
parsing is introduced as an optimisation, not a prerequisite.

### Autocomplete details

**Element names** — sourced from `recall schema --json` element registry.
Every element in the registry is a completion candidate inside PROCEDURE DIVISION.

**PIC types** — `X(n)`, `9(n)`, `A(n)`, `BOOLEAN`, `DATE`, `URL`, `PCT`,
`CURRENCY` — shown when cursor is after `PIC` keyword.

**Field references** — DATA DIVISION field names shown as completions
inside `WITH DATA`, `USING`, and `RESOLVE` clauses. Type-filtered where
the element's field type is known.

**Clause keywords** — `WITH DATA`, `USING`, `WITH INTENT`, `VALUE`,
`COPY FROM`, `LOAD PLUGIN` — context-aware keyword completions.

### Diagnostic mapping

```typescript
// LSP Diagnostic severity mapping
'error'   → DiagnosticSeverity.Error
'warning' → DiagnosticSeverity.Warning

// RCL code → LSP diagnostic code
// All 29 existing codes map directly
// New LSP-specific codes: none required — compiler codes are sufficient
```

### New diagnostic codes

None — the existing 29 RCL codes are the diagnostic vocabulary.
The LSP surfaces them inline; it does not add new ones.

---

## Implementation Order

```
Phase 1 — Telemetry          Small.  No new language. Ships fast.
Phase 2 — recall diff        Medium. New module. Builds on parser.
Phase 3 — AUDIT DIVISION     Medium. New division. Builds on diff.
Phase 4 — LSP                Large.  New package. Builds on everything.
```

Each phase is independently shippable. Phase 4 is the only one with
an external dependency (VS Code marketplace submission).

---

## What Each Feature Proves

| Feature | What it proves |
|---|---|
| Telemetry | The pipeline is measurable — autonomous operation is trackable |
| `recall diff` | Source is the artifact — change is structurally visible, not just textual |
| AUDIT DIVISION | Provenance is a language construct — human and AI authorship are formally recorded |
| LSP | RECALL is a real language — the tooling meets the standard any serious language provides |

Together they complete the post-1.0 maturity story: a language that measures
itself, diffs itself, records its own history, and integrates with every
serious development environment. The philosophy is unchanged. The surface area
that proves the philosophy is now complete.
