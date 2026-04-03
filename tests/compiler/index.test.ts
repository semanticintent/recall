import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile, check } from '../../src/compiler/index.js'

const TMP = '/tmp/recall-test'

const VALID_SOURCE = `
IDENTIFICATION DIVISION.
   PROGRAM-ID.    TEST-PROG.
   PAGE-TITLE.    "Test".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT    RESPONSIVE.
      COLOR-MODE  DARK.
      LANGUAGE    EN.
   PALETTE SECTION.

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HEADING PIC X(20) VALUE "Hello".
   ITEMS SECTION.

PROCEDURE DIVISION.

   RENDER-MAIN.
      DISPLAY HEADING-1 HEADING.
   STOP SECTION.

   STOP RUN.
`

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

describe('RECALL Compiler', () => {
  describe('compile()', () => {
    it('compiles a valid .rcl file', () => {
      setup()
      const src = join(TMP, 'test.rcl')
      writeFileSync(src, VALID_SOURCE)
      const result = compile(src)
      expect(result.ok).toBe(true)
      expect(result.outputPath).toContain('test.html')
    })

    it('output file exists after compile', () => {
      setup()
      const src = join(TMP, 'test.rcl')
      writeFileSync(src, VALID_SOURCE)
      compile(src)
      expect(existsSync(join(TMP, 'test.html'))).toBe(true)
    })

    it('output embeds RECALL source comment', () => {
      setup()
      const src = join(TMP, 'test.rcl')
      writeFileSync(src, VALID_SOURCE)
      compile(src)
      const html = readFileSync(join(TMP, 'test.html'), 'utf-8')
      expect(html).toContain('RECALL COMPILED OUTPUT')
    })

    it('output is self-contained HTML', () => {
      setup()
      const src = join(TMP, 'test.rcl')
      writeFileSync(src, VALID_SOURCE)
      compile(src)
      const html = readFileSync(join(TMP, 'test.html'), 'utf-8')
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<style>')
      expect(html).not.toContain('<link rel="stylesheet"')
      expect(html).not.toContain('<script src=')
    })

    it('fails on missing file', () => {
      const result = compile('/tmp/does-not-exist.rcl')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('FILE NOT FOUND')
    })

    it('fails on wrong extension', () => {
      setup()
      const src = join(TMP, 'test.html')
      writeFileSync(src, '<html/>')
      const result = compile(src)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('.rcl')
    })

    it('respects --out directory', () => {
      setup()
      const src = join(TMP, 'test.rcl')
      const outDir = join(TMP, 'output')
      mkdirSync(outDir, { recursive: true })
      writeFileSync(src, VALID_SOURCE)
      const result = compile(src, outDir)
      expect(result.ok).toBe(true)
      expect(result.outputPath).toContain('output/test.html')
    })
  })

  describe('check()', () => {
    it('passes on valid source', () => {
      setup()
      const src = join(TMP, 'test.rcl')
      writeFileSync(src, VALID_SOURCE)
      const result = check(src)
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('fails on missing file', () => {
      const result = check('/tmp/nope.rcl')
      expect(result.ok).toBe(false)
      expect(result.errors[0]).toContain('FILE NOT FOUND')
    })

    it('fails on wrong extension', () => {
      setup()
      const src = join(TMP, 'bad.txt')
      writeFileSync(src, 'hello')
      const result = check(src)
      expect(result.ok).toBe(false)
    })
  })
})
