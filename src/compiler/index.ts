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
import { typeCheck } from '../typechecker/index.js'
import { printDiagnostics } from '../diagnostics/index.js'
import { DiagnosticCollector } from '../diagnostics/collector.js'
import type { DataDivision, ComponentDivision, DisplayStatement, EnvironmentDivision } from '../parser/rcl.js'
import type { SourceLocation } from '../diagnostics/types.js'

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
  // Replace " with ' (RECALL VALUE strings are delimited by "), then
  // encode newlines as literal \n so generated VALUE lines stay single-line.
  // The DATA parser processes one line at a time — multi-line VALUES only
  // yield the first line. Literal \n is what cal-source.ts split('\\n') expects.
  return val.replace(/"/g, "'").replace(/\r?\n/g, '\\n')
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

// ─────────────────────────────────────────────────────────
// LOAD FROM shape inspection — what fields would be generated
// Exported so recall check --inspect can show the shape report
// ─────────────────────────────────────────────────────────

export interface LoadFromEntry {
  directive: string     // raw LOAD FROM "..." line
  file:      string     // resolved absolute path
  ext:       string     // 'json' | 'csv'
  generated: string[]   // the RCL lines that were inlined
}

export interface DataLoadError {
  directive: string
  specifier: string    // the path as written in source
  code:      'RCL-019' | 'RCL-020'
  message:   string
}

export interface DataLoadResult {
  source:  string
  entries: LoadFromEntry[]   // successful loads
  errors:  DataLoadError[]   // structured failures
}

function resolveDataLoads(source: string, dir: string): DataLoadResult {
  const lines   = source.split('\n')
  const result: string[] = []
  const entries: LoadFromEntry[] = []
  const errors:  DataLoadError[] = []
  let inData  = false
  let inValue = false

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
        const specifier = match[1]
        let filePath: string
        try {
          filePath = resolveFilePath(specifier, dir)
        } catch {
          errors.push({
            directive: t,
            specifier,
            code:    'RCL-019',
            message: `LOAD FROM "${specifier}" — file not found`,
          })
          continue
        }

        let content: string
        try {
          content = readFileSync(filePath, 'utf-8')
        } catch {
          errors.push({
            directive: t,
            specifier,
            code:    'RCL-019',
            message: `LOAD FROM "${specifier}" — cannot read file: ${filePath}`,
          })
          continue
        }

        const ext = extname(filePath).toLowerCase()
        let generated: string[]
        try {
          if (ext === '.json') {
            generated = jsonToRclLines(JSON.parse(content) as Record<string, unknown>)
          } else if (ext === '.csv') {
            generated = csvToRclLines(content, basename(filePath))
          } else {
            errors.push({
              directive: t,
              specifier,
              code:    'RCL-020',
              message: `LOAD FROM "${specifier}" — unsupported format "${ext}", expected .json or .csv`,
            })
            continue
          }
        } catch {
          errors.push({
            directive: t,
            specifier,
            code:    'RCL-020',
            message: `LOAD FROM "${specifier}" — file is not valid ${ext === '.json' ? 'JSON' : 'CSV'}`,
          })
          continue
        }

        entries.push({ directive: t, file: filePath, ext: ext.slice(1), generated })
        result.push(...generated)
      }
    } else {
      result.push(line)
    }
  }

  return { source: result.join('\n'), entries, errors }
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
  warnings?: boolean   // true when warnings present (exit code 2)
}

export interface CheckResult {
  ok: boolean
  inputPath: string
  errors: string[]
  warnings?: boolean   // true when warnings present (exit code 2)
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

// ─────────────────────────────────────────────────────────
// INSPECT — show what LOAD FROM generates before compiling
// Used by: recall check --inspect
// ─────────────────────────────────────────────────────────

export interface InspectResult {
  ok:        boolean
  inputPath: string
  entries:   LoadFromEntry[]
  errors:    DataLoadError[]
}

export function inspect(inputPath: string): InspectResult {
  const absInput = resolve(inputPath)
  if (!existsSync(absInput)) {
    return { ok: false, inputPath: absInput, entries: [], errors: [] }
  }
  let source: string
  try {
    source = readFileSync(absInput, 'utf-8')
  } catch {
    return { ok: false, inputPath: absInput, entries: [], errors: [] }
  }
  try {
    const withTheme      = resolveThemeCopies(source, dirname(absInput))
    const withComponents = resolveComponentCopies(withTheme, dirname(absInput))
    const loadResult     = resolveDataLoads(withComponents, dirname(absInput))
    return {
      ok:        loadResult.errors.length === 0,
      inputPath: absInput,
      entries:   loadResult.entries,
      errors:    loadResult.errors,
    }
  } catch {
    return { ok: false, inputPath: absInput, entries: [], errors: [] }
  }
}

export function formatInspectReport(result: InspectResult): string {
  const lines: string[] = []
  const hr = '─'.repeat(60)

  if (result.errors.length > 0) {
    lines.push('LOAD FROM errors:')
    for (const err of result.errors) {
      lines.push(`  [${err.code}] ${err.message}`)
    }
    lines.push('')
  }

  if (result.entries.length === 0 && result.errors.length === 0) {
    lines.push('No LOAD FROM directives found in this file.')
    return lines.join('\n')
  }

  for (const entry of result.entries) {
    lines.push(`LOAD FROM "${entry.directive.replace(/^LOAD FROM\s+/, '')}"`)
    lines.push(hr)

    // Parse generated lines to build a readable shape summary
    let currentSection = ''
    let currentGroup = ''
    let currentItem = ''

    for (const line of entry.generated) {
      const t = line.trim()
      if (t === 'WORKING-STORAGE SECTION.' || t === 'WORKING-STORAGE SECTION') {
        currentSection = 'WORKING-STORAGE'
        lines.push('  WORKING-STORAGE:')
        continue
      }
      if (t === 'ITEMS SECTION.' || t === 'ITEMS SECTION') {
        currentSection = 'ITEMS'
        lines.push('  ITEMS:')
        continue
      }
      // Level 01 group (no PIC — has children)
      const groupMatch = t.match(/^01\s+([A-Z0-9-]+)\.$/)
      if (groupMatch) {
        currentGroup = groupMatch[1]
        currentItem = ''
        lines.push(`    ${currentGroup}  (group)`)
        continue
      }
      // Level 01 scalar (has PIC)
      const scalarMatch = t.match(/^01\s+([A-Z0-9-]+)\s+(PIC [^\s]+)\s+VALUE/)
      if (scalarMatch) {
        lines.push(`    ${scalarMatch[1].padEnd(28)} ${scalarMatch[2]}`)
        continue
      }
      // Level 05 sub-group item
      const itemMatch = t.match(/^05\s+([A-Z0-9-]+)\.$/)
      if (itemMatch) {
        currentItem = itemMatch[1]
        lines.push(`      ${currentItem}`)
        continue
      }
      // Level 10 field
      const fieldMatch = t.match(/^10\s+([A-Z0-9-]+)\s+(PIC [^\s]+)\s+VALUE/)
      if (fieldMatch) {
        lines.push(`        ${fieldMatch[1].padEnd(26)} ${fieldMatch[2]}`)
      }
    }
    lines.push('')
    lines.push(`  ${entry.generated.length} generated line(s) from ${entry.file}`)
    lines.push('')
  }

  return lines.join('\n')
}

export interface CompileOptions {
  strict?: boolean
}

export function compile(inputPath: string, outDir?: string, opts: CompileOptions = {}): CompileResult {
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
  const fileFallback: SourceLocation = { file: absInput, line: 1, col: 1, length: 1, source: '' }

  try {
    const withTheme      = resolveThemeCopies(source, dirname(absInput))
    const withComponents = resolveComponentCopies(withTheme, dirname(absInput))
    const loadResult     = resolveDataLoads(withComponents, dirname(absInput))

    // ── LOAD FROM errors — abort before parse ─────────────
    if (loadResult.errors.length > 0) {
      const loadDc = new DiagnosticCollector()
      for (const err of loadResult.errors) {
        loadDc.error(err.code, fileFallback, err.message,
          'Verify the file path is correct relative to the .rcl source file'
        )
      }
      printDiagnostics(loadDc)
      return { ok: false, inputPath: absInput, error: 'LOAD FROM errors — no output written' }
    }

    program = parse(loadResult.source)
    resolveIncludes(program, dirname(absInput))
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `PARSE ERROR: ${(err as Error).message}` }
  }

  // ── Type check — collect all diagnostics before generating ──
  const dc = typeCheck(program, absInput, { strict: opts.strict ?? false })
  if (dc.hasErrors() || dc.hasWarnings()) printDiagnostics(dc)
  if (dc.hasErrors()) {
    return { ok: false, inputPath: absInput, error: 'Type errors found — no output written' }
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

  return { ok: true, inputPath: absInput, outputPath, warnings: dc.hasWarnings() }
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

export interface CheckOptions {
  strict?:     boolean
  formatJson?: boolean
}

export function check(inputPath: string, opts: CheckOptions = {}): CheckResult {
  const absInput = resolve(inputPath)

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

  const fileFallback: SourceLocation = { file: absInput, line: 1, col: 1, length: 1, source: '' }

  try {
    const withTheme      = resolveThemeCopies(source, dirname(absInput))
    const withComponents = resolveComponentCopies(withTheme, dirname(absInput))
    const loadResult     = resolveDataLoads(withComponents, dirname(absInput))

    // ── LOAD FROM errors ──────────────────────────────────
    if (loadResult.errors.length > 0) {
      const loadDc = new DiagnosticCollector()
      for (const err of loadResult.errors) {
        loadDc.error(err.code, fileFallback, err.message,
          'Verify the file path is correct relative to the .rcl source file'
        )
      }
      if (opts.formatJson) {
        process.stdout.write(JSON.stringify({ file: absInput, ...loadDc.toJSON() }, null, 2) + '\n')
      } else {
        printDiagnostics(loadDc)
      }
      return {
        ok: false,
        inputPath: absInput,
        errors: loadResult.errors.map(e => `[${e.code}] ${e.message}`),
      }
    }

    const program = parse(loadResult.source)
    const dc      = typeCheck(program, absInput, { strict: opts.strict ?? false })

    if (opts.formatJson) {
      process.stdout.write(JSON.stringify({ file: absInput, ...dc.toJSON() }, null, 2) + '\n')
    } else {
      printDiagnostics(dc)
    }

    return {
      ok:        !dc.hasErrors(),
      inputPath: absInput,
      errors:    dc.errors().map(d => `[${d.code}] ${d.message}: ${d.why}`),
      warnings:  dc.hasWarnings(),
    }
  } catch (err) {
    return { ok: false, inputPath: absInput, errors: [`PARSE ERROR: ${(err as Error).message}`] }
  }
}
