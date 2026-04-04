# RECALL

**A declarative web interface language with COBOL-inspired syntax.**

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.  MY-SITE.
   PAGE-TITLE.  "Hello, World.".

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-HEAD PIC X(40) VALUE "STILL HERE.".
      01 HERO-BODY PIC X(200) VALUE "Built to last.".

PROCEDURE DIVISION.

   RENDER-HERO.
      DISPLAY SECTION ID "hero"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY HEADING-1 HERO-HEAD.
         DISPLAY PARAGRAPH HERO-BODY.
      STOP SECTION.

   STOP RUN.
```

```sh
recall compile my-site.rcl
# → my-site.html  (self-contained, zero dependencies)
```

---

## What is RECALL?

RECALL is a compiler, not a runtime. You write `.rcl` source files in a
COBOL-inspired, division-based syntax. The compiler produces a single,
self-contained HTML file — inline CSS, no external dependencies, no build
step to run the result.

The guiding principle: **the source is the artifact.**

Every compiled `.html` file embeds its original `.rcl` source in an HTML
comment block at the top of the output. View source on any RECALL page and
you see COBOL divisions.

RECALL is not:
- A COBOL runtime or interpreter
- A wrapper around React, Vue, or any JS framework
- A templating engine on top of HTML
- A joke

RECALL is:
- A domain-specific language for web interfaces
- Inspired by COBOL syntax — verbose, English-like, division-based
- A transpiler that produces vanilla HTML + inline CSS
- A statement about longevity

---

## Install

```sh
npm install -g @semanticintent/recall
```

Or use it as a library:

```sh
npm install @semanticintent/recall
```

---

## CLI

```sh
# Compile a .rcl file to HTML
recall compile my-site.rcl

# Compile to a specific output directory
recall compile my-site.rcl --out dist/

# Check a file for errors without compiling
recall check my-site.rcl
```

---

## Language Structure

Every RECALL program has five divisions:

```cobol
IDENTIFICATION DIVISION.   ← who this is
ENVIRONMENT DIVISION.      ← how it looks (theme, fonts, palette)
DATA DIVISION.             ← what it holds (variables, lists)
COMPONENT DIVISION.        ← custom elements defined in RECALL syntax
PROCEDURE DIVISION.        ← what it renders
```

### IDENTIFICATION DIVISION

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID.    MY-SITE.
   AUTHOR.        SEMANTICINTENT.
   DATE-WRITTEN.  2026-04-03.
   PAGE-TITLE.    "My Site".
   DESCRIPTION.   "A site about things.".
   FAVICON.       "/favicon.ico".
```

### ENVIRONMENT DIVISION

```cobol
ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT    RESPONSIVE.
      COLOR-MODE  DARK.
      FONT-PRIMARY    "IBM Plex Mono".
      FONT-SECONDARY  "IBM Plex Sans".

   PALETTE SECTION.
      01 COLOR-ACCENT  PIC X(7) VALUE "#00FF41".
      01 COLOR-BG      PIC X(7) VALUE "#080808".
      01 COLOR-TEXT    PIC X(7) VALUE "#E0E0E0".
      01 COLOR-MUTED   PIC X(7) VALUE "#555555".
      01 COLOR-BORDER  PIC X(7) VALUE "#1A1A1A".
```

### DATA DIVISION

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 PAGE-HEADING  PIC X(60)  VALUE "Hello, World.".
      01 PAGE-BODY     PIC X(200) VALUE "Welcome to RECALL.".

   ITEMS SECTION.
      01 NAV-ITEMS.
         05 NAV-ITEM-1      PIC X(20) VALUE "HOME".
         05 NAV-ITEM-1-HREF PIC X(80) VALUE "/".
         05 NAV-ITEM-2      PIC X(20) VALUE "ABOUT".
         05 NAV-ITEM-2-HREF PIC X(80) VALUE "/about".
```

### PROCEDURE DIVISION

```cobol
PROCEDURE DIVISION.

   RENDER-NAV.
      DISPLAY NAVIGATION USING NAV-ITEMS
         WITH STICKY YES
         WITH LOGO "MY SITE".

   RENDER-HERO.
      DISPLAY SECTION ID "hero"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY HEADING-1 PAGE-HEADING
            WITH STYLE MONO.
         DISPLAY PARAGRAPH PAGE-BODY.
         DISPLAY BUTTON "Get Started"
            ON-CLICK GOTO "#install"
            WITH STYLE PRIMARY.
      STOP SECTION.

   STOP RUN.
```

---

## Elements

| Element | Description |
|---|---|
| `HEADING-1` / `HEADING-2` / `HEADING-3` | Section headings |
| `PARAGRAPH` | Body text |
| `LABEL` | Small uppercase label |
| `BUTTON` | CTA button with `ON-CLICK GOTO` |
| `LINK` | Inline hyperlink |
| `CODE-BLOCK` | Preformatted code block |
| `CARD-LIST` | Grid of cards from a data group |
| `NAVIGATION` | Site navigation with logo + links |
| `SECTION` | Layout container (`CENTERED`, `STACK`, `GRID`) |
| `FOOTER` | Page footer |
| `DIVIDER` | Horizontal rule |
| `BANNER` | Full-width announcement strip |
| `IMAGE` | Responsive image |
| `INPUT` | Text / textarea input field |

---

## COMPONENT DIVISION

Define custom elements in RECALL syntax. Use them exactly like built-in
elements. Pure compile-time expansion — the output is still zero-dependency HTML.

```cobol
COMPONENT DIVISION.

   DEFINE PRICING-CARD.
      ACCEPTS TIER, PRICE, FEATURES, CTA-LABEL, CTA-HREF.
      DISPLAY SECTION
         WITH LAYOUT STACK.
         DISPLAY HEADING-3 TIER.
         DISPLAY LABEL PRICE.
         DISPLAY CARD-LIST USING FEATURES.
         DISPLAY BUTTON CTA-LABEL
            ON-CLICK GOTO CTA-HREF
            WITH STYLE PRIMARY.
      STOP SECTION.
   END DEFINE.
```

Call it from PROCEDURE DIVISION with `WITH` clauses binding each `ACCEPTS` parameter:

```cobol
RENDER-PRICING.
   DISPLAY SECTION ID "pricing"
      WITH LAYOUT GRID
      WITH COLUMNS 2.
      DISPLAY PRICING-CARD
         WITH TIER "STARTER"
         WITH PRICE "$0 / month"
         WITH FEATURES STARTER-FEATURES
         WITH CTA-LABEL "GET STARTED"
         WITH CTA-HREF "/signup".
      DISPLAY PRICING-CARD
         WITH TIER "PRO"
         WITH PRICE "$29 / month"
         WITH FEATURES PRO-FEATURES
         WITH CTA-LABEL "GO PRO"
         WITH CTA-HREF "/signup/pro".
   STOP SECTION.
```

Component libraries live in their own `.rcl` files and are loaded via `COPY FROM`:

```cobol
PROCEDURE DIVISION.

   LOAD-COMPONENTS.
      COPY FROM "components/pricing-card.rcl".
```

The compiler merges the component definitions into the registry and inlines
zero HTML at the LOAD position — it's a named import, not a render call.

---

## Components (COPY)

Reuse elements across pages with `COPY FROM`:

```cobol
* components/nav.rcl — a full .rcl file with its own DATA and PROCEDURE
```

```cobol
PROCEDURE DIVISION.

   RENDER-NAV.
      COPY FROM "components/nav.rcl".

   RENDER-FOOTER.
      COPY FROM "components/footer.rcl".
```

The compiler merges the component's data into the parent's DATA division
and inlines its procedure statements at the COPY position. The output is
still one self-contained HTML file.

---

## Library Usage

```ts
import { parse }     from '@semanticintent/recall/parser'
import { generate }  from '@semanticintent/recall/generator'
import { compile }   from '@semanticintent/recall/compiler'

// Compile file → HTML file
const result = compile('my-site.rcl', 'dist/')
if (!result.ok) console.error(result.error)

// Parse source → AST
const program = parse(source)

// Generate HTML from AST
const html = generate(program, source)
```

---

## Examples

See [`examples/`](examples/) for working `.rcl` files:

- [`examples/portfolio.rcl`](examples/portfolio.rcl) — personal portfolio page
- [`examples/landing.rcl`](examples/landing.rcl) — RECALL's own landing page (written in RECALL)
- [`examples/pricing.rcl`](examples/pricing.rcl) — two PRICING-CARD instances from one component definition
- [`examples/components/nav.rcl`](examples/components/nav.rcl) — reusable nav component (COPY)
- [`examples/components/pricing-card.rcl`](examples/components/pricing-card.rcl) — PRICING-CARD + TESTIMONIAL (COMPONENT DIVISION)

---

## Roadmap

- [x] Five-division language structure
- [x] Full element library (16 elements)
- [x] COPY — shared components, data, and procedure sections
- [x] COMPONENT DIVISION — custom elements with ACCEPTS parameters
- [ ] Multi-page `recall build` with project manifest
- [ ] Shared theme inheritance (`COPY PALETTE FROM "theme.rcl"`)
- [ ] Opt-in vanilla JS interactions (tabs, accordion, modal)
- [ ] Compile-time data binding from JSON / CSV

---

## Contributing

Pull requests welcome. Please open an issue first for significant changes.

```sh
git clone https://github.com/semanticintent/recall
cd recall
npm install
npm test         # 46 tests
npm run build    # compile TypeScript
node bin/recall.js compile examples/landing.rcl
```

---

## License

MIT © [semanticintent](https://github.com/semanticintent)
