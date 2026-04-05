// ─────────────────────────────────────────────────────────
// RECALL Compiler — orchestrates parse → generate
// ─────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs'
import { resolve, basename, dirname, join, relative, extname } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// ─────────────────────────────────────────────────────────
// Path resolution — relative paths and npm package paths
// ─────────────────────────────────────────────────────────

function resolveFilePath(specifier: string, dir: string): string {
  // npm scoped package path (@scope/pkg/file.rcpy) — walk up for node_modules
  if (specifier.startsWith('@')) {
    let current = dir
    while (true) {
      const candidate = join(current, 'node_modules', specifier)
      if (existsSync(candidate)) return candidate
      const parent = dirname(current)
      if (parent === current) break  // filesystem root
      current = parent
    }
    throw new Error(`Cannot resolve package path: "${specifier}" — is the package installed?`)
  }
  // Relative or bare path — resolve against dir
  return resolve(dir, specifier)
}
import { parse } from '../parser/rcl.js'
import { generate } from '../generator/html.js'
import type { DataDivision, ComponentDivision, DisplayStatement, EnvironmentDivision } from '../parser/rcl.js'

// ─────────────────────────────────────────────────────────
// COPY resolution — merges component files into the AST
// ─────────────────────────────────────────────────────────

function resolveStatementsInPlace(
  statements: DisplayStatement[],
  data: DataDivision,
  component: ComponentDivision,
  dir: string,
  env: EnvironmentDivision,
): void {
  let i = 0
  while (i < statements.length) {
    const stmt = statements[i]
    if (stmt.element === 'COPY') {
      const filePath = resolveFilePath(stmt.value!, dir)
      const componentSource = readFileSync(filePath, 'utf-8')
      const imported = parse(componentSource)
      // Merge data
      data.workingStorage.push(...imported.data.workingStorage)
      data.items.push(...imported.data.items)
      // Merge component definitions
      component.components.push(...imported.component.components)
      // Merge environment — palette, fonts, styleBlock from copybook
      Object.assign(env.palette, imported.environment.palette)
      if (imported.environment.fontPrimary)   env.fontPrimary   = imported.environment.fontPrimary
      if (imported.environment.fontSecondary) env.fontSecondary = imported.environment.fontSecondary
      if (imported.environment.styleBlock) {
        env.styleBlock = env.styleBlock
          ? `${env.styleBlock}\n${imported.environment.styleBlock}`
          : imported.environment.styleBlock
      }
      // Inline procedure statements
      const inlined = imported.procedure.sections.flatMap(s => s.statements)
      statements.splice(i, 1, ...inlined)
      i += inlined.length
    } else {
      if (stmt.children.length > 0) {
        resolveStatementsInPlace(stmt.children, data, component, dir, env)
      }
      i++
    }
  }
}

function resolveIncludes(program: ReturnType<typeof parse>, dir: string): void {
  for (const section of program.procedure.sections) {
    resolveStatementsInPlace(section.statements, program.data, program.component, dir, program.environment)
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

// ─────────────────────────────────────────────────────────
// LOAD FROM — JSON/CSV → DATA DIVISION at compile time
// ─────────────────────────────────────────────────────────

function toRclName(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function picFor(val: string): string {
  const isNum = /^\d+(\.\d+)?$/.test(val.trim())
  return isNum ? `PIC 9(${val.length})` : `PIC X(${Math.max(val.length, 50)})`
}

function safeValue(val: string): string {
  return val.replace(/"/g, "'")
}

function jsonToRclLines(json: Record<string, unknown>): string[] {
  const ws: string[] = []
  const items: string[] = []

  for (const [key, val] of Object.entries(json)) {
    const name = toRclName(key)

    if (Array.isArray(val)) {
      items.push(`      01 ${name}.`)
      val.forEach((row, idx) => {
        if (typeof row !== 'object' || row === null) return
        const itemName = `${name}-${idx + 1}`
        items.push(`         05 ${itemName}.`)
        for (const [fk, fv] of Object.entries(row as Record<string, unknown>)) {
          const fieldName = `${itemName}-${toRclName(fk)}`
          const fieldVal  = safeValue(String(fv ?? ''))
          items.push(`            10 ${fieldName} ${picFor(fieldVal)} VALUE "${fieldVal}".`)
        }
      })
    } else if (typeof val === 'string' || typeof val === 'number') {
      const fieldVal = safeValue(String(val))
      ws.push(`      01 ${name} ${picFor(fieldVal)} VALUE "${fieldVal}".`)
    }
  }

  const result: string[] = []
  if (ws.length)    result.push('   WORKING-STORAGE SECTION.', ...ws)
  if (items.length) result.push('   ITEMS SECTION.', ...items)
  return result
}

function csvToRclLines(content: string, filename: string): string[] {
  const rows = content.trim().split('\n').filter(Boolean)
  if (rows.length < 2) return []

  const groupName = toRclName(basename(filename, extname(filename)))
  const headers   = rows[0].split(',').map(h => toRclName(h.trim()))
  const result: string[] = ['   ITEMS SECTION.', `      01 ${groupName}.`]

  for (let i = 1; i < rows.length; i++) {
    const cols     = rows[i].split(',')
    const itemName = `${groupName}-${i}`
    result.push(`         05 ${itemName}.`)
    headers.forEach((header, j) => {
      const fieldName = `${itemName}-${header}`
      const fieldVal  = safeValue((cols[j] ?? '').trim())
      result.push(`            10 ${fieldName} ${picFor(fieldVal)} VALUE "${fieldVal}".`)
    })
  }

  return result
}

// Returns true if t is a line that opens a multi-line VALUE string (not closed on same line).
// Used by pre-processors to skip lines inside VALUE "...multi-line...". content.
function opensMultilineValue(t: string): boolean {
  const idx = t.indexOf('VALUE "')
  if (idx === -1) return false
  // Single-line: VALUE "..." — ends with ". on same line
  return !t.trimEnd().endsWith('".')
}

function resolveDataLoads(source: string, dir: string): string {
  const lines  = source.split('\n')
  const result: string[] = []
  let inData   = false
  let inValue  = false

  for (const line of lines) {
    const t = line.trim()

    // Track multi-line VALUE strings — skip directive detection inside them
    if (inValue) {
      result.push(line)
      if (t.trimEnd().endsWith('".')) inValue = false
      continue
    }
    if (opensMultilineValue(t)) { inValue = true; result.push(line); continue }

    if (t.startsWith('DATA DIVISION')) { inData = true; result.push(line); continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('DATA DIVISION'))) {
      inData = false; result.push(line); continue
    }

    if (inData && t.startsWith('LOAD FROM')) {
      const match = t.match(/LOAD FROM\s+"([^"]+)"/)
      if (match) {
        const filePath = resolveFilePath(match[1], dir)
        const content  = readFileSync(filePath, 'utf-8')
        const ext      = extname(filePath).toLowerCase()
        if (ext === '.json') {
          result.push(...jsonToRclLines(JSON.parse(content) as Record<string, unknown>))
        } else if (ext === '.csv') {
          result.push(...csvToRclLines(content, basename(filePath)))
        }
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

function extractComponentContent(source: string): string[] {
  const lines = source.split('\n')
  const result: string[] = []
  let inComponent = false
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('COMPONENT DIVISION')) { inComponent = true; continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('COMPONENT DIVISION'))) {
      inComponent = false; continue
    }
    if (inComponent) result.push(line)
  }
  return result
}

function resolveComponentCopies(source: string, dir: string): string {
  const lines = source.split('\n')
  const result: string[] = []
  let inComponent = false
  let inValue     = false

  for (const line of lines) {
    const t = line.trim()

    if (inValue) {
      result.push(line)
      if (t.trimEnd().endsWith('".')) inValue = false
      continue
    }
    if (opensMultilineValue(t)) { inValue = true; result.push(line); continue }

    if (t.startsWith('COMPONENT DIVISION')) { inComponent = true; result.push(line); continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('COMPONENT DIVISION'))) {
      inComponent = false; result.push(line); continue
    }

    if (inComponent && t.startsWith('COPY FROM')) {
      const match = t.match(/COPY FROM\s+"([^"]+)"/)
      if (match) {
        const filePath = resolveFilePath(match[1], dir)
        const copySource = readFileSync(filePath, 'utf-8')
        result.push(...extractComponentContent(copySource))
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

function resolveThemeCopies(source: string, dir: string): string {
  const lines = source.split('\n')
  const result: string[] = []
  let inEnv   = false
  let inValue = false

  for (const line of lines) {
    const t = line.trim()

    if (inValue) {
      result.push(line)
      if (t.trimEnd().endsWith('".')) inValue = false
      continue
    }
    if (opensMultilineValue(t)) { inValue = true; result.push(line); continue }

    if (t.startsWith('ENVIRONMENT DIVISION')) { inEnv = true; result.push(line); continue }
    if (DIVISION_STARTS.some(d => t.startsWith(d) && !t.startsWith('ENVIRONMENT DIVISION'))) {
      inEnv = false; result.push(line); continue
    }

    if (inEnv && t.startsWith('COPY FROM')) {
      const match = t.match(/COPY FROM\s+"([^"]+)"/)
      if (match) {
        const filePath = resolveFilePath(match[1], dir)
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

// ─────────────────────────────────────────────────────────
// Plugin loading — LOAD PLUGIN @scope/pkg in ENVIRONMENT DIVISION
// ─────────────────────────────────────────────────────────

function extractPluginNames(source: string): string[] {
  const names: string[] = []
  for (const line of source.split('\n')) {
    const t = line.trim().replace(/\.$/, '')
    if (t.startsWith('LOAD PLUGIN ')) {
      const name = t.replace('LOAD PLUGIN ', '').trim()
      if (name) names.push(name)
    }
  }
  return names
}

function resolvePluginEntryPoint(pkgName: string, dir: string): string {
  let current = dir
  while (true) {
    const candidate = join(current, 'node_modules', pkgName)
    if (existsSync(candidate)) {
      const pkgJsonPath = join(candidate, 'package.json')
      if (existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
        const main =
          pkgJson.exports?.['.']?.import ??
          pkgJson.exports?.['.']?.default ??
          pkgJson.main ??
          'index.js'
        return join(candidate, main)
      }
      return join(candidate, 'index.js')
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  throw new Error(`Cannot resolve plugin: "${pkgName}" — is the package installed?`)
}

export async function loadPlugins(sourcePath: string): Promise<void> {
  const source = readFileSync(resolve(sourcePath), 'utf-8')
  const dir = dirname(resolve(sourcePath))
  const names = extractPluginNames(source)
  for (const name of names) {
    const entryPoint = resolvePluginEntryPoint(name, dir)
    await import(pathToFileURL(entryPoint).href)
  }
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
    const withTheme      = resolveThemeCopies(source, dirname(absInput))
    const withComponents = resolveComponentCopies(withTheme, dirname(absInput))
    const withData       = resolveDataLoads(withComponents, dirname(absInput))
    program = parse(withData)
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

// ─────────────────────────────────────────────────────────
// BUILD — compile an entire directory of .rcl files
// ─────────────────────────────────────────────────────────

export interface BuildResult {
  ok: boolean
  srcDir: string
  outDir: string
  compiled: CompileResult[]
  errors: CompileResult[]
}

function findRclFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findRclFiles(full))
    } else if (extname(entry) === '.rcl') {
      results.push(full)
    }
  }
  return results
}

export async function build(srcDir: string, outDir?: string): Promise<BuildResult> {
  const absSrc = resolve(srcDir)
  const absOut = resolve(outDir ?? 'public')

  const compiled: CompileResult[] = []
  const errors: CompileResult[] = []

  if (!existsSync(absSrc)) {
    return {
      ok: false,
      srcDir: absSrc,
      outDir: absOut,
      compiled,
      errors: [{ ok: false, inputPath: absSrc, error: `SOURCE DIRECTORY NOT FOUND: ${absSrc}` }],
    }
  }

  const files = findRclFiles(absSrc)

  if (files.length === 0) {
    return {
      ok: false,
      srcDir: absSrc,
      outDir: absOut,
      compiled,
      errors: [{ ok: false, inputPath: absSrc, error: `NO .rcl FILES FOUND IN: ${absSrc}` }],
    }
  }

  for (const file of files) {
    // Mirror the source directory structure in the output directory
    const rel = relative(absSrc, dirname(file))
    const fileOutDir = join(absOut, rel)
    mkdirSync(fileOutDir, { recursive: true })

    await loadPlugins(file)
    const result = compile(file, fileOutDir)
    if (result.ok) {
      compiled.push(result)
    } else {
      errors.push(result)
    }
  }

  return {
    ok: errors.length === 0,
    srcDir: absSrc,
    outDir: absOut,
    compiled,
    errors,
  }
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
    const withTheme      = resolveThemeCopies(source, dirname(absInput))
    const withComponents = resolveComponentCopies(withTheme, dirname(absInput))
    const withData       = resolveDataLoads(withComponents, dirname(absInput))
    const program = parse(withData)

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
