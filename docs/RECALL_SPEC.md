# RECALL Language Specification
### Version 0.8.0
> *"Still here. Still running."*

---

## 0. Design Law: COBOL First

**Every feature in RECALL must have a COBOL precedent.**

Before adding any new language feature, keyword, convention, or file behaviour, ask:

> *"How did COBOL solve this?"*

If COBOL solved it, RECALL adopts the same solution — adapted for the web, but faithful
to the original intent. If COBOL didn't solve it, the feature needs extraordinary
justification to exist.

This is not nostalgia. It is a constraint that keeps the language coherent, legible,
and durable. COBOL's design decisions survived 60 years of production use. That is the
standard RECALL holds itself to.

### A concrete example: partial file exclusion

Early in development: *how do we exclude component files from the build compiler?*

The first instinct was modern convention: prefix with underscore (`_nav.rcl`).
But COBOL solved it with **copybooks** — `.cpy` files never compiled standalone,
only `COPY`'d into a program at compile time. The extension signals intent.

RECALL adopted this exactly: **`.rcpy` files** are never compiled by `recall build`.
They are only valid as targets of `COPY FROM`. The underscore convention was abandoned.

### Checklist for new features

- [ ] Does COBOL have this concept? What is it called?
- [ ] Can the COBOL keyword or convention be used directly?
- [ ] If adapted, does the adaptation preserve the original intent?
- [ ] Does the feature add a new mental model, or extend an existing COBOL one?
- [ ] Would a COBOL developer recognise this immediately?

---

## 1. What Is RECALL?

RECALL is a declarative web interface language written in COBOL-inspired syntax.
It transpiles to self-contained, dependency-free HTML/CSS/JS files.

The guiding principle: **the source is the artifact.**
Every compiled RECALL page embeds its original `.rcl` source inside an HTML comment
block — so anyone who views page source sees nothing but COBOL divisions.

RECALL is not:
- A COBOL runtime or interpreter
- A wrapper around React, Alpine.js, or any JS framework
- A templating engine on top of HTML
- A joke

RECALL is:
- A domain-specific language for web interfaces
- Inspired by COBOL syntax — verbose, English-like, division-based
- A transpiler that outputs vanilla HTML + inline CSS + vanilla JS
- An AI-first language: the compiler is the documentation

### AI-First Design

Every structural decision in RECALL serves machine readability as much as human
readability. The intent is in the syntax — an AI can read, generate, modify, and
audit a `.rcl` file without an external schema because the language is self-describing.

The CLI reflects this: `recall schema`, `recall explain`, `recall stats`, `recall check --inspect`,
and `recall fix` all expose the compiler's knowledge as queryable output. The compiler
is the documentation. Drift between docs and implementation is structurally impossible.

---

## 2. File Format

```
filename.rcl         — RECALL source file (compiled by recall compile / recall build)
filename.rcpy        — RECALL copybook (never compiled standalone; included via COPY FROM)
filename.html        — compiled output (self-contained)
```

Column formatting follows COBOL tradition:
- Column 7:      indicator (`*` = comment, `-` = continuation)
- Columns 8–11:  Area A (division/section headers)
- Columns 12–72: Area B (statements, values)

The compiler is column-lenient — it reads intent, not column positions.

---

## 3. Program Structure

Every RECALL program consists of five divisions, in order:

```
IDENTIFICATION DIVISION.   — page metadata
ENVIRONMENT DIVISION.      — rendering configuration and plugins
DATA DIVISION.             — all data: content, state, loaded records
COMPONENT DIVISION.        — reusable render components (optional)
PROCEDURE DIVISION.        — the render pipeline
```

`COMPONENT DIVISION` is optional. All others are required.

---

## 4. IDENTIFICATION DIVISION

Declares metadata about the page. Maps to `<head>` meta tags and the embedded
source header in compiled output.

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.    MY-PORTFOLIO.
   AUTHOR.        JANE-DOE.
   DATE-WRITTEN.  2026-04-03.
   PAGE-TITLE.    "Jane Doe — Systems Engineer".
   DESCRIPTION.   "Portfolio and contact page".
   FAVICON.       "/assets/icon.png".
```

| Keyword       | Required | Maps To                      |
|---------------|----------|------------------------------|
| PROGRAM-ID    | Yes      | `id` on `<body>`             |
| AUTHOR        | No       | `<meta name="author">`       |
| DATE-WRITTEN  | No       | `<meta name="date">`         |
| PAGE-TITLE    | Yes      | `<title>`                    |
| DESCRIPTION   | No       | `<meta name="description">`  |
| FAVICON       | No       | `<link rel="icon">`          |

**Diagnostics:** RCL-W03 fires when AUTHOR or DATE-WRITTEN are absent.

---

## 5. ENVIRONMENT DIVISION

Declares global rendering settings, theme inheritance, and plugins.

```cobol
ENVIRONMENT DIVISION.
   COPY FROM "theme.rcpy".

   CONFIGURATION SECTION.
      VIEWPORT         RESPONSIVE.
      COLOR-MODE       DARK.
      FONT-PRIMARY     "IBM Plex Mono".
      FONT-SECONDARY   "IBM Plex Sans".
      LANGUAGE         EN.

   PALETTE SECTION.
      01 COLOR-ACCENT    PIC X(7) VALUE "#00FF41".
      01 COLOR-BG        PIC X(7) VALUE "#0A0A0A".
      01 COLOR-TEXT      PIC X(7) VALUE "#E0E0E0".
      01 COLOR-MUTED     PIC X(7) VALUE "#555555".
      01 COLOR-BORDER    PIC X(7) VALUE "#222222".
```

### COPY FROM

Inlines a `.rcpy` copybook's ENVIRONMENT content into the current program.
Used for theme sharing across pages:

```cobol
COPY FROM "theme.rcpy".
COPY FROM "@semanticintent/recall-ui/themes/dark.rcpy".
```

Paths starting with `@` resolve via `node_modules` walk-up from the source directory.
All other paths are relative to the `.rcl` source file.

### LOAD PLUGIN

Loads a plugin package that registers additional DISPLAY elements:

```cobol
LOAD PLUGIN "@stratiqx/recall-components".
```

Plugins must export a `register(registry)` function. Once loaded, plugin elements
are available in DISPLAY statements and validated by the type checker.

### VIEWPORT options
- `RESPONSIVE` — adds standard responsive meta tag
- `FIXED-WIDTH` — locks to 1200px max-width
- `FULL-WIDTH` — no max-width constraint

### COLOR-MODE options
- `DARK` — dark background default
- `LIGHT` — light background default
- `SYSTEM` — follows OS preference via `prefers-color-scheme`

---

## 6. DATA DIVISION

Declares all data — content, configuration, loaded records, and reusable shapes.
Follows COBOL's level-number hierarchy.

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-HEADING   PIC X(60)  VALUE "BUILT DIFFERENT.".
      01 CTA-LABEL      PIC X(20)  VALUE "VIEW WORK".
      01 SHOW-BANNER    PIC 9      VALUE 1.

   ITEMS SECTION.
      01 PROJECT-ITEMS.
         05 PROJECT-1.
            10 PROJ-TITLE  PIC X(60)  VALUE "RECALL TRANSPILER".
            10 PROJ-DESC   PIC X(200) VALUE "A COBOL-syntax web interface language.".
            10 PROJ-TAG    PIC X(20)  VALUE "OPEN SOURCE".
            10 PROJ-HREF   PIC X(80)  VALUE "https://github.com/semanticintent/recall-compiler".
```

### Sections

| Section | Purpose |
|---|---|
| `WORKING-STORAGE SECTION` | Scalar fields — single values used in DISPLAY statements |
| `ITEMS SECTION` | Group fields — collections iterated by CARD-LIST, TABLE, STAT-GRID etc. |

### Data Types (PIC Clauses)

| PIC Clause     | Type     | Constraint                    |
|----------------|----------|-------------------------------|
| `PIC X(n)`     | string   | max n characters              |
| `PIC X`        | string   | max 1 character               |
| `PIC 9`        | numeric  | 0 or 1 (boolean flag)         |
| `PIC 9(n)`     | numeric  | n digits, no decimals         |
| `PIC DATE`     | date     | ISO 8601 — YYYY-MM-DD         |
| `PIC URL`      | url      | must begin http/https or /    |
| `PIC PCT`      | percent  | numeric 0–100                 |

### Level Numbers

| Level | Meaning                        |
|-------|--------------------------------|
| 01    | Top-level group / component    |
| 05    | Collection item / child group  |
| 10    | Field within a child group     |

### COMMENT Clause

Fields may carry an intent note for AI tooling. The comment is metadata only —
it has no effect on compiled output:

```cobol
01 FETCH-SCORE  PIC X(10) VALUE "2978"
   COMMENT "CAL fetch score — higher is better; used in cascade header".
01 SECTOR-BADGE PIC X(30) VALUE "AI Infrastructure"
   COMMENT "Short sector label displayed in hero badge and meta".
```

COMMENT clauses appear in `recall check --inspect` output and in the `fieldIntent`
block of `recall check --format json`.

### VALUE BLOCK

Multi-line string literals for long content values. The compiler auto-sizes the
PIC X declaration with 20% headroom:

```cobol
01 BODY-TEXT PIC X VALUE BLOCK.
   This is a multi-line block of text.
   It can span as many lines as needed.
   Each line becomes part of the value joined with \n.
END VALUE.
```

The `PIC X` is replaced at preprocess time with `PIC X(n)` sized to fit the
encoded content. RCL-W02 will not fire on auto-sized fields.

### LOAD FROM

Loads structured data from an external file into the DATA DIVISION at compile time.
Generated fields follow the declared shape and are available to DISPLAY statements.

```cobol
LOAD FROM "data/dimensions.json"
   INTO DIMENSIONS
   AS RECORDS WITH FIELDS
      DIM-NAME   PIC X(30)
      DIM-SCORE  PIC 9(2)
      DIM-LAYER  PIC X(8)
      DIM-EVID   PIC X(400).

LOAD FROM "data/sources.csv"
   INTO SOURCES
   AS RECORDS WITH FIELDS
      SRC-LABEL  PIC X(60)
      SRC-HREF   PIC X(120).
```

Generated group names follow the pattern `GROUPNAME-N-FIELDNAME`.
Run `recall check <file> --inspect` to see every generated DATA symbol.

### RECORD Types

Reusable group shapes — declare once, expand anywhere:

```cobol
RECORD PROJECT-SHAPE WITH FIELDS
   PROJ-TITLE  PIC X(60)
   PROJ-DESC   PIC X(200)
   PROJ-TAG    PIC X(20)
   PROJ-HREF   PIC X(80).

ITEMS SECTION.
   01 PROJECT-ITEMS.
      05 PROJECT-1 LIKE PROJECT-SHAPE.
      05 PROJECT-2 LIKE PROJECT-SHAPE.
      05 PROJECT-3 LIKE PROJECT-SHAPE.
```

Each `LIKE` expands to the full field set with naming `GROUPNAME-N-FIELDNAME`.
Unknown RECORD references emit RCL-019.

---

## 7. COMPONENT DIVISION

Defines reusable render components. Optional division — omit if not needed.

```cobol
COMPONENT DIVISION.
   DEFINE CASE-HERO.
      ACCEPTS CASE-TITLE REQUIRED, CASE-SUBTITLE, SECTOR-BADGE, STATS.

      DISPLAY SECTION ID "hero" WITH LAYOUT CENTERED WITH PADDING LARGE.
         DISPLAY LABEL SECTOR-BADGE.
         DISPLAY HEADING-1 CASE-TITLE.
         DISPLAY PARAGRAPH CASE-SUBTITLE.
         DISPLAY STAT-GRID STATS WITH COLUMNS 6.
      STOP SECTION.
   END DEFINE.
```

### ACCEPTS Clause

Declares parameters a component expects. Parameters marked `REQUIRED` cause
RCL-017 if not provided at the call site:

```cobol
ACCEPTS CASE-TITLE REQUIRED, CASE-SUBTITLE, SECTOR-BADGE.
```

### Invoking Components

```cobol
PROCEDURE DIVISION.
   RENDER.
      DISPLAY CASE-HERO
         WITH DATA CASE-TITLE, CASE-SUBTITLE, SECTOR-BADGE, STATS.
      STOP SECTION.
   STOP RUN.
```

---

## 8. PROCEDURE DIVISION

The render pipeline. Sections execute top-to-bottom. Each section renders one
logical region of the page. Every section ends with `STOP SECTION.`.
The division ends with `STOP RUN.`.

```cobol
PROCEDURE DIVISION.

   RENDER-NAV.
      DISPLAY NAVIGATION USING NAV-ITEMS
         WITH STICKY YES
         WITH LOGO "RECALL".
      STOP SECTION.

   RENDER-HERO.
      DISPLAY SECTION ID "hero"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY HEADING-1 HERO-HEADING
            WITH STYLE MONO.
         DISPLAY PARAGRAPH HERO-SUBTEXT
            WITH COLOR MUTED.
         DISPLAY BUTTON CTA-LABEL
            ON-CLICK GOTO CTA-HREF.
      STOP SECTION.

   STOP RUN.
```

---

## 9. DISPLAY Verb Reference

`DISPLAY` is the primary rendering verb. Run `recall schema` for the full live
element registry with accepted clauses.

### Structural Elements

```cobol
DISPLAY SECTION ID "name"
   WITH LAYOUT [CENTERED | GRID | FLEX | STACK | SPLIT]
   WITH COLUMNS [1-12]
   WITH PADDING [NONE | SMALL | MEDIUM | LARGE]
   WITH BACKGROUND [color-variable]
   WITH MAX-WIDTH [NARROW | STANDARD | WIDE | FULL].

DISPLAY NAVIGATION USING [data-group]
   WITH STICKY [YES | NO]
   WITH LOGO "text".

DISPLAY FOOTER
   WITH TEXT "content"
   WITH ALIGN [LEFT | CENTER | RIGHT].
```

### Typography

```cobol
DISPLAY HEADING-1 [variable | "literal"]
   WITH STYLE  [MONO | SANS | SERIF]
   WITH COLOR  [color-variable | COLOR-TEXT | COLOR-MUTED | COLOR-ACCENT]
   WITH ALIGN  [LEFT | CENTER | RIGHT]
   WITH WEIGHT [NORMAL | BOLD | LIGHT].

DISPLAY HEADING-2 [variable | "literal"].
DISPLAY HEADING-3 [variable | "literal"].
DISPLAY PARAGRAPH [variable | "literal"]
   WITH COLOR [color-variable | COLOR-MUTED | COLOR-TEXT].
DISPLAY LABEL    [variable | "literal"].
DISPLAY CODE-BLOCK [variable | "literal"]
   WITH LANGUAGE "cobol".
DISPLAY CALLOUT [variable | "literal"]
   WITH STYLE [INFO | WARNING | SUCCESS].
```

### Interactive Elements

```cobol
DISPLAY BUTTON [variable | "literal"]
   ON-CLICK GOTO [href | section-id]
   WITH STYLE [PRIMARY | GHOST | OUTLINE]
   WITH SIZE  [SMALL | MEDIUM | LARGE].

DISPLAY LINK [variable | "literal"]
   HREF [variable | "literal"]
   WITH TARGET [SELF | BLANK].

DISPLAY INPUT ID "name"
   WITH LABEL "label text"
   WITH TYPE  [TEXT | EMAIL | NUMBER | TEXTAREA]
   WITH PLACEHOLDER "hint text".
```

### Collection Elements

```cobol
DISPLAY CARD-LIST USING [data-group]
   WITH STYLE   [BORDERED | FILLED | MINIMAL]
   WITH COLUMNS [1 | 2 | 3]
   WITH HOVER-LIFT [YES | NO].

DISPLAY TABLE [data-group]
   WITH COLUMNS "Col1, Col2, Col3"
   WITH STRIPED [YES | NO].

DISPLAY STAT-GRID [data-group]
   WITH COLUMNS [2 | 3 | 4 | 6].

DISPLAY TIMELINE USING [data-group].

DISPLAY IMAGE SRC [variable | "path"]
   WITH ALT  "description"
   WITH SIZE [FULL | HALF | QUARTER | AUTO].

DISPLAY DIVIDER
   WITH STYLE [SOLID | DASHED | BLANK]
   WITH SPACING [SMALL | MEDIUM | LARGE].

DISPLAY TABS USING [data-group].
DISPLAY SIDEBAR USING [data-group].
DISPLAY BANNER [variable | "literal"]
   WITH STYLE [ACCENT | MUTED].
```

---

## 10. Comments

```cobol
* This is a full-line comment
      * Indented comments are also valid
```

All comments are preserved in compiled output inside the embedded source block.
See also: the `COMMENT` clause on DATA fields (§6) — that is field-level intent
metadata, distinct from source comments.

---

## 11. Compiled Output Structure

Every `.rcl` file compiles to a single `.html` file:

```html
<!--
*==============================================*
* RECALL COMPILED OUTPUT                      *
* SOURCE: portfolio.rcl                       *
* COMPILED: 2026-04-03T14:32:00Z             *
* RECALL VERSION: 0.8.0                       *
*==============================================*
[FULL .rcl SOURCE PRESERVED HERE]
*==============================================*
-->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>...</title>
  <style>/* All styles inline */</style>
</head>
<body>
  <!-- Rendered from PROCEDURE division -->
  <script>/* All interactivity inline */</script>
</body>
</html>
```

**The rule:** zero `<link rel="stylesheet">` to external files.
Zero `<script src="...">` to CDNs or frameworks. One file. Always.

---

## 12. CLI Reference

### Core

```bash
recall compile <file>              # transpile .rcl to .html
recall compile <file> -o <dir>     # specify output directory
recall build <dir>                 # compile all .rcl files in a directory
recall build <dir> -o <out>        # specify output directory
```

### Type Checking

```bash
recall check <file>                # text diagnostics — all errors and warnings
recall check <file> --strict       # warnings promoted to errors (CI mode)
recall check <file> --format json  # machine-readable diagnostic output
recall check <file> --quiet        # no output — exit codes only
recall check <file> --inspect      # show all DATA symbols from LOAD FROM
```

**Exit codes:** `0` = clean · `1` = errors · `2` = warnings only

### AI-First Tooling

```bash
recall schema                      # human-readable element + type registry
recall schema --json               # machine-readable (AI can query live contracts)

recall explain RCL-002             # human-readable error code entry
recall explain RCL-002 --json      # machine-readable
recall explain --list              # all codes with summaries
recall explain --list --json       # machine-readable full list

recall stats <file>                # orientation snapshot: field counts, groups, warnings
recall stats <file> --json         # machine-readable summary

recall history <file>              # DATA field diff: HEAD~1 → HEAD (requires git)
recall history <file> --commits 3  # look back N commits
recall history <file> --json       # machine-readable diff

recall fix <file> --dry-run        # preview auto-fixable issues without writing
recall fix <file> --yes            # apply: PIC resize (RCL-002), AUTHOR (RCL-W03), empty sections (RCL-W04)
```

---

## 13. Diagnostics

RECALL uses a structured diagnostic system with stable error codes (RCL-001 through
RCL-W05). Every error names what is wrong, why, and how to fix it.

Full reference: `docs/ERROR-REFERENCE.md`
Implementation status: `docs/STRICT-MODE-SPEC.md`
Live query: `recall explain --list`

---

## 14. Design Principles

1. **The source is the artifact.** The `.rcl` file is always embedded in the output.
2. **No dependencies.** Output is a single HTML file. Always.
3. **Verbose is a feature.** COBOL's English-like verbosity is intentional legibility.
4. **View source is the experience.** Discovering COBOL in a web page's source *is the point.*
5. **Legacy forward.** This is not nostalgia. It is a philosophy about what lasts.
6. **The compiler is the documentation.** `recall schema`, `recall explain`, and `recall check` expose the compiler's live contracts — drift between docs and implementation is structurally impossible.
7. **Explicit over implicit.** Every place RECALL felt effortless was a place where intent was declared. Every place friction appeared was where the compiler accepted ambiguity silently.

---

*RECALL — What COBOL Would Have Built for the Web.*
*Still here. Still running.*
