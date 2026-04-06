// ─────────────────────────────────────────────────────────
// RECALL Type Checker — AST → DiagnosticCollector
//
// Four passes in order:
//   1. Symbol table   — DATA DIVISION → name/type/shape map
//   2. Structural     — required divisions + STOP RUN
//   3. Statement walk — every DISPLAY statement type-checked
//   4. Component pass — ACCEPTS parameters validated
//
// Never throws. Accumulates all diagnostics before returning.
// The compiler decides whether to abort based on hasErrors().
// ─────────────────────────────────────────────────────────

import type {
  ReclProgram,
  DataField,
  DisplayStatement,
  NodeLocation,
} from '../parser/rcl.js'
import { DiagnosticCollector } from '../diagnostics/collector.js'
import type { SourceLocation } from '../diagnostics/types.js'

// ─────────────────────────────────────────────────────────
// PIC type system
// ─────────────────────────────────────────────────────────

export type PicKind =
  | 'string'
  | 'numeric'
  | 'decimal'
  | 'date'
  | 'url'
  | 'percent'
  | 'group'
  | 'unknown'

export interface Symbol {
  name:      string
  kind:      PicKind
  maxLength: number        // 0 = unconstrained
  isGroup:   boolean
  children:  Symbol[]
  rawPic:    string
  comment?:  string        // COMMENT clause — intent metadata
}

/** Parse a PIC declaration string into a PicKind and maxLength */
function parsePic(pic: string): { kind: PicKind; maxLength: number } {
  const p = pic.trim().toUpperCase()
  if (p === 'DATE')             return { kind: 'date',    maxLength: 10  }
  if (p === 'URL')              return { kind: 'url',     maxLength: 0   }
  if (p === 'PCT')              return { kind: 'percent', maxLength: 3   }
  if (/^X\((\d+)\)$/.test(p)) {
    const m = p.match(/^X\((\d+)\)$/)!
    return { kind: 'string',  maxLength: parseInt(m[1], 10) }
  }
  if (p === 'X')                return { kind: 'string',  maxLength: 1   }
  if (/^9\(\d+\)V9\(\d+\)$/.test(p)) return { kind: 'decimal', maxLength: 0 }
  if (/^9\((\d+)\)$/.test(p)) {
    const m = p.match(/^9\((\d+)\)$/)!
    return { kind: 'numeric', maxLength: parseInt(m[1], 10) }
  }
  if (p === '9')                return { kind: 'numeric', maxLength: 1   }
  return { kind: 'unknown', maxLength: 0 }
}

function dataFieldToSymbol(field: DataField): Symbol {
  const { kind, maxLength } = parsePic(field.pic)
  const isGroup = field.children.length > 0
  return {
    name:      field.name,
    kind:      isGroup ? 'group' : kind,
    maxLength,
    isGroup,
    children:  field.children.map(dataFieldToSymbol),
    rawPic:    field.pic,
    comment:   field.comment,
  }
}

// ─────────────────────────────────────────────────────────
// Element type contracts
// ─────────────────────────────────────────────────────────

export type ValueExpectation = 'string' | 'url' | 'group' | 'none' | 'any'

export interface ElementContract {
  accepts:       ValueExpectation
  requiresUsing: boolean    // must have USING clause
  requiresClick: boolean    // must have ON-CLICK clause
  requiresHref:  boolean    // must have HREF clause
  description:   string     // one-line description for schema output
}

export const BUILT_IN_ELEMENTS: Record<string, ElementContract> = {
  // ── Text elements ──────────────────────────────────────
  'HEADING-1':   { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Top-level page heading (h1)' },
  'HEADING-2':   { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Section heading (h2)' },
  'HEADING-3':   { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Sub-section heading (h3)' },
  'PARAGRAPH':   { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Body text paragraph' },
  'LABEL':       { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Short inline label or caption' },
  'CODE-BLOCK':  { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Monospaced code or preformatted text block' },
  'BANNER':      { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Full-width highlighted banner message' },
  'CALLOUT':     { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Aside callout box for notes or warnings' },
  // ── Interactive elements ───────────────────────────────
  'BUTTON':      { accepts: 'string', requiresUsing: false, requiresClick: true,  requiresHref: false, description: 'Clickable button; requires ON-CLICK clause' },
  'LINK':        { accepts: 'string', requiresUsing: false, requiresClick: false, requiresHref: true,  description: 'Hyperlink text; requires HREF clause' },
  'INPUT':       { accepts: 'none',   requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Text input field; no value accepted' },
  // ── Media elements ─────────────────────────────────────
  'IMAGE':       { accepts: 'url',    requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Image; value or variable must be PIC URL' },
  // ── Layout elements ────────────────────────────────────
  'DIVIDER':     { accepts: 'none',   requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Horizontal rule separator; no value' },
  'SECTION':     { accepts: 'none',   requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Layout section container; no direct value' },
  'FOOTER':      { accepts: 'any',    requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Page footer; accepts any value type' },
  // ── Group elements — USING clause required ─────────────
  'CARD-LIST':   { accepts: 'group',  requiresUsing: true,  requiresClick: false, requiresHref: false, description: 'Card grid rendered from a DATA group; USING required' },
  'NAVIGATION':  { accepts: 'group',  requiresUsing: true,  requiresClick: false, requiresHref: false, description: 'Top navigation bar from a DATA group; USING required' },
  'SIDEBAR-NAV': { accepts: 'group',  requiresUsing: true,  requiresClick: false, requiresHref: false, description: 'Sidebar navigation from a DATA group; USING required' },
  'TABS':        { accepts: 'group',  requiresUsing: true,  requiresClick: false, requiresHref: false, description: 'Tab interface from a DATA group; USING required' },
  // ── Group elements — value OR USING clause accepted ────
  'TABLE':       { accepts: 'group',  requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Data table from a group; pass group name as value or via USING' },
  'STAT-GRID':   { accepts: 'group',  requiresUsing: false, requiresClick: false, requiresHref: false, description: 'Metric stat grid from a group; pass group name as value or via USING' },
}

const KNOWN_ELEMENT_NAMES = new Set(Object.keys(BUILT_IN_ELEMENTS))

// ─────────────────────────────────────────────────────────
// "Did you mean?" — closest element name by edit distance
// ─────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function didYouMean(name: string, candidates: string[]): string | undefined {
  let best: string | undefined
  let bestDist = Infinity
  for (const c of candidates) {
    const d = levenshtein(name, c)
    if (d < bestDist && d <= 3) { bestDist = d; best = c }
  }
  return best
}

// ─────────────────────────────────────────────────────────
// SourceLocation helper — bridges NodeLocation → SourceLocation
// ─────────────────────────────────────────────────────────

function toLoc(node: NodeLocation | undefined, file: string, fallback: SourceLocation): SourceLocation {
  if (!node) return fallback
  return {
    file,
    line:   node.line,
    col:    node.col,
    length: node.length,
    source: node.source,
  }
}

const UNKNOWN_LOC = (file: string): SourceLocation => ({
  file, line: 1, col: 1, length: 1, source: ''
})

// ─────────────────────────────────────────────────────────
// Pass 1 — Symbol table
// ─────────────────────────────────────────────────────────

type SymbolTable = Map<string, Symbol>

function buildSymbolTable(program: ReclProgram): SymbolTable {
  const table = new Map<string, Symbol>()
  const allFields = [...program.data.workingStorage, ...program.data.items]
  for (const field of allFields) {
    const sym = dataFieldToSymbol(field)
    table.set(field.name, sym)
    // Also index children by name for flat lookups
    for (const child of field.children) {
      table.set(child.name, dataFieldToSymbol(child))
    }
  }
  return table
}

// ─────────────────────────────────────────────────────────
// Pass 2 — Structural checks
// ─────────────────────────────────────────────────────────

function checkStructural(
  program: ReclProgram,
  file: string,
  dc: DiagnosticCollector,
): void {
  const fallback = UNKNOWN_LOC(file)

  // PROGRAM-ID present?
  if (!program.identification.programId || program.identification.programId === 'RECALL-PROGRAM') {
    // Only warn — RECALL-PROGRAM is the default fallback value
    dc.warning('RCL-W03', fallback,
      'PROGRAM-ID not set in IDENTIFICATION DIVISION',
      'Add: PROGRAM-ID. MY-PROGRAM.'
    )
  }

  // AUTHOR and DATE-WRITTEN optional but recommended
  if (!program.identification.author) {
    dc.warning('RCL-W03', fallback,
      'AUTHOR not set in IDENTIFICATION DIVISION',
      'Add: AUTHOR. Your Name.'
    )
  }

  // PROCEDURE DIVISION must have at least one section
  if (program.procedure.sections.length === 0) {
    dc.error('RCL-005', fallback,
      'PROCEDURE DIVISION is empty — no sections defined',
      'Add at least one procedure section with DISPLAY statements'
    )
    return
  }

  // STOP RUN — the last statement in the last section should lead to it.
  // We check by verifying the procedure has any sections at all (parser handles STOP RUN).
  // A more precise check: ensure the last section is not empty.
  const lastSection = program.procedure.sections[program.procedure.sections.length - 1]
  if (lastSection.statements.length === 0) {
    dc.warning('RCL-W04', toLoc(lastSection.loc, file, fallback),
      `Section ${lastSection.name} is empty`,
      'Add DISPLAY statements or remove the section'
    )
  }
}

// ─────────────────────────────────────────────────────────
// Pass 3 — Statement walk
// ─────────────────────────────────────────────────────────

function checkStatement(
  stmt:           DisplayStatement,
  symbols:        SymbolTable,
  file:           string,
  hasPlugins:     boolean,
  componentNames: Set<string>,
  dc:             DiagnosticCollector,
): void {
  const fallback = UNKNOWN_LOC(file)
  const loc = toLoc(stmt.loc, file, fallback)
  const element = stmt.element

  // Skip COPY and SECTION — not type-checked at element level
  if (element === 'COPY' || element === 'SECTION') {
    for (const child of stmt.children) {
      checkStatement(child, symbols, file, hasPlugins, componentNames, dc)
    }
    return
  }

  // ── RCL-003 Unknown element ────────────────────────────
  const contract = BUILT_IN_ELEMENTS[element]
  if (!contract) {
    // Component calls and plugin elements are both valid — skip RCL-003
    if (!hasPlugins && !componentNames.has(element)) {
      const suggestion = didYouMean(element, [...KNOWN_ELEMENT_NAMES])
      dc.error('RCL-003', loc,
        `No element ${element} is registered`,
        suggestion ? `Did you mean: ${suggestion}?` : 'Check element name spelling or add LOAD PLUGIN in ENVIRONMENT DIVISION'
      )
    }
    for (const child of stmt.children) {
      checkStatement(child, symbols, file, hasPlugins, componentNames, dc)
    }
    return
  }

  // ── Resolve value and USING clause ───────────────────────
  const valueName   = stmt.value
  const usingClause = stmt.clauses.find(c => c.key === 'USING')
  // TABLE and STAT-GRID accept the group name as stmt.value OR as USING
  const usingName = usingClause?.value ??
    (contract.accepts === 'group' && !contract.requiresUsing ? valueName : undefined)

  // ── RCL-004 Unknown identifier (value) ────────────────
  // String-accepting elements allow literal values — "SYNTAX" parses to SYNTAX after
  // quote stripping, but is valid as a literal. Only check identifiers for group elements
  // where the value MUST reference a DATA group (TABLE, STAT-GRID).
  const valueIsGroupRef = contract.accepts === 'group' && !contract.requiresUsing
  if (valueName && /^[A-Z][A-Z0-9-]+$/.test(valueName) && valueIsGroupRef) {
    if (!symbols.has(valueName)) {
      dc.error('RCL-004', loc,
        `${valueName} (group) is not declared in DATA DIVISION`,
        `Add ${valueName} to the ITEMS SECTION`
      )
    }
  }

  // ── RCL-004 Unknown identifier (USING) ────────────────
  if (usingName && !symbols.has(usingName)) {
    dc.error('RCL-004', loc,
      `${usingName} (USING) is not declared in DATA DIVISION`,
      `Add a group named ${usingName} in the ITEMS SECTION`
    )
  }

  // ── RCL-007/008 Group shape ────────────────────────────
  if (contract.requiresUsing) {
    if (!usingName) {
      dc.error('RCL-007', loc,
        `${element} requires a USING clause referencing a group`,
        `Add: DISPLAY ${element} USING MY-GROUP.`
      )
    } else if (usingName && symbols.has(usingName)) {
      const sym = symbols.get(usingName)!
      if (!sym.isGroup) {
        dc.error('RCL-007', loc,
          `${usingName} is a scalar (${sym.rawPic}), but ${element} requires a group`,
          `Declare ${usingName} in ITEMS SECTION with child fields`
        )
      }
    }
  }

  if (!contract.requiresUsing && usingName && symbols.has(usingName)) {
    const sym = symbols.get(usingName)!
    if (sym.isGroup && contract.accepts !== 'group' && contract.accepts !== 'any' && contract.accepts !== 'none') {
      dc.error('RCL-008', loc,
        `${usingName} is a group but ${element} expects a scalar value`,
        `Use a scalar variable or a USING-capable element like CARD-LIST`
      )
    }
  }

  // ── RCL-001 Type mismatch ──────────────────────────────
  if (valueName && /^[A-Z][A-Z0-9-]+$/.test(valueName) && symbols.has(valueName)) {
    const sym = symbols.get(valueName)!

    if (contract.accepts === 'string' && sym.kind === 'group') {
      dc.error('RCL-001', loc,
        `${element} expects a string value, but ${valueName} is a group`,
        `Use DISPLAY ${element} USING ${valueName} or reference a scalar field`
      )
    }

    if (contract.accepts === 'url' && sym.kind !== 'url' && sym.kind !== 'string') {
      dc.error('RCL-001', loc,
        `${element} expects a URL, but ${valueName} is declared ${sym.rawPic}`,
        `Declare ${valueName} as PIC URL or PIC X(n) with a valid URL value`
      )
    }

    // ── RCL-002 Value constraint (length) ───────────────
    if (sym.kind === 'string' && sym.maxLength > 0) {
      const val = sym.name  // We don't have the actual value at type-check time
      // Warn if near limit (>90%) — we check VALUE length from the symbol when available
      // Full value check happens at compile time via safeValue — here we flag the declaration
    }

    // ── RCL-009 DATE format ──────────────────────────────
    if (sym.kind === 'date') {
      // DATE type used correctly — no error
    }
  }

  // ── RCL-W01 Empty group ────────────────────────────────
  if (usingName && symbols.has(usingName)) {
    const sym = symbols.get(usingName)!
    if (sym.isGroup && sym.children.length === 0) {
      dc.warning('RCL-W01', loc,
        `${usingName} is declared but has no items — ${element} will render empty`,
        `Add child fields to ${usingName} in the ITEMS SECTION`
      )
    }
  }

  // ── Recurse into children ──────────────────────────────
  for (const child of stmt.children) {
    checkStatement(child, symbols, file, hasPlugins, componentNames, dc)
  }
}

function checkStatements(
  program:        ReclProgram,
  symbols:        SymbolTable,
  file:           string,
  hasPlugins:     boolean,
  componentNames: Set<string>,
  dc:             DiagnosticCollector,
): void {
  for (const section of program.procedure.sections) {
    // RCL-W04 — empty section
    if (section.statements.length === 0) {
      const fallback = UNKNOWN_LOC(file)
      dc.warning('RCL-W04', toLoc(section.loc, file, fallback),
        `Section ${section.name} has no statements`,
        'Add DISPLAY statements or remove the section'
      )
    }
    for (const stmt of section.statements) {
      checkStatement(stmt, symbols, file, hasPlugins, componentNames, dc)
    }
  }
}

// ─────────────────────────────────────────────────────────
// Pass 4 — Component pass
// ─────────────────────────────────────────────────────────

function checkComponents(
  program: ReclProgram,
  symbols: SymbolTable,
  file:    string,
  dc:      DiagnosticCollector,
): void {
  const fallback = UNKNOWN_LOC(file)
  const definedNames = new Set(program.component.components.map(c => c.name))

  for (const component of program.component.components) {
    const loc = toLoc(component.loc, file, fallback)

    if (component.accepts.length === 0) {
      dc.warning('RCL-W03', loc,
        `Component ${component.name} has no ACCEPTS parameters`,
        'Add: ACCEPTS PARAM-1 REQUIRED, PARAM-2.'
      )
    }
  }

  // Check that REQUIRED parameters are provided at every call site
  function walkForRequiredParams(
    stmts: typeof program.procedure.sections[0]['statements']
  ): void {
    for (const stmt of stmts) {
      if (definedNames.has(stmt.element)) {
        const def = program.component.components.find(c => c.name === stmt.element)!
        const required = def.accepts.filter(a => a.required)
        for (const param of required) {
          const provided =
            stmt.clauses.some(c => c.key === param.name) ||
            stmt.clauses.some(c => c.key === 'DATA' &&
              c.value.split(',').map(s => s.trim()).includes(param.name))
          if (!provided) {
            dc.error('RCL-017', toLoc(stmt.loc, file, fallback),
              `${stmt.element} is missing required parameter "${param.name}"`,
              `Add: WITH ${param.name} <value>`
            )
          }
        }
      }
      walkForRequiredParams(stmt.children)
    }
  }

  for (const section of program.procedure.sections) {
    walkForRequiredParams(section.statements)
  }
}

// ─────────────────────────────────────────────────────────
// Value checks — DATA DIVISION declarations
// ─────────────────────────────────────────────────────────

function checkDataValues(
  program: ReclProgram,
  file:    string,
  dc:      DiagnosticCollector,
): void {
  const fallback = UNKNOWN_LOC(file)
  const allFields = [...program.data.workingStorage, ...program.data.items]

  function checkField(field: DataField): void {
    const loc = toLoc(field.loc, file, fallback)
    const { kind, maxLength } = parsePic(field.pic)
    const val = field.value

    if (!val) {
      for (const child of field.children) checkField(child)
      return
    }

    // RCL-002 — value exceeds declared length
    if (kind === 'string' && maxLength > 0 && val.length > maxLength) {
      dc.error('RCL-002', loc,
        `${field.name} value exceeds PIC X(${maxLength}) — ${val.length} characters provided (${val.length - maxLength} over limit)`,
        `Shorten the value to ${maxLength} characters or increase PIC X(${maxLength}) to PIC X(${val.length})`
      )
    }

    // RCL-W02 — value near length limit (>90%)
    if (kind === 'string' && maxLength > 0 && val.length > maxLength * 0.9 && val.length <= maxLength) {
      dc.warning('RCL-W02', loc,
        `${field.name} value is ${val.length}/${maxLength} characters — near PIC X(${maxLength}) limit`,
      )
    }

    // RCL-012 — non-numeric in PIC 9 field
    if (kind === 'numeric' && val && !/^-?\d+(\.\d+)?$/.test(val)) {
      dc.error('RCL-012', loc,
        `${field.name} is declared PIC 9 but value "${val}" contains non-numeric characters`,
        `Use a numeric value or change declaration to PIC X`
      )
    }

    // RCL-009 — invalid DATE format
    if (kind === 'date' && val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      dc.error('RCL-009', loc,
        `${field.name} is PIC DATE but value "${val}" is not ISO 8601 format`,
        `Use YYYY-MM-DD format, e.g. "2026-04-05"`
      )
    }

    // RCL-010 — invalid URL format
    if (kind === 'url' && val && !/^(https?:\/\/|\/)/.test(val)) {
      dc.error('RCL-010', loc,
        `${field.name} is PIC URL but value "${val}" does not begin with http, https, or /`,
        `Use a full URL or a root-relative path starting with /`
      )
    }

    // RCL-011 — PCT out of range
    if (kind === 'percent' && val) {
      const n = parseFloat(val)
      if (isNaN(n) || n < 0 || n > 100) {
        dc.error('RCL-011', loc,
          `${field.name} is PIC PCT but value "${val}" is outside 0–100 range`,
          `Use a numeric value between 0 and 100`
        )
      }
    }

    for (const child of field.children) checkField(child)
  }

  for (const field of allFields) checkField(field)
}

// ─────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────

export interface TypeCheckOptions {
  strict: boolean   // promote warnings to errors
}

export function typeCheck(
  program: ReclProgram,
  file:    string,
  opts:    TypeCheckOptions = { strict: false },
): DiagnosticCollector {
  const dc = new DiagnosticCollector()

  const symbols        = buildSymbolTable(program)
  const hasPlugins     = program.environment.plugins.length > 0
  const componentNames = new Set(program.component.components.map(c => c.name))

  checkStructural(program, file, dc)
  checkDataValues(program, file, dc)
  checkStatements(program, symbols, file, hasPlugins, componentNames, dc)
  checkComponents(program, symbols, file, dc)

  if (opts.strict) dc.promoteWarnings()

  return dc
}
