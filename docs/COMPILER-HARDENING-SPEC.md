# RECALL Compiler Hardening Spec
## Four Lessons from COBOL — Applied to an AI-First Compiler

> Version: 0.1 — Draft  
> Status: Pre-implementation  
> Context: Prerequisite work before WITH INTENT ships. The AI compositor contract requires a compiler that catches everything it can catch. These four items close the known gaps.

---

## Why This Matters for AI-First

A human programmer reads context. They notice a missing terminator, remember a field was never initialised, catch a size overflow by eye. Imperfect, but they carry implicit knowledge.

An AI compositor has no implicit knowledge. It operates strictly on what is formally declared — the schema, the DATA DIVISION, the COMMENT clauses. Any ambiguity the compiler does not catch becomes an ambiguity the AI inherits and potentially propagates silently at scale.

The WITH INTENT contract is: *the AI composites within the language, the compiler validates the output.* That contract is only as strong as the compiler's ability to catch everything that can go wrong. Every silent failure is a hole in the contract.

These four items close the known holes.

---

## Item 1 — RCL-005: Missing Statement Terminator

### The COBOL lesson
COBOL's dot terminated entire logical blocks — a misplaced or missing dot silently restructured program logic with no warning. The most hated punctuation in programming history.

### RECALL's current state
RECALL statements are single-line by design, so dot cannot collapse nested scope. The structural danger does not exist. However: if a `.` is missing, the parser currently silently skips or misparsed the statement. No diagnostic is emitted.

### Spec

**Diagnostic code:** `RCL-005`  
**Name:** `missing-terminator`  
**Severity:** error  
**Category:** syntax

**Trigger condition:** a statement line in PROCEDURE DIVISION is parsed but no `.` is found before the next newline or end of input.

**Error output (text):**
```
ERROR [RCL-005] missing-terminator — program.rcl:14:32
  DISPLAY HEADING-1 PAGE-TITLE
                               ^
  Statement has no terminator
  Every RECALL statement must end with a period (.)
```

**Error output (JSON):**
```json
{
  "code": "RCL-005",
  "severity": "error",
  "category": "syntax",
  "line": 14,
  "col": 32,
  "message": "Statement has no terminator",
  "hint": "Every RECALL statement must end with a period (.)"
}
```

**`recall explain RCL-005` output:**
```
RCL-005 — missing-terminator
Category: syntax
Severity: error
Message:  A PROCEDURE DIVISION statement was found without a terminating period.
Hint:     Every RECALL statement ends with a full stop. Add . at the end of the line.
```

### Implementation notes
- Parser should check for `.` as the last non-whitespace character on each PROCEDURE DIVISION statement line
- Lines that are continuations (part of multi-line VALUE strings in DATA DIVISION) are exempt
- Comment lines (`*`) are exempt
- Division/section headers are exempt

---

## Item 2 — RCL-006: Uninitialised Field

### The COBOL lesson
COBOL did not require fields to have initial values. Uninitialised WORKING-STORAGE fields contained garbage memory. Programs ran, produced wrong output, and nobody knew why.

### RECALL's current state
A field declared without a `VALUE` clause renders empty silently. The AI compositor may declare fields without values, see no error, and produce blank output with no diagnostic signal.

### Spec

**Diagnostic code:** `RCL-006`  
**Name:** `uninitialised-field`  
**Severity:** warning  
**Category:** data

**Trigger condition:** a field in DATA DIVISION is declared without a `VALUE` clause AND that field is referenced in PROCEDURE DIVISION.

**Warning output (text):**
```
WARNING [RCL-006] uninitialised-field — program.rcl:8:4
  01 PAGE-SUBTITLE PIC X.
     ^^^^^^^^^^^^
  Field referenced in PROCEDURE DIVISION has no VALUE
  Hint: add VALUE "..." or VALUE "" to declare intent explicitly
```

**Warning output (JSON):**
```json
{
  "code": "RCL-006",
  "severity": "warning",
  "category": "data",
  "line": 8,
  "col": 4,
  "message": "Field referenced in PROCEDURE DIVISION has no VALUE clause",
  "hint": "Add VALUE \"...\" to declare intent explicitly, or VALUE \"\" for intentional empty"
}
```

**`recall explain RCL-006` output:**
```
RCL-006 — uninitialised-field
Category: data
Severity: warning
Message:  A field is referenced in PROCEDURE DIVISION but has no VALUE clause in DATA DIVISION.
Hint:     Add VALUE "..." to set a value, or VALUE "" to explicitly declare an empty field.
          This distinction matters for AI compositors — an explicit empty is intentional;
          a missing VALUE is ambiguous.
```

### Design decision — warning not error
A field with no VALUE may be intentional (placeholder, dynamic population planned). Severity is warning so the program still compiles and the human/AI gets signal without a hard block. A future `--strict-data` flag could elevate this to error.

### Implementation notes
- Only trigger if the field is actually referenced in PROCEDURE DIVISION — unused fields do not warn (avoids noise from shared DATA templates)
- `VALUE ""` is treated as explicit empty — no warning
- `VALUE " "` (space) is treated as explicit — no warning
- Groups (items with sub-items) are exempt if all sub-items have VALUES

---

## Item 3 — RCL-007: PIC Size Overflow

### The COBOL lesson
COBOL silently truncated values that exceeded their declared PIC size. A value of 12 characters moved into a `PIC X(10)` field lost its last two characters with no warning. Wrong data in production, untraceable.

### RECALL's current state
A VALUE longer than its declared PIC size is accepted and silently truncated at render time. No diagnostic is emitted.

### Spec

**Diagnostic code:** `RCL-007`  
**Name:** `pic-overflow`  
**Severity:** warning  
**Category:** data

**Trigger condition:** the string length of a VALUE literal exceeds the declared size in a `PIC X(n)` clause.

**Warning output (text):**
```
WARNING [RCL-007] pic-overflow — program.rcl:6:4
  01 SHORT-TITLE PIC X(10) VALUE "This title is too long".
                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  VALUE length 22 exceeds PIC X(10) — will truncate to "This title"
  Hint: increase PIC size or shorten the value
```

**Warning output (JSON):**
```json
{
  "code": "RCL-007",
  "severity": "warning",
  "category": "data",
  "line": 6,
  "col": 4,
  "message": "VALUE length 22 exceeds declared PIC X(10) — value will be truncated",
  "declared_size": 10,
  "actual_length": 22,
  "truncated_value": "This title",
  "hint": "Increase PIC size to PIC X(22) or shorten the value"
}
```

**`recall explain RCL-007` output:**
```
RCL-007 — pic-overflow
Category: data
Severity: warning
Message:  A VALUE literal is longer than the field's declared PIC size.
          The value will be silently truncated at compile time.
Hint:     Either increase the PIC size to match the actual value length,
          or shorten the value. Use recall check --inspect to see resolved values.
```

### Design decision — warning not error
Truncation may be intentional (deliberately capping display length). Warning gives signal without blocking. A future `--strict-data` flag could elevate to error.

### Special case — PIC X (no size)
`PIC X` without a size declaration is treated as unbounded — no overflow warning is emitted. This is intentional: `PIC X` in RECALL means "any text of any length" and is the common case for most content fields.

### Implementation notes
- Only applies to `PIC X(n)` with explicit size
- `PIC 9(n)` overflow (numeric): same pattern, same code — numeric value exceeds digit count
- Multi-line VALUE strings: measure total resolved length after line joining
- Does not apply to `PIC DATE`, `PIC URL`, `PIC BOOL` — those have type validation, not size validation

---

## Item 4 — COPY Clause with Closed Symbol Resolution

### The COBOL lesson
COBOL COPY brought shared field definitions into a program. Over time, thousands of copybooks proliferated across systems, versions diverged, nobody knew which was authoritative. Change one copybook — everything that copied it broke. Finding what copied it was manual archaeology.

### RECALL's current state
No module or import system exists. Each `.rcl` file is fully self-contained. Safe for single-file programs but as programs grow, DATA definitions will be copy-pasted between files — which is exactly how copybook hell begins.

### Spec

**New clause:** `COPY <name> FROM "<path>"`  
**Location:** DATA DIVISION, after or instead of inline field declarations  
**Scope:** imports all `01`-level field declarations from the target file's DATA DIVISION into the current program's symbol table

**Syntax:**
```cobol
DATA DIVISION.
   COPY CUSTOMER-FIELDS FROM "shared/customer.rcl".
   COPY SITE-CONFIG FROM "shared/config.rcl".

   01 PAGE-TITLE PIC X VALUE "Welcome".
```

**Resolution rules:**
1. Path is relative to the source file's directory
2. The compiler resolves all COPY references before building the symbol table — no lazy resolution
3. Circular COPY references are a hard error (`RCL-008 circular-copy`)
4. A field name that exists in both a COPY source and the local DATA DIVISION is a hard error (`RCL-009 duplicate-field`) — no silent override
5. COPY targets must be valid `.rcl` files — referencing a non-existent file is `RCL-010 unresolved-copy`

**New diagnostic codes:**

| Code | Name | Severity |
|---|---|---|
| `RCL-008` | `circular-copy` | error |
| `RCL-009` | `duplicate-field` | error |
| `RCL-010` | `unresolved-copy` | error |

**RCL-008 output:**
```
ERROR [RCL-008] circular-copy — program.rcl:5:4
  COPY BASE FROM "shared/base.rcl"
  Circular reference detected: program.rcl → base.rcl → program.rcl
```

**RCL-009 output:**
```
ERROR [RCL-009] duplicate-field — program.rcl:12:4
  01 PAGE-TITLE PIC X VALUE "Local Title".
     ^^^^^^^^^^
  Field PAGE-TITLE already declared via COPY shared/config.rcl:8
  Hint: rename the local field or remove it from the COPY source
```

**RCL-010 output:**
```
ERROR [RCL-010] unresolved-copy — program.rcl:5:4
  COPY CUSTOMER-FIELDS FROM "shared/customer.rcl"
                             ^^^^^^^^^^^^^^^^^^^^^
  File not found: shared/customer.rcl
```

### `recall check --inspect` output with COPY
When running `recall check --inspect`, the symbol table output must show the *source* of each field:

```
FIELD          PIC    VALUE              SOURCE
PAGE-TITLE     X      "Welcome"          program.rcl:12
CUSTOMER-NAME  X(30)  "Acme Corp"        shared/customer.rcl:4
SITE-URL       URL    "https://..."      shared/config.rcl:8
```

This makes provenance visible — the AI compositor and the human both know exactly where every field came from.

### AI-first implication
WITH INTENT requires a *closed* symbol table — every field the AI can reference must be fully resolved before composition begins. The COPY clause with strict resolution guarantees this: by the time the AI compositor sees the DATA DIVISION, all COPY references have been resolved, all duplicates rejected, and the symbol table is complete and authoritative. No ambiguity enters the composition phase.

### Implementation notes
- Phase 1: implement COPY parsing and resolution, RCL-008/009/010 diagnostics
- Phase 2: add `--inspect` source column
- Phase 3: version pinning (`COPY CUSTOMER-FIELDS FROM "shared/customer.rcl" VERSION "1.2"`) — post-1.0

---

## Implementation Priority

| Item | Code(s) | Effort | Priority |
|---|---|---|---|
| Missing terminator | RCL-005 | Low | High — quick win, closes silent parse failures |
| Uninitialised field | RCL-006 | Low | High — directly affects AI compositor signal |
| PIC size overflow | RCL-007 | Low | Medium — catches a class of silent data bugs |
| COPY clause | RCL-008/009/010 | High | Pre-1.0 — required before multi-file programs are practical |

RCL-005, 006, 007 are incremental additions to the existing diagnostic pipeline — low risk, high signal value. The COPY clause is the largest piece and should be designed carefully before implementation begins.

---

## Relationship to WITH INTENT

These four items are not optional polish. They are the foundation the AI compositor stands on.

WITH INTENT makes the claim: *the compiler validates whatever the AI produces.* That claim requires:

- No silent parse failures (RCL-005)
- No ambiguous uninitialised fields (RCL-006)  
- No silent data truncation (RCL-007)
- A closed, authoritative symbol table (COPY clause)

Without these, WITH INTENT is a claim the compiler cannot fully honour. With them, the guarantee is real.
