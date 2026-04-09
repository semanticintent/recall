# Common Record Description

> Version: 1.0 — April 2026
> Applies to: `@semanticintent/recall-compiler`, `@stratiqx/recall-components`,
>             `@semanticintent/semantic-cal-workflow-mcp`

---

## What It Is

The **Common Record Description** is the agreed field set between three layers of the
RECALL publishing pipeline:

1. **MCP `inputSchema`** — what the AI author (Claude Desktop) receives as instructions
2. **Brief JSON** — what gets assembled, stored, and versioned on disk
3. **RECALL DATA DIVISION** — what the compiler receives and renders to HTML

All three layers express the same contract in different syntaxes, for different
audiences. When they agree, the pipeline is self-consistent. When they diverge,
the compiler either truncates silently or renders nothing.

---

## Schema Vocabulary — Three Named Layers

RECALL has three distinct schemas that must not be conflated:

| Name | Command / Artifact | Audience | Purpose |
|---|---|---|---|
| **Language Schema** | `recall schema` / `recall schema --json` | AI compositor, tooling | All valid RECALL elements, PIC types, divisions, and clauses |
| **Component Manifest** | `components/index.json` in any plugin | `recall scaffold`, AI tooling | Field definitions, group shapes, PIC types for a specific plugin's components |
| **Common Record Description** | MCP `inputSchema` + brief JSON + DATA DIVISION | AI author (Claude), pipeline tooling | The agreed field set between authoring, storage, and rendering for a specific publishing use case |

These three schemas operate at different layers and should never be substituted
for one another.

---

## How It Emerged

The Common Record Description was not designed upfront — it evolved through the
convergence of three independently built systems:

1. **Brief JSON** came first — a way to separate research from rendering. Fields
   were implicit, unenforced, and only the model knew them.

2. **MCP `inputSchema`** forced formalisation — every brief field had to be named,
   typed, and described so Claude Desktop knew what to pass. The descriptions were
   written as *instructions to the model*, not documentation. This is the moment
   the field list became a contract.

3. **RECALL DATA DIVISION** connected the layers — brief JSON fields had to map
   to PIC X declarations. `CASE-HEADLINE PIC X(100)`, `DIMENSIONS` as a group,
   `CAL-SOURCE-CODE PIC X(1000)`. The same contract expressed a third time, now
   compiler-enforced.

The schema-as-contract is the natural result of three systems that each needed
to agree on the same fields. The MCP inputSchema, the brief JSON, and the RECALL
DATA DIVISION are the same document in three syntaxes.

---

## Structure of a Common Record Description

A Common Record Description has three expression points:

### 1. MCP `inputSchema` (author-facing)

JSON Schema passed to the AI author. Field descriptions are *instructions*, not
documentation — the most reliable mechanism for guiding model behaviour without
prompt engineering.

```json
{
  "CASE-HEADLINE": {
    "type": "string",
    "description": "Main headline — short, declarative, under 100 chars. No markdown."
  },
  "DIMENSIONS": {
    "type": "array",
    "description": "Exactly 6 items, one per CAL dimension D1–D6.",
    "items": {
      "type": "object",
      "properties": {
        "DIM-CODE":     { "type": "string", "description": "D1–D6" },
        "DIM-TAG":      { "type": "string", "description": "Pattern label, e.g. 'Capability Discontinuity'" },
        "DIM-EVIDENCE": { "type": "string", "description": "Include [N] citation markers for each source referenced." }
      }
    }
  }
}
```

### 2. Brief JSON (storage layer)

The assembled field set on disk. Persisted alongside the compiled HTML.
Versioned in git. Used to regenerate the HTML without re-research.

```json
{
  "CASE-HEADLINE": "Project Glasswing — The Defensive Singularity",
  "DIMENSIONS": [
    {
      "DIM-CODE": "D5",
      "DIM-NAME": "Quality",
      "DIM-LAYER": "origin",
      "DIM-SCORE": "80",
      "DIM-TAG": "Capability Discontinuity",
      "DIM-EVIDENCE": "90× improvement in autonomous exploit development.[1]"
    }
  ]
}
```

### 3. RECALL DATA DIVISION (compiler-facing)

The same fields expressed as PIC X declarations. The compiler enforces types
and truncates to declared lengths — silent truncation is a known failure mode
(see Roadmap: Performance Measurement).

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 CASE-HEADLINE  PIC X(100)  VALUE "Project Glasswing — The Defensive Singularity".

   ITEMS SECTION.
      01 DIMENSIONS.
         05 DIMENSIONS-1.
            10 DIMENSIONS-1-CODE      PIC X(4)    VALUE "D5".
            10 DIMENSIONS-1-NAME      PIC X(50)   VALUE "Quality".
            10 DIMENSIONS-1-LAYER     PIC X(10)   VALUE "origin".
            10 DIMENSIONS-1-SCORE     PIC X(4)    VALUE "80".
            10 DIMENSIONS-1-TAG       PIC X(60)   VALUE "Capability Discontinuity".
            10 DIMENSIONS-1-EVIDENCE  PIC X(1200) VALUE "90× improvement in autonomous exploit development.[1]".
```

---

## Contract Integrity Rules

1. **Field names must match exactly** across all three layers. A field named
   `CASE-HEADLINE` in `inputSchema` must produce `CASE-HEADLINE` in the brief
   JSON and map to a `CASE-HEADLINE` PIC X declaration in the DATA DIVISION.

2. **PIC X lengths are the ceiling, not the target.** Authors should write values
   that fit. The compiler truncates silently — no error, no warning currently.
   (Surfacing truncations is a planned telemetry feature.)

3. **`inputSchema` descriptions are instructions to the model.** They are the
   primary mechanism for guiding authoring quality — more reliable than prompt
   engineering alone. The pre-flight checklist in the SKILL file is a companion,
   not a substitute.

4. **Optional fields must be handled gracefully.** A field absent from the brief
   JSON must produce an empty PIC X value, not an error. Renderers must handle
   empty values without breaking layout.

5. **Group fields require matching structure.** A group like `DIMENSIONS` must
   have the same child field suffixes (`-CODE`, `-NAME`, `-LAYER`, `-SCORE`,
   `-TAG`, `-EVIDENCE`) in both the brief JSON shape and the DATA DIVISION
   group shape.

---

## Pre-flight Checklist (authoring gate)

Before calling the MCP tool, the AI author verifies:

- [ ] `[N]` citation markers in every body field that references a source
- [ ] `[N]` markers in `DIM-EVIDENCE` fields
- [ ] `DIM-TAG` present for every dimension
- [ ] FETCH calculated from formula — not estimated
- [ ] All source URLs populated
- [ ] Index metadata fields present (`CASE-DATE-ISO`, `CASE-TYPE`, `CASE-CASCADE` etc.)

---

## Relation to Other Schemas

| Name | Document | Scope |
|---|---|---|
| **Common Record Description** | This document | Field agreement across authoring → storage → rendering |
| **Compositor Contract** | `COMPOSITOR-CONTRACT.md` | `WITH INTENT` expansion payload between `recall expand` and an AI compositor |
| **Language Schema** | `recall schema --json` | Valid RECALL syntax — elements, PIC types, clauses |
| **Component Manifest** | `components/index.json` | Plugin-level field definitions for `recall scaffold` |
