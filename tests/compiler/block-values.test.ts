// ─────────────────────────────────────────────────────────
// VALUE BLOCK and VALUE HEREDOC tests
// ─────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { check, compile } from '../../src/compiler/index.js'

const TMP = '/tmp/recall-block-test'

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

function write(name: string, source: string): string {
  const p = join(TMP, name)
  writeFileSync(p, source)
  return p
}

function program(dataSection: string): string {
  return [
    'IDENTIFICATION DIVISION.',
    '   PROGRAM-ID. TEST.',
    '   PAGE-TITLE. "T".',
    'ENVIRONMENT DIVISION.',
    '   CONFIGURATION SECTION.',
    '      VIEWPORT RESPONSIVE.',
    'DATA DIVISION.',
    '   WORKING-STORAGE SECTION.',
    dataSection,
    '   ITEMS SECTION.',
    'PROCEDURE DIVISION.',
    '   RENDER.',
    '      DISPLAY PARAGRAPH BODY.',
    '   STOP SECTION.',
    '',
    '   STOP RUN.',
  ].join('\n')
}

describe('VALUE BLOCK', () => {
  beforeEach(setup)

  it('compiles a VALUE BLOCK field cleanly', () => {
    const src = write('block.rcl', program(`
      01 BODY PIC X VALUE BLOCK.
         First paragraph of content.
         Second paragraph continues here.
      END VALUE.`))
    const result = check(src)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('preserves newline-encoded content in compiled HTML', () => {
    const src = write('block-html.rcl', program(`
      01 BODY PIC X VALUE BLOCK.
         Line one.
         Line two.
      END VALUE.`))
    const result = compile(src, TMP)
    expect(result.ok).toBe(true)
    const html = result.outputPath ? require('node:fs').readFileSync(result.outputPath, 'utf-8') : ''
    expect(html).toContain('Line one.')
  })
})

describe('VALUE HEREDOC', () => {
  beforeEach(setup)

  it('compiles a VALUE HEREDOC field cleanly', () => {
    const src = write('heredoc.rcl', program(`
      01 BODY PIC X VALUE HEREDOC.
         Any content here.
         Including "quoted strings".
      END HEREDOC.`))
    const result = check(src)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('does not emit RCL-W08 for quoted content inside HEREDOC', () => {
    const src = write('heredoc-quotes.rcl', program(`
      01 BODY PIC X VALUE HEREDOC.
         01 EXAMPLE PIC X(20) VALUE "Hello World".
         PROCEDURE DIVISION.
         DISPLAY HEADING-1 EXAMPLE.
      END HEREDOC.`))
    const result = check(src)
    // Quoted values inside HEREDOC should not trigger RCL-W08
    expect(result.warningMessages.some(w => w.includes('RCL-W08'))).toBe(false)
    expect(result.ok).toBe(true)
  })

  it('does not treat PROCEDURE DIVISION inside HEREDOC as a real division', () => {
    // If PROCEDURE DIVISION leaked out it would confuse the parser/bucketer.
    // A clean check() with no structural errors proves containment.
    const src = write('heredoc-division.rcl', program(`
      01 BODY PIC X VALUE HEREDOC.
         PROCEDURE DIVISION.
         ENVIRONMENT DIVISION.
         COMPONENT DIVISION.
         COPY FROM "@semanticintent/recall-ui/themes/dark.rcpy".
      END HEREDOC.`))
    const result = check(src)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('auto-sizes PIC X with no explicit length', () => {
    const src = write('heredoc-autosize.rcl', program(`
      01 BODY PIC X VALUE HEREDOC.
         This is some content that needs auto-sizing.
      END HEREDOC.`))
    const result = check(src)
    expect(result.ok).toBe(true)
  })
})
