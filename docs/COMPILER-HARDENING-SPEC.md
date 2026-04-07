# RECALL Compiler Hardening Spec
## Four Lessons from COBOL — Applied to an AI-First Compiler

> Version: 0.2 — Scoped for implementation  
> Status: RCL-023 and RCL-W06 ready to implement. DATA COPY deferred (separate session).  
> Context: Prerequisite work before WITH INTENT ships. The AI compositor contract requires a compiler that catches everything it can catch.

---

## Why This Matters for AI-First

A human programmer reads context. They notice a missing terminator, remember a field was never initialised, catch a size overflow by eye. Imperfect, but they carry implicit knowledge.

An AI compositor has no implicit knowledge. It operates strictly on what is formally declared — the schema, the DATA DIVISION, the COMMENT clauses. Any ambiguity the compiler does not catch becomes an ambiguity the AI inherits and potentially propagates silently at scale.

The WITH INTENT contract is: *the AI composites within the language, the compiler validates the output.* That contract is only as strong as the compiler's ability to catch everything that can go wrong. Every silent failure is a hole in the contract.

---

## Status Overview

| Item | Code | Status | Notes |
|---|---|---|---|
| Missing terminator | `RCL-023` | **TODO** | Next session — small, self-contained |
| Uninitialised field | `RCL-W06` | **TODO** | Next session — new typechecker pass |
| PIC size overflow | `RCL-002` / `RCL-W02` | **DONE** | Already fully implemented in `checkDataValues` |
| DATA COPY clause | `RCL-024/025/026` | **DEFERRED** | Large feature — separate focused session |

---

## Item 1 — RCL-023: Missing Statement Terminator

### The COBOL lesson
COBOL's dot terminated entire logical blocks — a misplaced or missing dot silently restructured program logic with no warning.

### RECALL's current state
RECALL statements are single-line by design so dot cannot collapse nested scope. However: if a `.` is missing on a DISPLAY statement, the parser currently processes it silently with no diagnostic emitted.

### Where to implement
**File:** `src/parser/rcl.ts`  
**Function:** `parseProcedure()` — lines 491–556  
**Approach:** In `joinContinuationLines`, the raw line text is available before `.` stripping. Check each DISPLAY/STOP-RUN line for a terminating `.` before `replace(/\.$/, '')` strips it. If absent, record the location for a diagnostic.

Currently `joinContinuationLines` strips the dot silently:
```typescript
const tokens = text.replace(/\.$/, '').split(/\s+/)
```

**The challenge:** the parser does not currently return diagnostics — it only returns an AST. Terminator errors need to surface through the typechecker or a new parser-level diagnostic channel.

**Recommended approach:** add an optional `parseWarnings: ParseWarning[]` array to `ReclProgram` (populated by the parser), then have the typechecker drain it into the `DiagnosticCollector` at the start of `typeCheck()`. This keeps the parser pure (no DC dependency) while surfacing parse-level issues.

### Diagnostic spec

**Code:** `RCL-023`  
**Name:** `missing-terminator`  
**Severity:** error  
**Category:** syntax

**Error output (text):**
```
ERROR [RCL-023] missing-terminator — program.rcl:14:29
  DISPLAY HEADING-1 PAGE-TITLE
                               ^
  Statement has no terminator
  Every RECALL statement must end with a period (.)
```

**Error output (JSON):**
```json
{
  "code": "RCL-023",
  "severity": "error",
  "category": "syntax",
  "line": 14,
  "col": 29,
  "message": "Statement has no terminator",
  "hint": "Every RECALL statement ends with a full stop (.)"
}
```

**`recall explain RCL-023`:**
```
RCL-023 — missing-terminator
Category: syntax
Severity: error
Message:  A PROCEDURE DIVISION statement was found without a terminating period.
Hint:     Every RECALL statement ends with a full stop. Add . at the end of the line.
```

### Exemptions
- Comment lines (`*`) — exempt
- Division/section headers — exempt (they end in `.` by design, parser already handles)
- Blank lines — exempt
- Multi-line VALUE strings in DATA DIVISION — exempt (tracked via `inValueString` flag already in parser)

### codes.ts entry to add
```typescript
'RCL-023': {
  code:        'RCL-023',
  severity:    'error',
  category:    'syntax',
  message:     'Statement has no terminator',
  description: 'A PROCEDURE DIVISION statement does not end with a period. Every RECALL statement must be terminated with a full stop.',
  example:     'DISPLAY HEADING-1 PAGE-TITLE   ← missing period',
  fix:         'Add a period at the end of the statement: DISPLAY HEADING-1 PAGE-TITLE.',
  seeAlso:     [],
},
```

---

## Item 2 — RCL-W06: Uninitialised Field

### The COBOL lesson
COBOL fields without initial values contained garbage memory. Programs produced wrong output with no warning. Silent, untraceable.

### RECALL's current state
A field declared without a `VALUE` clause renders empty silently. An AI compositor may declare fields without values, see no error, and produce blank output with no diagnostic signal.

### Where to implement
**File:** `src/typechecker/index.ts`  
**New pass:** `checkUninitialisedFields()` — add after `checkDataValues()` in the `typeCheck()` function  
**Approach:**  
1. Walk all PROCEDURE DIVISION statements and collect every field name referenced (as `stmt.value` or in USING/WITH DATA clauses) into a `referencedNames: Set<string>`
2. Walk all DATA DIVISION fields — if `field.value === ''` AND the field name is in `referencedNames`, emit `RCL-W06`
3. Fields not referenced in PROCEDURE DIVISION do not warn (avoids noise from DATA templates)

### Key distinction — explicit empty vs missing
- `VALUE ""` — explicit empty, intentional, **no warning**
- `VALUE " "` — explicit space, intentional, **no warning**  
- No VALUE clause at all → parsed as `value: ''` in `DataField` — **warn**

**Problem:** the parser currently cannot distinguish "VALUE was declared as empty string" from "VALUE was never declared". Both result in `field.value === ''`.

**Fix needed in parser first:** add `valueSet: boolean` to `DataField` interface (true if VALUE clause was present, regardless of its content). Set it in `parsePicValue()`.

```typescript
// In src/parser/rcl.ts — DataField interface
export interface DataField {
  level:    DataLevel
  name:     string
  pic:      string
  value:    string
  valueSet: boolean   // ← ADD: true if VALUE clause was present
  comment?: string
  children: DataField[]
  loc?:     NodeLocation
}
```

```typescript
// In parsePicValue() — return valueSet flag
return { pic, value, comment, valueSet: valueIdx >= 0 }
```

### Diagnostic spec

**Code:** `RCL-W06`  
**Name:** `uninitialised-field`  
**Severity:** warning  
**Category:** data

**Warning output (text):**
```
WARNING [RCL-W06] uninitialised-field — program.rcl:8:4
  01 PAGE-SUBTITLE PIC X.
     ^^^^^^^^^^^^
  Field referenced in PROCEDURE DIVISION has no VALUE clause
  Hint: add VALUE "..." or VALUE "" to declare intent explicitly
```

**Warning output (JSON):**
```json
{
  "code": "RCL-W06",
  "severity": "warning",
  "category": "data",
  "line": 8,
  "col": 4,
  "message": "Field referenced in PROCEDURE DIVISION has no VALUE clause",
  "hint": "Add VALUE \"...\" to set a value, or VALUE \"\" for intentional empty"
}
```

**`recall explain RCL-W06`:**
```
RCL-W06 — uninitialised-field
Category: data
Severity: warning
Message:  A field is referenced in PROCEDURE DIVISION but has no VALUE clause in DATA DIVISION.
          The field will render empty. This may be intentional but is ambiguous.
Hint:     Add VALUE "..." to set a value. Use VALUE "" to explicitly declare an empty field.
          This distinction matters for AI compositors — an explicit empty is intentional;
          a missing VALUE is ambiguous.
```

### codes.ts entry to add
```typescript
'RCL-W06': {
  code:        'RCL-W06',
  severity:    'warning',
  category:    'data',
  message:     'Field has no VALUE clause',
  description: 'A field is referenced in PROCEDURE DIVISION but was declared without a VALUE clause. The field renders empty. For AI compositor clarity, every referenced field should have an explicit VALUE.',
  example:     '01 PAGE-SUBTITLE PIC X.\nDISPLAY PARAGRAPH PAGE-SUBTITLE.   ← no VALUE declared',
  fix:         'Add VALUE "..." to the field declaration, or VALUE "" to explicitly declare an intentional empty.',
  seeAlso:     ['RCL-006'],
},
```

---

## Item 3 — PIC Size Overflow (DONE)

Already fully implemented as `RCL-002` (error — value exceeds declared length) and `RCL-W02` (warning — value near limit) in `checkDataValues()` in `src/typechecker/index.ts` lines 576–587.

No work needed.

---

## Item 4 — DATA COPY Clause (DEFERRED)

### Why deferred
COPY is a new parser feature requiring file I/O during parsing, a recursive resolver, circular dependency detection, and symbol table merging. It's a self-contained architectural addition that warrants its own focused session rather than being bolted onto the RCL-023/W06 implementation.

### When to revisit
Before WITH INTENT implementation. WITH INTENT requires a *closed* symbol table — COPY resolution must be complete before the AI compositor sees the DATA DIVISION. This is the last prerequisite before WITH INTENT can be fully implemented.

### New codes reserved for COPY session
- `RCL-024` — `unresolved-copy` (file not found)
- `RCL-025` — `circular-copy` (cycle in COPY chain)
- `RCL-026` — `duplicate-field` (field name collision between COPY and local DATA)

---

## Implementation Order for Next Session

**Step 1 — Parser change (required for both items)**
- Add `valueSet: boolean` to `DataField` in `src/parser/rcl.ts`
- Update `parsePicValue()` to return and set `valueSet`
- Update `parseDataField()` to pass `valueSet` through

**Step 2 — RCL-023: Missing terminator**
- Add `ParseWarning` type and `parseWarnings` array to `ReclProgram`
- In `parseProcedure()`, detect DISPLAY lines missing `.` before stripping
- In `typeCheck()`, drain `parseWarnings` into `DiagnosticCollector` at start
- Add `RCL-023` to `codes.ts`
- Add `recall explain RCL-023` support (already works via codes registry)

**Step 3 — RCL-W06: Uninitialised field**
- Add `collectReferencedNames()` helper — walks all PROCEDURE statements
- Add `checkUninitialisedFields()` pass in typechecker
- Call it from `typeCheck()` after `checkDataValues()`
- Add `RCL-W06` to `codes.ts`

**Step 4 — Tests**
- Add test cases to the existing test suite for both diagnostics
- Confirm `recall check --format json` emits correct codes

**Step 5 — Version bump**
- Bump to `0.8.7` in `package.json`
- Update `recall-site` dependency and rebuild

---

## Files touched

| File | Change |
|---|---|
| `src/parser/rcl.ts` | Add `valueSet` to `DataField`, `ParseWarning` type, populate in `parseProcedure` |
| `src/typechecker/index.ts` | New `collectReferencedNames()`, `checkUninitialisedFields()`, drain parse warnings |
| `src/diagnostics/codes.ts` | Add `RCL-023` and `RCL-W06` entries |

Three files. No new files needed. No architectural changes beyond the `ParseWarning` channel.
