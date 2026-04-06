# RECALL Error Reference

> Version: 0.8.1
> Covers all diagnostic codes emitted by `recall compile` and `recall check`.

Every diagnostic has a stable code. Codes never change meaning between versions.
Use the code to search this document or link to a specific error.

---

## Quick Reference

### Errors — abort compilation, no output written

| Code | Category | Summary |
|---|---|---|
| [RCL-001](#rcl-001--type-mismatch) | type-mismatch | Element expects a different PIC type |
| [RCL-002](#rcl-002--value-exceeds-declared-length) | value-constraint | VALUE string longer than PIC X(n) allows |
| [RCL-003](#rcl-003--unknown-element) | unknown-element | DISPLAY references an unregistered element |
| [RCL-004](#rcl-004--unknown-identifier) | unknown-identifier | Group reference not declared in DATA DIVISION |
| [RCL-005](#rcl-005--missing-required-division) | missing-required | PROCEDURE DIVISION empty or absent |
| [RCL-006](#rcl-006--missing-required-identification-field) | missing-required | Required IDENTIFICATION DIVISION field absent |
| [RCL-007](#rcl-007--using-requires-a-group) | group-shape | USING references a scalar, not a group |
| [RCL-008](#rcl-008--group-used-where-scalar-expected) | group-shape | Group used in a string element context |
| [RCL-009](#rcl-009--invalid-date-format) | format | PIC DATE value not ISO 8601 |
| [RCL-010](#rcl-010--invalid-url-format) | format | PIC URL value missing http/https or / prefix |
| [RCL-011](#rcl-011--pct-value-out-of-range) | format | PIC PCT value outside 0–100 |
| [RCL-012](#rcl-012--non-numeric-value-in-pic-9-field) | value-constraint | Non-numeric characters in PIC 9 field |
| [RCL-013](#rcl-013--missing-stop-run) | structural | STOP RUN absent from PROCEDURE DIVISION |
| [RCL-014](#rcl-014--component-referenced-before-define) | structural | Component used before its DEFINE block |
| [RCL-015](#rcl-015--cannot-resolve-copy-from-path) | unknown-identifier | COPY FROM file path cannot be resolved |
| [RCL-016](#rcl-016--component-parameter-type-mismatch) | type-mismatch | Wrong type passed to component ACCEPTS parameter |
| [RCL-017](#rcl-017--missing-required-component-parameter) | missing-required | Component called without a required ACCEPTS field |
| [RCL-018](#rcl-018--circular-copy-detected) | structural | COPY FROM chain creates a circular dependency |
| [RCL-022](#rcl-022--palette-key-has-trailing-period) | format | Palette key has trailing period — colour lookup silently fails |

### Warnings — shown but compilation continues (errors with `--strict`)

| Code | Category | Summary |
|---|---|---|
| [RCL-W01](#rcl-w01--group-is-empty) | group-shape | Group declared but has no items |
| [RCL-W02](#rcl-w02--value-near-length-limit) | value-constraint | VALUE string using >90% of declared PIC X(n) |
| [RCL-W03](#rcl-w03--missing-optional-identification-field) | missing-required | AUTHOR or DATE-WRITTEN not set |
| [RCL-W04](#rcl-w04--unreachable-procedure-section) | structural | Section defined but has no statements |
| [RCL-W05](#rcl-w05--implicit-string-coercion) | type-mismatch | Numeric value used in a string context |

---

## PIC Type Reference

| Declaration | Kind | Constraint |
|---|---|---|
| `PIC X(n)` | string | max n characters |
| `PIC X` | string | max 1 character |
| `PIC 9(n)` | numeric | n digits, integers only |
| `PIC 9(n)V9(m)` | decimal | n integer + m decimal digits |
| `PIC DATE` | date | ISO 8601 — YYYY-MM-DD |
| `PIC URL` | url | must begin with `http`, `https`, or `/` |
| `PIC PCT` | percent | numeric 0–100 |

---

## Errors

---

### RCL-001 — Type Mismatch

**Category:** type-mismatch | **Severity:** error

An element received a variable of an incompatible PIC type.

#### Example

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 VISIT-COUNT  PIC 9(6)  VALUE 142398.

PROCEDURE DIVISION.
   RENDER-HERO.
      DISPLAY HEADING-1 VISIT-COUNT.   ← ERROR
```

```
ERROR [RCL-001] type-mismatch — example.rcl:7:18
   DISPLAY HEADING-1 VISIT-COUNT.
                     ^^^^^^^^^^^
  Type mismatch
  HEADING-1 expects a string value (PIC X)
  VISIT-COUNT is declared PIC 9(6) (numeric)
  Hint: Use DISPLAY LABEL VISIT-COUNT for numeric display
```

#### Fix

Use an element that accepts numeric values, or declare the field as `PIC X`:

```cobol
DISPLAY LABEL VISIT-COUNT.          ← LABEL accepts numeric
```

```cobol
01 VISIT-COUNT  PIC X(10)  VALUE "142,398".   ← string declaration
DISPLAY HEADING-1 VISIT-COUNT.                ← now valid
```

---

### RCL-002 — Value Exceeds Declared Length

**Category:** value-constraint | **Severity:** error

The VALUE string is longer than the declared `PIC X(n)` allows.

#### Example

```cobol
01 HERO-HEAD  PIC X(40)  VALUE "This heading is much longer than forty characters.".
```

```
ERROR [RCL-002] value-constraint — example.rcl:2:4
   01 HERO-HEAD  PIC X(40)  VALUE "This heading is much longer than forty characters.".
      ^^^^^^^^^
  Value exceeds declared length
  HERO-HEAD value exceeds PIC X(40) — 51 characters provided (11 over limit)
  Hint: Shorten the value to 40 characters or increase PIC X(40) to PIC X(51)
```

#### Fix

Either shorten the value or increase the PIC length:

```cobol
01 HERO-HEAD  PIC X(60)  VALUE "This heading is much longer than forty characters.".
```

---

### RCL-003 — Unknown Element

**Category:** unknown-element | **Severity:** error

A `DISPLAY` statement references an element name that is not registered — not a built-in element and no plugin is loaded.

#### Example

```cobol
DISPLAY HEADING1 PAGE-TITLE.   ← ERROR — missing hyphen
```

```
ERROR [RCL-003] unknown-element — example.rcl:3:9
   DISPLAY HEADING1 PAGE-TITLE.
           ^^^^^^^^
  Unknown element
  No element HEADING1 is registered
  Hint: Did you mean: HEADING-1?
```

#### Fix

Correct the element name. If using a plugin element, add `LOAD PLUGIN` in the ENVIRONMENT DIVISION:

```cobol
DISPLAY HEADING-1 PAGE-TITLE.
```

```cobol
ENVIRONMENT DIVISION.
   LOAD PLUGIN @my-org/my-plugin.
```

---

### RCL-004 — Unknown Identifier

**Category:** unknown-identifier | **Severity:** error

A `USING` clause references a group name that is not declared in the DATA DIVISION.

#### Example

```cobol
PROCEDURE DIVISION.
   RENDER-NAV.
      DISPLAY NAVIGATION USING NAV-LINKS.   ← ERROR — group not declared
```

```
ERROR [RCL-004] unknown-identifier — example.rcl:3:30
   DISPLAY NAVIGATION USING NAV-LINKS.
                            ^^^^^^^^^
  Unknown identifier
  NAV-LINKS (group) is not declared in DATA DIVISION
  Hint: Add NAV-LINKS to the ITEMS SECTION
```

#### Fix

Declare the group in the ITEMS SECTION:

```cobol
DATA DIVISION.
   ITEMS SECTION.
      01 NAV-LINKS.
         05 NAV-LINKS-1       PIC X(20) VALUE "Home".
         05 NAV-LINKS-1-HREF  PIC X(80) VALUE "/".
```

---

### RCL-005 — Missing Required Division

**Category:** missing-required | **Severity:** error

The PROCEDURE DIVISION is absent or has no sections, so nothing can be rendered.

#### Example

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID. MY-SITE.
   PAGE-TITLE. "Hello".
* No PROCEDURE DIVISION
```

```
ERROR [RCL-005] missing-required — example.rcl:1:1
  Missing required division
  PROCEDURE DIVISION is empty — no sections defined
  Hint: Add at least one procedure section with DISPLAY statements
```

#### Fix

```cobol
PROCEDURE DIVISION.

   RENDER-MAIN.
      DISPLAY SECTION.
         DISPLAY HEADING-1 "Hello".
      STOP SECTION.

   STOP RUN.
```

---

### RCL-006 — Missing Required Identification Field

**Category:** missing-required | **Severity:** error

A required field in the IDENTIFICATION DIVISION is absent or empty.

#### Example

```cobol
IDENTIFICATION DIVISION.
   AUTHOR. Michael Shatny.
* PROGRAM-ID missing
```

#### Fix

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.   MY-SITE.
   PAGE-TITLE.   "My Site".
   AUTHOR.       Michael Shatny.
   DATE-WRITTEN. 2026-04-05.
```

---

### RCL-007 — USING Requires a Group

**Category:** group-shape | **Severity:** error

An element that requires a group (`CARD-LIST`, `NAVIGATION`, `TABS`, etc.) was given a USING clause that references a scalar field, or the USING clause is absent entirely.

#### Example

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 PAGE-TITLE  PIC X(60)  VALUE "My Site".

PROCEDURE DIVISION.
   RENDER-NAV.
      DISPLAY NAVIGATION USING PAGE-TITLE.   ← ERROR — scalar, not group
```

```
ERROR [RCL-007] group-shape — example.rcl:6:9
   DISPLAY NAVIGATION USING PAGE-TITLE.
           ^^^^^^^^^^
  USING requires a group, not a scalar
  PAGE-TITLE is a scalar (PIC X(60)), but NAVIGATION requires a group
  Hint: Declare PAGE-TITLE in ITEMS SECTION with child fields
```

#### Fix

Declare a group in the ITEMS SECTION:

```cobol
DATA DIVISION.
   ITEMS SECTION.
      01 NAV-ITEMS.
         05 NAV-ITEMS-1       PIC X(20) VALUE "Home".
         05 NAV-ITEMS-1-HREF  PIC X(80) VALUE "/".

PROCEDURE DIVISION.
   RENDER-NAV.
      DISPLAY NAVIGATION USING NAV-ITEMS.
```

---

### RCL-008 — Group Used Where Scalar Expected

**Category:** group-shape | **Severity:** error

A string-accepting element (`HEADING-1`, `PARAGRAPH`, etc.) was given a group reference where a scalar value is expected.

#### Example

```cobol
DATA DIVISION.
   ITEMS SECTION.
      01 FEATURES.
         05 FEATURES-1  PIC X(40) VALUE "Fast".
         05 FEATURES-2  PIC X(40) VALUE "Reliable".

PROCEDURE DIVISION.
   RENDER.
      DISPLAY HEADING-1 FEATURES.   ← ERROR — group in string context
```

#### Fix

Use `CARD-LIST` or another group element, or reference a scalar field:

```cobol
DISPLAY CARD-LIST USING FEATURES.
```

---

### RCL-009 — Invalid DATE Format

**Category:** format | **Severity:** error

A field declared `PIC DATE` has a value that does not match ISO 8601 (`YYYY-MM-DD`).

#### Example

```cobol
01 PUBLISH-DATE  PIC DATE  VALUE "April 5, 2026".   ← ERROR
```

```
ERROR [RCL-009] format — example.rcl:1:4
  Invalid DATE format
  PUBLISH-DATE is PIC DATE but value "April 5, 2026" is not ISO 8601 format
  Hint: Use YYYY-MM-DD format, e.g. "2026-04-05"
```

#### Fix

```cobol
01 PUBLISH-DATE  PIC DATE  VALUE "2026-04-05".
```

---

### RCL-010 — Invalid URL Format

**Category:** format | **Severity:** error

A field declared `PIC URL` has a value that does not begin with `http://`, `https://`, or `/`.

#### Example

```cobol
01 LOGO-SRC  PIC URL  VALUE "images/logo.png".   ← ERROR — relative path
```

```
ERROR [RCL-010] format — example.rcl:1:4
  Invalid URL format
  LOGO-SRC is PIC URL but value "images/logo.png" does not begin with http, https, or /
  Hint: Use a full URL or a root-relative path starting with /
```

#### Fix

```cobol
01 LOGO-SRC  PIC URL  VALUE "/images/logo.png".
```

---

### RCL-011 — PCT Value Out of Range

**Category:** format | **Severity:** error

A field declared `PIC PCT` has a value outside the 0–100 range.

#### Example

```cobol
01 ACCURACY  PIC PCT  VALUE "142".   ← ERROR
```

#### Fix

```cobol
01 ACCURACY  PIC PCT  VALUE "78".
```

---

### RCL-012 — Non-Numeric Value in PIC 9 Field

**Category:** value-constraint | **Severity:** error

A field declared `PIC 9(n)` contains non-numeric characters in its VALUE.

#### Example

```cobol
01 VISIT-COUNT  PIC 9(6)  VALUE "142,398".   ← ERROR — comma not allowed
```

```
ERROR [RCL-012] value-constraint — example.rcl:1:4
  Non-numeric value in PIC 9 field
  VISIT-COUNT is declared PIC 9 but value "142,398" contains non-numeric characters
  Hint: Use a numeric value or change declaration to PIC X
```

#### Fix

```cobol
01 VISIT-COUNT  PIC 9(6)   VALUE "142398".   ← numeric only
01 VISIT-COUNT  PIC X(10)  VALUE "142,398".  ← or declare as string
```

---

### RCL-013 — Missing STOP RUN

**Category:** structural | **Severity:** error

The PROCEDURE DIVISION does not end with `STOP RUN.`

#### Fix

```cobol
PROCEDURE DIVISION.

   RENDER-MAIN.
      DISPLAY HEADING-1 "Hello".

   STOP RUN.   ← required
```

---

### RCL-014 — Component Referenced Before DEFINE

**Category:** structural | **Severity:** error

A component is used in PROCEDURE DIVISION before its `DEFINE` block appears in the COMPONENT DIVISION.

#### Fix

Ensure the COMPONENT DIVISION appears before the PROCEDURE DIVISION and contains the `DEFINE` block for every component used.

---

### RCL-015 — Cannot Resolve COPY FROM Path

**Category:** unknown-identifier | **Severity:** error

A `COPY FROM` directive references a file or package path that cannot be found.

#### Example

```cobol
COPY FROM "components/nav.rcpy".   ← ERROR — file not found
```

```
ERROR [RCL-015] unknown-identifier — example.rcl:3:11
  Cannot resolve COPY FROM path
  "components/nav.rcpy" — file not found relative to source directory
```

#### Fix

- Verify the path is correct relative to the `.rcl` file
- For npm package paths (`@scope/pkg/file.rcpy`), verify the package is installed

---

### RCL-016 — Component Parameter Type Mismatch

**Category:** type-mismatch | **Severity:** error

A component was called with a `WITH` clause that passes the wrong type for an `ACCEPTS` parameter.

#### Fix

Match the type of the bound value to what the component expects. Check the component's `ACCEPTS` declaration.

---

### RCL-017 — Missing Required Component Parameter

**Category:** missing-required | **Severity:** error

A component was called without providing all parameters declared in its `ACCEPTS` clause.

#### Example

```cobol
COMPONENT DIVISION.
   DEFINE PRICING-CARD.
      ACCEPTS TIER, PRICE, FEATURES.
      ...
   END DEFINE.

PROCEDURE DIVISION.
   RENDER.
      DISPLAY PRICING-CARD
         WITH TIER "STARTER"
         WITH PRICE "$0".
      * FEATURES not provided — ERROR
```

#### Fix

```cobol
DISPLAY PRICING-CARD
   WITH TIER     "STARTER"
   WITH PRICE    "$0"
   WITH FEATURES STARTER-FEATURES.   ← all ACCEPTS fields required
```

---

### RCL-018 — Circular COPY Detected

**Category:** structural | **Severity:** error

A `COPY FROM` chain creates a cycle — file A copies file B which copies file A.

#### Fix

Restructure components so no file directly or indirectly includes itself. Extract shared content into a third file that neither includes.

---

### RCL-022 — Palette Key Has Trailing Period

**Category:** format | **Severity:** error

A colour key in the `PALETTE SECTION` ends with a period. The parser stores the key with the period included, so any lookup against the clean name silently fails and the colour is never applied to the compiled output.

#### Example

```cobol
ENVIRONMENT DIVISION.
   PALETTE SECTION.
      COLOR-BG.  "#080a10".   ← stored as "COLOR-BG." — lookup for COLOR-BG finds nothing
      COLOR-FG   "#ffffff".   ← correct
```

```
ERROR [RCL-022] format — example.rcl:3:7
   COLOR-BG.  "#080a10".
   ^^^^^^^^^
  Palette key has trailing period
  Palette key "COLOR-BG." has a trailing period — the colour lookup will never match
  Hint: Remove the period: COLOR-BG  "#hexvalue".
```

#### Fix

Remove the period from the key name:

```cobol
PALETTE SECTION.
   COLOR-BG  "#080a10".
   COLOR-FG  "#ffffff".
```

The `01` form (DATA-style palette entry) is not affected — periods are correctly stripped from that syntax automatically.

---

## Warnings

Warnings are shown alongside compilation output. The HTML file is still written.
Use `--strict` to promote all warnings to errors (exit 1, no output).

---

### RCL-W01 — Group Is Empty

**Category:** group-shape | **Severity:** warning

A group referenced by a USING clause is declared but has no child items. The element will render an empty container.

#### Example

```cobol
DATA DIVISION.
   ITEMS SECTION.
      01 FEATURES.   ← no children

PROCEDURE DIVISION.
   RENDER.
      DISPLAY CARD-LIST USING FEATURES.   ← W01
```

```
WARNING [RCL-W01] group-shape — example.rcl:6:9
   DISPLAY CARD-LIST USING FEATURES.
           ^^^^^^^^^
  Group is empty
  FEATURES is declared but has no items — CARD-LIST will render empty
  Hint: Add child fields to FEATURES in the ITEMS SECTION
```

#### Fix

Add items to the group or remove the DISPLAY statement:

```cobol
01 FEATURES.
   05 FEATURES-1  PIC X(40) VALUE "Fast".
   05 FEATURES-2  PIC X(40) VALUE "Reliable".
```

---

### RCL-W02 — Value Near Length Limit

**Category:** value-constraint | **Severity:** warning

A VALUE string is using more than 90% of its declared `PIC X(n)` length. Not an error — but a signal that the declaration may need to be widened.

#### Example

```cobol
01 HERO-SUB  PIC X(60)  VALUE "A platform built for the modern intelligence cycle.".
```

```
WARNING [RCL-W02] value-constraint — example.rcl:1:4
  Value near declared length limit
  HERO-SUB value is 52/60 characters — near PIC X(60) limit
```

#### Fix

Either leave as-is (it compiles) or widen the declaration for headroom:

```cobol
01 HERO-SUB  PIC X(80)  VALUE "A platform built for the modern intelligence cycle.".
```

---

### RCL-W03 — Missing Optional Identification Field

**Category:** missing-required | **Severity:** warning

`AUTHOR` or `DATE-WRITTEN` is absent from the IDENTIFICATION DIVISION. These fields are not required for compilation but are part of the RECALL provenance model — they travel with the output.

#### Fix

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.   MY-SITE.
   PAGE-TITLE.   "My Site".
   AUTHOR.       Michael Shatny.      ← recommended
   DATE-WRITTEN. 2026-04-05.          ← recommended
```

---

### RCL-W04 — Unreachable Procedure Section

**Category:** structural | **Severity:** warning

A section is defined in the PROCEDURE DIVISION but contains no DISPLAY statements. It will produce no output.

#### Example

```cobol
PROCEDURE DIVISION.

   RENDER-HERO.
      DISPLAY HEADING-1 "Hello".

   RENDER-EMPTY.
      * Nothing here   ← W04

   STOP RUN.
```

#### Fix

Add content to the section or remove it.

---

### RCL-W05 — Implicit String Coercion

**Category:** type-mismatch | **Severity:** warning

A numeric value is used in a context that expects a string. The compiler will coerce it, but the behaviour may not be what was intended.

#### Fix

Declare the field as `PIC X` if it is intended for display as text, or use an element that explicitly accepts numeric values (`LABEL`).

---

## Using Error Codes in CI

```bash
# Fail on any error — warnings allowed
recall compile my-site.rcl
# Exit 0 → clean
# Exit 1 → errors (pipeline fails)
# Exit 2 → warnings only (pipeline passes)

# Fail on errors AND warnings
recall compile my-site.rcl --strict
# Exit 0 → clean
# Exit 1 → errors or warnings (pipeline fails)

# Machine-readable output
recall check my-site.rcl --format json
```

```json
{
  "file": "/path/to/my-site.rcl",
  "errors": 1,
  "warnings": 2,
  "diagnostics": [
    {
      "code": "RCL-002",
      "severity": "error",
      "category": "value-constraint",
      "file": "/path/to/my-site.rcl",
      "line": 8,
      "col": 4,
      "message": "Value exceeds declared length",
      "why": "HERO-HEAD value exceeds PIC X(40) — 51 characters provided (11 over limit)",
      "hint": "Shorten the value to 40 characters or increase PIC X(40) to PIC X(51)"
    }
  ]
}
```
