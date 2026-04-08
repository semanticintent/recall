# RECALL Compositor Contract
# WITH INTENT — normative specification

> Version: 1.0 (aligned with recall-compiler v1.0.0)

---

## Overview

`recall expand` sends unexpanded `WITH INTENT` clauses to a compositor and
receives valid RECALL PROCEDURE statements in return. This document defines
the exact contract between the compiler tooling and the compositor.

The compositor is any agent or API endpoint that can receive the payload below
and return the expected response shape. The reference implementation uses the
Anthropic Messages API.

---

## Trigger

A `DISPLAY` statement in the PROCEDURE DIVISION with a `WITH INTENT` clause:

```cobol
PROCEDURE DIVISION.

   RENDER.
      DISPLAY HERO
         WITH INTENT "dramatic opening, single product, urgency without hype"
         WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, CTA-PRIMARY.

   STOP RUN.
```

Before expansion: compiles with a placeholder HTML comment (RCL-W09 warning).
After expansion: `page.expanded.rcl` replaces the WITH INTENT statement with
concrete DISPLAY statements. Author reviews, renames, commits.

---

## Compositor Payload

One payload object per `WITH INTENT` statement. Sent as JSON.

```json
{
  "schemaVersion": "1.0",
  "intent": "dramatic opening, single product, urgency without hype",
  "element": "HERO",
  "dataFields": [
    { "name": "PRODUCT-NAME",    "pic": "X(60)",  "comment": "Product headline" },
    { "name": "PRODUCT-TAGLINE", "pic": "X(200)", "comment": "One-sentence description" },
    { "name": "CTA-PRIMARY",     "pic": "X(30)",  "comment": "Primary CTA label" }
  ],
  "availableFields": [
    { "name": "PRODUCT-NAME",    "pic": "X(60)",  "section": "working-storage" },
    { "name": "PRODUCT-TAGLINE", "pic": "X(200)", "section": "working-storage" },
    { "name": "CTA-PRIMARY",     "pic": "X(30)",  "section": "working-storage" }
  ],
  "palette": { "COLOR-BG": "#080808", "COLOR-ACCENT": "#00ff41" },
  "componentRegistry": ["PAGE-HERO", "SITE-NAV", "CARD-SECTION"],
  "programId": "MY-PAGE"
}
```

### Field definitions

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | `"1.0"` | Fixed at `"1.0"` for this contract version |
| `intent` | string | The literal string from `WITH INTENT "..."` |
| `element` | string | The element name from `DISPLAY <element>` |
| `dataFields` | array | Fields listed in `WITH DATA` clause (may be empty) |
| `availableFields` | array | All DATA DIVISION scalar fields (full DATA context) |
| `palette` | object | ENVIRONMENT DIVISION palette key → hex value |
| `componentRegistry` | string[] | All component names available (LOAD PLUGIN + DEFINE) |
| `programId` | string | From IDENTIFICATION DIVISION PROGRAM-ID |

#### DataField shape

```typescript
interface DataField {
  name:     string   // field name as declared (e.g. "PRODUCT-NAME")
  pic:      string   // PIC type (e.g. "X(60)", "9(4)", "URL", "DATE")
  section:  string   // "working-storage" or "items"
  comment?: string   // COMMENT clause value if present — intent metadata
}
```

---

## Expected Response

```json
{
  "source": "DISPLAY PAGE-HERO\n   WITH HERO-TITLE PRODUCT-NAME\n   WITH HERO-SUBTITLE PRODUCT-TAGLINE\n   WITH CTA-LABEL CTA-PRIMARY."
}
```

### Constraints on `source`

The compositor MUST return valid RECALL PROCEDURE statements. Specifically:

1. **One or more DISPLAY statements** — each terminated with a period
2. **No division headers** — no `PROCEDURE DIVISION.`, no `DATA DIVISION.`, etc.
3. **No section headers** — no `RENDER.` or other bare-word section names
4. **Only referenced field names** — all variable names must exist in `availableFields`
5. **No WITH INTENT clauses** — the expanded output must be fully concrete

The compiler runs the full `check()` pipeline on the expanded output. If
`check()` returns errors, the expansion is rejected (RCL-027) and no file is
written.

---

## Error Conditions

| Condition | Code | Outcome |
|---|---|---|
| Compositor returns invalid RECALL | RCL-027 | `expand()` returns `ok: false`, no file written |
| Compositor HTTP error / timeout | — | `expand()` returns `ok: false` with error message |
| `WITH INTENT` present but `recall expand` not run | RCL-W09 | Compiles with warning, placeholder HTML comment rendered |

---

## System Prompt (reference implementation)

The system prompt lives in `src/expand/prompt.ts`. It is separate from the
integration logic so it can be iterated independently.

The prompt must:
1. Explain the RECALL language structure (DISPLAY statements, clause syntax)
2. Explain the payload shape and each field's meaning
3. Specify the response format (`{ "source": "..." }`)
4. Specify the constraints on `source` (listed above)
5. Include at least one complete worked example (payload → response)

---

## Workflow

```
author writes:
  DISPLAY HERO
     WITH INTENT "dramatic opening"
     WITH DATA PRODUCT-NAME, CTA-PRIMARY.

  → recall check page.rcl     outputs: RCL-W09 warning (unexpanded)
  → recall compile page.rcl   outputs: page.html with <!-- WITH INTENT: ... --> placeholder

  → recall expand page.rcl    calls compositor, writes page.expanded.rcl
  → author reviews page.expanded.rcl
  → author renames → page.rcl, commits
```

---

## Versioning

This contract is versioned with `schemaVersion`. Breaking changes to the payload
shape or response format require a new `schemaVersion` and a compiler version bump.
The compositor should reject payloads with unknown `schemaVersion` values.
