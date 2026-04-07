# RECALL Formal Grammar Specification

> Version: 1.0 — Draft  
> Status: Normative reference for the RECALL language  
> Compiler: `@semanticintent/recall-compiler` v0.8.7+  
> Notation: Extended Backus-Naur Form (EBNF)

This document is the authoritative grammar specification for the RECALL language.
The compiler is the reference implementation of this grammar. Where the compiler
diverges from this document, the document is correct and the compiler has a bug.

---

## Notation

```
rule      = definition ;           (* rule assignment *)
A B       (* sequence: A followed by B *)
A | B     (* alternation: A or B *)
[ A ]     (* optional: zero or one A *)
{ A }     (* repetition: zero or more A *)
( A )     (* grouping *)
"text"    (* literal terminal *)
'text'    (* literal terminal, alternative quoting *)
UPPER     (* non-terminal rule reference *)
/regex/   (* terminal defined by regular expression *)
```

---

## Top-Level Structure

```ebnf
program =
    IDENTIFICATION_DIVISION
    [ ENVIRONMENT_DIVISION ]
    [ DATA_DIVISION ]
    [ COMPONENT_DIVISION ]
    PROCEDURE_DIVISION ;

division_header =
    ( "IDENTIFICATION DIVISION"
    | "ENVIRONMENT DIVISION"
    | "DATA DIVISION"
    | "COMPONENT DIVISION"
    | "PROCEDURE DIVISION"
    ) "." ;
```

Every division header ends with a period. Divisions appear in the order above.
ENVIRONMENT, DATA, and COMPONENT divisions are optional but must appear in order
when present. IDENTIFICATION and PROCEDURE are required.

---

## Lexical Conventions

```ebnf
(* Identifiers — uppercase letters, digits, hyphens *)
IDENTIFIER = /[A-Z][A-Z0-9-]*/ ;

(* Numeric literal *)
NUMBER = /[0-9]+(\.[0-9]+)?/ ;

(* String literal — double or single quoted *)
STRING = '"' { /[^"\\]/ | '\\"' } '"'
       | "'" { /[^'\\]/ | "\\'" } "'" ;

(* Comment line — entire line is a comment *)
COMMENT_LINE = "*" { /.*/ } NEWLINE ;

(* Statement terminator *)
TERMINATOR = "." ;

(* Whitespace — spaces and tabs, not newlines *)
WS = { " " | "\t" } ;
```

**Comment lines:** Any line whose first non-whitespace character is `*` is a
comment and is ignored by the compiler entirely.

**Case sensitivity:** All RECALL keywords are uppercase. Identifiers in DATA
DIVISION are uppercase. String values are case-preserving.

**Line model:** RECALL is line-oriented. Statements are one logical line.
Continuation is not supported in PROCEDURE DIVISION. DATA DIVISION VALUE strings
may span multiple lines (see VALUE_BLOCK).

---

## IDENTIFICATION DIVISION

```ebnf
IDENTIFICATION_DIVISION =
    "IDENTIFICATION DIVISION" "."
    { identification_clause } ;

identification_clause =
    program_id_clause
  | page_title_clause
  | author_clause
  | date_written_clause
  | description_clause
  | favicon_clause ;

program_id_clause    = "PROGRAM-ID."    ( IDENTIFIER | STRING ) "." ;
page_title_clause    = "PAGE-TITLE."    ( IDENTIFIER | STRING ) "." ;
author_clause        = "AUTHOR."        STRING "." ;
date_written_clause  = "DATE-WRITTEN."  STRING "." ;
description_clause   = "DESCRIPTION."   ( IDENTIFIER | STRING ) "." ;
favicon_clause       = "FAVICON."       STRING "." ;
```

**Required:** `PROGRAM-ID` and `PAGE-TITLE`. All others optional.

`PAGE-TITLE` and `DESCRIPTION` may reference a DATA DIVISION field by name
(IDENTIFIER) — the compiler resolves the field value at compile time.

**Diagnostics:**
- `RCL-006` — PROGRAM-ID or PAGE-TITLE missing
- `RCL-W03` — AUTHOR or DATE-WRITTEN missing

---

## ENVIRONMENT DIVISION

```ebnf
ENVIRONMENT_DIVISION =
    "ENVIRONMENT DIVISION" "."
    [ configuration_section ]
    [ palette_section ]
    [ font_section ]
    [ style_block_section ] ;

configuration_section =
    "CONFIGURATION SECTION" [ "." ]
    { configuration_clause } ;

configuration_clause =
    viewport_clause
  | color_mode_clause
  | language_clause
  | load_plugin_clause
  | suppress_css_clause ;

viewport_clause      = "VIEWPORT"            ( "RESPONSIVE" | "FIXED-WIDTH" | "FULL-WIDTH" ) "." ;
color_mode_clause    = "COLOR-MODE"           ( "DARK" | "LIGHT" | "SYSTEM" ) "." ;
language_clause      = "LANGUAGE"             IDENTIFIER "." ;
load_plugin_clause   = "LOAD" "PLUGIN"        IDENTIFIER "." ;
suppress_css_clause  = "SUPPRESS-DEFAULT-CSS" "YES" "." ;

palette_section =
    "PALETTE SECTION" [ "." ]
    { palette_entry } ;

palette_entry =
    color_shorthand
  | color_pic_entry ;

color_shorthand  = /COLOR-[A-Z0-9-]+/ STRING "." ;
color_pic_entry  = "01" /COLOR-[A-Z0-9-]+/ "PIC" pic_type "VALUE" STRING "." ;

font_section =
    "FONT SECTION" [ "." ]
    { font_clause } ;

font_clause =
    font_primary_clause
  | font_secondary_clause ;

font_primary_clause   = "FONT-PRIMARY"   STRING "." ;
font_secondary_clause = "FONT-SECONDARY" STRING "." ;

style_block_section =
    ( "STYLE-BLOCK" | "STYLE-BLOCK." )
    { raw_css_line }
    ( section_header | division_header ) ;

raw_css_line = /.*/ NEWLINE ;
```

**Defaults:**
- VIEWPORT: `RESPONSIVE`
- COLOR-MODE: `DARK`
- LANGUAGE: `EN`

**Diagnostics:**
- `RCL-022` — palette key with trailing period

---

## DATA DIVISION

```ebnf
DATA_DIVISION =
    "DATA DIVISION" "."
    [ working_storage_section ]
    [ items_section ]
    { load_from_clause } ;

working_storage_section =
    "WORKING-STORAGE SECTION" [ "." ]
    { data_field_01 } ;

items_section =
    "ITEMS SECTION" [ "." ]
    { data_group | data_field_01 } ;

load_from_clause = "LOAD" "FROM" STRING "." ;

(* Level 01 — scalar or group root *)
data_field_01 =
    "01" IDENTIFIER pic_clause [ value_clause ] [ comment_clause ] "."
  | "01" IDENTIFIER record_expansion "."
  | value_block ;

(* Level 05 — group child *)
data_field_05 =
    "05" IDENTIFIER pic_clause [ value_clause ] [ comment_clause ] "." ;

(* Level 10 — group grandchild *)
data_field_10 =
    "10" IDENTIFIER pic_clause [ value_clause ] [ comment_clause ] "." ;

data_group =
    "01" IDENTIFIER "."
    { data_field_05
      { data_field_10 }
    } ;

pic_clause = "PIC" pic_type ;

pic_type =
    "X"
  | "X(" NUMBER ")"
  | "9"
  | "9(" NUMBER ")"
  | "9(" NUMBER ")V9(" NUMBER ")"
  | "DATE"
  | "URL"
  | "PCT"
  | "BOOL" ;

value_clause =
    "VALUE" STRING
  | "VALUE" NUMBER ;

comment_clause = "COMMENT" STRING ;

(* Multi-line value block *)
value_block =
    "01" IDENTIFIER "PIC" "X" "VALUE" "BLOCK" "."
    { /[^"]*/ NEWLINE }
    "END" "VALUE" "." ;

(* RECORD type definition *)
record_type_def =
    "RECORD" IDENTIFIER "."
    { data_field_10 }
    "END" "RECORD" "." ;

(* RECORD expansion *)
record_expansion =
    "RECORD" IDENTIFIER "ROWS" NUMBER "." ;
```

**PIC types and their semantics:**

| Type | Meaning | Constraint |
|---|---|---|
| `X` | Unbounded string | None |
| `X(n)` | String max n chars | RCL-002 if exceeded |
| `9` | Single digit | Must be numeric |
| `9(n)` | n-digit integer | RCL-012 if non-numeric |
| `9(n)V9(m)` | Decimal | n integer, m decimal digits |
| `DATE` | ISO 8601 date | RCL-009 if not YYYY-MM-DD |
| `URL` | HTTP(S) URL or root path | RCL-010 if not http/https/slash |
| `PCT` | Percentage 0–100 | RCL-011 if out of range |
| `BOOL` | Boolean | `true` or `false` |

**Diagnostics:**
- `RCL-002` — value exceeds PIC X(n) length
- `RCL-W02` — value near PIC X(n) limit (>90%)
- `RCL-009` — invalid DATE format
- `RCL-010` — invalid URL format
- `RCL-011` — PCT out of range
- `RCL-012` — non-numeric in PIC 9 field
- `RCL-W06` — field referenced in PROCEDURE has no VALUE clause

---

## COMPONENT DIVISION

```ebnf
COMPONENT_DIVISION =
    "COMPONENT DIVISION" "."
    { component_def } ;

component_def =
    "DEFINE" IDENTIFIER "."
    [ accepts_clause ]
    { display_statement }
    "END DEFINE" "." ;

accepts_clause =
    "ACCEPTS" accepts_param_list "." ;

accepts_param_list =
    accepts_param { "," accepts_param } ;

accepts_param =
    IDENTIFIER [ "REQUIRED" ] ;
```

**Component names** must be uppercase identifiers. They are referenced by name
in PROCEDURE DIVISION display statements.

**Diagnostics:**
- `RCL-014` — component references undefined element
- `RCL-016` — unknown parameter passed to component
- `RCL-017` — required parameter missing at call site
- `RCL-018` — circular COPY detected

---

## PROCEDURE DIVISION

```ebnf
PROCEDURE_DIVISION =
    "PROCEDURE DIVISION" "."
    { procedure_section }
    "STOP RUN" "." ;

procedure_section =
    section_header
    { display_statement | copy_from_statement } ;

section_header = IDENTIFIER "." ;

copy_from_statement = "COPY" "FROM" STRING "." ;

display_statement =
    "DISPLAY" element_name
    [ value_ref ]
    { display_clause }
    "."
  | "DISPLAY" "SECTION"
    { display_clause }
    { display_statement }
    "STOP SECTION" "."
  | "DISPLAY" component_name
    { with_clause }
    "." ;

element_name    = IDENTIFIER ;   (* must match registered element *)
component_name  = IDENTIFIER ;   (* must match COMPONENT DIVISION DEFINE *)
value_ref       = IDENTIFIER     (* DATA field name *)
                | STRING ;        (* literal value *)

display_clause =
    with_clause
  | using_clause
  | href_clause
  | id_clause
  | on_click_clause
  | with_data_clause ;

with_clause      = "WITH" IDENTIFIER ( IDENTIFIER | STRING | NUMBER ) ;
using_clause     = "USING" IDENTIFIER ;
href_clause      = "HREF" STRING ;
id_clause        = "ID" STRING ;
on_click_clause  = "ON-CLICK" IDENTIFIER STRING ;
with_data_clause = "WITH" "DATA" IDENTIFIER { [ "," ] IDENTIFIER } ;
```

**Every display statement must end with a terminating period.**

**Diagnostics:**
- `RCL-003` — unknown element name
- `RCL-004` — unknown identifier in value or USING clause
- `RCL-005` — PROCEDURE DIVISION empty
- `RCL-007` — USING required but absent, or scalar where group expected
- `RCL-008` — group where scalar expected; or LAYOUT SPLIT shape error
- `RCL-013` — STOP RUN missing
- `RCL-023` — statement has no terminating period
- `RCL-W01` — group is empty
- `RCL-W04` — section has no statements
- `RCL-W05` — implicit numeric coercion in string context

---

## Built-In Elements

```ebnf
builtin_element =
    (* Text *)
    "HEADING-1" | "HEADING-2" | "HEADING-3"
  | "PARAGRAPH" | "LABEL" | "CODE-BLOCK"
  | "BANNER" | "CALLOUT"
    (* Interactive *)
  | "BUTTON" | "LINK" | "INPUT"
    (* Media *)
  | "IMAGE"
    (* Layout *)
  | "DIVIDER" | "SECTION" | "FOOTER"
    (* Group elements *)
  | "CARD-LIST" | "NAVIGATION" | "SIDEBAR-NAV"
  | "TABS" | "TABLE" | "STAT-GRID" ;
```

Element contracts (accepted value types):

| Element | Accepts | Requires |
|---|---|---|
| `HEADING-1/2/3` | string | — |
| `PARAGRAPH` | string | — |
| `LABEL` | string | — |
| `CODE-BLOCK` | string | — |
| `BANNER` | string | — |
| `CALLOUT` | string | — |
| `BUTTON` | string | ON-CLICK |
| `LINK` | string | HREF |
| `INPUT` | none | — |
| `IMAGE` | url | — |
| `DIVIDER` | none | — |
| `SECTION` | none | — |
| `FOOTER` | any | — |
| `CARD-LIST` | group | USING |
| `NAVIGATION` | group | USING |
| `SIDEBAR-NAV` | group | USING |
| `TABS` | group | USING |
| `TABLE` | group | — |
| `STAT-GRID` | group | — |

Plugin elements registered via `LOAD PLUGIN` extend this table at runtime.

---

## Complete Program Example

```cobol
IDENTIFICATION DIVISION.
   PROGRAM-ID. MY-SITE.
   PAGE-TITLE. "My Site".
   AUTHOR. Michael Shatny.
   DATE-WRITTEN. 2026-04-07.

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT RESPONSIVE.
      COLOR-MODE DARK.
   PALETTE SECTION.
      COLOR-ACCENT "#00ff41".

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-TITLE    PIC X      VALUE "Welcome".
      01 HERO-BODY     PIC X      VALUE "A short description.".
      01 VISIT-COUNT   PIC 9(6)   VALUE "142398".
      01 LAUNCH-DATE   PIC DATE   VALUE "2026-04-07".
      01 SITE-URL      PIC URL    VALUE "https://example.com".
   ITEMS SECTION.
      01 NAV-LINKS.
         05 NAV-1-LABEL PIC X VALUE "Home".
         05 NAV-1-HREF  PIC URL VALUE "/".
         05 NAV-2-LABEL PIC X VALUE "About".
         05 NAV-2-HREF  PIC URL VALUE "/about".

PROCEDURE DIVISION.
   RENDER.
      DISPLAY NAVIGATION USING NAV-LINKS.
      DISPLAY HEADING-1  HERO-TITLE.
      DISPLAY PARAGRAPH  HERO-BODY.
      DISPLAY LABEL      VISIT-COUNT.
      STOP RUN.
```

---

## Error Recovery

When the parser encounters a malformed statement, it emits a diagnostic and
advances to the next synchronisation point before continuing. This ensures all
errors in a program are reported in a single compiler pass.

**Synchronisation points:**
- The next statement terminator (`.`) on a line by itself or ending a line
- The next division header (`* DIVISION.`)
- The next section header (single uppercase word ending in `.`)
- End of file

**Recovery behaviour by context:**

| Error | Recovery action |
|---|---|
| Missing terminator on DISPLAY | Emit RCL-023, treat as terminated, continue |
| Unknown element in DISPLAY | Emit RCL-003, skip statement, continue |
| Malformed PIC clause | Emit RCL-W07 (unknown PIC type), default to PIC X, continue |
| Malformed VALUE clause | Emit RCL-W08 (malformed value), treat as empty VALUE, continue |
| Unrecognised DATA field level | Skip line, continue |
| Unrecognised division content | Skip line, continue |

The compiler never aborts on a single error. It accumulates all diagnostics and
reports them together. Build fails if any error-severity diagnostics were emitted.
Warnings do not fail the build unless `--strict` is active.

---

## Diagnostic Code Reference

Full reference: `recall explain --list`  
Machine-readable: `recall explain --list --json`

| Code | Severity | Category | Summary |
|---|---|---|---|
| RCL-001 | error | type-mismatch | Type mismatch |
| RCL-002 | error | value-constraint | Value exceeds declared length |
| RCL-003 | error | unknown-element | Unknown element |
| RCL-004 | error | unknown-identifier | Unknown identifier |
| RCL-005 | error | missing-required | Missing PROCEDURE DIVISION |
| RCL-006 | error | missing-required | Missing required identification field |
| RCL-007 | error | group-shape | USING requires a group |
| RCL-008 | error | group-shape | Group used where scalar expected |
| RCL-009 | error | format | Invalid DATE format |
| RCL-010 | error | format | Invalid URL format |
| RCL-011 | error | format | PCT value out of range |
| RCL-012 | error | value-constraint | Non-numeric value in PIC 9 field |
| RCL-013 | error | structural | Missing STOP RUN |
| RCL-014 | error | structural | Component referenced before DEFINE |
| RCL-015 | error | unknown-identifier | Cannot resolve COPY FROM path |
| RCL-016 | error | type-mismatch | Component parameter type mismatch |
| RCL-017 | error | missing-required | Missing required component parameter |
| RCL-018 | error | structural | Circular COPY detected |
| RCL-019 | error | structural | LOAD FROM file not found |
| RCL-020 | error | structural | LOAD FROM file not valid JSON or CSV |
| RCL-021 | error | unknown-identifier | Unknown RECORD type |
| RCL-022 | error | format | Palette key has trailing period |
| RCL-023 | error | syntax | Statement has no terminator |
| RCL-W01 | warning | group-shape | Group is empty |
| RCL-W02 | warning | value-constraint | Value near declared length limit |
| RCL-W03 | warning | missing-required | Missing optional identification field |
| RCL-W04 | warning | structural | Unreachable procedure section |
| RCL-W05 | warning | type-mismatch | Implicit string coercion |
| RCL-W06 | warning | data | Field has no VALUE clause |
| RCL-W07 | warning | syntax | Unknown PIC type — defaulted to X |
| RCL-W08 | warning | syntax | Malformed VALUE clause — treated as empty |

---

## Language Invariants

These properties hold for every valid RECALL program:

1. **Division order** — IDENTIFICATION precedes ENVIRONMENT precedes DATA precedes COMPONENT precedes PROCEDURE. No division may appear out of order.

2. **Data before procedure** — every field referenced in PROCEDURE DIVISION must be declared in DATA DIVISION. Forward references are not permitted.

3. **Closed element vocabulary** — every element name in a DISPLAY statement must be registered in the compiler's element registry (built-in or plugin). Open-ended element names are not permitted.

4. **Typed fields** — every DATA field has an explicit PIC type. Implicit typing is not permitted.

5. **Explicit termination** — every PROCEDURE DIVISION must end with `STOP RUN.`

6. **Terminated statements** — every DISPLAY statement ends with `.`

7. **Single compilation unit** — a RECALL program is a single `.rcl` file. Multi-file programs use COPY FROM for components and LOAD FROM for data. There is no linking phase.

---

*This document is the normative grammar reference for RECALL. It should be
updated with every language change and versioned alongside the compiler.*
