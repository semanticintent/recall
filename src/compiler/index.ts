// ─────────────────────────────────────────────────────────
// RECALL Compiler — orchestrates parse → generate
// ─────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, basename, dirname, join } from 'node:path'
import { parse } from '../parser/rcl.js'
import { generate } from '../generator/html.js'
import type { DataDivision, ComponentDivision, DisplayStatement } from '../parser/rcl.js'

// ─────────────────────────────────────────────────────────
// COPY resolution — merges component files into the AST
// ─────────────────────────────────────────────────────────

function resolveStatementsInPlace(
  statements: DisplayStatement[],
  data: DataDivision,
  component: ComponentDivision,
  dir: string,
): void {
  let i = 0
  while (i < statements.length) {
    const stmt = statements[i]
    if (stmt.element === 'COPY') {
      const filePath = resolve(dir, stmt.value!)
      const componentSource = readFileSync(filePath, 'utf-8')
      const imported = parse(componentSource)
      // Merge data
      data.workingStorage.push(...imported.data.workingStorage)
      data.items.push(...imported.data.items)
      // Merge component definitions
      component.components.push(...imported.component.components)
      // Inline procedure statements
      const inlined = imported.procedure.sections.flatMap(s => s.statements)
      statements.splice(i, 1, ...inlined)
      i += inlined.length
    } else {
      if (stmt.children.length > 0) {
        resolveStatementsInPlace(stmt.children, data, component, dir)
      }
      i++
    }
  }
}

function resolveIncludes(program: ReturnType<typeof parse>, dir: string): void {
  for (const section of program.procedure.sections) {
    resolveStatementsInPlace(section.statements, program.data, program.component, dir)
  }
}

// ─────────────────────────────────────────────────────────
// Theme inheritance — COPY FROM in ENVIRONMENT DIVISION
// Runs as a source pre-process before parse()
// ─────────────────────────────────────────────────────────

const DIVISION_STARTS = [
  'IDENTIFICATION DIVISION',
  'ENVIRONMENT DIVISION',
  'DATA DIVISION',
  'COMPONENT DIVISION',
  'PROCEDURE DIVISION',
]

function extractEnvContent(source: string): string[] {
  const lines = source.split('\n')
  const result: string[] = []
  let inEnv = false
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('ENVIRONMENT DIVISION')) { inEnv = true; continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('ENVIRONMENT DIVISION'))) {
      inEnv = false; continue
    }
    if (inEnv) result.push(line)
  }
  return result
}

function resolveThemeCopies(source: string, dir: string): string {
  const lines = source.split('\n')
  const result: string[] = []
  let inEnv = false

  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('ENVIRONMENT DIVISION')) { inEnv = true; result.push(line); continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('ENVIRONMENT DIVISION'))) {
      inEnv = false; result.push(line); continue
    }

    if (inEnv && t.startsWith('COPY FROM')) {
      const match = t.match(/COPY FROM\s+"([^"]+)"/)
      if (match) {
        const filePath = resolve(dir, match[1])
        const themeSource = readFileSync(filePath, 'utf-8')
        result.push(...extractEnvContent(themeSource))
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

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
    const merged = resolveThemeCopies(source, dirname(absInput))
    program = parse(merged)
    resolveIncludes(program, dirname(absInput))
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
    const merged = resolveThemeCopies(source, dirname(absInput))
    const program = parse(merged)

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
