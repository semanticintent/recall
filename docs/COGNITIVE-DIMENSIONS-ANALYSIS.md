# Cognitive Dimensions of Notations — RECALL Language Analysis

> **Framework:** Cognitive Dimensions of Notations (Green & Petre, 1996)
> **Subject:** RECALL v0.8.8 — a COBOL-inspired declarative publishing language
> **Analysis type:** Analytical evaluation (single-analyst, evidence-grounded)
> **Date:** April 2026
> **Analyst:** Michael Shatny, with compiler implementation as primary evidence source
>
> ---
>
> *The Cognitive Dimensions of Notations framework was developed by Thomas R.G. Green
> and Marian Petre to provide a structured vocabulary for evaluating the usability
> properties of notations — programming languages, visual formalisms, and specification
> languages. It does not produce a single score. It produces a profile: a set of
> dimension ratings with supporting evidence, intended to reveal where a notation
> makes tradeoffs and whether those tradeoffs are intentional.*

---

## Preamble: Why This Analysis Exists

RECALL was built by one person. That fact has no bearing on the quality of the
design — but it does create a credibility gap. Without institutional affiliation,
peer review, or a large user base, the design decisions that went into RECALL have
no external validation.

This analysis applies a standard framework to fill that gap. It does not attempt
to claim RECALL is a mature language. It attempts to document, using a shared
vocabulary, *why* specific design decisions were made, *what properties they produce*,
and *where the tradeoffs land*.

The honest answer is more credible than a favourable one.

---

## The 13 Dimensions — Overview

Green & Petre identify 13 dimensions. Each is rated here on a qualitative scale:

- **Positive** — the notation handles this well
- **Neutral** — acceptable, neither strong nor weak
- **Weak** — a genuine limitation, acknowledged
- **Intentional tradeoff** — rated weak, but the weakness is the design

Each rating is followed by evidence from actual RECALL source and compiler behaviour.

---

## Dimension 1: Viscosity

*How much effort does it take to make a change? Does one change require cascading edits?*

**Rating: Positive**

RECALL's DATA DIVISION / PROCEDURE DIVISION separation means most content changes
are isolated. Changing the value of `HERO-HEADING` requires editing one line in
the DATA DIVISION — no PROCEDURE DIVISION changes needed:

```cobol
01 HERO-HEADING PIC X(60) VALUE "STILL HERE.".
```

Structural changes (adding a new section to a page) require adding a field in DATA
and a DISPLAY statement in PROCEDURE. This is two edits, but they are in different
structural locations that the author visits for different reasons. The coupling is
explicit rather than implicit.

The PIC X(n) length constraint creates a minor viscosity source: widening a value
requires widening the declaration. The compiler catches this (RCL-002) rather than
silently truncating. The viscosity here is intentional — it surfaces at edit time
rather than at runtime.

**Evidence:** The RECALL compiler has no cascading dependency on field declaration
order within a section. Fields can be reordered without consequence.

---

## Dimension 2: Visibility

*Can you see all information relevant to a task in one place, or is it hidden?*

**Rating: Positive**

The division structure makes the question "what data does this page have?" answerable
by reading DATA DIVISION alone. The question "what does this page render?" is
answerable by reading PROCEDURE DIVISION alone. They do not mix.

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 PAGE-TITLE    PIC X(80)  VALUE "RECALL — The Source That Remembers".
      01 HERO-HEADING  PIC X(60)  VALUE "STILL HERE.".
      ...

PROCEDURE DIVISION.
   RENDER-HERO.
      DISPLAY HEADING-1 HERO-HEADING.
```

The `COMMENT` clause extends visibility into AI-readable intent:

```cobol
01 CTA-PRIMARY PIC X(30) VALUE "READ THE SPEC"
   COMMENT "Primary call to action — should convey momentum not instruction".
```

**Limitation:** Long DATA DIVISION declarations push PROCEDURE DIVISION off-screen
in large files. The language does not currently support splitting DATA across multiple
files (COPY deferred to v0.9). For large pages, the author must scroll to see both.

---

## Dimension 3: Hidden Dependencies

*Are there invisible relationships between parts of the notation that can cause
unexpected effects when one part changes?*

**Rating: Positive — notably strong for the domain**

RECALL has no hidden dependencies by design. Every reference in PROCEDURE DIVISION
must name a field explicitly declared in DATA DIVISION. The compiler enforces this
(RCL-004). There is no variable scoping, no inheritance, no implicit lookup chain.

```cobol
DISPLAY NAVIGATION USING NAV-LINKS.
```

If `NAV-LINKS` does not exist in DATA DIVISION, this is an error — not a silent
empty render. The dependency is visible and validated.

COPY FROM creates a dependency on an external file. This is the only hidden
dependency in the language, and it is mitigated: the compiler resolves COPY at
compile time, and circular COPY chains produce RCL-018. The roadmap (DATA COPY,
v0.9) specifies one-authoritative-source rules before the feature ships.

**Comparison:** HTML has deeply hidden dependencies — a class name in markup
references a rule in a stylesheet that may or may not exist, may or may not be
loaded, may or may not be overridden. RECALL eliminates this entire class of
dependency.

---

## Dimension 4: Premature Commitment

*Does the notation force the author to make decisions before they have enough
information to make them well?*

**Rating: Neutral**

PIC X(n) requires the author to declare a maximum length before writing the value.
For short fields (headings, labels) this is a natural constraint. For long fields
(body text, descriptions) it requires estimation, and the compiler enforces it
strictly (RCL-002).

This is the most significant premature commitment in the language. The mitigation
is partial: PIC X without a length specifier defaults to unbounded string (the
compiler warns RCL-W07 only for unknown PIC *types*, not for absent lengths).

The DATA before PROCEDURE ordering requires all fields to be declared before any
rendering is written. This could be seen as commitment, but in practice the
DATA DIVISION doubles as the content inventory for a page — knowing what fields
you have before you render them is the design intent.

**Note for v1.0:** An `AUTOLEN` PIC modifier has been discussed for fields where
the author explicitly opts out of length validation. This would resolve the
premature commitment concern for body text without weakening the general contract.

---

## Dimension 5: Progressive Evaluation

*Can the author try out partial solutions without completing the whole program?*

**Rating: Weak**

RECALL requires a complete program structure (IDENTIFICATION + DATA + PROCEDURE +
STOP RUN) to compile successfully. A partial program — DATA declared, PROCEDURE
empty — produces RCL-005 (missing PROCEDURE DIVISION) or RCL-013 (missing STOP RUN).

`recall check` allows validation without HTML generation, which partially addresses
this. But there is no mode that compiles a page with only some sections rendered,
or that produces a draft HTML from an incomplete source.

**This is a genuine limitation.** Early-stage authoring — sketching a page structure
before all content is known — is made harder by the all-or-nothing compilation model.

The compiler's error recovery (v0.8.8) mitigates this partially: the parser no
longer aborts on the first error, so a partial PROCEDURE DIVISION produces a
complete diagnostic report rather than a single failure. The author can see all
problems at once and address them iteratively.

**Planned mitigation (post-1.0):** A `--draft` flag that allows compilation with
missing or empty fields using placeholder content. Not a language change — a
compiler mode.

---

## Dimension 6: Role-Expressiveness

*Does the notation communicate the role of each component — what it is for —
without external documentation?*

**Rating: Positive — strongest dimension for the AI-first design goal**

This is the dimension where RECALL's design investment is most visible.

Division headers are self-describing:

```cobol
IDENTIFICATION DIVISION.   ← who this page is and what it is called
ENVIRONMENT DIVISION.      ← how it should be rendered
DATA DIVISION.             ← what content it has
PROCEDURE DIVISION.        ← how the content is laid out
```

Field names are SCREAMING-SNAKE-CASE identifiers that read as statements:

```cobol
01 HERO-HEADING    PIC X(60)  VALUE "STILL HERE.".
01 CTA-PRIMARY     PIC X(30)  VALUE "READ THE SPEC".
01 INSTALL-CMD     PIC X(40)  VALUE "npm install -g @semanticintent/recall".
```

The `COMMENT` clause adds explicit role annotation at the field level:

```cobol
01 PAGE-SUBTITLE PIC X(80) VALUE ""
   COMMENT "Optional subtitle — leave empty for landing pages, populate for articles".
```

The `WITH INTENT` primitive (roadmap, v0.9) makes role expression a first-class
language feature rather than a convention:

```cobol
DISPLAY HERO
   WITH INTENT "dramatic opening, single product, urgency without hype"
   WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, CTA-PRIMARY.
```

**Comparison with peers:**
- HTML: `<div class="hero-section">` — role is in a class string, not enforced
- Markdown: no element vocabulary, no role encoding
- JSX: role is in component names, enforced only by convention

RECALL encodes role at the grammar level, not the convention level.

---

## Dimension 7: Consistency

*When you know part of the notation, how much does that knowledge help with other parts?*

**Rating: Positive**

All divisions follow the same structural pattern:

```
DIVISION-NAME DIVISION.
   SECTION-NAME SECTION.
      statement.
      statement.
```

The `WITH` clause modifier works uniformly across elements:

```cobol
DISPLAY HEADING-1 FIELD   WITH STYLE MONO.
DISPLAY SECTION   ID "id" WITH LAYOUT CENTERED WITH PADDING LARGE.
DISPLAY CARD-LIST USING X WITH COLUMNS 3 WITH HOVER-LIFT YES.
```

The PIC type system is consistent: every field has a type, every type has validation,
every validation violation has a stable diagnostic code. Learning one PIC type teaches
the pattern for all of them.

The diagnostic code system is itself consistent: errors are `RCL-NNN`, warnings are
`RCL-WNNN`. Every code has the same structure: code, message, why, hint. All 22 codes
follow this pattern with no exceptions.

**Minor inconsistency:** `DISPLAY SECTION` uses children (nested DISPLAY statements)
where all other elements use VALUE or USING. This structural exception is necessary
for layout composition but represents a learning surface — an author who understands
scalar elements must learn a different mental model for SECTION.

---

## Dimension 8: Error-Proneness

*Does the notation make it easy to write something that looks correct but is wrong?*

**Rating: Positive — the primary design investment**

The error-proneness analysis maps directly to RECALL's COBOL lessons. Each of
COBOL's four notorious failure modes was a specific error-proneness problem:

| COBOL failure | RECALL resolution |
|---|---|
| Misplaced period restructured logic silently | Statements are one line; period terminates that line only. RCL-023 catches missing terminators. |
| Column sensitivity — invisible positional semantics | RECALL is indent-insensitive. No Area A, no Area B. |
| Copybook proliferation — unknown authority | COPY deferred; roadmap specifies one-source rules before shipping |
| Implicit behaviour — truncation, uninitialised fields | RCL-002 (truncation), RCL-W06 (uninitialised), RCL-W07 (unknown type), RCL-W08 (malformed value) |

The `valueSet` flag in the compiler's symbol table (v0.8.7) is a direct error-proneness
mitigation: a field with `VALUE ""` and a field with no VALUE clause are identical at
runtime but semantically distinct. The compiler distinguishes them and warns on the
ambiguous one (RCL-W06).

**Strict mode** (`--strict`) promotes all warnings to errors, converting the entire
warning set into hard failures. For AI compositor use — where all output must be
unambiguous — strict mode makes error-proneness near-zero.

**Evidence:** The per-code test suite (v0.8.8) documents 22 distinct error conditions,
each with a minimal reproducible case. This is the compiler's formal proof that every
identified error-proneness vector has a detection path.

---

## Dimension 9: Abstraction

*Does the notation support building reusable abstractions? What is the abstraction ceiling?*

**Rating: Neutral (with a roadmap)**

RECALL has two abstraction mechanisms:

**COMPONENT DIVISION** — reusable template blocks with typed parameters:

```cobol
COMPONENT DIVISION.
   DEFINE PRICING-CARD.
      ACCEPTS TIER, PRICE, FEATURES.
      DISPLAY HEADING-2 TIER.
      DISPLAY LABEL PRICE.
      DISPLAY CARD-LIST USING FEATURES.
   END DEFINE.
```

**COPY FROM** — file inclusion for shared layout fragments (nav, footer):

```cobol
ENVIRONMENT DIVISION.
   COPY FROM "theme.rcpy".

PROCEDURE DIVISION.
   RENDER-NAV.
      COPY FROM "components/nav.rcpy".
```

Both mechanisms exist and are implemented. The abstraction ceiling is currently
lower than a general programming language: there are no higher-order components,
no conditional rendering, no loops. A component cannot call another component
dynamically. These are constraints, not oversights — the language is a publishing
language, not a general-purpose one.

**Roadmap:** The WITH INTENT primitive is a different kind of abstraction — intent
as composition instruction rather than template. An AI compositor expands intent
into concrete RECALL source. This shifts abstraction from a structural concern
to a semantic one.

---

## Dimension 10: Secondary Notation

*Can the author add meaning through layout, naming, or comments beyond the formal syntax?*

**Rating: Positive**

RECALL treats secondary notation as a first-class design concern.

**Naming** is constrained to SCREAMING-SNAKE-CASE, which functions as a secondary
notation signal: identifiers visually distinct from keywords, readable as intent.

**COMMENT clauses** are part of the language grammar, not stripped at compile time:

```cobol
01 PAGE-SUBTITLE PIC X(80) VALUE ""
   COMMENT "Leave empty for index pages, populate for article pages".
```

COMMENT content is preserved in the compiler's symbol table and available to the
AI compositor via `recall check --format json`. It travels with the data contract.

**Indentation** is optional and unsemantic, but conventional. Standard RECALL style
uses 3-space indentation aligned to division nesting. Because the language enforces
no indentation rules, secondary notation via indentation cannot create hidden errors
(cf. Python's semantic indentation, COBOL's column rules).

**The embedded source comment** in compiled HTML is itself a secondary notation
mechanism: every `.html` output file begins with the original `.rcl` source in
a comment block. View Source on any RECALL page and the intent is readable.

---

## Dimension 11: Closeness of Mapping

*How closely does the notation map to the problem domain?*

**Rating: Positive**

The problem domain is web publishing. The notation maps to it directly:

| Domain concept | RECALL encoding |
|---|---|
| Page identity (title, author, date) | IDENTIFICATION DIVISION |
| Rendering environment (viewport, colour) | ENVIRONMENT DIVISION |
| Content inventory | DATA DIVISION |
| Layout and output | PROCEDURE DIVISION |
| Content type (heading, paragraph, CTA) | Element vocabulary (HEADING-1, PARAGRAPH, BUTTON) |
| Content field | PIC X(n) with VALUE |
| List of items | ITEMS SECTION with grouped fields |
| Reusable component | COMPONENT DIVISION DEFINE |

The domain is publishing, not computation. RECALL has no loops, no conditionals,
no arithmetic — not because these are hard to implement, but because they are not
part of the domain. The closeness of mapping is maintained by deliberate exclusion.

**Comparison:** HTML's domain is document structure, not publishing intent.
A `<section>` is a structural container with no semantic commitment to what it
contains or how it should be treated. A `DISPLAY HERO WITH INTENT` is a publishing
instruction — it tells the system what the author wants to achieve.

---

## Dimension 12: Diffuseness

*How much space does the notation take to express an idea? Is it unnecessarily verbose?*

**Rating: Intentional tradeoff — verbose by design**

RECALL is verbose. A minimal valid program is approximately 20 lines. A landing
page (see `examples/landing.rcl`) is 139 lines for content that would be ~80 lines
of HTML (without CSS) or ~15 lines of Markdown.

This is not a failure. It is the central thesis of the design:

> "Verbose is a feature. COBOL's English-like verbosity is intentional legibility.
> A RECALL source file reads like a structured document. The intent is visible
> without a comment." — RECALL design principles

The verbosity serves three explicit purposes:

1. **Human readability without documentation** — a non-programmer reading a RECALL
   file can infer the page structure without prior knowledge of the language
2. **AI compositor signal** — more syntax means more formal signal for a language
   model to read. Less ambiguity per token.
3. **Provenance** — the IDENTIFICATION DIVISION fields (`AUTHOR`, `DATE-WRITTEN`,
   `PROGRAM-ID`) are publishing metadata, not compiler boilerplate. They travel
   with every compiled output.

The honest acknowledgement: for authors who want to quickly sketch a page,
RECALL's minimum viable program is a barrier. The language is not optimised for
speed of authoring. It is optimised for durability of artifact and legibility of
intent.

---

## Dimension 13: Hard Mental Operations

*Does the notation require difficult or error-prone mental calculations?*

**Rating: Positive**

RECALL requires no mental arithmetic, no state tracking, no execution model
reasoning. The author declares fields and renders them. There is no mutable state.
There are no side effects. There is no order dependency between DATA DIVISION fields.

The hardest mental operation in RECALL is understanding group hierarchy — the
05/10/15 level numbering inherited from COBOL:

```cobol
01 WHY-COBOL-ITEMS.
   05 WHY-1.
      10 PROJ-TITLE  PIC X(60)  VALUE "AI'S BEST TRAINING LANGUAGE.".
      10 PROJ-DESC   PIC X(200) VALUE "...".
```

The convention is that higher level numbers are children of lower level numbers.
This is not immediately obvious to a first-time reader. The compiler validates
group structure but does not currently guide level number selection. An author
who writes `05` where `10` was expected will get structurally incorrect nesting
with no error.

**Planned mitigation:** RCL-W09 (inconsistent level nesting) is documented in
the roadmap as a future diagnostic.

---

## Summary Profile

| Dimension | Rating | Notes |
|---|---|---|
| Viscosity | Positive | One-field changes are isolated; PIC X(n) widening is minor friction |
| Visibility | Positive | DATA / PROCEDURE separation; COMMENT clause extends intent visibility |
| Hidden Dependencies | Positive | All references explicit and compiler-validated; COPY is the one exception |
| Premature Commitment | Neutral | PIC X(n) length requires estimation; AUTOLEN proposed for v1.0 |
| Progressive Evaluation | Weak | All-or-nothing compilation; `recall check` partially mitigates |
| Role-Expressiveness | Positive | Strongest dimension; division headers, COMMENT, WITH INTENT |
| Consistency | Positive | Uniform WITH clause, uniform PIC system, uniform diagnostic format |
| Error-Proneness | Positive | 22 diagnostic codes; strict mode; valueSet distinction; per-code test coverage |
| Abstraction | Neutral | COMPONENT DIVISION + COPY implemented; WITH INTENT a new abstraction model |
| Secondary Notation | Positive | COMMENT as grammar, embedded source, unsemantic indentation |
| Closeness of Mapping | Positive | Domain is publishing; elements map to publishing intent, not HTML structure |
| Diffuseness | Intentional tradeoff | Verbose by design; legibility and AI signal over authoring speed |
| Hard Mental Operations | Positive | No state, no arithmetic; level numbering is the only non-obvious convention |

**Strong dimensions (4+ of 13):** Visibility, Hidden Dependencies, Role-Expressiveness,
Consistency, Error-Proneness, Secondary Notation, Closeness of Mapping, Hard Mental
Operations.

**Weak dimensions (1 of 13):** Progressive Evaluation — a known limitation with a
planned mitigation.

**Intentional tradeoffs (1 of 13):** Diffuseness — verbosity is the stated design
choice, not an oversight.

---

## Comparison with Peer Notations

The following comparison is analytical, not empirical. It reflects the framework
applied to three peer notations for the same problem domain: web publishing.

| Dimension | HTML | Markdown | RECALL |
|---|---|---|---|
| Viscosity | High (class/style coupling) | Low | Low-Neutral |
| Visibility | Low (structure + style separated) | High for text, low for structure | High |
| Hidden Dependencies | High (CSS class chains, JS hooks) | Low | Positive |
| Premature Commitment | Low | Very low | Neutral |
| Progressive Evaluation | High (browser renders anything) | High | Weak |
| Role-Expressiveness | Low (div soup) | Low (flat) | High |
| Consistency | Neutral | High for prose, low for mixed | High |
| Error-Proneness | High (silent rendering failures) | Low | Positive |
| Abstraction | Via components/frameworks | None | Neutral |
| Secondary Notation | Class names, comments | Headings, formatting | Strong |
| Closeness of Mapping | Document structure | Prose document | Publishing intent |
| Diffuseness | Neutral | Very low | High |
| Hard Mental Operations | High (box model, cascade, specificity) | Low | Positive |

**Observation:** RECALL's profile is consistent with its design claim. It trades
diffuseness and progressive evaluation — both genuine costs — for role-expressiveness,
visibility, and error-proneness — the properties that matter most for an AI-first
publishing language where the primary reader is a language model, not a web browser.

---

## Design Observations

Three observations the framework reveals that are not obvious from reading the spec:

**1. The target reader changes the optimal dimension profile.**

If the primary reader is a human author, Progressive Evaluation and low Diffuseness
matter most — you want fast feedback on partial work and minimal typing. If the
primary reader is an AI compositor, Role-Expressiveness, Visibility, and low
Error-Proneness matter most — the AI needs formal signal, not authoring convenience.
RECALL's profile is deliberately optimised for the second case. This is the
AI-first design claim made concrete.

**2. The diagnostic system is a dimension property, not a feature.**

Error-Proneness in the Cognitive Dimensions framework is a property of the
notation itself — how likely the notation is to invite mistakes. The RECALL
compiler's diagnostic system is the enforcement mechanism that converts
error-prone constructs into compiler-caught errors. RCL-W06 (uninitialised field)
is not a convenience warning for human programmers. It is the compiler enforcing
a notation property: ambiguous declarations are not acceptable in a language
designed for machine readability.

**3. Progressive Evaluation is the correct weakness to have.**

A publishing language that prioritises durability, provenance, and formal
correctness should not optimise for partial compilation. The weakness in
Progressive Evaluation is evidence that RECALL is not trying to be a prototyping
tool. It is trying to be an artifact language — something that produces outputs
that can be audited, reproduced, and trusted. The all-or-nothing compilation model
is the right price for that property.

---

## Limitations of This Analysis

This is a single-analyst, analytical evaluation. Its limitations:

- **No user study.** No RECALL programs were written by participants unfamiliar
  with the language. The dimension ratings reflect the designer's perspective,
  not observed usage.
- **No comparative user study.** The peer comparison (HTML, Markdown) is
  analytical, not empirical. A controlled study could contradict some ratings.
- **Version-specific.** This analysis covers RECALL v0.8.8. The language is
  pre-1.0 and evolving. Dimension ratings may shift as the language stabilises.
- **Single analyst.** Expert reviews typically involve 3–5 reviewers. A single
  analyst introduces confirmation bias risk, particularly on dimensions where
  the designer has a stated position (Diffuseness, Role-Expressiveness).

These limitations are standard for analytical evaluation of a pre-release notation.
A user study is appropriate post-1.0, when the language is stable enough that
observed usage reflects the design intent rather than design-in-progress.

---

## Citation

Green, T.R.G. and Petre, M. (1996). Usability Analysis of Visual Programming
Environments: A 'Cognitive Dimensions' Framework. *Journal of Visual Languages
and Computing*, 7(2), 131–174.

Green, T.R.G. (1989). Cognitive Dimensions of Notations. In A. Sutcliffe and
L. Macaulay (eds.), *People and Computers V*, pp. 443–460. Cambridge University Press.

---

*This document is part of the RECALL language specification archive.
It is intended as a living document: updated when the language changes
in ways that affect dimension ratings.*
