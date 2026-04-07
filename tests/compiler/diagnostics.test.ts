// ─────────────────────────────────────────────────────────
// Per-code diagnostic coverage
//
// One test per RCL-NNN / RCL-WNNN.
// Each test: minimal fixture → check() → assert exact code present.
// ─────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { check } from '../../src/compiler/index.js'

const TMP = '/tmp/recall-diag-test'

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

function write(name: string, source: string): string {
  const p = join(TMP, name)
  writeFileSync(p, source)
  return p
}

// ── Minimal valid scaffold (used as base for negative tests) ──────────────
function minimal({
  id   = `   PROGRAM-ID. TEST.\n   PAGE-TITLE. "T".`,
  env  = '',
  data = `   WORKING-STORAGE SECTION.\n      01 FIELD-A PIC X(20) VALUE "hello".`,
  proc = `   RENDER.\n      DISPLAY HEADING-1 FIELD-A.\n   STOP SECTION.\n\n   STOP RUN.`,
} = {}): string {
  return [
    'IDENTIFICATION DIVISION.',
    id,
    'ENVIRONMENT DIVISION.',
    '   CONFIGURATION SECTION.',
    '      VIEWPORT RESPONSIVE.',
    env,
    'DATA DIVISION.',
    data,
    '   ITEMS SECTION.',
    'PROCEDURE DIVISION.',
    proc,
  ].join('\n')
}

function hasCode(result: ReturnType<typeof check>, code: string): boolean {
  return (
    result.errors.some(e => e.includes(code)) ||
    result.warningMessages.some(w => w.includes(code))
  )
}

// ─────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────

describe('RCL-001 — type mismatch (group in string element)', () => {
  beforeEach(setup)
  it('emits RCL-001 when group field used as stmt.value in string element', () => {
    const src = write('rcl001.rcl', minimal({
      data: [
        '   WORKING-STORAGE SECTION.',
        '      01 FIELD-A PIC X(20) VALUE "hello".',
        '   ITEMS SECTION.',
        '      01 FEATURES.',
        '         05 FEATURES-1 PIC X(40) VALUE "Fast".',
      ].join('\n'),
      proc: `   RENDER.\n      DISPLAY HEADING-1 FEATURES.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-001')).toBe(true)
  })
})

describe('RCL-002 — value exceeds declared length', () => {
  beforeEach(setup)
  it('emits RCL-002 when VALUE is longer than PIC X(n)', () => {
    const src = write('rcl002.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 HERO-HEAD PIC X(10) VALUE "This is longer than ten characters.".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-002')).toBe(true)
  })
})

describe('RCL-003 — unknown element', () => {
  beforeEach(setup)
  it('emits RCL-003 when DISPLAY uses an unregistered element name', () => {
    const src = write('rcl003.rcl', minimal({
      proc: `   RENDER.\n      DISPLAY HEADING1 FIELD-A.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-003')).toBe(true)
  })
})

describe('RCL-004 — unknown identifier in USING', () => {
  beforeEach(setup)
  it('emits RCL-004 when USING references undeclared group', () => {
    const src = write('rcl004.rcl', minimal({
      proc: `   RENDER.\n      DISPLAY NAVIGATION USING NAV-LINKS.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-004')).toBe(true)
  })
})

describe('RCL-005 — missing PROCEDURE DIVISION', () => {
  beforeEach(setup)
  it('emits RCL-005 when PROCEDURE DIVISION is absent', () => {
    const src = write('rcl005.rcl', [
      'IDENTIFICATION DIVISION.',
      '   PROGRAM-ID. TEST.',
      '   PAGE-TITLE. "T".',
      'DATA DIVISION.',
      '   WORKING-STORAGE SECTION.',
    ].join('\n'))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-005')).toBe(true)
  })
})

describe('RCL-006 — missing required identification field', () => {
  beforeEach(setup)
  it('emits RCL-006 when PROGRAM-ID is absent', () => {
    const src = write('rcl006.rcl', [
      'IDENTIFICATION DIVISION.',
      '   AUTHOR. Test.',
      'DATA DIVISION.',
      '   WORKING-STORAGE SECTION.',
      'PROCEDURE DIVISION.',
      '   RENDER.',
      '      DISPLAY PARAGRAPH "hello".',
      '   STOP SECTION.',
      '   STOP RUN.',
    ].join('\n'))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-006')).toBe(true)
  })
})

describe('RCL-007 — USING requires a group, not a scalar', () => {
  beforeEach(setup)
  it('emits RCL-007 when USING points to a scalar field', () => {
    const src = write('rcl007.rcl', minimal({
      proc: `   RENDER.\n      DISPLAY NAVIGATION USING FIELD-A.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-007')).toBe(true)
  })
})

describe('RCL-008 — group used where scalar expected (via USING)', () => {
  beforeEach(setup)
  it('emits RCL-008 when USING passes a group to a scalar element', () => {
    const src = write('rcl008.rcl', minimal({
      data: [
        '   WORKING-STORAGE SECTION.',
        '      01 FIELD-A PIC X(20) VALUE "hello".',
        '   ITEMS SECTION.',
        '      01 FEATURES.',
        '         05 FEATURES-1 PIC X(40) VALUE "Fast".',
      ].join('\n'),
      proc: `   RENDER.\n      DISPLAY PARAGRAPH USING FEATURES.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-008')).toBe(true)
  })
})

describe('RCL-009 — invalid DATE format', () => {
  beforeEach(setup)
  it('emits RCL-009 when DATE value is not ISO 8601', () => {
    const src = write('rcl009.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 PUB-DATE PIC DATE VALUE "April 5, 2026".\n      01 FIELD-A PIC X(20) VALUE "hello".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-009')).toBe(true)
  })
})

describe('RCL-010 — invalid URL format', () => {
  beforeEach(setup)
  it('emits RCL-010 when URL value is a relative path', () => {
    const src = write('rcl010.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 LOGO-SRC PIC URL VALUE "images/logo.png".\n      01 FIELD-A PIC X(20) VALUE "hello".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-010')).toBe(true)
  })
})

describe('RCL-011 — PCT value out of range', () => {
  beforeEach(setup)
  it('emits RCL-011 when PCT value exceeds 100', () => {
    const src = write('rcl011.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 ACCURACY PIC PCT VALUE "142".\n      01 FIELD-A PIC X(20) VALUE "hello".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-011')).toBe(true)
  })
})

describe('RCL-012 — non-numeric value in PIC 9 field', () => {
  beforeEach(setup)
  it('emits RCL-012 when PIC 9 VALUE contains non-numeric characters', () => {
    const src = write('rcl012.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 VISIT-COUNT PIC 9(6) VALUE "142,398".\n      01 FIELD-A PIC X(20) VALUE "hello".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-012')).toBe(true)
  })
})

describe('RCL-013 — missing STOP RUN', () => {
  beforeEach(setup)
  it('emits RCL-013 when PROCEDURE DIVISION has no STOP RUN', () => {
    const src = write('rcl013.rcl', minimal({
      proc: `   RENDER.\n      DISPLAY HEADING-1 FIELD-A.\n   STOP SECTION.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-013')).toBe(true)
  })
})

describe('RCL-022 — palette key has trailing period', () => {
  beforeEach(setup)
  it('emits RCL-022 when a PALETTE key ends with a period', () => {
    const src = write('rcl022.rcl', minimal({
      env: `   PALETTE SECTION.\n      COLOR-BG.  "#080a10".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-022')).toBe(true)
  })
})

describe('RCL-023 — missing statement terminator', () => {
  beforeEach(setup)
  it('emits RCL-023 when a DISPLAY statement has no period', () => {
    const src = write('rcl023.rcl', minimal({
      proc: `   RENDER.\n      DISPLAY HEADING-1 FIELD-A\n      DISPLAY PARAGRAPH FIELD-A.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-023')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────
// WARNING CODES
// ─────────────────────────────────────────────────────────

describe('RCL-W01 — empty group in USING', () => {
  beforeEach(setup)
  it('emits RCL-W01 when USING points to a group with no children', () => {
    const src = write('rclw01.rcl', minimal({
      data: [
        '   WORKING-STORAGE SECTION.',
        '      01 FIELD-A PIC X(20) VALUE "hello".',
        '   ITEMS SECTION.',
        '      01 FEATURES.',
      ].join('\n'),
      proc: `   RENDER.\n      DISPLAY CARD-LIST USING FEATURES.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-W01')).toBe(true)
  })
})

describe('RCL-W02 — value near declared length limit', () => {
  beforeEach(setup)
  it('emits RCL-W02 when VALUE uses more than 90% of PIC X(n) width', () => {
    // PIC X(20), value is 19 chars = 95%
    const src = write('rclw02.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 FIELD-A PIC X(20) VALUE "nineteen chars here".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-W02')).toBe(true)
  })
})

describe('RCL-W03 — missing optional identification field', () => {
  beforeEach(setup)
  it('emits RCL-W03 when AUTHOR is absent', () => {
    const src = write('rclw03.rcl', minimal({
      id: `   PROGRAM-ID. TEST.\n   PAGE-TITLE. "T".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-W03')).toBe(true)
  })
})

describe('RCL-W05 — implicit string coercion', () => {
  beforeEach(setup)
  it('emits RCL-W05 when numeric field is used in string element', () => {
    const src = write('rclw05.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 REVENUE PIC 9(8) VALUE "4800000".\n      01 FIELD-A PIC X(20) VALUE "hello".`,
      proc: `   RENDER.\n      DISPLAY PARAGRAPH REVENUE.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-W05')).toBe(true)
  })
})

describe('RCL-W06 — field has no VALUE clause', () => {
  beforeEach(setup)
  it('emits RCL-W06 when referenced field has no VALUE', () => {
    const src = write('rclw06.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 PAGE-SUBTITLE PIC X.\n      01 FIELD-A PIC X(20) VALUE "hello".`,
      proc: `   RENDER.\n      DISPLAY PARAGRAPH PAGE-SUBTITLE.\n   STOP SECTION.\n\n   STOP RUN.`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-W06')).toBe(true)
  })
})

describe('RCL-W07 — unknown PIC type', () => {
  beforeEach(setup)
  it('emits RCL-W07 when PIC type is not recognised', () => {
    const src = write('rclw07.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 MY-FIELD PIC CUSTOM VALUE "hello".\n      01 FIELD-A PIC X(20) VALUE "hello".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-W07')).toBe(true)
  })
})

describe('RCL-W08 — malformed VALUE clause', () => {
  beforeEach(setup)
  it('emits RCL-W08 when VALUE is not a quoted string', () => {
    const src = write('rclw08.rcl', minimal({
      data: `   WORKING-STORAGE SECTION.\n      01 MY-FIELD PIC X VALUE hello.\n      01 FIELD-A PIC X(20) VALUE "hello".`,
    }))
    const result = check(src, { quiet: true })
    expect(hasCode(result, 'RCL-W08')).toBe(true)
  })
})
