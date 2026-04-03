// ─────────────────────────────────────────────────────────
// RECALL Compiler — orchestrates parse → generate
// ─────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, basename, dirname, join } from 'node:path'
import { parse } from '../parser/rcl.js'
import { generate } from '../generator/html.js'

export interface CompileResult {
  ok: boolean
  inputPath: string
  outputPath?: string
  error?: string
}

export interface CheckResult {
  ok: boolean
  inputPath: string
  errors: string[]
}

export function compile(inputPath: string, outDir?: string): CompileResult {
  const absInput = resolve(inputPath)

  if (!existsSync(absInput)) {
    return { ok: false, inputPath: absInput, error: `FILE NOT FOUND: ${absInput}` }
  }

  if (!absInput.endsWith('.rcl')) {
    return { ok: false, inputPath: absInput, error: `NOT A RECALL SOURCE FILE. EXPECTED .rcl EXTENSION.` }
  }

  let source: string
  try {
    source = readFileSync(absInput, 'utf-8')
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `CANNOT READ FILE: ${(err as Error).message}` }
  }

  let program
  try {
    program = parse(source)
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `PARSE ERROR: ${(err as Error).message}` }
  }

  let html: string
  try {
    html = generate(program, source)
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `GENERATION ERROR: ${(err as Error).message}` }
  }

  const outputDir = outDir ? resolve(outDir) : dirname(absInput)
  const outputName = basename(absInput, '.rcl') + '.html'
  const outputPath = join(outputDir, outputName)

  try {
    writeFileSync(outputPath, html, 'utf-8')
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `CANNOT WRITE OUTPUT: ${(err as Error).message}` }
  }

  return { ok: true, inputPath: absInput, outputPath }
}

export function check(inputPath: string): CheckResult {
  const absInput = resolve(inputPath)
  const errors: string[] = []

  if (!existsSync(absInput)) {
    return { ok: false, inputPath: absInput, errors: [`FILE NOT FOUND: ${absInput}`] }
  }

  if (!absInput.endsWith('.rcl')) {
    return { ok: false, inputPath: absInput, errors: ['NOT A RECALL SOURCE FILE. EXPECTED .rcl EXTENSION.'] }
  }

  let source: string
  try {
    source = readFileSync(absInput, 'utf-8')
  } catch (err) {
    return { ok: false, inputPath: absInput, errors: [`CANNOT READ FILE: ${(err as Error).message}`] }
  }

  try {
    const program = parse(source)

    if (!program.identification.programId) {
      errors.push('IDENTIFICATION DIVISION: PROGRAM-ID IS REQUIRED.')
    }
    if (!program.identification.pageTitle) {
      errors.push('IDENTIFICATION DIVISION: PAGE-TITLE IS REQUIRED.')
    }
    if (program.procedure.sections.length === 0) {
      errors.push('PROCEDURE DIVISION: NO SECTIONS FOUND. AT LEAST ONE RENDER SECTION IS REQUIRED.')
    }
  } catch (err) {
    errors.push(`PARSE ERROR: ${(err as Error).message}`)
  }

  return { ok: errors.length === 0, inputPath: absInput, errors }
}
