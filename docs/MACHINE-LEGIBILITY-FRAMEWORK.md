# Machine Legibility Dimensions (MLD)
## A Framework for Evaluating Notations Where the Primary Reader Is an AI System

> **Version:** 0.1 (initial proposal)
> **Date:** April 2026
> **Author:** Michael Shatny
> **Status:** Proposed framework — not yet peer-reviewed
> **Reference implementation:** RECALL v0.8.8
>
> ---
>
> *This document proposes a framework for evaluating the properties of formal
> notations — programming languages, publishing languages, specification formats —
> from the perspective of an AI system that must read, generate, validate, and
> iterate on source written in that notation. It is a companion to the Cognitive
> Dimensions of Notations framework (Green & Petre, 1996), which evaluates notations
> from the perspective of a human reader. It does not replace that framework. It
> covers a different reader.*

---

## 1. Motivation

### 1.1 The Gap in Existing Frameworks

The Cognitive Dimensions of Notations framework (Green & Petre, 1996) provides a
structured vocabulary for evaluating notations along dimensions like viscosity,
visibility, role-expressiveness, and error-proneness. It is grounded in cognitive
science — specifically in how human working memory, attention, and pattern
recognition interact with the structure of a notation.

This grounding is its strength and its scope limit. The framework was designed
for human readers. Its dimensions measure cognitive load, learning curves, and
the mental effort required to read and modify notation. These are the right
questions when the reader is human.

They are not the only questions when the reader is an AI system.

A large language model reading a notation does not experience working memory
constraints in the way a human does. It does not get fatigued, cannot scroll back
to check a declaration, and does not rely on peripheral vision to notice misaligned
structure. But it has its own constraints: it operates on tokenised sequences, its
attention is bounded by context windows, its training distribution shapes which
vocabulary it handles confidently, and its generation process accumulates errors
without the self-correction that human programmers apply mid-keystroke.

These constraints produce a different set of questions about notation design. No
existing framework asks them.

### 1.2 Why the Question Matters Now

AI systems are increasingly primary participants in the software production cycle.
They do not read documentation and then write code — in many production contexts,
they are the first and only author of a notation, with human review happening
downstream. When an AI system is the primary producer of a notation, the properties
of that notation that determine whether AI production is reliable, correctable, and
auditable are design properties, not usage properties. They can be evaluated before
a single AI-generated program is written.

The absence of a framework for this evaluation means that notations being used
with AI compositors, generators, and assistants are being evaluated informally —
by observation, by trial and error, by accumulated practitioner intuition. A
formal framework would allow notation designers to reason about these properties
before building, and to evaluate existing notations against them.

### 1.3 RECALL as the Reference Case

RECALL is a COBOL-inspired publishing language for the web, designed from the
foundation with the explicit goal of making AI composition reliable and auditable.
It was built before this framework existed — the design decisions that satisfy
the dimensions below were made for practical reasons during implementation, not
against a checklist.

That sequence is significant. RECALL's design choices can serve as evidence
that the dimensions in this framework are real, non-trivial properties, because
they were arrived at independently through the process of building a language that
actually works with AI compositors.

Where the framework describes a dimension, the RECALL analysis section shows the
concrete design decision that addresses it — and, where applicable, the compiler
behaviour that enforces it.

---

## 2. Foundational Claims

Before defining the dimensions, three foundational claims that distinguish
this framework from its predecessor:

**Claim 1: The primary reader changes the evaluation criteria.**

A notation optimised for human readers minimises cognitive load, supports
progressive evaluation, and tolerates ambiguity that skilled authors resolve
through implicit knowledge. A notation optimised for AI readers minimises
inferential state, maximises formal signal per token, and eliminates ambiguity
that a language model would resolve by sampling — producing outputs that are
statistically plausible but structurally wrong.

The optimal design is different. A notation can score well on Cognitive Dimensions
and poorly on Machine Legibility Dimensions, and vice versa.

**Claim 2: AI generation errors compound; human generation errors are caught
mid-production.**

A human programmer writing invalid syntax notices it immediately — through editor
highlighting, failed compilation, or the visual signal of broken structure.
Correction happens before the output leaves the editor. An AI system generating
invalid syntax at position N of a 200-token output does not self-correct — it
continues generating from the invalid state, and subsequent tokens are conditioned
on the error. The error compounds.

This makes error recovery a property of the notation itself, not just the tooling.
A notation that produces specific, structured, correctable diagnostics on invalid
input gives an AI compositor a feedback signal it can act on. A notation that
produces undifferentiated failures, or that silently accepts malformed input, gives
the AI compositor nothing to correct against.

**Claim 3: The compiler is an AI runtime component, not just a validator.**

In a notation designed for AI composition, the compiler's schema, symbol table,
and diagnostic output are inputs to the AI compositor's generation process — not
downstream artifacts that happen after AI involvement ends. A notation that exposes
its schema as a queryable resource (what elements are valid? what types does each
accept?) is fundamentally different from one that does not, for an AI compositor.
The compiler is part of the AI's working context.

---

## 3. The Dimensions

Nine dimensions are defined. Each dimension is:

- **Defined** — what property it measures
- **Rated** on a three-point scale: Positive / Neutral / Weak
- **Illustrated** with examples showing high and low scores
- **Applied to RECALL** with evidence from compiler behaviour and source examples

---

### Dimension 1: Tokenisation Alignment

**Definition:** How well does the notation's lexical structure align with the
tokenisation strategies used by large language models? A notation with high
tokenisation alignment uses vocabulary that maps to single or bounded token
sequences, avoiding constructs that fragment into unpredictable subword units.

**Why it matters:** Language models generate text token by token. If a keyword
fragments into multiple tokens in the model's vocabulary, the probability of
generating the correct complete keyword is the product of the probabilities of
each token in sequence. Every additional token in a keyword is a multiplication
of failure probability. A notation whose keywords are single tokens in common
LLM vocabularies is fundamentally easier for those models to generate correctly.

**High score example:** SQL keywords (`SELECT`, `FROM`, `WHERE`, `INSERT`) are
single tokens in most LLM vocabularies. The model's probability mass for a
`SELECT` statement is concentrated at one decision point.

**Low score example:** A notation that uses punctuation-heavy keywords
(`.forEach(`, `=>`, `?.`) fragments into multiple tokens and requires the model
to make several sequential correct decisions to produce one logical operator.

**RECALL rating: Positive**

RECALL's vocabulary is drawn from COBOL, which uses natural English words as
keywords. `DISPLAY`, `PROCEDURE`, `IDENTIFICATION`, `WORKING-STORAGE`, `VALUE`
are all well-represented in the training distributions of large language models —
both because they are English words and because COBOL itself is present in
training data.

```cobol
DISPLAY HEADING-1 PAGE-TITLE
   WITH STYLE MONO.
```

`DISPLAY`, `HEADING-1`, `WITH`, `STYLE`, `MONO` — each of these is a single
or two-token sequence in GPT-family tokenisers. The probability of correct
generation is concentrated at semantic decision points (which element? which
field?) rather than distributed across syntactic fragments.

The hyphenated identifier convention (`PAGE-TITLE`, `HERO-HEADING`,
`WORKING-STORAGE`) is the one alignment cost: hyphenated tokens sometimes split.
This is mitigated by the SCREAMING-SNAKE-CASE naming convention, which is
present in training data as a recognisable pattern even when individual tokens
split.

---

### Dimension 2: Ambiguity Surface

**Definition:** The number of constructs in the notation that have more than one
valid interpretation, or that produce valid but unintended output when generated
imprecisely. A low ambiguity surface means that any given generation decision
has one correct outcome — or that incorrect outcomes are structurally invalid
and caught by the compiler.

**Why it matters:** An AI compositor resolves ambiguity by sampling from its
probability distribution. Frequent ambiguity means frequent sampling, and sampling
compounds: each ambiguous choice conditions the probability of subsequent choices.
A notation with a low ambiguity surface converts ambiguous choices into structural
errors, allowing the compiler to catch them rather than allowing the AI to silently
resolve them incorrectly.

**High score example:** A notation where every statement has a required terminator
(`STOP RUN.`, statement `.`) and the compiler rejects unterminated statements.
The AI cannot omit a terminator accidentally and have the program compile.

**Low score example:** HTML, where an unclosed `<div>` is valid (browsers
auto-close), a `<div class="hero">` and `<section class="hero">` are
interchangeable for rendering purposes, and inline styles and class-based styles
produce identical output through different paths. Every layout decision is
ambiguous.

**RECALL rating: Positive**

RECALL systematically eliminates ambiguity at the language level. Four
specific design decisions each address a category of ambiguity:

**Structural ambiguity:** Every RECALL statement is one line, terminated with a
period. The compiler emits `RCL-023` for any statement missing its terminator.
An AI compositor cannot write a multi-line statement that *looks* terminated.

**Type ambiguity:** Every DATA DIVISION field has a declared PIC type. The
compiler validates type compatibility at every reference point (RCL-001, RCL-005,
RCL-007, RCL-008). An AI compositor cannot silently misuse a field's type.

**Initialisation ambiguity:** The compiler distinguishes `VALUE ""` (declared
empty — intentional) from absence of VALUE clause (undeclared — ambiguous) via
the `valueSet` symbol table flag, emitting `RCL-W06` on the latter. Two
runtime-identical states are semantically differentiated in the type system.

**Reference ambiguity:** Every PROCEDURE DIVISION reference must name a field
explicitly declared in DATA DIVISION (RCL-004). There are no implicit variables,
no scope-based lookups, no fallback values. An AI compositor either names a
declared field or produces a compiler error.

---

### Dimension 3: State Surface

**Definition:** The amount of program state an AI compositor must track and
maintain correctly to generate valid output at any point in the program. A low
state surface means each generation decision can be made with minimal reference
to prior decisions. A high state surface means that generating position N correctly
requires having generated positions 1 through N-1 correctly.

**Why it matters:** An AI compositor generating a 200-token program cannot
re-read its own prior output with the same fidelity a human author can. Attention
mechanisms have limits. A notation where each decision is locally valid — where
"does this statement compile?" does not depend on a complex accumulated state —
is fundamentally more reliable for AI generation than one where validity is
global.

**High score example:** A notation where each statement is self-contained:
the element name, its value reference, and its modifiers all appear on the same
line. No statement's validity depends on the state left by a prior statement.

**Low score example:** A language with mutable variables, where generating a
`return result` statement requires having tracked what `result` was assigned to
across potentially many prior lines, any of which could have reassigned it.

**RECALL rating: Positive**

RECALL has near-zero mutable state. The DATA DIVISION is fully declared
before the PROCEDURE DIVISION begins. An AI compositor generating PROCEDURE
DIVISION statements operates against a fixed, fully-known data contract — there
is no state to track, no assignment to remember, no scope to maintain.

```cobol
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-HEADING PIC X(60) VALUE "STILL HERE.".
      01 CTA-PRIMARY  PIC X(30) VALUE "READ THE SPEC".

PROCEDURE DIVISION.
   RENDER-HERO.
      DISPLAY HEADING-1 HERO-HEADING.    ← self-contained
      DISPLAY BUTTON    CTA-PRIMARY.     ← self-contained
```

Each DISPLAY statement can be evaluated for correctness independently. The
validity of `DISPLAY BUTTON CTA-PRIMARY.` does not depend on whether
`DISPLAY HEADING-1 HERO-HEADING.` was correct. An AI compositor can generate,
validate, and correct each statement in isolation.

The only cross-statement state in RECALL is the SECTION nesting model
(`DISPLAY SECTION ... STOP SECTION`), which introduces one level of open/close
state. This is the notation's highest state surface point.

---

### Dimension 4: Schema Availability

**Definition:** Can an AI compositor query the valid vocabulary of the notation
before generating? A notation with high schema availability exposes a queryable
registry of valid constructs — elements, types, clauses — that an AI compositor
can retrieve as context before generation begins, rather than relying on its
training distribution to recall what is valid.

**Why it matters:** An AI compositor operating from memory of its training
distribution will occasionally hallucinate element names, invent clause modifiers
that don't exist, or apply types to contexts that don't accept them. A notation
that exposes its own schema as a live, queryable resource replaces training
memory with ground truth. The query result is always current because it is the
compiler itself.

**High score example:** A notation where `notation schema --json` returns a
complete, typed registry of all valid elements, their accepted types, their
required and optional clauses, and their constraints — and where this output is
the compiler's internal registry, not a separate documentation file.

**Low score example:** A notation where the valid vocabulary is documented in
a README that may be out of sync with the implementation, and where there is no
programmatic way to query what is currently valid.

**RECALL rating: Positive**

RECALL implements `recall schema --json`, which returns the live element
registry from the compiler's internal `BUILT_IN_ELEMENTS` table. The output
is always current — it cannot drift from the implementation because it *is*
the implementation.

```json
{
  "elements": {
    "HEADING-1": {
      "accepts": "string",
      "requiresUsing": false,
      "clauses": ["WITH STYLE"]
    },
    "CARD-LIST": {
      "accepts": "group",
      "requiresUsing": true,
      "clauses": ["WITH COLUMNS", "WITH STYLE", "WITH HOVER-LIFT"]
    }
  }
}
```

Additionally, `recall check --format json` exposes the DATA DIVISION symbol
table — field names, PIC types, VALUE strings, COMMENT clauses, and the
`valueSet` flag — as a structured input for AI compositor context. An AI
compositor reading this output knows not just what fields exist, but what
they mean and what their declared intent is.

The combination of schema + symbol table gives the AI compositor a complete
context for constrained generation before writing a single output token.

---

### Dimension 5: Error Signal Fidelity

**Definition:** When an AI compositor produces invalid notation, how useful is
the compiler's feedback for correction? A notation with high error signal fidelity
produces structured, stable, code-keyed diagnostics with specific location
information and corrective hints. A notation with low error signal fidelity
produces generic error messages that do not identify the specific violation or
suggest a correction path.

**Why it matters:** An AI compositor in a human-supervised loop — where the
human sets intent, the AI generates, the compiler validates, and the AI corrects
— requires structured feedback to close the correction loop. A message like
`syntax error` is not actionable. A message like `[RCL-023] Statement has no
terminator at line 8:4 — DISPLAY HEADING-1 PAGE-TITLE — add a period` is
actionable: the AI compositor can identify the line, apply the correction rule,
and regenerate.

Diagnostic code stability is a secondary property: if diagnostic codes are stable
across compiler versions, an AI compositor can be trained on what each code means
and what correction each code requires. Unstable messages cannot be trained on.

**High score example:** A diagnostic system where every error has a stable code,
a machine-readable location (file, line, column), a specific description of the
violation, and a corrective hint — and where these are consistently available
as structured JSON output.

**Low score example:** A compiler that prints `Error: unexpected token` at a
line number, with no code, no category, no hint, and message text that changes
between versions.

**RECALL rating: Positive**

RECALL's diagnostic system was designed explicitly for AI compositor use.
Every diagnostic has:

- A stable code (`RCL-NNN` for errors, `RCL-WNNN` for warnings)
- A category (`syntax`, `type-mismatch`, `missing-required`, `data`, etc.)
- A source snippet with a caret pointing to the offending token
- A human-readable `why` string explaining the specific violation
- A corrective `hint` string

```
ERROR [RCL-023] syntax — program.rcl:8:4
  DISPLAY HEADING-1 PAGE-TITLE
                    ^^^^^^^^^^
  Statement has no terminator
  Hint: Add a period at the end of the statement
```

`recall check --format json` makes all diagnostics available as structured
output:

```json
{
  "diagnostics": [{
    "code": "RCL-023",
    "severity": "error",
    "category": "syntax",
    "file": "program.rcl",
    "line": 8,
    "col": 4,
    "message": "Statement has no terminator",
    "why": "DISPLAY HEADING-1 PAGE-TITLE has no period",
    "hint": "Add a period at the end of the statement"
  }]
}
```

The per-code test suite (v0.8.8, 22 tests) formally documents what input
triggers each code. This is the machine-readable proof that each error signal
is stable and reproducible.

The correction loop for an AI compositor is:
1. Generate RECALL source
2. `recall check --format json`
3. Read `diagnostics` array
4. For each diagnostic: locate by `file/line/col`, apply correction per `hint`
5. Regenerate and recheck

This loop is fully mechanical — it does not require human interpretation of
the error signal.

---

### Dimension 6: Intent Density

**Definition:** How much semantic signal about the author's intent is encoded
per token in the notation? A notation with high intent density gives an AI
compositor more to work with per line: explicit declarations of what content is
for, what layout is intended, what the rendering context is. A notation with low
intent density requires the AI to infer intent from structure or naming
conventions.

**Why it matters:** An AI compositor generating content for a field or element
must infer what that field or element is for if the notation does not declare it.
Inference is probabilistic. Declaration is deterministic. A notation that moves
more intent from inference into declaration improves AI compositor reliability
proportionally to the amount of intent declared.

**High score example:**
```cobol
01 CTA-PRIMARY PIC X(30) VALUE "READ THE SPEC"
   COMMENT "Primary call to action — should convey momentum not instruction".
```
The field name, type, value, and semantic intent are all formally declared.
An AI compositor expanding this field has four signals: name (CTA-PRIMARY →
call to action), type (PIC X, string), value ("READ THE SPEC"), and intent
comment (momentum not instruction).

**Low score example:**
```html
<a href="/spec" class="btn btn-primary">Read the spec</a>
```
The element's role is in class names (conventions, not declarations), the semantic
intent is absent, and the link text "Read the spec" is the only content signal.

**RECALL rating: Positive**

RECALL encodes intent at three levels:

**Field-level:** PIC type declares the semantic category of a field. `PIC DATE`
is not just a string — it is a date, and the compiler validates ISO 8601 format
(RCL-009). `PIC URL` is not just a string — it is a URL, and the compiler
validates protocol and path format (RCL-010). `PIC PCT` is a percentage
with a bounded range (RCL-011). The type system encodes semantic constraints
that are meaningful to an AI compositor beyond simple type checking.

**COMMENT clause:** Formal intent annotation at the field level, preserved in
the compiler's symbol table, available via `recall check --format json`:

```cobol
01 PAGE-SUBTITLE PIC X(80) VALUE ""
   COMMENT "Optional — leave empty for index pages, populate for articles".
```

**WITH INTENT (roadmap):** A first-class composition intent clause that declares
what a rendered block should feel like and what data it has:

```cobol
DISPLAY HERO
   WITH INTENT "dramatic opening, single product, urgency without hype"
   WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, CTA-PRIMARY.
```

Each level increases intent density. The roadmap item (WITH INTENT) is the
most significant: it moves intent from a field-level annotation to a block-level
composition instruction that is part of the compiled artifact — the intent clause
is not a comment. It is a formal program statement.

---

### Dimension 7: Round-trip Fidelity

**Definition:** How much information is preserved when an AI compositor
generates valid notation, the notation is compiled, the output is read, and
the source is regenerated? A notation with high round-trip fidelity produces
outputs where the original source — and the intent behind it — is recoverable
from the compiled artifact.

**Why it matters:** An AI compositor operating in an iterative loop (generate →
compile → read output → adjust → regenerate) needs the compiled artifact to
carry enough signal for the re-read step to be informative. A notation where
the compiled output contains only the result — with no trace of the source or
intent — breaks the iterative loop. Each iteration starts from zero.

**High score example:** A notation where the compiled output embeds the full
source, and where the source contains formal intent annotations that were input
to the compilation. Reading the compiled artifact gives the AI compositor the
same signal as reading the source.

**Low score example:** A notation where compilation is lossy — source
transpiles to minified output with no source maps, no embedded source, and no
intent annotations surviving the compilation step.

**RECALL rating: Positive — by design principle**

The RECALL design principle "the source is the artifact" is precisely a
round-trip fidelity guarantee. Every compiled `.html` file embeds the full
`.rcl` source in a comment block at the top of the output:

```html
<!--
RECALL COMPILED OUTPUT
Generated: 2026-04-07

SOURCE:
IDENTIFICATION DIVISION.
   PROGRAM-ID. RECALL-LANDING.
   ...
-->
```

An AI compositor reading a compiled RECALL page can recover the full source,
including DATA DIVISION field declarations, COMMENT clauses, PIC types, and
VALUE strings. The information loss from compilation is zero.

When WITH INTENT ships, the intent clause will also appear in the compiled
output — alongside the AI-expanded source it produced. The reasoning (intent)
and the action (expanded source) coexist in the artifact, making the
decision auditable after the fact.

Round-trip fidelity is the property that makes RECALL pages maintainable
across time by AI compositors that did not produce the original — they can
read the artifact, recover the source, understand the intent annotations, and
generate valid modifications against the same contract.

---

### Dimension 8: Constraint Completeness

**Definition:** Does the notation constrain the solution space sufficiently
that an AI compositor cannot generate plausible-but-wrong output that passes
compilation? A notation with high constraint completeness makes the valid
program space small enough that structural correctness is a meaningful guarantee.
A notation with low constraint completeness accepts a large variety of inputs,
many of which compile successfully but produce semantically incorrect results.

**Why it matters:** The goal of using a formal notation for AI composition is
not just that the AI can generate something that compiles — it is that compilation
is a meaningful quality signal. If the notation is so permissive that almost
anything compiles, the compiler's approval is not informative. The constraint
completeness of a notation determines how much the compiler can guarantee about
AI-generated output.

**High score example:** A notation with a closed element vocabulary — where
generating an invalid element name is a compiler error, not a rendering fallback.
The compiler's approval means the AI used only elements that actually exist.

**Low score example:** HTML, where `<foo>` is valid HTML5 (custom elements),
where `class="whatever"` compiles regardless of whether the CSS rule exists,
and where a missing `alt` attribute on an image produces valid, compilable,
semantically incomplete output.

**RECALL rating: Positive**

RECALL's element vocabulary is closed. The compiler maintains a registry
(`BUILT_IN_ELEMENTS`) and rejects any element name not in the registry with
`RCL-003`. An AI compositor cannot invent an element:

```
DISPLAY HERO-BANNER PAGE-TITLE.
         ^^^^^^^^^^^
ERROR [RCL-003] Unknown element: HERO-BANNER is not registered
```

The type system adds a second layer: even with a valid element, the field
passed to it must be type-compatible. A group field cannot be passed to a
string element (RCL-001/RCL-008). A numeric field cannot be silently coerced
to a string context without a warning (RCL-W05). A field without a VALUE
clause cannot be referenced without a warning (RCL-W06).

In strict mode (`--strict`), all warnings become errors. The constraint
completeness in strict mode is near-total: if a RECALL program compiles in
strict mode, it means every field is declared with explicit intent, every
type is compatible, every reference is to a known identifier, and every
statement is properly terminated. This is a meaningful quality guarantee.

---

### Dimension 9: Decomposability

**Definition:** Can valid notation be generated in independent segments without
requiring full-program context? A notation with high decomposability allows an
AI compositor to generate a DATA DIVISION field, a PROCEDURE section, or a
component independently — without needing to hold the entire program in context.
A notation with low decomposability makes every part of the program dependent
on every other part.

**Why it matters:** Context window constraints are real. An AI compositor
generating a large program cannot always hold the entire source in context.
A notation where sections are independently valid — where generating a new
PROCEDURE section does not require re-reading the entire DATA DIVISION — allows
AI compositors to operate effectively on large programs by generating in chunks.

**High score example:** A notation where DATA fields are independently declared
(no cross-references between fields), where PROCEDURE sections are independently
renderable (each section contains all its display logic), and where adding a new
section does not require modifying existing ones.

**Low score example:** A notation where adding a new UI component requires
updating a central routing file, a type index, a CSS module export, and a
storybook story — where each piece depends on the others.

**RECALL rating: Positive**

RECALL's DATA DIVISION fields are independently declared. Adding a new field:

```cobol
01 HERO-BADGE PIC X(20) VALUE "NEW".
```

requires no changes to any other field. There are no import statements, no
type indexes, no cross-field references in the DATA DIVISION.

PROCEDURE sections are independently renderable. Adding a new section:

```cobol
RENDER-BADGE.
   DISPLAY LABEL HERO-BADGE.
STOP SECTION.
```

requires only that `HERO-BADGE` exists in DATA DIVISION and that the section
appears before `STOP RUN`. It does not require modifying existing sections.

COMPONENT DIVISION components are independently defined — each DEFINE block
is self-contained with its own ACCEPTS parameters.

The one decomposability constraint: the program must include at least one
PROCEDURE section and STOP RUN to compile. This minimum scaffold is the
boundary of decomposable generation — below it, partial compilation is not
supported.

---

## 4. Summary Profile

| Dimension | Rating | Summary |
|---|---|---|
| Tokenisation Alignment | Positive | COBOL-derived vocabulary; English keywords map well to LLM token distributions |
| Ambiguity Surface | Positive | Closed element set, required terminators, explicit types, no implicit references |
| State Surface | Positive | Near-zero mutable state; PROCEDURE statements are locally evaluable |
| Schema Availability | Positive | `recall schema --json` and `recall check --format json` expose live compiler state |
| Error Signal Fidelity | Positive | Stable codes, structured JSON output, per-code correction hints |
| Intent Density | Positive | PIC type semantics, COMMENT clause, WITH INTENT (roadmap) |
| Round-trip Fidelity | Positive | Source embedded in compiled output by design principle |
| Constraint Completeness | Positive | Closed vocabulary, strict type system, --strict mode upgrades all warnings to errors |
| Decomposability | Positive | DATA fields and PROCEDURE sections independently addable |

**Overall profile:** RECALL scores positively on all nine dimensions. This is
the expected result for a language designed with these properties in mind.

The framework's value is not in the RECALL score — it is in the dimensions
themselves, which provide a vocabulary for evaluating any notation against these
properties.

---

## 5. Comparison with Peer Notations

| Dimension | HTML | JSX/React | Markdown | RECALL |
|---|---|---|---|---|
| Tokenisation Alignment | Neutral | Neutral | Positive | Positive |
| Ambiguity Surface | Weak | Weak | Neutral | Positive |
| State Surface | Weak | Weak | Positive | Positive |
| Schema Availability | Neutral | Neutral (PropTypes) | None | Positive |
| Error Signal Fidelity | Weak | Neutral | None | Positive |
| Intent Density | Weak | Neutral | Weak | Positive |
| Round-trip Fidelity | Weak | Weak | Neutral | Positive |
| Constraint Completeness | Weak | Neutral | Weak | Positive |
| Decomposability | Neutral | Weak | Positive | Positive |

**Observation:** HTML and JSX score weakly on most dimensions. This is consistent
with observable AI behaviour when generating these notations: AI-generated HTML
frequently produces plausible structure with semantically incorrect or missing
attributes, over-engineered class hierarchies, and layout decisions that compile
but fail design intent. The weak scores explain the observable failure modes.

Markdown scores well on tokenisation alignment, state surface, and
decomposability — it is simple, stateless, and chunks naturally. It scores
weakly on constraint completeness and intent density — there is no element
vocabulary to violate and no formal way to declare what a section is for.
Markdown is well-suited to AI generation of prose; it is not suited to AI
composition of structured interfaces.

---

## 6. Relationship to Cognitive Dimensions

Machine Legibility Dimensions is a companion framework, not a replacement.
The two frameworks evaluate different properties of the same notation, from
the perspective of different readers.

A notation can score well on Cognitive Dimensions and poorly on MLD:

> A notation that is easy for experienced humans to write quickly — low
> diffuseness, high progressive evaluation — may use implicit conventions
> and abbreviations that reduce intent density and increase ambiguity surface
> for an AI compositor.

A notation can score well on MLD and poorly on Cognitive Dimensions:

> A notation that is highly explicit, formally constrained, and verbose —
> high intent density, low ambiguity surface — scores weakly on diffuseness
> and progressive evaluation in the Cognitive Dimensions framework. RECALL
> is this case.

The ideal notation for a human-AI collaborative context scores well on both.
Where it cannot — where optimising for one reader costs the other — the
tradeoff should be a documented design decision, not an accident.

| CD Dimension | Corresponding MLD Concern |
|---|---|
| Visibility | Intent Density (are intent signals visible to the AI?) |
| Error-Proneness | Ambiguity Surface + Error Signal Fidelity |
| Abstraction | Decomposability (can abstractions be generated independently?) |
| Hidden Dependencies | State Surface (does generation require tracking implicit state?) |
| Consistency | Tokenisation Alignment (consistent vocabulary maps to consistent token paths) |

---

## 7. Limitations and Future Work

**This is a proposed framework, not a validated one.**

The dimensions defined here were derived analytically — from practical experience
building a notation (RECALL) designed for AI compositor use, and from reasoning
about the failure modes of AI generation in existing notations. They have not
been validated through empirical study.

Validation would require:

- **Controlled generation studies:** Give AI compositors identical tasks in two
  notations that differ on one MLD dimension. Measure error rates, correction
  loops, and output quality.
- **Tokenisation analysis:** Empirically measure tokenisation efficiency of
  notation vocabularies across a range of LLM tokenisers.
- **Error recovery experiments:** Measure how reliably AI compositors can
  correct a program given diagnostics of varying fidelity.
- **Multi-analyst review:** The nine dimensions were defined by one analyst.
  Expert review from PLT researchers and ML practitioners would strengthen,
  extend, or challenge the dimension set.

These studies are feasible and represent the natural next step for this framework.
They require a stable notation to study — which is why this analysis is being
written at RECALL v0.8.8, with v1.0 as the stable reference point for any
empirical follow-up.

**The framework does not address all AI reader concerns.**

Nine dimensions do not exhaust the space. Candidates for future dimensions
include:

- **Training distribution alignment** — how well-represented is the notation
  in the pre-training corpora of common LLMs? A notation present in training
  data requires less inference; one absent from it requires more.
- **Correction convergence** — how quickly does an AI compositor converge on
  a correct program through iterative compilation and correction? Some notations
  may have feedback loops that cycle rather than converge.
- **Provenance encoding** — does the notation formally support authorship
  metadata, versioning, and intent-of-change annotations? Relevant for
  long-lived collaborative documents where AI and human authorship interleave.

---

## 8. Conclusion

The properties that make a notation legible to an AI reader are different from
the properties that make it legible to a human reader. They can be named,
defined, and evaluated. A notation that was designed with these properties in
mind — even before a formal framework existed to name them — can be shown to
satisfy them in a structured, reproducible way.

The practical implication is direct: notation designers building tools for
AI-assisted composition can use this framework as a checklist before
implementation, not just as an evaluation after the fact. The dimensions are
design criteria. Each one points to a specific decision: expose your schema
as a queryable API; make your diagnostic system return structured JSON with
stable codes; encode intent at the field level, not just the structural level;
close your element vocabulary.

These are not abstract properties. Each one corresponds to a concrete compiler
or language feature that either exists or does not. The framework makes them
visible as a category — and naming a category is the first step to being able
to design for it.

---

## References

Green, T.R.G. and Petre, M. (1996). Usability Analysis of Visual Programming
Environments: A 'Cognitive Dimensions' Framework. *Journal of Visual Languages
and Computing*, 7(2), 131–174.

Green, T.R.G. (1989). Cognitive Dimensions of Notations. In A. Sutcliffe and
L. Macaulay (eds.), *People and Computers V*, pp. 443–460. Cambridge University Press.

Yao, S. et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models.
*arXiv:2210.03629*.

RECALL Language Specification v0.8.8. Shatny, M. (2026).
`/docs/RECALL_SPEC.md`, `/docs/RECALL-GRAMMAR.md`.

RECALL Cognitive Dimensions Analysis. Shatny, M. (2026).
`/docs/COGNITIVE-DIMENSIONS-ANALYSIS.md`.

---

*This document is a first proposal. Version 0.1. It should be cited as a
working document, not a published framework, until empirical validation is
complete. Feedback from PLT researchers, ML practitioners, and notation
designers is the intended next step.*
