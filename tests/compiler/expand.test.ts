// ─────────────────────────────────────────────────────────
// WITH INTENT tests — parser, typechecker, generator
// ─────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { check, compile } from '../../src/compiler/index.js'
import { parse } from '../../src/parser/rcl.js'

const TMP = '/tmp/recall-expand-test'

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

function write(name: string, source: string): string {
  const p = join(TMP, name)
  writeFileSync(p, source)
  return p
}

const BASE_SRC = `IDENTIFICATION DIVISION.
   PROGRAM-ID. TEST.
   PAGE-TITLE. "T".
   AUTHOR. Test.
   DATE-WRITTEN. 2026-04-08.
ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT RESPONSIVE.
DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 PRODUCT-NAME    PIC X(60) VALUE "RECALL".
         COMMENT "Product headline"
      01 PRODUCT-TAGLINE PIC X(200) VALUE "What COBOL would have built for the web.".
         COMMENT "One-sentence description"
      01 CTA-PRIMARY     PIC X(30) VALUE "Get started".
         COMMENT "Primary CTA label"
   ITEMS SECTION.`

// ─────────────────────────────────────────────────────────
// Parser — WITH INTENT clause
// ─────────────────────────────────────────────────────────

describe('WITH INTENT — parser', () => {
  it('parses WITH INTENT string into stmt.intent', () => {
    const src = `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "dramatic opening, single product".
   STOP SECTION.

   STOP RUN.
`
    const program = parse(src)
    const stmt = program.procedure.sections[0].statements[0]
    expect(stmt.intent).toBe('dramatic opening, single product')
  })

  it('captures WITH DATA fields after WITH INTENT', () => {
    const src = `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "urgency without hype"
         WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, CTA-PRIMARY.
   STOP SECTION.

   STOP RUN.
`
    const program = parse(src)
    const stmt = program.procedure.sections[0].statements[0]
    expect(stmt.intent).toBe('urgency without hype')
    const dataClause = stmt.clauses.find(c => c.key === 'DATA')
    expect(dataClause).toBeDefined()
    expect(dataClause!.value).toContain('PRODUCT-NAME')
    expect(dataClause!.value).toContain('CTA-PRIMARY')
  })

  it('stmt.intent is undefined when WITH INTENT is absent', () => {
    const src = `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY PARAGRAPH PRODUCT-NAME.
   STOP SECTION.

   STOP RUN.
`
    const program = parse(src)
    const stmt = program.procedure.sections[0].statements[0]
    expect(stmt.intent).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────
// RCL-W09 — unexpanded WITH INTENT emits warning
// ─────────────────────────────────────────────────────────

describe('RCL-W09 — unexpanded WITH INTENT', () => {
  beforeEach(setup)

  it('emits RCL-W09 warning for unexpanded WITH INTENT', () => {
    const src = write('rcl-w09.rcl', `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "dramatic opening".
   STOP SECTION.

   STOP RUN.
`)
    const result = check(src)
    expect(result.warningMessages.some(w => w.includes('RCL-W09'))).toBe(true)
  })

  it('RCL-W09 is a warning not an error — ok is still true', () => {
    const src = write('rcl-w09-ok.rcl', `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "urgency without hype".
   STOP SECTION.

   STOP RUN.
`)
    const result = check(src)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('RCL-W09 becomes an error in strict mode', () => {
    const src = write('rcl-w09-strict.rcl', `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "strict fails".
   STOP SECTION.

   STOP RUN.
`)
    const result = check(src, { strict: true })
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('RCL-W09'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────
// Generator — WITH INTENT renders as placeholder comment
// ─────────────────────────────────────────────────────────

describe('WITH INTENT — generator placeholder', () => {
  beforeEach(setup)

  it('compiles ok with WITH INTENT present (placeholder output)', () => {
    const src = write('with-intent-compile.rcl', `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "dramatic opening, single product".
   STOP SECTION.

   STOP RUN.
`)
    const result = compile(src, TMP)
    expect(result.ok).toBe(true)
  })

  it('HTML contains WITH INTENT placeholder comment', () => {
    const src = write('with-intent-html.rcl', `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "dramatic opening, single product".
   STOP SECTION.

   STOP RUN.
`)
    const result = compile(src, TMP)
    expect(result.ok).toBe(true)
    const html = result.outputPath ? readFileSync(result.outputPath, 'utf-8') : ''
    expect(html).toContain('<!-- WITH INTENT:')
    expect(html).toContain('dramatic opening, single product')
  })

  it('RCL-003 unknown element is NOT fired for WITH INTENT statements', () => {
    // HERO is not a built-in element — without the RCL-003 guard it would error
    const src = write('with-intent-no-rcl003.rcl', `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "compositor will resolve this element".
   STOP SECTION.

   STOP RUN.
`)
    const result = check(src)
    expect(result.errors.some(e => e.includes('RCL-003'))).toBe(false)
  })

  it('WITH DATA fields after WITH INTENT do not trigger RCL-W06', () => {
    // RCL-W06 fires for fields with no VALUE that are referenced in PROCEDURE
    // but WITH DATA fields on a WITH INTENT stmt should not be checked as display targets
    const src = write('with-intent-no-rcl-w06.rcl', `${BASE_SRC}
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HERO
         WITH INTENT "build from data"
         WITH DATA PRODUCT-NAME, PRODUCT-TAGLINE, CTA-PRIMARY.
   STOP SECTION.

   STOP RUN.
`)
    const result = check(src)
    expect(result.errors.some(e => e.includes('RCL-W06'))).toBe(false)
    expect(result.warningMessages.some(w => w.includes('RCL-W06'))).toBe(false)
  })
})
