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
// VALUE BLOCK — multi-line string literals (C# 11 raw strings inspiration)
//
// Syntax:
//   01 BODY-TEXT PIC X VALUE BLOCK.
//      This content spans multiple lines.
//      No escaping required.
//   END VALUE.
//
// - PIC X with no size is auto-sized to actual content length.
// - PIC X(n) is kept as-is; RCL-002 fires if content exceeds n.
// - Lines are joined with \n (same encoding as LOAD FROM values).
// - Runs before resolveDataLoads so BLOCK values appear as normal fields.
// ─────────────────────────────────────────────────────────

function resolveBlockValues(source: string): string {
  const lines = source.split('\n')
  const result: string[] = []
  let inBlock = false
  let blockDecl = ''      // the full declaration line before VALUE BLOCK.
  let blockIndent = ''    // leading whitespace to restore
  let blockContent: string[] = []

  for (const line of lines) {
    const t = line.trim()

    if (inBlock) {
      if (t === 'END VALUE.' || t === 'END VALUE') {
        // Join lines and encode as a safe single-line VALUE string
        const content  = blockContent.join('\n').trim()
        const safe     = content.replace(/"/g, "'").replace(/\r?\n/g, '\\n')
        // Auto-size with 20% headroom so RCL-W02 doesn't fire on auto-sized fields
        const autoSizeN = Math.ceil(safe.length * 1.2)
        const autoSize  = blockDecl.replace(
          /\bPIC\s+X\b(?!\s*\()/,
          `PIC X(${autoSizeN})`
        )
        const resolved = autoSize.replace(
          /\bVALUE\s+BLOCK\.?\s*$/,
          `VALUE "${safe}".`
        )
        result.push(blockIndent + resolved.trimStart())
        inBlock = false
        blockContent = []
        blockDecl = ''
        blockIndent = ''
      } else {
        // Preserve content lines — strip leading indent beyond field indent
        blockContent.push(t)
      }
      continue
    }

    // Only match VALUE BLOCK when the keyword is NOT inside a quoted VALUE string.
    // A line like: 01 FOO PIC X(100) VALUE "... PIC X VALUE BLOCK.  contains VALUE " before
    // the match — that means VALUE BLOCK is inside a string literal, not a real declaration.
    const blockMatch = /\bVALUE\s+BLOCK\.?\s*$/.exec(t)
    if (blockMatch && !t.slice(0, blockMatch.index).includes('"')) {
      inBlock = true
      blockDecl = t
      blockIndent = line.match(/^(\s*)/)?.[1] ?? ''
      blockContent = []
      continue
    }

    result.push(line)
  }

  return result.join('\n')
}

// ─────────────────────────────────────────────────────────
// RECORD types — reusable repeating group shapes (C# 10 records inspiration)
//
// Syntax — define a shape once:
//   RECORD DIMENSION-ROW.
//      10 DIM-CODE    PIC X(10).
//      10 DIM-NAME    PIC X(50).
//      10 DIM-SCORE   PIC 9(2).
//   END RECORD.
//
// Use it in ITEMS SECTION:
//   01 DIMENSIONS RECORD DIMENSION-ROW ROWS 6.
//
// Expands to:
//   01 DIMENSIONS.
//      05 DIMENSIONS-1.
//         10 DIMENSIONS-1-DIM-CODE  PIC X(10).
//         ...
//      05 DIMENSIONS-6.
//         10 DIMENSIONS-6-DIM-CODE  PIC X(10).
//
// Field naming: GROUP-N-FIELDNAME  (e.g. DIMENSIONS-1-DIM-CODE)
// RECORD blocks can appear anywhere in DATA DIVISION — they are removed from
// output and only their expansions appear.
// ─────────────────────────────────────────────────────────

export interface RecordExpansionError {
  line:     string
  code:     'RCL-021'
  message:  string
}

export interface RecordResult {
  source: string
  errors: RecordExpansionError[]
}

function resolveRecordTypes(source: string): RecordResult {
  const lines  = source.split('\n')
  const shapes = new Map<string, string[]>()   // shapeName -> field lines (trimmed)
  const errors: RecordExpansionError[] = []

  // ── Pass 1: collect RECORD shape definitions ─────────────
  let inRecord     = false
  let inValueStr   = false   // skip content inside multi-line VALUE strings
  let shapeName = ''
  let shapeFields: string[] = []
  const stripped: string[] = []

  for (const line of lines) {
    const t = line.trim()

    // Track multi-line VALUE strings — never process RECORD syntax inside them
    if (inValueStr) {
      stripped.push(line)
      if (t.endsWith('".')) inValueStr = false
      continue
    }
    if (t.includes('VALUE "') && !t.endsWith('".')) {
      inValueStr = true
      stripped.push(line)
      continue
    }

    if (inRecord) {
      if (t === 'END RECORD.' || t === 'END RECORD') {
        shapes.set(shapeName, [...shapeFields])
        inRecord = false
        shapeName = ''
        shapeFields = []
      } else if (t && !t.startsWith('*')) {
        shapeFields.push(t)
      }
      continue   // RECORD blocks are consumed — not emitted
    }

    const m = t.match(/^RECORD\s+([A-Z][A-Z0-9-]+)\.?$/)
    if (m) {
      inRecord   = true
      shapeName  = m[1]
      shapeFields = []
      continue
    }

    stripped.push(line)
  }

  // ── Pass 2: expand RECORD uses ────────────────────────────
  const result: string[] = []
  let inValueStr2 = false   // skip content inside multi-line VALUE strings

  for (const line of stripped) {
    const t = line.trim()
    const indent = line.match(/^(\s*)/)?.[1] ?? ''

    // Track multi-line VALUE strings — never expand RECORD uses inside them
    if (inValueStr2) {
      result.push(line)
      if (t.endsWith('".')) inValueStr2 = false
      continue
    }
    if (t.includes('VALUE "') && !t.endsWith('".')) {
      inValueStr2 = true
      result.push(line)
      continue
    }

    // 01 GROUP RECORD SHAPE-NAME ROWS n.
    const useMatch = t.match(
      /^01\s+([A-Z][A-Z0-9-]+)\s+RECORD\s+([A-Z][A-Z0-9-]+)\s+ROWS\s+(\d+)\.?$/
    )

    if (useMatch) {
      const [, groupName, refShape, rowsStr] = useMatch
      const rows   = parseInt(rowsStr, 10)
      const fields = shapes.get(refShape)

      if (!fields) {
        errors.push({
          line:    t,
          code:    'RCL-021',
          message: `RECORD "${refShape}" is not defined — declare it with RECORD ${refShape}. ... END RECORD. in DATA DIVISION`,
        })
        // Emit a bare group so the rest of the parse doesn't break
        result.push(`${indent}01 ${groupName}.`)
        continue
      }

      result.push(`${indent}01 ${groupName}.`)
      for (let i = 1; i <= rows; i++) {
        const itemName = `${groupName}-${i}`
        result.push(`${indent}   05 ${itemName}.`)
        for (const field of fields) {
          // field: "10 DIM-CODE PIC X(10)." → "10 ITEM-NAME-DIM-CODE PIC X(10)."
          const expanded = field.replace(
            /^(\d+\s+)([A-Z][A-Z0-9-]+)(\s+)/,
            (_match, level, fieldName, space) =>
              `${level}${itemName}-${fieldName}${space}`
          )
          result.push(`${indent}      ${expanded}`)
        }
      }
      continue
    }

    result.push(line)
  }

  return { source: result.join('\n'), errors }
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

function resolveComponentCopies(source: string, dir: string, seen: Set<string> = new Set()): string {
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
        const filePath = resolve(resolveFilePath(match[1], dir))
        // ── RCL-018: circular COPY detection ────────────────
        if (seen.has(filePath)) {
          throw new Error(`[RCL-018] Circular COPY detected: "${match[1]}" is already being included`)
        }
        const nextSeen = new Set(seen).add(filePath)
        const copySource = readFileSync(filePath, 'utf-8')
        result.push(...extractComponentContent(resolveComponentCopies(copySource, dirname(filePath), nextSeen)))
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

function resolveThemeCopies(source: string, dir: string, seen: Set<string> = new Set()): string {
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
        const filePath = resolve(resolveFilePath(match[1], dir))
        // ── RCL-018: circular COPY detection ────────────────
        if (seen.has(filePath)) {
          throw new Error(`[RCL-018] Circular COPY detected: "${match[1]}" is already being included`)
        }
        const nextSeen = new Set(seen).add(filePath)
        const themeSource = readFileSync(filePath, 'utf-8')
        result.push(...extractEnvContent(resolveThemeCopies(themeSource, dirname(filePath), nextSeen)))
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
  warningMessages: string[]   // formatted warning strings, same shape as errors
  warnings?: boolean          // true when warnings present (exit code 2)
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
// parseFromSource — run full preprocessor pipeline on an in-memory source string
// Useful when the source is NOT on disk (e.g. old git version retrieved via git show).
// baseDir is used to resolve COPY FROM / LOAD FROM paths — typically dirname(absFile).
// ─────────────────────────────────────────────────────────

export function parseFromSource(source: string, baseDir: string): ReturnType<typeof parse> {
  const withTheme      = resolveThemeCopies(source, baseDir)
  const withComponents = resolveComponentCopies(withTheme, baseDir)
  const withBlocks     = resolveBlockValues(withComponents)
  const recordResult   = resolveRecordTypes(withBlocks)
  const loadResult     = resolveDataLoads(recordResult.source, baseDir)
  return parse(loadResult.source)
}

// ─────────────────────────────────────────────────────────
// INSPECT — show what LOAD FROM generates before compiling
// Used by: recall check --inspect
// ─────────────────────────────────────────────────────────

export interface FieldComment {
  name:    string
  pic:     string
  section: 'working-storage' | 'items'
  comment: string
}

export interface InspectResult {
  ok:            boolean
  inputPath:     string
  entries:       LoadFromEntry[]
  errors:        DataLoadError[]
  fieldComments: FieldComment[]   // only fields that have a COMMENT clause
  program?:      ReturnType<typeof parse>  // parsed program (available when parse succeeds)
}

export function inspect(inputPath: string): InspectResult {
  const absInput = resolve(inputPath)
  const empty = { ok: false, inputPath: absInput, entries: [], errors: [], fieldComments: [] }
  if (!existsSync(absInput)) return empty
  let source: string
  try {
    source = readFileSync(absInput, 'utf-8')
  } catch {
    return empty
  }
  try {
    const withTheme      = resolveThemeCopies(source, dirname(absInput))
    const withComponents = resolveComponentCopies(withTheme, dirname(absInput))
    const withBlocks     = resolveBlockValues(withComponents)
    const recordResult   = resolveRecordTypes(withBlocks)
    const loadResult     = resolveDataLoads(recordResult.source, dirname(absInput))

    // Parse to extract COMMENT clauses from manually declared DATA fields
    const program = parse(loadResult.source)
    const fieldComments: FieldComment[] = []

    function collectComments(fields: ReturnType<typeof parse>['data']['workingStorage'], section: FieldComment['section']): void {
      for (const field of fields) {
        if (field.comment) {
          fieldComments.push({ name: field.name, pic: field.pic, section, comment: field.comment })
        }
        collectComments(field.children, section)
      }
    }

    collectComments(program.data.workingStorage, 'working-storage')
    collectComments(program.data.items, 'items')

    return {
      ok:            loadResult.errors.length === 0 && recordResult.errors.length === 0,
      inputPath:     absInput,
      entries:       loadResult.entries,
      errors:        loadResult.errors,
      fieldComments,
      program,
    }
  } catch {
    return empty
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

  // ── FIELD INTENT — only shown when COMMENT clauses are present ──
  if (result.fieldComments.length > 0) {
    lines.push('FIELD INTENT')
    lines.push(hr)
    for (const f of result.fieldComments) {
      lines.push(`  ${f.name.padEnd(30)} ${f.pic.padEnd(14)} ${f.comment}`)
    }
    lines.push('')
  }

  if (result.entries.length === 0 && result.errors.length === 0) {
    if (result.fieldComments.length === 0) {
      lines.push('No LOAD FROM directives or COMMENT clauses found in this file.')
    }
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
    const withBlocks     = resolveBlockValues(withComponents)
    const recordResult   = resolveRecordTypes(withBlocks)
    const loadResult     = resolveDataLoads(recordResult.source, dirname(absInput))

    // ── RECORD errors — abort before parse ────────────────
    if (recordResult.errors.length > 0) {
      const recDc = new DiagnosticCollector()
      for (const err of recordResult.errors) {
        recDc.error(err.code, fileFallback, err.message,
          'Define the RECORD shape in DATA DIVISION before using it'
        )
      }
      printDiagnostics(recDc)
      return { ok: false, inputPath: absInput, error: 'RECORD errors — no output written' }
    }

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
  quiet?:      boolean  // suppress all output; rely on exit code only
}

export function check(inputPath: string, opts: CheckOptions = {}): CheckResult {
  const absInput = resolve(inputPath)

  if (!existsSync(absInput)) {
    return { ok: false, inputPath: absInput, errors: [`FILE NOT FOUND: ${absInput}`], warningMessages: [] }
  }

  if (!absInput.endsWith('.rcl')) {
    return { ok: false, inputPath: absInput, errors: ['NOT A RECALL SOURCE FILE. EXPECTED .rcl EXTENSION.'], warningMessages: [] }
  }

  let source: string
  try {
    source = readFileSync(absInput, 'utf-8')
  } catch (err) {
    return { ok: false, inputPath: absInput, errors: [`CANNOT READ FILE: ${(err as Error).message}`], warningMessages: [] }
  }

  const fileFallback: SourceLocation = { file: absInput, line: 1, col: 1, length: 1, source: '' }

  try {
    const withTheme      = resolveThemeCopies(source, dirname(absInput))
    const withComponents = resolveComponentCopies(withTheme, dirname(absInput))
    const withBlocks     = resolveBlockValues(withComponents)
    const recordResult   = resolveRecordTypes(withBlocks)
    const loadResult     = resolveDataLoads(recordResult.source, dirname(absInput))

    // ── RECORD errors ─────────────────────────────────────
    if (recordResult.errors.length > 0) {
      const recDc = new DiagnosticCollector()
      for (const err of recordResult.errors) {
        recDc.error(err.code, fileFallback, err.message,
          'Define the RECORD shape in DATA DIVISION before using it'
        )
      }
      if (!opts.quiet) {
        if (opts.formatJson) {
          process.stdout.write(JSON.stringify({ file: absInput, ...recDc.toJSON() }, null, 2) + '\n')
        } else {
          printDiagnostics(recDc)
        }
      }
      return {
        ok: false,
        inputPath: absInput,
        errors: recordResult.errors.map(e => `[${e.code}] ${e.message}`),
        warningMessages: [],
      }
    }

    // ── LOAD FROM errors ──────────────────────────────────
    if (loadResult.errors.length > 0) {
      const loadDc = new DiagnosticCollector()
      for (const err of loadResult.errors) {
        loadDc.error(err.code, fileFallback, err.message,
          'Verify the file path is correct relative to the .rcl source file'
        )
      }
      if (!opts.quiet) {
        if (opts.formatJson) {
          process.stdout.write(JSON.stringify({ file: absInput, ...loadDc.toJSON() }, null, 2) + '\n')
        } else {
          printDiagnostics(loadDc)
        }
      }
      return {
        ok: false,
        inputPath: absInput,
        errors: loadResult.errors.map(e => `[${e.code}] ${e.message}`),
        warningMessages: [],
      }
    }

    const program = parse(loadResult.source)
    const dc      = typeCheck(program, absInput, { strict: opts.strict ?? false })

    if (!opts.quiet) {
      if (opts.formatJson) {
        // Collect fields that have COMMENT clauses for the intent block
        const commentedFields: { name: string; pic: string; section: string; comment: string }[] = []
        function gatherComments(fields: typeof program.data.workingStorage, section: string): void {
          for (const f of fields) {
            if (f.comment) commentedFields.push({ name: f.name, pic: f.pic, section, comment: f.comment })
            gatherComments(f.children, section)
          }
        }
        gatherComments(program.data.workingStorage, 'working-storage')
        gatherComments(program.data.items, 'items')

        const out: Record<string, unknown> = { file: absInput, ...dc.toJSON() }
        if (commentedFields.length > 0) out['fieldIntent'] = commentedFields
        process.stdout.write(JSON.stringify(out, null, 2) + '\n')
      } else {
        printDiagnostics(dc)
      }
    }

    return {
      ok:              !dc.hasErrors(),
      inputPath:       absInput,
      errors:          dc.errors().map(d => `[${d.code}] ${d.message}: ${d.why}`),
      warningMessages: dc.warnings().map(d => `[${d.code}] ${d.message}: ${d.why}`),
      warnings:        dc.hasWarnings(),
    }
  } catch (err) {
    const msg = (err as Error).message ?? String(err)
    // ── RCL-018: circular COPY ──────────────────────────────────────────────────
    if (msg.startsWith('[RCL-018]')) {
      const copyDc = new DiagnosticCollector()
      copyDc.error('RCL-018', fileFallback,
        msg.replace('[RCL-018] ', ''),
        'Break the cycle: ensure no .rcpy file directly or indirectly includes itself'
      )
      if (!opts.quiet) {
        if (opts.formatJson) {
          process.stdout.write(JSON.stringify({ file: absInput, ...copyDc.toJSON() }, null, 2) + '\n')
        } else {
          printDiagnostics(copyDc)
        }
      }
      return { ok: false, inputPath: absInput, errors: [msg], warningMessages: [] }
    }
    // ── RCL-015: COPY FROM path unresolvable — convert to structured diagnostic ──
    const isCopyError = /cannot resolve package path|ENOENT|no such file/i.test(msg)
    if (isCopyError) {
      const copyDc = new DiagnosticCollector()
      copyDc.error('RCL-015', fileFallback,
        `COPY FROM path could not be resolved: ${msg}`,
        'Check that the path is correct relative to the .rcl source file, or that the npm package is installed'
      )
      if (!opts.quiet) {
        if (opts.formatJson) {
          process.stdout.write(JSON.stringify({ file: absInput, ...copyDc.toJSON() }, null, 2) + '\n')
        } else {
          printDiagnostics(copyDc)
        }
      }
      return { ok: false, inputPath: absInput, errors: [`[RCL-015] ${msg}`], warningMessages: [] }
    }
    return { ok: false, inputPath: absInput, errors: [`PARSE ERROR: ${msg}`], warningMessages: [] }
  }
}
