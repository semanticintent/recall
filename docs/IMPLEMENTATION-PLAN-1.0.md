# RECALL 1.0 Implementation Plan
# WITH INTENT + DATA COPY

> Created: April 2026
> Target: DATA COPY → v0.9.0 / WITH INTENT + Site Manifest → v1.0.0

---

## Summary

Two features gate the 1.0 release:

| Feature | Version | What it unlocks |
|---|---|---|
| DATA COPY | 0.9.0 | Shared field definitions across pages |
| WITH INTENT | 1.0.0 | AI composition primitive |
| Site Manifest | 1.0.0 | Multi-page publishing (depends on both) |

**DATA COPY ships first.** It is a pure preprocessor addition, no external
dependencies, follows the established COPY pattern. Its fields are part of the
WITH INTENT compositor payload — shipping it first makes that payload complete.

---

## Critical Path Risk: Four Pipeline Call Sites

The preprocessor pipeline is duplicated across four functions:
`compile()`, `check()`, `inspect()`, `parseFromSource()`.

Every new pipeline stage must be added to all four. A missed call site produces
a silent inconsistency (check passes, compile fails).

**Recommended pre-work before either feature:** Extract a shared helper:

```typescript
function runPreprocessorPipeline(source: string, dir: string): {
  source:          string
  dataCopyErrors:  DataCopyError[]
  recordErrors:    RecordError[]
  loadErrors:      DataLoadError[]
}
```

This makes the pipeline a single source of truth. All four public functions call it.
This is the single highest-leverage change before adding any new stage.

---

## Feature 1: DATA COPY (v0.9.0)

### What it is

`COPY FROM` in DATA DIVISION — shared field definitions from `.rcpy` copybooks,
resolved at compile time. Same keyword as ENVIRONMENT and COMPONENT divisions.

```cobol
DATA DIVISION.
   COPY FROM "shared/nav-fields.rcpy".
   WORKING-STORAGE SECTION.
      01 PAGE-TITLE PIC X(60) VALUE "Home".
```

A data copybook is a `.rcpy` file containing only a DATA DIVISION:

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 NAV-TITLE PIC X(40) VALUE "RECALL".
      01 NAV-HREF  PIC URL   VALUE "/".
   ITEMS SECTION.
      01 NAV-ITEMS.
         05 NAV-ITEMS-1.
            10 NAV-ITEMS-1-LABEL PIC X(30) VALUE "Home".
            10 NAV-ITEMS-1-HREF  PIC URL   VALUE "/".
```

### New Diagnostic Codes

| Code | Severity | Trigger |
|---|---|---|
| RCL-024 | error | DATA COPY file not found |
| RCL-025 | error | Field name collision between COPY and local/prior fields |
| RCL-026 | error | Circular DATA COPY dependency |

### Pipeline Position

```
resolveBlockValues
resolveThemeCopies
resolveComponentCopies
→ resolveDataCopies   ← NEW (after components, before records)
resolveRecordTypes
resolveDataLoads
parse
```

Must run after components (copybook may reference component names) and before
records (copybook may define record-compatible field structures). Before LOAD FROM
because DATA COPY fields are author-declared, LOAD FROM fields are synthetic.

### Implementation Steps

**Step 1 — codes.ts** (no logic, just registry — do this first)

Add RCL-024, RCL-025, RCL-026 to
`/Users/dev/workspace/recall-compiler/src/diagnostics/codes.ts`.

```typescript
'RCL-024': {
  code: 'RCL-024', severity: 'error', category: 'unknown-identifier',
  message: 'DATA COPY file not found',
  description: 'A COPY FROM in DATA DIVISION references a .rcpy file that cannot be found.',
  example: 'DATA DIVISION.\n   COPY FROM "shared/nav-fields.rcpy".   ← not found',
  fix: 'Verify the path relative to the .rcl file. For npm paths, verify the package is installed.',
  seeAlso: ['RCL-015', 'RCL-025', 'RCL-026'],
},
'RCL-025': {
  code: 'RCL-025', severity: 'error', category: 'structural',
  message: 'DATA COPY field name collision',
  description: 'A field name from a DATA COPY already exists (local or prior copybook). Duplicate skipped.',
  example: '01 NAV-TITLE PIC X(40) VALUE "Local".\nCOPY FROM "shared/nav.rcpy".   ← also declares NAV-TITLE',
  fix: 'Rename the colliding field in either the local DATA DIVISION or the copybook.',
  seeAlso: ['RCL-024', 'RCL-026'],
},
'RCL-026': {
  code: 'RCL-026', severity: 'error', category: 'structural',
  message: 'Circular DATA COPY dependency',
  description: 'A COPY FROM chain in DATA DIVISION creates a cycle.',
  example: '* nav.rcpy: COPY FROM "footer.rcpy"\n* footer.rcpy: COPY FROM "nav.rcpy"',
  fix: 'Extract shared fields into a third file that neither imports.',
  seeAlso: ['RCL-024', 'RCL-018'],
},
```

**Step 2 — compiler/index.ts**

Add `extractDataContent()` helper (mirrors `extractEnvContent()`):

```typescript
function extractDataContent(source: string): string[] {
  const lines = source.split('\n')
  const result: string[] = []
  let inData = false
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('DATA DIVISION')) { inData = true; continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('DATA DIVISION'))) {
      inData = false; continue
    }
    if (inData) result.push(line)
  }
  return result
}
```

Add `DataCopyError` and `DataCopyResult` interfaces:

```typescript
export interface DataCopyError {
  directive: string
  specifier: string
  code:      'RCL-024' | 'RCL-025' | 'RCL-026'
  message:   string
}
export interface DataCopyResult {
  source: string
  errors: DataCopyError[]
}
```

Add `resolveDataCopies()` function — mirrors `resolveComponentCopies()`:

```typescript
function resolveDataCopies(
  source:     string,
  dir:        string,
  seen:       Set<string> = new Set(),
  knownNames: Set<string> = new Set(),
): DataCopyResult {
  const lines = source.split('\n')
  const result: string[] = []
  const errors: DataCopyError[] = []
  let inData  = false
  let inValue = false

  for (const line of lines) {
    const t = line.trim()

    if (inValue) {
      result.push(line)
      if (t.trimEnd().endsWith('".')) inValue = false
      continue
    }
    if (opensMultilineValue(t)) { inValue = true; result.push(line); continue }

    if (t.startsWith('DATA DIVISION')) { inData = true; result.push(line); continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('DATA DIVISION'))) {
      inData = false; result.push(line); continue
    }

    if (inData && t.startsWith('COPY FROM')) {
      const match = t.match(/COPY FROM\s+"([^"]+)"/)
      if (match) {
        const specifier = match[1]
        let filePath: string
        try {
          filePath = resolve(resolveFilePath(specifier, dir))
        } catch {
          errors.push({ directive: t, specifier, code: 'RCL-024',
            message: `DATA COPY "${specifier}" — file not found` })
          continue
        }
        if (!existsSync(filePath)) {
          errors.push({ directive: t, specifier, code: 'RCL-024',
            message: `DATA COPY "${specifier}" — file not found` })
          continue
        }
        if (seen.has(filePath)) {
          errors.push({ directive: t, specifier, code: 'RCL-026',
            message: `Circular DATA COPY: "${specifier}" is already being included` })
          continue
        }
        const nextSeen = new Set(seen).add(filePath)
        const copySource = readFileSync(filePath, 'utf-8')
        const nested = resolveDataCopies(copySource, dirname(filePath), nextSeen, knownNames)
        errors.push(...nested.errors)
        const dataLines = extractDataContent(nested.source)
        for (const dl of dataLines) {
          const fieldMatch = dl.trim().match(/^01\s+([A-Z][A-Z0-9-]+)[\s.]/)
          if (fieldMatch) {
            const name = fieldMatch[1]
            if (knownNames.has(name)) {
              errors.push({ directive: t, specifier, code: 'RCL-025',
                message: `Field "${name}" from DATA COPY "${specifier}" collides with existing field` })
              continue
            }
            knownNames.add(name)
          }
          result.push(dl)
        }
      }
    } else {
      if (inData) {
        const fieldMatch = t.match(/^01\s+([A-Z][A-Z0-9-]+)[\s.]/)
        if (fieldMatch) knownNames.add(fieldMatch[1])
      }
      result.push(line)
    }
  }
  return { source: result.join('\n'), errors }
}
```

**Step 3 — pipeline insertion (all four call sites)**

In `compile()`, `check()`, `inspect()`, `parseFromSource()`:

```typescript
const withBlocks     = resolveBlockValues(source)
const withTheme      = resolveThemeCopies(withBlocks, dir)
const withComponents = resolveComponentCopies(withTheme, dir)
const dataCopyResult = resolveDataCopies(withComponents, dir)   // ← NEW
const recordResult   = resolveRecordTypes(dataCopyResult.source)
const loadResult     = resolveDataLoads(recordResult.source, dir)
```

Surface `dataCopyResult.errors` using the same DiagnosticCollector abort pattern
as RECORD errors (already established at line ~900 in compile()).

**Step 4 — No type checker changes required**

Fields are inlined before the parser runs. The type checker sees normal DataField
nodes. Add a comment in `buildSymbolTable()` noting the LOAD FROM / DATA COPY
collision gap (silent overwrite) as a known post-1.0 item.

**Step 5 — No generator changes required**

Fields are resolved before parse. Generator sees normal fields.

### Test Fixtures

File: `/Users/dev/workspace/recall-compiler/tests/compiler/data-copy.test.ts`

| Fixture | Asserts |
|---|---|
| `rcl024-missing.rcl` | RCL-024 in errors |
| `rcl025-collision.rcl` + `collision.rcpy` | RCL-025 in errors |
| `rcl026-a.rcpy` ↔ `rcl026-b.rcpy` | RCL-026 in errors |
| `happy-path.rcl` + `shared.rcpy` | ok: true, shared field visible in HTML |
| `nested-copy.rcl` → a.rcpy → b.rcpy | fields from both levels visible |
| `npm-path.rcl` with mock node_modules | happy path + RCL-024 when absent |
| `copy-plus-load-from.rcl` | both field sets visible, no collision |

---

## Feature 2: WITH INTENT (v1.0.0)

### What it is

An AI composition primitive. Annotates a DISPLAY statement with natural language
intent. `recall expand` sends the intent + context to a compositor, receives valid
RECALL source, writes an expanded file. The compiler validates the output — same
pipeline as any RECALL source.

```cobol
PROCEDURE DIVISION.

   RENDER.
      DISPLAY HERO
         WITH INTENT "dramatic opening, single product, urgency without hype"
         WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, CTA-PRIMARY.

   STOP RUN.
```

Before expansion: compiles with a placeholder HTML comment (RCL-W09 warning).
After expansion: `page.expanded.rcl` replaces the WITH INTENT with concrete
DISPLAY statements. Author reviews, renames, commits.

### New Diagnostic Codes

| Code | Severity | Trigger |
|---|---|---|
| RCL-W09 | warning | Unexpanded WITH INTENT clause — renders as placeholder |
| RCL-027 | error | Expansion failed — compositor returned invalid RECALL |

### New CLI Command

```sh
recall expand page.rcl                   # writes page.expanded.rcl
recall expand page.rcl --dry-run         # print compositor payload, no API call
recall expand page.rcl --out expanded/   # custom output path
```

### Compositor Payload

```json
{
  "intent": "dramatic opening, single product, urgency without hype",
  "element": "HERO",
  "dataFields": [
    { "name": "PRODUCT-NAME",    "pic": "X(60)",  "comment": "Product headline" },
    { "name": "PRODUCT-TAGLINE", "pic": "X(200)", "comment": "One-sentence description" },
    { "name": "CTA-PRIMARY",     "pic": "X(30)",  "comment": "Primary CTA label" }
  ],
  "palette": { "COLOR-BG": "#080808", "COLOR-ACCENT": "#00ff41" },
  "componentRegistry": ["PAGE-HERO", "SITE-NAV", "CARD-SECTION"],
  "schemaVersion": "1.0"
}
```

Expected response: `{ "source": "<valid RECALL PROCEDURE statements>" }`

The compositor contract is normative — document it in
`docs/COMPOSITOR-CONTRACT.md` before writing any prompt or integration code.

### Implementation Steps

**Step 1 — parser/rcl.ts**

Extend `DisplayStatement`:
```typescript
export interface DisplayStatement {
  // ... existing fields ...
  intent?: string   // content of WITH INTENT "..." — present means unexpanded
}
```

In `parseDisplayStatement()`, add a branch in the clause-parsing loop:
```typescript
if (kw === 'WITH' && tokens[i + 1] === 'INTENT' && i + 2 < tokens.length) {
  intent = extractString(tokens[i + 2])
  i += 3; continue
}
```

Assign `intent` to the returned statement. Verify `WITH DATA` clauses are still
captured when they follow `WITH INTENT` — test this first (write the failing
test before implementing).

Add a comment to `joinContinuationLines()` explicitly noting that `WITH` is NOT
in the new-statement heuristic list and must not be added.

**Step 2 — diagnostics/codes.ts**

Add RCL-W09 and RCL-027 entries (see code shapes in DATA COPY step 1 as template).

**Step 3 — typechecker/index.ts**

Add `checkUnexpandedIntents()` pass — walks all procedure statements recursively,
emits RCL-W09 for any `stmt.intent !== undefined`.

Add skip guard in `checkStatement()` before the RCL-003 element-name lookup:
```typescript
if (stmt.intent !== undefined) return   // compositor will resolve element name
```

**Step 4 — generator/html.ts**

In the main statement renderer, add before element dispatch:
```typescript
if (stmt.intent !== undefined) {
  return `<!-- WITH INTENT: ${escapeHtml(stmt.intent)} (unexpanded) -->`
}
```

**Step 5 — src/expand/index.ts** (new file — pure functions only)

Exports: `expand(opts: ExpandOptions): Promise<ExpandResult>`

Logic:
1. Run preprocessor pipeline on input file
2. Parse to AST
3. Collect all `stmt.intent !== undefined` statements
4. Build compositor payload per statement
5. POST to compositor endpoint
6. Inline returned source in place of WITH INTENT statements
7. Write `<basename>.expanded.rcl`
8. Run `check()` on expanded file — if fails, return RCL-027, do not write

**Step 6 — src/expand/prompt.ts** (new file)

System prompt string for the Anthropic API path. Lives separately from the
integration code so it can be iterated without touching logic.

**Step 7 — src/cli/commands/expand.ts** (new file)

Thin wrapper over `expand()`. Same pattern as scaffold.ts.

**Step 8 — cli/index.ts**

Register `expandCommand`. Add expand to help text block.

### Test Fixtures

File: `/Users/dev/workspace/recall-compiler/tests/compiler/expand.test.ts`

| Fixture | Asserts |
|---|---|
| `rcl-w09-unexpanded.rcl` | RCL-W09 in warningMessages |
| `rcl-w09-strict.rcl` | RCL-W09 in errors (strict mode) |
| `with-intent-placeholder.rcl` | compile() ok, HTML contains `<!-- WITH INTENT:` |
| `with-intent-with-data.rcl` | RCL-W06 NOT fired for WITH DATA fields |
| expand unit (mocked compositor) | payload shape correct |
| expand invalid response (mocked) | ExpandResult.ok false, RCL-027 present |

---

## New Files Summary

| File | Feature | Notes |
|---|---|---|
| `src/expand/index.ts` | WITH INTENT | Pure functions — no CLI coupling |
| `src/expand/prompt.ts` | WITH INTENT | System prompt string — iterable independently |
| `src/cli/commands/expand.ts` | WITH INTENT | Thin CLI wrapper |
| `docs/COMPOSITOR-CONTRACT.md` | WITH INTENT | Write before prompt or integration code |
| `tests/compiler/data-copy.test.ts` | DATA COPY | 7 fixtures |
| `tests/compiler/expand.test.ts` | WITH INTENT | 6 fixtures |

---

## Modified Files Summary

| File | Change |
|---|---|
| `src/diagnostics/codes.ts` | RCL-024, 025, 026, W09, 027 |
| `src/compiler/index.ts` | `resolveDataCopies()` + pipeline (×4 call sites) |
| `src/parser/rcl.ts` | `DisplayStatement.intent` + parser branch |
| `src/typechecker/index.ts` | `checkUnexpandedIntents()` + RCL-003 guard |
| `src/generator/html.ts` | WITH INTENT placeholder rendering |
| `src/cli/index.ts` | register expandCommand + help text |

---

## Version Targets

| Version | Scope |
|---|---|
| **0.9.0** | DATA COPY — RCL-024/025/026, `resolveDataCopies`, pipeline insertion, 7 tests |
| **1.0.0** | WITH INTENT — RCL-W09/027, `recall expand`, compositor contract, site manifest |
