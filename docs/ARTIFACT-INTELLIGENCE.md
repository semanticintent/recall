# Artifact Intelligence

> RECALL concept document — April 2026

---

## The Thesis

A compiled artifact should be able to answer for itself.

Not with a README alongside it. Not by reading a git log. Not by querying a CMS or
database. The artifact itself — the compiled `.html` file — carries everything needed
to understand what it is, who wrote it, how it got there, and whether it changed
since it was compiled.

RECALL already does this structurally: the `.rcl` source is embedded in a comment in
every compiled output. The AUDIT DIVISION compiles into that same comment — who
created it, when, with what change history. The type system enforces that authorship is
`Human`, `AI compositor`, or `AI agent` — not a free-form string.

**Artifact intelligence** is what you get when you make that embedded information
queryable. `recall summarize` is the command. Eight lenses are the query surface.

---

## Why It Matters Now

In 2026, three things are true simultaneously:

1. **AI agents are producing web content at scale.** A page may have been written
   by a human, expanded by an AI compositor, revised by an AI agent, and touched
   again by a human — all in the same week. That history matters. It is not stored
   in git (deployment pipelines don't always carry git history). It is not in the CMS
   (there is no CMS — RECALL compiles to static HTML). It exists only if the artifact
   carries it.

2. **AI agents are also *reading* web content.** When a crawler, RAG pipeline, or
   orchestrating agent reads a RECALL page, the embedded source + AUDIT comment is
   machine-parseable. An agent that understands RECALL can extract the full authorship
   chain, the DATA DIVISION field schema, the WITH INTENT clauses, and the change log
   without a separate API call. The artifact is the API.

3. **Provenance is becoming a compliance surface.** The question "was this written by
   a human or AI?" is no longer academic. It is asked by search engines, academic
   publishers, employers, and regulators. RECALL makes the answer a compile-time fact
   — not a claim, not a trust signal, but a typed value that was enforced at build time.

---

## The Eight Lenses

`recall summarize` produces a structured report across eight lenses. Each lens answers
a distinct question about the artifact.

### 1. Structural

*What is the shape of this program?*

- Division count and names present
- Section count (PROCEDURE DIVISION paragraphs)
- DATA DIVISION field count (scalars + groups)
- Element count (DISPLAY statements)
- COPY FROM / LOAD FROM / LOAD PLUGIN presence

```
STRUCTURAL
  Divisions:   4  (IDENTIFICATION, ENVIRONMENT, DATA, PROCEDURE, AUDIT)
  Sections:    5  (RENDER-NAV, RENDER-HERO, RENDER-WHY, RENDER-CTA, RENDER-FOOTER)
  Fields:      14 (11 scalar, 3 group)
  Elements:    23 display statements
  LOAD FROM:   changelog.json
```

### 2. Intent

*What is this artifact trying to do?*

- PAGE-TITLE and DESCRIPTION from IDENTIFICATION DIVISION
- Section IDs from PROCEDURE DIVISION
- WITH INTENT clause count + full text of each clause

```
INTENT
  Title:       "Michael Shatny — Changelog"
  Description: "A living record of shipped things, compiled from changelog.json."
  Sections:    header, projects, log, about, footer
  WITH INTENT: 0 clauses
```

### 3. Data

*What data does this artifact work with?*

- WORKING-STORAGE field names, PIC types, and value sizes
- ITEMS groups and cardinality
- LOAD FROM source files and their schema (if derivable)
- AUTOLEN fields

```
DATA
  WORKING-STORAGE: 0 scalar fields
  LOAD FROM:       changelog.json
    Scalars:       author (X/32), handle (X/20), tagline (X/100)
    Groups:        PROJECTS (4 items), LOG (8 items)
```

### 4. Authorship

*Who is responsible for this artifact?*

- CREATED-BY kind and value
- CREATED-DATE
- Total CHANGE-LOG entries
- Breakdown by author kind: Human / AI compositor / AI agent
- Last touch by each kind

```
AUTHORSHIP
  Created by:      Human (Michael Shatny)
  Created:         2026-04-11
  Changes:         1
    Human:         1  (last: 2026-04-11)
    AI compositor: 0
    AI agent:      0
```

### 5. Change

*How did this artifact evolve?*

- Full CHANGE-LOG timeline
- First and last entry dates
- Delta from CREATED-DATE to last change
- Entries with notes vs. entries without

```
CHANGE LOG
  Span:   2026-04-11 → 2026-04-11  (0 days)
  ──────────────────────────────────────────
  2026-04-11  Changelog page created. Human. "Initial compile and deploy."
```

### 6. Diagnostic

*Is this artifact healthy?*

- Error count (from last `recall check` pass, if cached)
- Warning count and codes
- Coverage percentage (populated fields / total fields)
- Truncation count
- `--strict` violations count

```
DIAGNOSTIC
  Errors:    0
  Warnings:  2  (RCL-W02 × 2 — auto-sized fields at limit)
  Coverage:  94%
  Truncations: 0
```

### 7. Dependency

*What does this artifact depend on?*

- COPY FROM paths (relative and package)
- LOAD FROM files
- LOAD PLUGIN packages with versions (from package.json, if available)

```
DEPENDENCIES
  COPY FROM:   theme.rcpy
  LOAD FROM:   changelog.json
  PLUGINS:     none
```

### 8. Output

*What kind of artifact does this produce?*

- Element types used (and counts per type)
- Layout patterns (CENTERED / STACK / GRID / SIDEBAR)
- Target (HTML, PDF, EMAIL — from ENVIRONMENT DIVISION if set)
- Estimated output size (chars) — derived from last compile telemetry if available

```
OUTPUT
  Target:   HTML
  Elements: HEADING-1 ×1, HEADING-2 ×3, PARAGRAPH ×2, CARD-LIST ×1,
            TABLE ×1, CALLOUT ×2, BUTTON ×0, FOOTER ×1
  Layouts:  CENTERED ×1, STACK ×3
  Est. size: ~18,000 chars
```

---

## Machine-Readable Output

`recall summarize page.rcl --format json` produces a stable JSON structure that
an AI agent or orchestration pipeline can read directly:

```json
{
  "schema": "recall-summary/1.0",
  "source": "changelog.rcl",
  "compiled": "2026-04-11",
  "structural": {
    "divisions": ["IDENTIFICATION", "ENVIRONMENT", "DATA", "PROCEDURE", "AUDIT"],
    "sections": 5,
    "fields": { "scalar": 0, "group": 2 },
    "elements": 9,
    "loadFrom": ["changelog.json"]
  },
  "intent": {
    "title": "Michael Shatny — Changelog",
    "description": "A living record of shipped things, compiled from changelog.json.",
    "sectionIds": ["header", "projects", "log", "about"],
    "withIntentCount": 0,
    "withIntentClauses": []
  },
  "authorship": {
    "createdBy": "Human",
    "createdDate": "2026-04-11",
    "changes": {
      "total": 1,
      "byKind": { "Human": 1, "AI compositor": 0, "AI agent": 0 },
      "lastHuman": "2026-04-11",
      "lastAiCompositor": null,
      "lastAiAgent": null
    }
  },
  "diagnostic": {
    "errors": 0,
    "warnings": 2,
    "warningCodes": ["RCL-W02", "RCL-W02"],
    "coveragePct": 94,
    "truncations": 0
  },
  "dependencies": {
    "copyFrom": ["theme.rcpy"],
    "loadFrom": ["changelog.json"],
    "plugins": []
  }
}
```

This shape is designed to compose with Pipeline Manifest output (`recall manifest
--json`) and brief JSON. An orchestrator can read all three and have a complete
picture of the artifact's context, schema, and provenance.

---

## `recall summarize --audit`

A focused lens for the most common provenance question: *who wrote this, and
when was it last touched by a human?*

```sh
recall summarize changelog.rcl --audit
```

```
RECALL SUMMARY  changelog.rcl  --audit
──────────────────────────────────────────────────────
Created by:    Human  (2026-04-11)
Last touched:  Human  (2026-04-11)
Changes:       1  (1 Human, 0 AI compositor, 0 AI agent)
Coverage:      94%
──────────────────────────────────────────────────────
2026-04-11  Changelog page created. Human. "Initial compile and deploy."
```

This is what a search engine, academic publisher, or compliance audit needs from
a RECALL artifact in one screen. No parsing required. The artifact produces it
from its own embedded AUDIT DIVISION.

`--audit` is a lens filter on `recall summarize` — not a flag on `recall audit`.
`recall audit` retains its existing focused job: print the raw CHANGE-LOG.
`recall summarize` is the query surface for everything the artifact knows about itself.

---

## Implementation Philosophy — Keep Simple Things Simple

**The CLI is good when each command has one job that someone actually needs done.**
Comprehensiveness for its own sake is a design smell.

`recall summarize` follows the same principle as every other RECALL command: one
clear job, one output, composable with `--format json` when a machine needs to read
it. The eight-lens framework is a *mental model* for what the artifact knows — not a
mandate that all eight lenses ship on day one.

### What to ship first

The minimum that closes the loop:

```sh
recall summarize page.rcl            # full report, human-readable
recall summarize page.rcl --audit    # authorship + change lenses only
recall summarize page.rcl --format json
recall summarize page.html           # extract embedded source, then summarize
```

That's it. Four invocations, two flags. An AI agent given a provenance task will use
`--audit --format json`. A human verifying a published page will use the bare command.
Everything else — `--lens structural`, `--lens output`, individual lens filters — is
additive and can follow when a real use case surfaces.

### What not to build until needed

- Eight individual `--lens X` flags — the `--audit` shortcut covers the 90% case
- `--since` / `--until` date filtering on the change lens — `recall audit` already does this
- Comparison mode (`recall summarize v1.rcl v2.rcl`) — that's `recall diff`'s job

**The test for any new flag:** does someone need this to close a real loop, or does
it make the command feel more complete? Only the first justifies building it.

---

## Relationship to Existing Commands

| Command | Primary question |
|---|---|
| `recall check` | Is this source valid? |
| `recall audit` | Who changed what, in what order? |
| `recall diff` | What structurally changed between two versions? |
| `recall stats` | How is the pipeline performing across all cases? |
| `recall summarize` | What is this artifact and who is responsible for it? |

They compose. `recall diff --suggest-audit` produces a CHANGE-LOG entry;
`recall summarize` reads the accumulated CHANGE-LOG and reports it as structured
provenance. `recall stats` aggregates `compile_ms` and `coverage_pct` across the
pipeline; `recall summarize` reports the same metrics for a single artifact in
context.

---

## The Broader Principle

Every compiler embeds information about source structure. RECALL's compiler goes
further: it embeds provenance, authorship, and intent. `recall summarize` is just
the query layer on top of what is already there.

The principle extends beyond RECALL. Any artifact that carries structured metadata
about its own creation — who wrote it, with what tools, under what constraints —
can serve as its own API. The artifact is the documentation. The artifact is the
audit trail. The artifact answers for itself.

RECALL is the first publishing language built on this principle from the ground up.
`recall summarize` is what that principle looks like as a command-line tool.
