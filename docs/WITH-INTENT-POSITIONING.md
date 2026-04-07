# WITH INTENT — A New Primitive

> Status: Concept documentation
> Originated: April 2026
> Audience: Language designers, AI researchers, potential collaborators

---

## The Claim

`WITH INTENT` as implemented in RECALL is a novel primitive — a formally
constrained AI composition clause embedded in a publishing language with
a live schema and compiler validation.

This combination does not exist elsewhere in this form.

---

## What Makes It New

The novelty is not any single property. Each property exists somewhere.
The novelty is the combination — all five, simultaneously, in a
publishing language:

### 1. Formally constrained output

The AI compositor cannot produce output that falls outside the RECALL
element vocabulary. It cannot invent elements. It cannot use clauses
that don't exist. It cannot reference fields that weren't declared.

This is enforced by the compiler — not by convention, not by a linter,
not by a code review. The compiler rejects invalid output as a
first-class error with a stable diagnostic code.

Constraint is structural, not advisory.

### 2. Data contract declared before composition

The DATA DIVISION is fully declared and validated before the AI
compositor runs. The compositor knows exactly what content exists, what
type each field is (PIC X, PIC 9, PIC DATE, PIC URL), and what each
field means (via COMMENT clauses).

The AI is not guessing at content. It is arranging known, typed,
intent-annotated data. This is the difference between a compositor and
a generator.

### 3. Concerns structurally separated by the language

Theme (ENVIRONMENT DIVISION), data (DATA DIVISION), components
(COMPONENT DIVISION), and layout composition (PROCEDURE DIVISION) are
enforced divisions — not conventions.

The AI compositor operates exclusively in PROCEDURE DIVISION. It cannot
touch the theme. It cannot alter the data. It cannot redefine
components. The walls are enforced by the grammar, not by discipline.

### 4. Output is auditable, persistent source

The expanded RECALL source produced by the AI compositor is not
discarded after compilation. It is:

- Readable by any author with knowledge of the RECALL grammar
- Editable — any AI decision can be overridden directly
- Embedded in the compiled HTML alongside the original intent clause
- Version-controllable — git diff shows exactly what the AI changed

The intent string and the expanded source coexist. The reasoning is
preserved alongside the result.

### 5. Compiler validates AI output, not human output

In all existing AI-to-UI tools, a human reviews the AI output before
it reaches production. The human is the validation layer.

In RECALL, the compiler is the validation layer. The human sets the
intent. The AI composes. The compiler validates. If the AI makes a
structurally invalid decision, the compiler catches it with a stable,
queryable diagnostic code — before the human ever sees the output.

This inverts the trust model. The human trusts the compiler to catch
AI errors, freeing them to focus on intent rather than review.

---

## Why It Cannot Be Retrofitted

The five properties above require each other. They are not independent
features that can be added to an existing language one at a time.

**Schema constraint requires a live, queryable schema.**
The RECALL schema is not documentation — it is the compiler's internal
element registry, exposed via `recall schema --json`. It is always
current because it *is* the compiler. A documentation schema drifts.
A live schema cannot.

**Data contract requires enforced separation.**
If data, theme, and layout can be mixed freely (as in JSX), there is
no stable "data contract" for the AI to operate against. The contract
only exists because the divisions are enforced.

**Auditable source requires source-as-artifact.**
The RECALL principle — the source is the artifact — means the compiled
HTML always embeds its origin. AI-expanded source is part of that
origin. In tools where output is generated and discarded, there is
nothing to embed.

**Compiler validation requires a formal grammar.**
HTML, JSX, and Tailwind are not formally constrained in the relevant
sense. The AI can produce infinite valid variations. Only a language
with a closed element vocabulary and a strict type system can make
compiler validation meaningful.

Each property is load-bearing. Remove one and the others weaken.
This is why the methodology cannot be added to React, HTML, or C# —
it requires the language to have been designed around these properties
from the foundation.

---

## The Intellectual Lineage

### From COBOL

COBOL encoded business intent so precisely that the machine could be
trusted with it. The divisions (IDENTIFICATION, ENVIRONMENT, DATA,
PROCEDURE) were not a stylistic choice — they were a formal separation
of concerns that made COBOL programs readable, auditable, and
maintainable across decades.

RECALL inherits this discipline directly. The divisions serve the same
purpose: make the program's intent legible to anything that reads it —
human, compiler, or AI.

### From grounded language generation

Academic NLP research has studied constrained text generation for
decades — generating SQL from natural language, API calls from
instructions, logical forms from queries. The common thread: constrain
the output space to a formal grammar so the generator cannot hallucinate
invalid structure.

`WITH INTENT` applies this principle at the language level rather than
the model level. The grammar is the constraint. The compiler is the
validator. The publishing language is the output space.

### From infrastructure-as-code

Terraform and Pulumi demonstrated that declarative intent ("I want
these resources with these properties") combined with a live provider
schema and a plan/apply validation step produces reliable, auditable
infrastructure. The human declares intent. The tool validates against
the schema. The output is a readable, version-controlled artifact.

RECALL applies the same discipline to UI composition. The domain
changes (interfaces, not infrastructure) but the methodology is
analogous: declare intent, validate against schema, produce auditable
source.

### From ReAct (AI research)

The ReAct pattern (Reason + Act, Yao et al. 2022) demonstrated that
AI agents interleaving reasoning steps with grounded actions produce
more reliable, auditable outputs than end-to-end generation. The
reasoning is preserved alongside the action.

`WITH INTENT` is structurally analogous:

| ReAct | RECALL WITH INTENT |
|---|---|
| Thought | `WITH INTENT "..."` clause |
| Action | AI compositor expands to RECALL source |
| Observation | Compiler validates output |
| Correction | Author edits expanded source |

The reasoning (intent clause) is preserved alongside the action
(expanded source). Neither disappears after compilation.

---

## What This Is Not

**It is not prompt-to-UI.**
Prompt-to-UI tools (v0, Galileo, Builder.io) take a natural language
description and generate freeform component code. The prompt disappears
after generation. The output is unconstrained. There is no compiler
validation. The AI is a code generator, not a compositor.

**It is not a design system with AI.**
Design system AI tools (Figma AI, Adobe) constrain the AI to visual
tokens — colors, spacing, type scales. There is no structural contract,
no data binding, no layout intent. The AI makes visual decisions, not
compositional ones.

**It is not LLM function calling.**
Function calling constrains AI output to a defined set of typed
function signatures. It is API-level, not language-level. There is no
persistent source artifact, no publishing pipeline, no concept of
layout composition or visual intent.

**It is not a templating language.**
Templating languages (Handlebars, Jinja, Liquid) separate data from
presentation but have no AI composition layer, no schema validation,
and no intent primitive. The human writes all structure.

---

## The Precise Definition

> **WITH INTENT** is a formally constrained AI composition primitive
> embedded in a publishing language (RECALL) where:
>
> - The composition space is bounded by a live, compiler-queryable
>   element schema
> - The data contract is declared, typed, and intent-annotated before
>   composition runs
> - Structural concerns are enforced by language divisions, not
>   convention
> - AI-expanded output is valid RECALL source — auditable, editable,
>   and preserved alongside the original intent clause
> - The compiler — not the human — is the validation layer for AI
>   output

No existing system satisfies all five conditions simultaneously in a
publishing language context.

---

## Implications

### For language design

`WITH INTENT` suggests a new class of language primitive: the
**composition intent clause** — a formally bounded natural language
statement that an AI compositor expands into valid source within the
language's own grammar.

This is distinct from comments (not compiled), macros (deterministic
expansion), and code generation (freeform output). It is a new point
in the design space.

### For AI tooling

The RECALL compiler becomes an AI runtime — not by adding AI to the
compiler, but by designing the language so the compiler's schema,
symbol table, and diagnostics are queryable by an AI compositor as
inputs to constrained generation.

The compiler is the AI's constraint system. The AI is the compiler's
composition engine. Neither replaces the other.

### For publishing

Documents, pages, reports, and interfaces that need to be generated,
audited, and maintained across time now have a composition model where
AI participation is structurally safe — not because the AI is trusted,
but because the language enforces what the AI can produce.

This is the COBOL insight applied to the AI era: encode intent
precisely enough that the machine — and now the AI — can be trusted
with the composition.

---

## Status and Next Steps

This document records the concept as it stands in April 2026.

Implementation is post-RECALL 1.0. The language must be stable before
the composition layer is built on top of it.

When the time comes, the implementation entry point is:

```
recall expand <file>     reads WITH INTENT clauses, calls compositor,
                         writes expanded RECALL source alongside original
```

The composer receives: schema JSON, DATA DIVISION symbols, ENVIRONMENT
palette, COMPONENT registry, intent string, layout token.

The composer produces: valid RECALL PROCEDURE statements.

The compiler validates: same pipeline as any RECALL source.

---

*This is the authoritative positioning document for the WITH INTENT
primitive. It should be updated as the concept evolves and referenced
when discussing RECALL's place in the AI-first tooling landscape.*
