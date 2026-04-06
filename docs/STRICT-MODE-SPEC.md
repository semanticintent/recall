# RECALL Strict Mode — Structured Diagnostics Specification

> Written: April 5, 2026
> Status: Specification — not yet implemented
> Target: recall-compiler v0.9.x

---

## Philosophy

RECALL does not fall back. RECALL does not infer. RECALL does not produce
silent output from ambiguous input.

If a program compiles, it is valid. If it is invalid, it does not compile —
and the author knows exactly why, exactly where, and exactly what to do.

This is the same contract as:
- Rust: zero implicit behaviour, every error explained
- TypeScript `strict: true`: no fallbacks, no silent coercion
- VitePress dead-link checking: build fails hard, all violations listed

The output HTML either exists and is correct, or does not exist at all.

---

## Diagnostic Structure

Every diagnostic is a structured object:

```typescript
interface Diagnostic {
  code:     string          // RCL-001 — stable, searchable, documentable
  severity: 'error' | 'warning'
  file:     string          // absolute path to .rcl source
  line:     number          // 1-indexed
  col:      number          // 1-indexed, points to offending token
  length:   number          // character span for caret rendering
  category: DiagnosticCategory
  message:  string          // what is wrong
  why:      string          // why it is wrong
  hint?:    string          // how to fix it (optional but preferred)
  context?: string          // surrounding source line for display
}

type DiagnosticCategory =
  | 'type-mismatch'
  | 'value-constraint'
  | 'unknown-identifier'
  | 'unknown-element'
  | 'missing-required'
  | 'group-shape'
  | 'structural'
  | 'format'
```

---

## Terminal Output Format

```
RECALL compile uc-228.rcl

ERROR [RCL-001] type-mismatch — uc-228.rcl:14:8
  DISPLAY HEADING-1 HERO-STAT
                    ^^^^^^^^^
  HEADING-1 expects PIC X (string)
  HERO-STAT is declared PIC 9(4) (numeric) at line 6
  Hint: use DISPLAY LABEL HERO-STAT for numeric display

ERROR [RCL-002] value-constraint — uc-228.rcl:8:22
  01 HERO-HEAD PIC X(40) VALUE "This string is longer than forty chars here".
                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  Declared: PIC X(40) — max 40 characters
  Provided: 44 characters (4 over limit)

ERROR [RCL-003] unknown-element — uc-228.rcl:31:6
  DISPLAY TIMELINE-X USING EVENTS.
          ^^^^^^^^^^
  No element TIMELINE-X is registered
  Did you mean: TIMELINE?

WARNING [RCL-W01] group-shape — uc-228.rcl:44:3
  DISPLAY CARD-LIST USING FEATURES.
  FEATURES is declared but has no items — output will be empty

─────────────────────────────────────────
  3 errors, 1 warning — compilation aborted
  No output written.
```

---

## Error Code Registry

### Errors — abort compilation

| Code | Category | Description |
|---|---|---|
| `RCL-001` | type-mismatch | Element expects different PIC type than variable declared |
| `RCL-002` | value-constraint | VALUE exceeds declared PIC length |
| `RCL-003` | unknown-element | DISPLAY references unregistered element name |
| `RCL-004` | unknown-identifier | Variable or group referenced but not declared in DATA DIVISION |
| `RCL-005` | missing-required | Required division or section absent (e.g. no PROCEDURE DIVISION) |
| `RCL-006` | missing-required | Required field absent from IDENTIFICATION DIVISION |
| `RCL-007` | group-shape | USING references a scalar, not a group |
| `RCL-008` | group-shape | GROUP declared but used where scalar expected |
| `RCL-009` | format | DATE value does not match ISO 8601 (YYYY-MM-DD) |
| `RCL-010` | format | URL value does not begin with http/https or / |
| `RCL-011` | format | PCT value outside 0–100 range |
| `RCL-012` | value-constraint | PIC 9 field contains non-numeric characters |
| `RCL-013` | structural | STOP RUN missing from PROCEDURE DIVISION |
| `RCL-014` | structural | COMPONENT referenced before DEFINE |
| `RCL-015` | unknown-identifier | COPY FROM path cannot be resolved |
| `RCL-016` | type-mismatch | ACCEPTS parameter type mismatch in COMPONENT call |
| `RCL-017` | missing-required | COMPONENT called without required ACCEPTS parameter |
| `RCL-018` | structural | Circular COPY detected |

### Warnings — surface but allow compilation (errors in `--strict`)

| Code | Category | Description |
|---|---|---|
| `RCL-W01` | group-shape | Group declared but has no items — element will render empty |
| `RCL-W02` | value-constraint | VALUE near PIC length limit (>90% of declared max) |
| `RCL-W03` | format | AUTHOR or DATE-WRITTEN absent from IDENTIFICATION DIVISION |
| `RCL-W04` | structural | Section defined in PROCEDURE DIVISION but never reached |
| `RCL-W05` | type-mismatch | Implicit string coercion applied (numeric used in text context) |

---

## Type System

### PIC Types

| Declaration | Type name | Constraint |
|---|---|---|
| `PIC X(n)` | string | max n characters |
| `PIC X` | string | max 1 character |
| `PIC 9(n)` | numeric | n digits, no decimals |
| `PIC 9(n)V9(m)` | decimal | n integer digits, m decimal digits |
| `PIC DATE` | date | ISO 8601 — YYYY-MM-DD |
| `PIC URL` | url | must begin http/https or / |
| `PIC PCT` | percent | numeric 0–100 |
| `GROUP` | group | named collection of items (ITEMS SECTION) |

### Element Type Expectations

Each registered element declares the types it accepts.
The type checker validates every DISPLAY statement against these contracts.

```typescript
interface ElementTypeContract {
  element:   string
  accepts:   'string' | 'numeric' | 'group' | 'none'
  picTypes?: string[]    // specific PIC types accepted, if constrained
  using?:    boolean     // requires USING clause (group reference)
}
```

Examples:

| Element | Accepts | Notes |
|---|---|---|
| `HEADING-1/2/3` | string | PIC X only |
| `PARAGRAPH` | string | PIC X only |
| `LABEL` | string | PIC X only |
| `BUTTON` | string | PIC X only, requires ON-CLICK |
| `CARD-LIST` | group | requires USING clause |
| `NAVIGATION` | group | requires USING clause |
| `TIMELINE` | group | requires USING clause |
| `SECTION` | none | container, no value |
| `DIVIDER` | none | no value |
| `IMAGE` | url | PIC URL |

---

## Implementation Plan

### Phase 1 — Diagnostic Infrastructure (v0.9.0)

Build the scaffolding before any type rules.

**Files to create:**
```
src/
  diagnostics/
    types.ts        — Diagnostic interface, DiagnosticCategory, severity
    collector.ts    — DiagnosticCollector class
    renderer.ts     — terminal output formatting (caret, colours, summary)
    codes.ts        — error code registry with message templates
```

**DiagnosticCollector:**
```typescript
class DiagnosticCollector {
  private items: Diagnostic[] = []

  error(code: string, location: SourceLocation, message: string, why: string, hint?: string): void
  warning(code: string, location: SourceLocation, message: string, why: string, hint?: string): void

  hasErrors(): boolean
  getAll(): Diagnostic[]
  render(): string    // formatted terminal output
}
```

**Key principle:** collector never throws. It accumulates. The compiler
decides when to abort — after collecting all diagnostics, not after the first.

**SourceLocation:**
```typescript
interface SourceLocation {
  file:   string
  line:   number
  col:    number
  length: number
  source: string   // the full source line, for caret rendering
}
```

**Caret renderer:**
```
  DISPLAY HEADING-1 HERO-STAT
                    ^^^^^^^^^
```
Pad to col, render `^` × length.

---

### Phase 2 — Parser Location Tracking (v0.9.1)

The parser (`src/parser/rcl.ts`) currently produces an AST without source
locations. Every AST node needs line/col attached for diagnostics to point
accurately.

**Changes to parser:**
- Attach `loc: SourceLocation` to every AST node
- Track line number as parser advances through source lines
- Track column offset within each line
- Pass source lines array into parse result for caret rendering

**AST nodes requiring location:**
- Every `DisplayStatement` — element name location
- Every `WorkingStorageItem` — variable name + VALUE location
- Every `GroupItem` — group name location
- Every `ProcedureSection` — section name location
- Every `ComponentDefinition` — component name location

This is the most invasive change — everything downstream reads from the AST.
Do this once, correctly, before building type rules.

---

### Phase 3 — Type Checker Pass (v0.9.2)

New compiler stage inserted between parse and generate:

```
parse → [type-check] → generate
```

If type-check produces errors: abort, render diagnostics, exit 1.
If type-check produces only warnings: render warnings, continue to generate.

**File to create:** `src/typechecker/index.ts`

**Checker structure:**
```typescript
function typeCheck(
  program: Program,
  source:  string,
  file:    string,
  opts:    { strict: boolean }
): DiagnosticCollector
```

**Passes in order:**

1. **Declaration pass** — build symbol table from DATA DIVISION
   - Every `WorkingStorageItem` → `{ name, picType, maxLength }`
   - Every group in `ITEMS SECTION` → `{ name, type: 'GROUP', items[] }`

2. **Structural pass** — check divisions and required fields
   - PROGRAM-ID present? (RCL-006)
   - PROCEDURE DIVISION present? (RCL-005)
   - STOP RUN present? (RCL-013)

3. **Statement pass** — walk every DisplayStatement
   - Resolve identifier → symbol table (RCL-004 if not found)
   - Look up element contract → element registry (RCL-003 if not found)
   - Check type compatibility → contract vs symbol (RCL-001)
   - Check USING clause → group expected, scalar provided (RCL-007/008)
   - Check VALUE constraints → length, format (RCL-002, RCL-009–012)

4. **Component pass** — validate COMPONENT DIVISION and call sites
   - Every ACCEPTS parameter declared? (RCL-017)
   - Parameter types match at call site? (RCL-016)
   - No circular definitions? (RCL-018)

---

### Phase 4 — CLI Integration (v0.9.3)

**Flags:**

```bash
recall compile my-site.rcl              # default: errors abort, warnings shown
recall compile my-site.rcl --strict     # warnings become errors
recall compile my-site.rcl --no-warn    # suppress warnings
recall check   my-site.rcl              # type-check only, no output written
```

`recall check` already exists as a command — extend it to run the full
type checker and render structured diagnostics.

**Exit codes:**
```
0  — clean compile, output written
1  — errors present, no output written
2  — warnings present, output written (unless --strict → exit 1)
```

**JSON output for tooling integration:**

```bash
recall check my-site.rcl --format json
```

```json
{
  "file": "my-site.rcl",
  "errors": 2,
  "warnings": 1,
  "diagnostics": [
    {
      "code": "RCL-001",
      "severity": "error",
      "line": 14,
      "col": 8,
      "message": "Type mismatch",
      "why": "HEADING-1 expects PIC X, HERO-STAT is PIC 9(4)",
      "hint": "Use DISPLAY LABEL for numeric display"
    }
  ]
}
```

---

### Phase 5 — Documentation (v0.9.4)

**Error reference page** — one entry per error code:

```markdown
## RCL-001 — Type Mismatch

**Category:** type-mismatch
**Severity:** error

An element was given a variable of the wrong PIC type.

### Example

    01 HERO-STAT PIC 9(4) VALUE 2978.
    DISPLAY HEADING-1 HERO-STAT.   ← ERROR

    HEADING-1 expects PIC X (string).
    HERO-STAT is declared PIC 9(4) (numeric).

### Fix

Declare the variable as PIC X, or use an element that accepts numeric input:

    DISPLAY LABEL HERO-STAT.    ← LABEL accepts numeric
```

One page per error code. Stable URLs: `/errors/RCL-001`.

---

## Rollout Order

| Version | Deliverable |
|---|---|
| v0.9.0 | Diagnostic infrastructure — collector, renderer, codes |
| v0.9.1 | Parser location tracking — line/col on every AST node |
| v0.9.2 | Type checker pass — symbol table, structural, statement, component |
| v0.9.3 | CLI integration — `--strict`, `--format json`, exit codes |
| v0.9.4 | Error reference documentation |
| v1.0.0 | Strict mode on by default |

---

## Design Constraints

- **Collect all errors before aborting** — never stop at the first error
- **No output on error** — if errors present, no HTML file is written
- **No silent fallbacks** — unknown element = error, not ignored
- **Stable error codes** — RCL-001 means the same thing forever
- **Hints are preferred** — every error should suggest a fix where possible
- **`--strict` promotes warnings** — zero tolerance mode for CI pipelines
- **JSON output** — machine-readable for editor integrations and CI reporting

---

## Reference Implementations

- **TypeScript** — structured diagnostics, error codes, strict mode
- **Rust** — caret rendering, "did you mean", zero implicit behaviour
- **VitePress** — hard build failure on dead links, all violations listed before abort
- **ESLint** — warning vs error severity, `--max-warnings 0` for strict CI
