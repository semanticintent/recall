import { describe, it, expect } from 'vitest'
import { parse } from '../../src/parser/rcl.js'

const MINIMAL = `
IDENTIFICATION DIVISION.
   PROGRAM-ID.    TEST-PROGRAM.
   PAGE-TITLE.    "Test Page".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT    RESPONSIVE.
      COLOR-MODE  DARK.
      LANGUAGE    EN.
   PALETTE SECTION.
      01 COLOR-ACCENT PIC X(7) VALUE "#00FF41".

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-TEXT PIC X(40) VALUE "Hello RECALL".

   ITEMS SECTION.
      01 NAV-ITEMS.
         05 NAV-ITEM-1      PIC X(20) VALUE "HOME".
         05 NAV-ITEM-1-HREF PIC X(80) VALUE "/".

PROCEDURE DIVISION.

   RENDER-HERO.
      DISPLAY SECTION ID "hero"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY HEADING-1 HERO-TEXT
            WITH STYLE MONO.
         DISPLAY PARAGRAPH "Welcome to RECALL."
            WITH COLOR MUTED.
      STOP SECTION.

   STOP RUN.
`

describe('RECALL Parser', () => {
  describe('IDENTIFICATION DIVISION', () => {
    it('parses PROGRAM-ID', () => {
      const p = parse(MINIMAL)
      expect(p.identification.programId).toBe('TEST-PROGRAM')
    })

    it('parses PAGE-TITLE', () => {
      const p = parse(MINIMAL)
      expect(p.identification.pageTitle).toBe('Test Page')
    })
  })

  describe('ENVIRONMENT DIVISION', () => {
    it('parses VIEWPORT', () => {
      const p = parse(MINIMAL)
      expect(p.environment.viewport).toBe('RESPONSIVE')
    })

    it('parses COLOR-MODE', () => {
      const p = parse(MINIMAL)
      expect(p.environment.colorMode).toBe('DARK')
    })

    it('parses PALETTE entries', () => {
      const p = parse(MINIMAL)
      expect(p.environment.palette['COLOR-ACCENT']).toBe('#00FF41')
    })
  })

  describe('DATA DIVISION', () => {
    it('parses WORKING-STORAGE scalar field', () => {
      const p = parse(MINIMAL)
      const hero = p.data.workingStorage.find(f => f.name === 'HERO-TEXT')
      expect(hero).toBeDefined()
      expect(hero?.value).toBe('Hello RECALL')
    })

    it('parses ITEMS group with children', () => {
      const p = parse(MINIMAL)
      const nav = p.data.items.find(f => f.name === 'NAV-ITEMS')
      expect(nav).toBeDefined()
      expect(nav?.children.length).toBeGreaterThan(0)
    })

    it('parses child field value', () => {
      const p = parse(MINIMAL)
      const nav = p.data.items.find(f => f.name === 'NAV-ITEMS')
      const item = nav?.children.find(c => c.name === 'NAV-ITEM-1')
      expect(item?.value).toBe('HOME')
    })
  })

  describe('PROCEDURE DIVISION', () => {
    it('parses sections', () => {
      const p = parse(MINIMAL)
      expect(p.procedure.sections.length).toBeGreaterThan(0)
    })

    it('parses section name', () => {
      const p = parse(MINIMAL)
      expect(p.procedure.sections[0].name).toBe('RENDER-HERO')
    })

    it('parses DISPLAY statements', () => {
      const p = parse(MINIMAL)
      const section = p.procedure.sections[0]
      expect(section.statements.length).toBeGreaterThan(0)
    })

    it('parses DISPLAY SECTION element', () => {
      const p = parse(MINIMAL)
      const section = p.procedure.sections[0]
      const display = section.statements[0]
      expect(display.element).toBe('SECTION')
    })

    it('parses WITH clauses', () => {
      const p = parse(MINIMAL)
      const stmt = p.procedure.sections[0].statements[0]
      const layout = stmt.clauses.find(c => c.key === 'LAYOUT')
      expect(layout?.value).toBe('CENTERED')
    })
  })
})
