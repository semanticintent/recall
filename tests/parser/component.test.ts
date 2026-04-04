import { describe, it, expect } from 'vitest'
import { parse } from '../../src/parser/rcl.js'

const SOURCE_WITH_COMPONENT = `
IDENTIFICATION DIVISION.
   PROGRAM-ID. TEST.
   PAGE-TITLE. "Test".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT RESPONSIVE.
      COLOR-MODE DARK.
      LANGUAGE EN.
   PALETTE SECTION.

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 MY-TITLE PIC X(20) VALUE "Hello".

COMPONENT DIVISION.

   DEFINE HERO-BLOCK.
      ACCEPTS TITLE, BODY, CTA-LABEL, CTA-HREF.
      DISPLAY SECTION
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY HEADING-1 TITLE.
         DISPLAY PARAGRAPH BODY.
         DISPLAY BUTTON CTA-LABEL
            ON-CLICK GOTO CTA-HREF
            WITH STYLE PRIMARY.
      STOP SECTION.
   END DEFINE.

   DEFINE SIMPLE-CARD.
      ACCEPTS NAME, DESC.
      DISPLAY SECTION
         WITH LAYOUT STACK.
         DISPLAY HEADING-3 NAME.
         DISPLAY PARAGRAPH DESC.
      STOP SECTION.
   END DEFINE.

PROCEDURE DIVISION.

   RENDER-MAIN.
      DISPLAY HERO-BLOCK
         WITH TITLE MY-TITLE
         WITH BODY "Welcome to RECALL."
         WITH CTA-LABEL "GET STARTED"
         WITH CTA-HREF "/start".

   STOP RUN.
`

describe('COMPONENT DIVISION parser', () => {
  it('parses component division with components array', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    expect(p.component.components).toHaveLength(2)
  })

  it('parses component name correctly', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    expect(p.component.components[0].name).toBe('HERO-BLOCK')
    expect(p.component.components[1].name).toBe('SIMPLE-CARD')
  })

  it('parses ACCEPTS list', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    expect(p.component.components[0].accepts).toEqual(['TITLE', 'BODY', 'CTA-LABEL', 'CTA-HREF'])
    expect(p.component.components[1].accepts).toEqual(['NAME', 'DESC'])
  })

  it('parses component body as SECTION with children', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    const hero = p.component.components[0]
    expect(hero.body.element).toBe('SECTION')
    expect(hero.body.children.length).toBeGreaterThan(0)
  })

  it('body children have correct elements', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    const hero = p.component.components[0]
    const elements = hero.body.children.map(c => c.element)
    expect(elements).toContain('HEADING-1')
    expect(elements).toContain('PARAGRAPH')
    expect(elements).toContain('BUTTON')
  })

  it('body SECTION has correct layout clause', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    const hero = p.component.components[0]
    const layout = hero.body.clauses.find(c => c.key === 'LAYOUT')
    expect(layout?.value).toBe('CENTERED')
  })

  it('file with no COMPONENT DIVISION returns empty components array', () => {
    const minimal = `
IDENTIFICATION DIVISION.
   PROGRAM-ID. MINIMAL.
   PAGE-TITLE. "Minimal".
ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT RESPONSIVE.
      COLOR-MODE DARK.
      LANGUAGE EN.
   PALETTE SECTION.
DATA DIVISION.
   WORKING-STORAGE SECTION.
PROCEDURE DIVISION.
   RENDER.
      DISPLAY HEADING-1 "Hello".
   STOP RUN.
`
    const p = parse(minimal)
    expect(p.component.components).toHaveLength(0)
  })

  it('component call appears in procedure as unknown element', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    const section = p.procedure.sections[0]
    expect(section.statements[0].element).toBe('HERO-BLOCK')
  })

  it('component call WITH clauses are parsed', () => {
    const p = parse(SOURCE_WITH_COMPONENT)
    const call = p.procedure.sections[0].statements[0]
    const titleClause = call.clauses.find(c => c.key === 'TITLE')
    expect(titleClause?.value).toBe('MY-TITLE')
    const ctaClause = call.clauses.find(c => c.key === 'CTA-HREF')
    expect(ctaClause?.value).toBe('/start')
  })
})
