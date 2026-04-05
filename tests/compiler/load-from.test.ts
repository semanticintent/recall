import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from '../../src/compiler/index.js'

const TMP = '/tmp/recall-load-from-test'

const BASE_RCL = (dataSection: string, procedureBody: string) => `
IDENTIFICATION DIVISION.
   PROGRAM-ID. LOAD-TEST.
   PAGE-TITLE. "Load From Test".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      COLOR-MODE DARK.

DATA DIVISION.
${dataSection}

PROCEDURE DIVISION.
   RENDER.
${procedureBody}
   STOP RUN.
`

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

// ─────────────────────────────────────────────────────────
// JSON — scalar fields
// ─────────────────────────────────────────────────────────

describe('LOAD FROM — JSON scalars', () => {
  it('populates WORKING-STORAGE from top-level string values', () => {
    setup()
    writeFileSync(join(TMP, 'brief.json'), JSON.stringify({
      'PAGE-TITLE': 'Streaming Consolidation',
      'SECTOR': 'Media & Entertainment',
    }))
    const src = BASE_RCL(
      '   LOAD FROM "brief.json".',
      '      DISPLAY HEADING-1 PAGE-TITLE.\n      DISPLAY PARAGRAPH SECTOR.',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('Streaming Consolidation')
    expect(html).toContain('Media &amp; Entertainment')
  })

  it('populates numeric fields correctly', () => {
    setup()
    writeFileSync(join(TMP, 'brief.json'), JSON.stringify({ 'FETCH-SCORE': '2451' }))
    const src = BASE_RCL(
      '   LOAD FROM "brief.json".',
      '      DISPLAY LABEL FETCH-SCORE.',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('2451')
  })
})

// ─────────────────────────────────────────────────────────
// JSON — array → ITEMS group (STAT-GRID)
// ─────────────────────────────────────────────────────────

describe('LOAD FROM — JSON arrays as ITEMS groups', () => {
  it('renders STAT-GRID from JSON array', () => {
    setup()
    writeFileSync(join(TMP, 'brief.json'), JSON.stringify({
      STATS: [
        { VALUE: '2,451', LABEL: 'FETCH Score' },
        { VALUE: '6/6',   LABEL: 'Dimensions'  },
        { VALUE: '$4.2B', LABEL: 'Market Cap'  },
      ],
    }))
    const src = BASE_RCL(
      '   LOAD FROM "brief.json".',
      '      DISPLAY STAT-GRID STATS WITH COLUMNS 3.',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('class="stat-grid cols-3"')
    expect(html).toContain('2,451')
    expect(html).toContain('FETCH Score')
    expect(html).toContain('6/6')
    expect(html).toContain('$4.2B')
    expect(html).toContain('Market Cap')
  })

  it('renders TABLE from JSON array', () => {
    setup()
    writeFileSync(join(TMP, 'brief.json'), JSON.stringify({
      DIMENSIONS: [
        { NAME: 'Revenue (D3)', SCORE: '75', LAYER: 'origin' },
        { NAME: 'Quality (D5)', SCORE: '62', LAYER: 'momentum' },
      ],
    }))
    const src = BASE_RCL(
      '   LOAD FROM "brief.json".',
      '      DISPLAY TABLE DIMENSIONS WITH COLUMNS "Dimension, Score, Layer".',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('<table class="recall-table">')
    expect(html).toContain('<th>Dimension</th>')
    expect(html).toContain('Revenue (D3)')
    expect(html).toContain('75')
    expect(html).toContain('momentum')
  })
})

// ─────────────────────────────────────────────────────────
// JSON — mixed scalars + arrays in same file
// ─────────────────────────────────────────────────────────

describe('LOAD FROM — JSON mixed scalar + array', () => {
  it('loads scalars into WS and arrays into ITEMS from same JSON', () => {
    setup()
    writeFileSync(join(TMP, 'brief.json'), JSON.stringify({
      'CASE-TITLE': 'Streaming Consolidation',
      STATS: [
        { VALUE: '2,451', LABEL: 'FETCH Score' },
        { VALUE: '6/6',   LABEL: 'Dimensions'  },
      ],
    }))
    const src = BASE_RCL(
      '   LOAD FROM "brief.json".',
      '      DISPLAY HEADING-1 CASE-TITLE.\n      DISPLAY STAT-GRID STATS WITH COLUMNS 2.',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('Streaming Consolidation')
    expect(html).toContain('class="stat-grid cols-2"')
    expect(html).toContain('2,451')
  })
})

// ─────────────────────────────────────────────────────────
// CSV → ITEMS group
// ─────────────────────────────────────────────────────────

describe('LOAD FROM — CSV', () => {
  it('renders TABLE from CSV file', () => {
    setup()
    writeFileSync(join(TMP, 'dimensions.csv'),
      'NAME,SCORE,LAYER\nRevenue (D3),75,origin\nQuality (D5),62,momentum\n'
    )
    const src = BASE_RCL(
      '   LOAD FROM "dimensions.csv".',
      '      DISPLAY TABLE DIMENSIONS WITH COLUMNS "Name, Score, Layer".',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('<table class="recall-table">')
    expect(html).toContain('<th>Name</th>')
    expect(html).toContain('Revenue (D3)')
    expect(html).toContain('75')
    expect(html).toContain('momentum')
  })

  it('renders STAT-GRID from CSV with VALUE/LABEL columns', () => {
    setup()
    writeFileSync(join(TMP, 'stats.csv'),
      'VALUE,LABEL\n2451,FETCH Score\n6/6,Dimensions\n'
    )
    const src = BASE_RCL(
      '   LOAD FROM "stats.csv".',
      '      DISPLAY STAT-GRID STATS WITH COLUMNS 2.',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('class="stat-grid cols-2"')
    expect(html).toContain('2451')
    expect(html).toContain('FETCH Score')
  })
})

// ─────────────────────────────────────────────────────────
// Multiple LOAD FROM in same DATA DIVISION
// ─────────────────────────────────────────────────────────

describe('LOAD FROM — multiple files', () => {
  it('merges data from two LOAD FROM statements', () => {
    setup()
    writeFileSync(join(TMP, 'meta.json'), JSON.stringify({ 'CASE-TITLE': 'AI Hardware Race' }))
    writeFileSync(join(TMP, 'dims.csv'),
      'NAME,SCORE\nGPU Supply,78\nData Centers,81\n'
    )
    const src = BASE_RCL(
      '   LOAD FROM "meta.json".\n   LOAD FROM "dims.csv".',
      '      DISPLAY HEADING-1 CASE-TITLE.\n      DISPLAY TABLE DIMS WITH COLUMNS "Name, Score".',
    )
    writeFileSync(join(TMP, 'main.rcl'), src)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('AI Hardware Race')
    expect(html).toContain('GPU Supply')
    expect(html).toContain('Data Centers')
  })
})
