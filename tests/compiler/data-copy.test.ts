// ─────────────────────────────────────────────────────────
// DATA COPY tests — COPY FROM in DATA DIVISION
// RCL-024 (file not found), RCL-025 (collision), RCL-026 (circular)
// ─────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { check, compile } from '../../src/compiler/index.js'

const TMP = '/tmp/recall-data-copy-test'

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

function write(name: string, source: string): string {
  const p = join(TMP, name)
  writeFileSync(p, source)
  return p
}

const BASE = `IDENTIFICATION DIVISION.
   PROGRAM-ID. TEST.
   PAGE-TITLE. "T".
ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT RESPONSIVE.
`

function program(dataDivision: string, procedure = 'DISPLAY PARAGRAPH BODY.'): string {
  return BASE + `DATA DIVISION.
${dataDivision}
PROCEDURE DIVISION.
   RENDER.
      ${procedure}
   STOP SECTION.

   STOP RUN.
`
}

// ─────────────────────────────────────────────────────────

describe('DATA COPY — happy path', () => {
  beforeEach(setup)

  it('inlines fields from a DATA COPY copybook', () => {
    write('shared.rcpy', `DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 SHARED-TITLE PIC X(60) VALUE "Shared Title".
      01 SHARED-BODY  PIC X(40) VALUE "Shared body text".
`)
    const src = write('happy.rcl', program(
      `   COPY FROM "shared.rcpy".
   WORKING-STORAGE SECTION.
      01 BODY PIC X(10) VALUE "Local".`,
      `DISPLAY PARAGRAPH BODY.`,
    ))
    const result = check(src)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('shared field is visible in compiled HTML', () => {
    write('shared-html.rcpy', `DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 BODY PIC X(20) VALUE "From copybook".
`)
    const src = write('happy-html.rcl', program(
      `   COPY FROM "shared-html.rcpy".
   WORKING-STORAGE SECTION.`,
      `DISPLAY PARAGRAPH BODY.`,
    ))
    const result = compile(src, TMP)
    expect(result.ok).toBe(true)
    const { readFileSync } = require('node:fs')
    const html = result.outputPath ? readFileSync(result.outputPath, 'utf-8') : ''
    expect(html).toContain('From copybook')
  })

  it('inlines fields from a nested DATA COPY (a → b)', () => {
    write('b.rcpy', `DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 DEEP-FIELD PIC X(40) VALUE "Deep".
`)
    write('a.rcpy', `DATA DIVISION.
   COPY FROM "b.rcpy".
   WORKING-STORAGE SECTION.
      01 SHALLOW-FIELD PIC X(40) VALUE "Shallow".
`)
    const src = write('nested.rcl', program(
      `   COPY FROM "a.rcpy".
   WORKING-STORAGE SECTION.
      01 BODY PIC X(10) VALUE "Local".`,
      `DISPLAY PARAGRAPH BODY.`,
    ))
    const result = check(src)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────

describe('RCL-024 — DATA COPY file not found', () => {
  beforeEach(setup)

  it('emits RCL-024 when COPY FROM file does not exist', () => {
    const src = write('rcl024.rcl', program(
      `   COPY FROM "shared/missing.rcpy".
   WORKING-STORAGE SECTION.
      01 BODY PIC X(5) VALUE "Hello".`,
    ))
    const result = check(src)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('RCL-024'))).toBe(true)
  })

  it('does not emit RCL-024 when the referenced file exists', () => {
    write('exists.rcpy', `DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 BODY PIC X(10) VALUE "exists".
`)
    const src = write('rcl024-ok.rcl', program(
      `   COPY FROM "exists.rcpy".
   WORKING-STORAGE SECTION.`,
    ))
    const result = check(src)
    expect(result.errors.some(e => e.includes('RCL-024'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────

describe('RCL-025 — DATA COPY field name collision', () => {
  beforeEach(setup)

  it('emits RCL-025 when copybook field collides with local field', () => {
    write('collision.rcpy', `DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 BODY PIC X(60) VALUE "From copybook".
`)
    const src = write('rcl025.rcl', program(
      `   COPY FROM "collision.rcpy".
   WORKING-STORAGE SECTION.
      01 BODY PIC X(10) VALUE "Local".`,  // BODY already declared in copybook
    ))
    const result = check(src)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('RCL-025'))).toBe(true)
  })

  it('does not emit RCL-025 when field names are unique', () => {
    write('no-collision.rcpy', `DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 SHARED-BODY PIC X(60) VALUE "From copybook".
`)
    const src = write('rcl025-ok.rcl', program(
      `   COPY FROM "no-collision.rcpy".
   WORKING-STORAGE SECTION.
      01 BODY PIC X(10) VALUE "Local".`,
    ))
    const result = check(src)
    expect(result.errors.some(e => e.includes('RCL-025'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────

describe('RCL-026 — Circular DATA COPY', () => {
  beforeEach(setup)

  it('emits RCL-026 when a DATA COPY creates a cycle', () => {
    // a.rcpy → b.rcpy → a.rcpy
    write('rcl026-a.rcpy', `DATA DIVISION.
   COPY FROM "rcl026-b.rcpy".
   WORKING-STORAGE SECTION.
      01 A-FIELD PIC X(20) VALUE "A".
`)
    write('rcl026-b.rcpy', `DATA DIVISION.
   COPY FROM "rcl026-a.rcpy".
   WORKING-STORAGE SECTION.
      01 B-FIELD PIC X(20) VALUE "B".
`)
    const src = write('rcl026.rcl', program(
      `   COPY FROM "rcl026-a.rcpy".
   WORKING-STORAGE SECTION.
      01 BODY PIC X VALUE "x".`,
    ))
    const result = check(src)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('RCL-026'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────

describe('DATA COPY + LOAD FROM coexistence', () => {
  beforeEach(setup)

  it('DATA COPY fields and LOAD FROM fields coexist without collision', () => {
    write('coexist-nav.rcpy', `DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 NAV-TITLE PIC X(40) VALUE "RECALL".
`)
    write('coexist-data.json', JSON.stringify({ pageTitle: 'Home', pageSubtitle: 'Welcome' }))
    // Note: LOAD FROM fields use camelCase-to-UPPER-KEBAB conversion:
    // pageTitle → PAGE-TITLE (but that may collide with builtins — use distinct keys)
    const src = write('combined.rcl', BASE + `DATA DIVISION.
   COPY FROM "coexist-nav.rcpy".
   WORKING-STORAGE SECTION.
      01 BODY PIC X(10) VALUE "content".
   LOAD FROM "coexist-data.json".
   ITEMS SECTION.
PROCEDURE DIVISION.
   RENDER.
      DISPLAY PARAGRAPH BODY.
   STOP SECTION.

   STOP RUN.
`)
    const result = check(src)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
