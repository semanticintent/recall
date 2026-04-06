# RECALL Strict Mode — Structured Diagnostics

> Last updated: April 2026
> Status: **All 26 codes enforced — v0.8.1**
> Current version: 0.8.1

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

## What Shipped

The entire diagnostic infrastructure was implemented in v0.7.x, ahead of the
originally planned v0.9.x schedule. All four phases are complete.

| Phase | Deliverable | Version |
|---|---|---|
| 1 | Diagnostic infrastructure — collector, renderer, codes | v0.7.0 |
| 2 | Parser location tracking — line/col on every AST node | v0.7.0 |
| 3 | Type checker — symbol table, structural, statement, component passes | v0.7.0 |
| 4 | CLI integration — `--strict`, `--format json`, `--quiet`, exit codes | v0.7.0 |
| 5 | Error reference documentation (`docs/ERROR-REFERENCE.md`) | v0.7.3 |
| — | `recall explain` — live code queries from CLI | v0.7.x |
| — | `source` + `caret` fields in JSON output | v0.7.x |
| — | All 7 previously-unenforced codes now active (RCL-006, 013, 014, 015, 016, 018, W05) | v0.8.0 |

---

## Diagnostic Structure

Every diagnostic is a structured object:

```typescript
interface Diagnostic {
  code:     string            // RCL-001 — stable, searchable, documentable
  severity: 'error' | 'warning'
  file:     string            // absolute path to .rcl source
  line:     number            // 1-indexed
  col:      number            // 1-indexed, points to offending token
  length:   number            // character span for caret rendering
  category: DiagnosticCategory
  message:  string            // what is wrong
  why:      string            // why it is wrong
  hint?:    string            // how to fix it (optional but preferred)
  source?:  string | null     // the full source line (plain text, no ANSI)
  caret?:   string | null     // caret string aligned to the error column
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

The `source` and `caret` fields are included in `--format json` output so that
AI tools and editor integrations can render their own caret displays without
parsing ANSI sequences.

---

## Terminal Output Format

```
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

## Error Code Status

### Errors — abort compilation

| Code | Category | Description |
|---|---|---|
| `RCL-001` | type-mismatch | Element expects different PIC type than variable declared |
| `RCL-002` | value-constraint | VALUE exceeds declared PIC length |
| `RCL-003` | unknown-element | DISPLAY references unregistered element name |
| `RCL-004` | unknown-identifier | Variable or group referenced but not declared in DATA DIVISION |
| `RCL-005` | missing-required | Required division absent (PROCEDURE DIVISION) |
| `RCL-006` | missing-required | PROGRAM-ID or PAGE-TITLE absent from IDENTIFICATION DIVISION |
| `RCL-007` | group-shape | USING references a scalar, not a group |
| `RCL-008` | group-shape | GROUP declared but used where scalar expected |
| `RCL-009` | format | DATE value does not match ISO 8601 (YYYY-MM-DD) |
| `RCL-010` | format | URL value does not begin with http/https or / |
| `RCL-011` | format | PCT value outside 0–100 range |
| `RCL-012` | value-constraint | PIC 9 field contains non-numeric characters |
| `RCL-013` | structural | STOP RUN missing from PROCEDURE DIVISION |
| `RCL-014` | structural | COMPONENT body references an undefined component name |
| `RCL-015` | unknown-identifier | COPY FROM path cannot be resolved — structured diagnostic with JSON output |
| `RCL-016` | type-mismatch | WITH DATA passes a parameter name not declared in ACCEPTS |
| `RCL-017` | missing-required | COMPONENT called without a REQUIRED ACCEPTS parameter |
| `RCL-018` | structural | Circular COPY detected — `.rcpy` file includes itself directly or transitively |
| `RCL-019` | structural | RECORD type referenced but not defined |
| `RCL-020` | value-constraint | VALUE BLOCK encoding error |
| `RCL-021` | unknown-identifier | LOAD FROM — file not found or parse failed |
| `RCL-022` | format | Palette key has trailing period — colour lookup silently fails |

### Warnings — surface but allow compilation (errors in `--strict`)

| Code | Category | Description |
|---|---|---|
| `RCL-W01` | group-shape | Group declared but has no items — element will render empty |
| `RCL-W02` | value-constraint | VALUE near PIC length limit (>90% of declared max) |
| `RCL-W03` | format | AUTHOR or DATE-WRITTEN absent from IDENTIFICATION DIVISION |
| `RCL-W04` | structural | Procedure section contains no DISPLAY statements |
| `RCL-W05` | type-mismatch | Numeric field (PIC 9) used in string-accepting element — implicit coercion |

---

## CLI Flags

```bash
recall check <file>                # text diagnostics — errors abort, warnings shown
recall check <file> --strict       # warnings promoted to errors
recall check <file> --format json  # machine-readable diagnostic output
recall check <file> --quiet        # no output — exit code only
recall check <file> --inspect      # show DATA symbols generated by LOAD FROM
```

**Exit codes:**
```
0  — clean, no errors or warnings
1  — errors present, no output written
2  — warnings present (clean compile unless --strict)
```

**JSON output format:**

```json
{
  "file": "/abs/path/to/my-site.rcl",
  "errors": 2,
  "warnings": 1,
  "diagnostics": [
    {
      "code": "RCL-001",
      "severity": "error",
      "category": "type-mismatch",
      "file": "/abs/path/to/my-site.rcl",
      "line": 14,
      "col": 8,
      "message": "Type mismatch",
      "why": "HEADING-1 expects PIC X, HERO-STAT is PIC 9(4)",
      "hint": "Use DISPLAY LABEL for numeric display",
      "source": "      DISPLAY HEADING-1 HERO-STAT",
      "caret": "                    ^^^^^^^^^"
    }
  ],
  "fieldIntent": [
    { "name": "FETCH-SCORE", "pic": "X(10)", "section": "working-storage", "comment": "CAL fetch score 0-100" }
  ]
}
```

The `fieldIntent` block is only present when one or more DATA fields carry a
`COMMENT` clause. It gives AI tools the author's declared intent for each field
without requiring a separate query.

---

## Type System

### PIC Types

| Declaration | Type name | Constraint |
|---|---|---|
| `PIC X(n)` | string | max n characters |
| `PIC X` | string | max 1 character |
| `PIC 9` | boolean-numeric | 0 or 1 |
| `PIC 9(n)` | numeric | n digits, no decimals |
| `PIC DATE` | date | ISO 8601 — YYYY-MM-DD |
| `PIC URL` | url | must begin http/https or / |
| `PIC PCT` | percent | numeric 0–100 |
| `GROUP` | group | named collection of items (ITEMS SECTION) |

### Element Type Contracts

Each built-in element declares the types it accepts. The type checker validates
every `DISPLAY` statement against these contracts at compile time.

Run `recall schema --json` to see the live element registry — it reflects the
actual compiler state, not a static snapshot.

---

## Design Constraints

These principles are invariant — they do not change as new codes are added:

- **Collect all errors before aborting** — never stop at the first error
- **No output on error** — if errors present, no HTML file is written
- **No silent fallbacks** — unknown element = error, not ignored
- **Stable error codes** — RCL-001 means the same thing forever
- **Hints are preferred** — every error should suggest a fix where possible
- **`--strict` promotes warnings** — zero tolerance mode for CI pipelines
- **JSON output** — machine-readable for editor integrations and AI tooling
- **`source` + `caret` in JSON** — AI tools render their own display; no ANSI parsing required

---

## Reference Implementations

- **TypeScript** — structured diagnostics, error codes, strict mode
- **Rust** — caret rendering, "did you mean", zero implicit behaviour
- **VitePress** — hard build failure on dead links, all violations listed before abort
- **ESLint** — warning vs error severity, `--max-warnings 0` for strict CI
