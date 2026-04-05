import { describe, it, expect } from 'vitest'
import { parse } from '../../src/parser/rcl.js'
import { generate } from '../../src/generator/html.js'

// ─────────────────────────────────────────────────────────
// Shared RCL builder
// ─────────────────────────────────────────────────────────

function makeRcl(itemsSection: string, procedureBody: string): string {
  return `
IDENTIFICATION DIVISION.
   PROGRAM-ID. ELEM-TEST.
   PAGE-TITLE. "Element Test".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      COLOR-MODE DARK.

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 TITLE PIC X(20) VALUE "Test".
   ITEMS SECTION.
${itemsSection}

PROCEDURE DIVISION.
   RENDER.
${procedureBody}
   STOP RUN.
`
}

// ─────────────────────────────────────────────────────────
// TABLE
// ─────────────────────────────────────────────────────────

describe('TABLE element', () => {
  const itemsSection = `
      01 DIMENSIONS.
         05 DIM-1.
            10 DIM-1-NAME   PIC X(30)  VALUE "Revenue (D3)".
            10 DIM-1-SCORE  PIC 9(2)   VALUE "75".
            10 DIM-1-LAYER  PIC X(8)   VALUE "origin".
         05 DIM-2.
            10 DIM-2-NAME   PIC X(30)  VALUE "Quality (D5)".
            10 DIM-2-SCORE  PIC 9(2)   VALUE "62".
            10 DIM-2-LAYER  PIC X(8)   VALUE "l1".`

  it('renders a table with column headers', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY TABLE DIMENSIONS
         WITH COLUMNS "Dimension, Score, Layer".`)
    const html = generate(parse(src), src)
    expect(html).toContain('<table class="recall-table">')
    expect(html).toContain('<th>Dimension</th>')
    expect(html).toContain('<th>Score</th>')
    expect(html).toContain('<th>Layer</th>')
  })

  it('renders data rows from 05-level items', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY TABLE DIMENSIONS
         WITH COLUMNS "Dimension, Score, Layer".`)
    const html = generate(parse(src), src)
    expect(html).toContain('<td>Revenue (D3)</td>')
    expect(html).toContain('<td>75</td>')
    expect(html).toContain('<td>origin</td>')
    expect(html).toContain('<td>Quality (D5)</td>')
    expect(html).toContain('<td>62</td>')
    expect(html).toContain('<td>l1</td>')
  })

  it('adds striped class when STRIPED YES', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY TABLE DIMENSIONS
         WITH COLUMNS "Dimension, Score, Layer"
         WITH STRIPED YES.`)
    const html = generate(parse(src), src)
    expect(html).toContain('class="recall-table striped"')
  })

  it('renders without headers when COLUMNS not provided', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY TABLE DIMENSIONS.`)
    const html = generate(parse(src), src)
    expect(html).toContain('<table class="recall-table">')
    expect(html).not.toContain('<thead>')
  })

  it('returns error comment for missing group', () => {
    const src = makeRcl('', `
      DISPLAY TABLE MISSING-GROUP
         WITH COLUMNS "A, B".`)
    const html = generate(parse(src), src)
    expect(html).toContain('<!-- TABLE:')
    expect(html).toContain('not found')
  })

  it('remains backward compatible with USING clause', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY TABLE
         WITH USING DIMENSIONS
         WITH HEADERS "Dimension, Score, Layer".`)
    const html = generate(parse(src), src)
    expect(html).toContain('<table class="recall-table">')
    expect(html).toContain('<th>Dimension</th>')
  })
})

// ─────────────────────────────────────────────────────────
// STAT-GRID
// ─────────────────────────────────────────────────────────

describe('STAT-GRID element', () => {
  const itemsSection = `
      01 STATS.
         05 STAT-1.
            10 STAT-1-VALUE  PIC X(10)  VALUE "584M".
            10 STAT-1-LABEL  PIC X(20)  VALUE "Global Listeners".
         05 STAT-2.
            10 STAT-2-VALUE  PIC X(10)  VALUE "$2.3B".
            10 STAT-2-LABEL  PIC X(20)  VALUE "Ad Revenue".
         05 STAT-3.
            10 STAT-3-VALUE  PIC X(10)  VALUE "6/6".
            10 STAT-3-LABEL  PIC X(20)  VALUE "Dimensions Hit".`

  it('renders stat cards with values and labels', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY STAT-GRID STATS
         WITH COLUMNS 3.`)
    const html = generate(parse(src), src)
    expect(html).toContain('class="stat-card"')
    expect(html).toContain('<div class="stat-value">584M</div>')
    expect(html).toContain('<div class="stat-label">Global Listeners</div>')
    expect(html).toContain('<div class="stat-value">$2.3B</div>')
    expect(html).toContain('<div class="stat-label">Ad Revenue</div>')
  })

  it('applies column count class', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY STAT-GRID STATS
         WITH COLUMNS 3.`)
    const html = generate(parse(src), src)
    expect(html).toContain('class="stat-grid cols-3"')
  })

  it('renders all three stat cards', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY STAT-GRID STATS
         WITH COLUMNS 3.`)
    const html = generate(parse(src), src)
    const cardCount = (html.match(/class="stat-card"/g) ?? []).length
    expect(cardCount).toBe(3)
  })

  it('defaults to no column class when COLUMNS omitted', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY STAT-GRID STATS.`)
    const html = generate(parse(src), src)
    expect(html).toContain('class="stat-grid"')
  })

  it('returns error comment for missing group', () => {
    const src = makeRcl('', `
      DISPLAY STAT-GRID MISSING
         WITH COLUMNS 3.`)
    const html = generate(parse(src), src)
    expect(html).toContain('<!-- STAT-GRID:')
    expect(html).toContain('not found')
  })

  it('includes stat-grid CSS in output', () => {
    const src = makeRcl(itemsSection, `
      DISPLAY STAT-GRID STATS
         WITH COLUMNS 6.`)
    const html = generate(parse(src), src)
    expect(html).toContain('.stat-grid')
    expect(html).toContain('.stat-value')
    expect(html).toContain('.stat-label')
  })
})
