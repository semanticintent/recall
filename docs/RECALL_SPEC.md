# RECALL Language Specification
### Version 0.1 — Draft
> *"Still here. Still running."*

---

## 1. What Is COBWEB?

RECALL is a declarative web interface language written in COBOL-inspired syntax.
It transpiles to self-contained, dependency-free HTML/CSS/JS files.

The guiding principle: **the source is the artifact.**
Every compiled RECALL page embeds its original `.rcl` source inside
an HTML comment block at the top of the output — so anyone who
views the page source sees nothing but COBOL divisions.

RECALL is not:
- A COBOL runtime or interpreter
- A wrapper around React, Alpine.js, or any JS framework
- A templating engine on top of HTML
- A joke

RECALL is:
- A domain-specific language for web interfaces
- Inspired by COBOL syntax — verbose, English-like, division-based
- A transpiler that outputs vanilla HTML + inline CSS + vanilla JS
- A statement

---

## 2. File Format

```
filename.rcl         — COBWEB source file
filename.html        — compiled output (self-contained)
```

Source files use `.rcl` extension.
Column formatting follows COBOL tradition:
- Columns 1–6:   sequence numbers (optional, ignored by transpiler)
- Column 7:      indicator (`*` = comment, `-` = continuation)
- Columns 8–11:  Area A (division/section headers)
- Columns 12–72: Area B (statements, values)

The transpiler is column-lenient in v0.1 — it reads intent, not column positions.

---

## 3. Program Structure

Every RECALL program consists of four divisions, in order:

```
IDENTIFICATION DIVISION.
ENVIRONMENT DIVISION.
DATA DIVISION.
PROCEDURE DIVISION.
```

All divisions are required. Sections within divisions may be optional.

---

## 4. IDENTIFICATION DIVISION

Declares metadata about the page. Maps to `<head>` meta tags.

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.    MY-PORTFOLIO.
   AUTHOR.        JANE-DOE.
   DATE-WRITTEN.  2026-04-03.
   PAGE-TITLE.    "Jane Doe — Systems Engineer".
   DESCRIPTION.   "Portfolio and contact page".
   FAVICON.       "/assets/icon.png".
```

| Keyword       | Required | Maps To               |
|---------------|----------|-----------------------|
| PROGRAM-ID    | Yes      | `id` on `<body>`      |
| AUTHOR        | No       | `<meta name="author">`|
| DATE-WRITTEN  | No       | `<meta name="date">`  |
| PAGE-TITLE    | Yes      | `<title>`             |
| DESCRIPTION   | No       | `<meta name="description">` |
| FAVICON       | No       | `<link rel="icon">`   |

---

## 5. ENVIRONMENT DIVISION

Declares global rendering settings. Maps to root CSS variables and `<meta viewport>`.

```cobol
ENVIRONMENT DIVISION.
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

Declares all data — content, state, and configuration.
Follows COBOL's level-number hierarchy.

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-HEADING      PIC X(60)  VALUE "BUILT DIFFERENT.".
      01 HERO-SUBTEXT      PIC X(120) VALUE "Systems thinker. Legacy forward.".
      01 CTA-LABEL         PIC X(20)  VALUE "VIEW WORK".
      01 CTA-HREF          PIC X(80)  VALUE "#projects".
      01 SHOW-BANNER       PIC 9      VALUE 1.

   ITEMS SECTION.
      01 NAV-ITEMS.
         05 NAV-ITEM-1     PIC X(20)  VALUE "ABOUT".
         05 NAV-ITEM-1-HREF PIC X(80) VALUE "#about".
         05 NAV-ITEM-2     PIC X(20)  VALUE "WORK".
         05 NAV-ITEM-2-HREF PIC X(80) VALUE "#work".
         05 NAV-ITEM-3     PIC X(20)  VALUE "CONTACT".
         05 NAV-ITEM-3-HREF PIC X(80) VALUE "#contact".

      01 PROJECT-ITEMS.
         05 PROJECT-1.
            10 PROJ-TITLE  PIC X(60)  VALUE "COBWEB TRANSPILER".
            10 PROJ-DESC   PIC X(200) VALUE "A COBOL-syntax web interface language.".
            10 PROJ-TAG    PIC X(20)  VALUE "OPEN SOURCE".
            10 PROJ-HREF   PIC X(80)  VALUE "https://github.com/cobweb".
         05 PROJECT-2.
            10 PROJ-TITLE  PIC X(60)  VALUE "LEGACY BRIDGE".
            10 PROJ-DESC   PIC X(200) VALUE "Connecting mainframe systems to modern UIs.".
            10 PROJ-TAG    PIC X(20)  VALUE "ENTERPRISE".
            10 PROJ-HREF   PIC X(80)  VALUE "#".
```

### Data Types

| PIC Clause       | Description             | HTML Use             |
|------------------|-------------------------|----------------------|
| `PIC X(n)`       | Alphanumeric, n chars   | Text, URLs, labels   |
| `PIC 9`          | Single digit (0 or 1)   | Boolean flags        |
| `PIC 9(n)`       | Numeric, n digits       | Counts, sizes        |
| `PIC X(7)`       | Hex color shorthand     | CSS color values     |

### Level Numbers

| Level | Meaning                        |
|-------|--------------------------------|
| 01    | Top-level group / component    |
| 05    | Collection item / child group  |
| 10    | Field within a child group     |

---

## 7. PROCEDURE DIVISION

The rendering engine. Defines what appears on screen, in order.
Think of it as a sequential render pipeline — top to bottom.

```cobol
PROCEDURE DIVISION.

   RENDER-NAV.
      DISPLAY NAVIGATION USING NAV-ITEMS
         WITH STICKY YES
         WITH LOGO "CBW".
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

   RENDER-PROJECTS.
      DISPLAY SECTION ID "projects"
         WITH LAYOUT GRID COLUMNS 2
         WITH PADDING MEDIUM.
         DISPLAY HEADING-2 "SELECTED WORK".
         DISPLAY CARD-LIST USING PROJECT-ITEMS
            WITH STYLE BORDERED
            WITH HOVER-LIFT YES.
      STOP SECTION.

   RENDER-FOOTER.
      DISPLAY FOOTER
         WITH TEXT "COMPILED WITH COBWEB. STILL RUNNING."
         WITH ALIGN CENTER.
      STOP SECTION.

   STOP RUN.
```

---

## 8. DISPLAY Verb Reference

`DISPLAY` is the primary rendering verb. It maps COBWEB constructs to HTML elements.

### Structural Elements

```cobol
DISPLAY SECTION ID "name"
   WITH LAYOUT [CENTERED | GRID | FLEX | STACK]
   WITH COLUMNS [1-12]
   WITH PADDING [NONE | SMALL | MEDIUM | LARGE]
   WITH BACKGROUND [color-variable | COLOR-BG]
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
   WITH COLOR  [color-variable | COLOR-MUTED | COLOR-TEXT].
DISPLAY LABEL    [variable | "literal"].
DISPLAY CODE-BLOCK [variable | "literal"]
   WITH LANGUAGE "cobol".
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

DISPLAY NAVIGATION USING [data-group]
   WITH STICKY [YES | NO].

DISPLAY IMAGE SRC [variable | "path"]
   WITH ALT  "description"
   WITH SIZE [FULL | HALF | QUARTER | AUTO].

DISPLAY DIVIDER
   WITH STYLE [SOLID | DASHED | BLANK]
   WITH SPACING [SMALL | MEDIUM | LARGE].
```

---

## 9. Flow Control

```cobol
GOTO section-name.
PERFORM section-name.
IF [condition]
   DISPLAY ...
END-IF.
```

### Conditions

```cobol
IF SHOW-BANNER = 1
   DISPLAY BANNER "WE ARE HIRING"
      WITH STYLE ACCENT.
END-IF.
```

---

## 10. Comments

```cobol
* This is a full-line comment (column 7 indicator)
      * This is also a comment
```

Multi-line comment block:
```cobol
*-----------------------------------------------*
* RENDER-HERO SECTION                           *
* Displays the hero banner and call to action   *
*-----------------------------------------------*
```

All comments are preserved in compiled output — inside the
embedded source block at the top of the HTML file.

---

## 11. Compiled Output Structure

Every `.rcl` file compiles to a single `.html` file structured as:

```html
<!--
*==============================================*
* RECALL COMPILED OUTPUT                      *
* SOURCE: portfolio.rcl                       *
* COMPILED: 2026-04-03T14:32:00Z             *
* RECALL VERSION: 0.1                         *
*==============================================*

IDENTIFICATION DIVISION.
   PROGRAM-ID. MY-PORTFOLIO.
   ...
   [FULL .rcl SOURCE PRESERVED HERE]
   ...
   STOP RUN.
*==============================================*
-->
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Generated from IDENTIFICATION and ENVIRONMENT divisions -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>...</title>
  <style>
    /* All styles inline — zero external dependencies */
  </style>
</head>
<body>
  <!-- Generated from PROCEDURE division -->
  <script>
    /* All interactivity inline — zero external dependencies */
  </script>
</body>
</html>
```

**The rule**: zero `<link rel="stylesheet">` to external files.
Zero `<script src="...">` to CDNs or frameworks.
One file. Always.

---

## 12. CLI Usage (Planned)

```bash
# Transpile a single file
recall compile portfolio.rcl

# Transpile with watch mode
recall compile portfolio.rcl --watch

# Transpile all .rcl files in a directory
recall compile ./src --out ./dist

# Validate syntax without compiling
recall check portfolio.rcl

# Print version
recall --version
```

---

## 13. Error Model

RECALL errors follow COBOL convention — verbose, readable, unambiguous.

```
RECALL COMPILATION ERROR
  FILE:    portfolio.rcl
  LINE:    47
  SECTION: RENDER-HERO

  MISSING REQUIRED CLAUSE.
  THE DISPLAY BUTTON VERB AT LINE 47 REQUIRES
  AN ON-CLICK OR HREF CLAUSE.

  EXAMPLE:
     DISPLAY BUTTON "CONTACT" ON-CLICK GOTO "#contact".

  COMPILATION TERMINATED.
```

---

## 14. Roadmap

### v0.1 — Core
- [ ] Parser for all four divisions
- [ ] DISPLAY verb: HEADING, PARAGRAPH, BUTTON, SECTION, NAVIGATION, FOOTER
- [ ] CARD-LIST with DATA DIVISION item groups
- [ ] Source embedding in compiled HTML comment
- [ ] CLI: `compile` and `check`

### v0.2 — Interaction
- [ ] IF/END-IF conditionals
- [ ] ON-CLICK with JS event binding
- [ ] FORM section with INPUT fields
- [ ] PERFORM for section reuse

### v0.3 — Components
- [ ] COPY members (reusable .rcl partials)
- [ ] ACCEPT verb for user input state
- [ ] MOVE verb for reactive data binding

### v0.4 — Themes
- [ ] Built-in theme presets (MAINFRAME, TERMINAL, LEDGER)
- [ ] Custom PALETTE SECTION variables
- [ ] Dark/light/system mode toggle

---

## 15. Design Principles

1. **The source is the artifact.** The `.rcl` file is always embedded in the output.
2. **No dependencies.** Output is a single HTML file. Always.
3. **Verbose is a feature.** COBOL's English-like verbosity is intentional legibility.
4. **View source is the experience.** Discovering COBOL in a web page's source *is the point.*
5. **Legacy forward.** This is not nostalgia. It is a philosophy about what lasts.

---

*COBWEB — COBol WEB*
*Still here. Still running.*
