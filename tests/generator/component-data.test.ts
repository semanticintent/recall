import { describe, it, expect } from 'vitest'
import { parse } from '../../src/parser/rcl.js'
import { generate } from '../../src/generator/html.js'

// ─────────────────────────────────────────────────────────
// WITH DATA — component data binding (v0.5)
// ─────────────────────────────────────────────────────────

function makeRcl(
  itemsSection: string,
  componentDivision: string,
  procedureBody: string,
  wsExtra = '',
): string {
  return `
IDENTIFICATION DIVISION.
   PROGRAM-ID. COMP-TEST.
   PAGE-TITLE. "Component Data Test".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      COLOR-MODE DARK.

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HERO-TITLE   PIC X(40) VALUE "The Insight".
      01 HERO-SUBTITLE PIC X(200) VALUE "Structural signal across six dimensions.".
      01 FETCH-SCORE  PIC 9(4)  VALUE "2451".
${wsExtra}
   ITEMS SECTION.
${itemsSection}

COMPONENT DIVISION.
${componentDivision}

PROCEDURE DIVISION.
   RENDER.
${procedureBody}
   STOP RUN.
`
}

describe('WITH DATA — scalar binding', () => {
  const component = `
   DEFINE HERO-BLOCK.
      ACCEPTS HERO-TITLE HERO-SUBTITLE FETCH-SCORE.
      DISPLAY SECTION ID "hero" WITH LAYOUT CENTERED WITH PADDING LARGE.
         DISPLAY HEADING-1 HERO-TITLE.
         DISPLAY PARAGRAPH HERO-SUBTITLE.
         DISPLAY LABEL FETCH-SCORE.
      STOP SECTION.
   END DEFINE.`

  it('binds scalar fields from DATA DIVISION into component', () => {
    const src = makeRcl('', component, `
      DISPLAY HERO-BLOCK
         WITH DATA HERO-TITLE, HERO-SUBTITLE, FETCH-SCORE.`)
    const html = generate(parse(src), src)
    expect(html).toContain('The Insight')
    expect(html).toContain('Structural signal across six dimensions.')
    expect(html).toContain('2451')
  })

  it('scalar values substitute in heading, paragraph, and label', () => {
    const src = makeRcl('', component, `
      DISPLAY HERO-BLOCK
         WITH DATA HERO-TITLE, HERO-SUBTITLE, FETCH-SCORE.`)
    const html = generate(parse(src), src)
    expect(html).toContain('<h1')
    expect(html).toContain('The Insight')
    expect(html).toContain('<p')
    expect(html).toContain('Structural signal across six dimensions.')
  })

  it('literal WITH clause still works alongside WITH DATA', () => {
    const src = makeRcl('', component, `
      DISPLAY HERO-BLOCK
         WITH DATA HERO-SUBTITLE, FETCH-SCORE
         WITH HERO-TITLE "Override Title".`)
    const html = generate(parse(src), src)
    expect(html).toContain('Override Title')
    expect(html).toContain('Structural signal across six dimensions.')
  })
})

describe('WITH DATA — group binding', () => {
  const itemsSection = `
      01 STATS.
         05 STAT-1.
            10 STAT-1-VALUE PIC X(10) VALUE "2,451".
            10 STAT-1-LABEL PIC X(20) VALUE "FETCH Score".
         05 STAT-2.
            10 STAT-2-VALUE PIC X(10) VALUE "6/6".
            10 STAT-2-LABEL PIC X(20) VALUE "Dimensions".`

  const component = `
   DEFINE METRICS-BLOCK.
      ACCEPTS STATS FETCH-SCORE.
      DISPLAY SECTION ID "metrics" WITH LAYOUT STACK WITH PADDING MEDIUM.
         DISPLAY LABEL FETCH-SCORE.
         DISPLAY STAT-GRID STATS WITH COLUMNS 2.
      STOP SECTION.
   END DEFINE.`

  it('passes group name reference so STAT-GRID resolves correctly', () => {
    const src = makeRcl(itemsSection, component, `
      DISPLAY METRICS-BLOCK
         WITH DATA STATS, FETCH-SCORE.`)
    const html = generate(parse(src), src)
    expect(html).toContain('class="stat-grid cols-2"')
    expect(html).toContain('2,451')
    expect(html).toContain('FETCH Score')
    expect(html).toContain('6/6')
    expect(html).toContain('Dimensions')
  })

  it('scalar and group binding work together in one component', () => {
    const src = makeRcl(itemsSection, component, `
      DISPLAY METRICS-BLOCK
         WITH DATA STATS, FETCH-SCORE.`)
    const html = generate(parse(src), src)
    // scalar: FETCH-SCORE label
    expect(html).toContain('2451')
    // group: STATS rendered as stat-grid
    expect(html).toContain('class="stat-card"')
  })
})

describe('WITH DATA — TABLE group binding', () => {
  const itemsSection = `
      01 DIMENSIONS.
         05 DIM-1.
            10 DIM-1-NAME  PIC X(30) VALUE "Revenue (D3)".
            10 DIM-1-SCORE PIC 9(2)  VALUE "75".
         05 DIM-2.
            10 DIM-2-NAME  PIC X(30) VALUE "Quality (D5)".
            10 DIM-2-SCORE PIC 9(2)  VALUE "62".`

  const component = `
   DEFINE CASCADE-BLOCK.
      ACCEPTS DIMENSIONS.
      DISPLAY SECTION ID "cascade" WITH LAYOUT STACK WITH PADDING MEDIUM.
         DISPLAY TABLE DIMENSIONS WITH COLUMNS "Dimension, Score".
      STOP SECTION.
   END DEFINE.`

  it('passes group to TABLE inside component', () => {
    const src = makeRcl(itemsSection, component, `
      DISPLAY CASCADE-BLOCK
         WITH DATA DIMENSIONS.`)
    const html = generate(parse(src), src)
    expect(html).toContain('<table class="recall-table">')
    expect(html).toContain('<th>Dimension</th>')
    expect(html).toContain('<th>Score</th>')
    expect(html).toContain('Revenue (D3)')
    expect(html).toContain('75')
  })
})

describe('WITH DATA — parser', () => {
  it('parses DATA clause with multiple comma-separated fields', () => {
    const src = makeRcl('', `
   DEFINE MY-COMP.
      ACCEPTS HERO-TITLE HERO-SUBTITLE.
      DISPLAY HEADING-1 HERO-TITLE.
   END DEFINE.`, `
      DISPLAY MY-COMP
         WITH DATA HERO-TITLE, HERO-SUBTITLE.`)
    const program = parse(src)
    const section = program.procedure.sections[0]
    const stmt = section.statements[0]
    const dataClause = stmt.clauses.find(c => c.key === 'DATA')
    expect(dataClause).toBeDefined()
    expect(dataClause!.value).toBe('HERO-TITLE,HERO-SUBTITLE')
  })

  it('parses DATA clause without trailing commas on field names', () => {
    const src = makeRcl('', `
   DEFINE MY-COMP.
      ACCEPTS HERO-TITLE.
      DISPLAY HEADING-1 HERO-TITLE.
   END DEFINE.`, `
      DISPLAY MY-COMP
         WITH DATA HERO-TITLE.`)
    const program = parse(src)
    const section = program.procedure.sections[0]
    const stmt = section.statements[0]
    const dataClause = stmt.clauses.find(c => c.key === 'DATA')
    expect(dataClause!.value).toBe('HERO-TITLE')
  })
})
