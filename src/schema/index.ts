// ─────────────────────────────────────────────────────────
// RECALL Schema — machine-readable language definition
//
// Designed for consumption by Claude (or any AI agent) before
// generating .rcl source. Run: recall schema --json
// ─────────────────────────────────────────────────────────

import { BUILT_IN_ELEMENTS } from '../typechecker/index.js'
import type { ValueExpectation } from '../typechecker/index.js'

// ─────────────────────────────────────────────────────────
// PIC types
// ─────────────────────────────────────────────────────────

export interface PicTypeEntry {
  syntax:      string
  kind:        string
  description: string
  example:     string
  notes:       string
}

const PIC_TYPES: PicTypeEntry[] = [
  {
    syntax:      'PIC X(n)',
    kind:        'string',
    description: 'Fixed-width string field, maximum n characters',
    example:     '01 PAGE-TITLE PIC X(80) VALUE "Dashboard".',
    notes:       'RCL-002 fires if the assigned value exceeds n characters',
  },
  {
    syntax:      'PIC 9(n)',
    kind:        'numeric',
    description: 'Numeric field, maximum n digits',
    example:     '01 REVENUE PIC 9(12) VALUE "4800000".',
    notes:       'RCL-012 fires if the value contains non-numeric characters',
  },
  {
    syntax:      'PIC 9(n)V9(m)',
    kind:        'decimal',
    description: 'Decimal field with n integer digits and m decimal digits',
    example:     '01 MARGIN PIC 9(3)V9(2) VALUE "18.40".',
    notes:       'Rendered as-is; no rounding applied by compiler',
  },
  {
    syntax:      'PIC DATE',
    kind:        'date',
    description: 'ISO 8601 date string (YYYY-MM-DD)',
    example:     '01 PUBLISHED PIC DATE VALUE "2026-04-05".',
    notes:       'RCL-009 fires if value does not match YYYY-MM-DD format',
  },
  {
    syntax:      'PIC URL',
    kind:        'url',
    description: 'URL string; must begin with http, https, or /',
    example:     '01 HERO-IMG PIC URL VALUE "https://example.com/hero.jpg".',
    notes:       'RCL-010 fires if value is not a valid URL or root-relative path',
  },
  {
    syntax:      'PIC PCT',
    kind:        'percent',
    description: 'Percentage value between 0 and 100',
    example:     '01 GROWTH PIC PCT VALUE "42".',
    notes:       'RCL-011 fires if value is outside 0–100 range',
  },
]

// ─────────────────────────────────────────────────────────
// Divisions
// ─────────────────────────────────────────────────────────

export interface DivisionEntry {
  name:        string
  required:    boolean
  description: string
  keyClauses:  string[]
}

const DIVISIONS: DivisionEntry[] = [
  {
    name:        'IDENTIFICATION DIVISION',
    required:    true,
    description: 'Document metadata: title, author, program ID, description, favicon, language',
    keyClauses:  ['PROGRAM-ID', 'AUTHOR', 'DATE-WRITTEN', 'PAGE-TITLE', 'DESCRIPTION', 'FAVICON', 'LANGUAGE'],
  },
  {
    name:        'ENVIRONMENT DIVISION',
    required:    false,
    description: 'Rendering environment: viewport, color mode, fonts, palette, style overrides, plugins',
    keyClauses:  ['VIEWPORT', 'COLOR-MODE', 'FONT-PRIMARY', 'FONT-SECONDARY', 'PALETTE', 'LOAD PLUGIN', 'COPY FROM'],
  },
  {
    name:        'DATA DIVISION',
    required:    false,
    description: 'Data declarations: scalar variables (WORKING-STORAGE) and groups (ITEMS)',
    keyClauses:  ['WORKING-STORAGE SECTION', 'ITEMS SECTION', 'LOAD FROM', '01/05/10 level numbers', 'PIC', 'VALUE'],
  },
  {
    name:        'COMPONENT DIVISION',
    required:    false,
    description: 'Reusable component definitions; each DEFINE block becomes a callable component',
    keyClauses:  ['DEFINE', 'ACCEPTS', 'COPY FROM'],
  },
  {
    name:        'PROCEDURE DIVISION',
    required:    true,
    description: 'Layout and rendering logic: sections containing DISPLAY statements',
    keyClauses:  ['SECTION', 'DISPLAY', 'USING', 'ON-CLICK', 'HREF', 'COPY', 'STOP RUN'],
  },
]

// ─────────────────────────────────────────────────────────
// Schema output types
// ─────────────────────────────────────────────────────────

export interface ElementSchemaEntry {
  name:          string
  accepts:       ValueExpectation
  requiresUsing: boolean
  requiresClick: boolean
  requiresHref:  boolean
  description:   string
}

export interface RecallSchema {
  language:    string
  version:     string
  description: string
  elements:    ElementSchemaEntry[]
  picTypes:    PicTypeEntry[]
  divisions:   DivisionEntry[]
  notes:       string[]
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export function getSchema(version = '0.2.0'): RecallSchema {
  const elements: ElementSchemaEntry[] = Object.entries(BUILT_IN_ELEMENTS).map(
    ([name, contract]) => ({
      name,
      accepts:       contract.accepts,
      requiresUsing: contract.requiresUsing,
      requiresClick: contract.requiresClick,
      requiresHref:  contract.requiresHref,
      description:   contract.description,
    })
  )

  return {
    language:    'RECALL',
    version,
    description: 'RECALL — COBOL-inspired declarative web publishing language. .rcl source compiles to self-contained HTML.',
    elements,
    picTypes:    PIC_TYPES,
    divisions:   DIVISIONS,
    notes: [
      'Field names in DATA DIVISION are UPPER-CASE-HYPHENATED (e.g. PAGE-TITLE, not pageTitle)',
      'LOAD FROM "file.json" auto-generates DATA fields — keys are uppercased and hyphens replace non-alphanumeric chars',
      'Group elements (accepts: "group") render collections; scalar elements (accepts: "string") render single values',
      'USING clause references a DATA group by name; value clause passes a literal string or variable name',
      'Elements with requiresUsing: true MUST have a USING clause pointing to a group in ITEMS SECTION',
      'TABLE and STAT-GRID accept the group name as a plain value OR via USING — both are valid',
      'Run `recall check src/file.rcl --inspect` to see what LOAD FROM generated before writing DISPLAY statements',
    ],
  }
}

// ─────────────────────────────────────────────────────────
// Human-readable text renderer
// ─────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  return s.padEnd(n)
}

export function formatSchema(schema: RecallSchema): string {
  const lines: string[] = []
  const hr = '─'.repeat(60)

  lines.push(`RECALL Language Schema  v${schema.version}`)
  lines.push(hr)
  lines.push(schema.description)
  lines.push('')

  // ── Elements ──────────────────────────────────────────
  lines.push('BUILT-IN ELEMENTS')
  lines.push(hr)
  lines.push(`${pad('ELEMENT', 14)} ${pad('ACCEPTS', 8)} ${pad('USING?', 7)} ${pad('CLICK?', 7)} ${pad('HREF?', 6)} DESCRIPTION`)
  lines.push(`${pad('', 14)} ${pad('', 8)} ${pad('', 7)} ${pad('', 7)} ${pad('', 6)} `)

  for (const el of schema.elements) {
    const using  = el.requiresUsing ? 'req'   : '—'
    const click  = el.requiresClick ? 'req'   : '—'
    const href   = el.requiresHref  ? 'req'   : '—'
    lines.push(
      `${pad(el.name, 14)} ${pad(el.accepts, 8)} ${pad(using, 7)} ${pad(click, 7)} ${pad(href, 6)} ${el.description}`
    )
  }
  lines.push('')

  // ── PIC Types ─────────────────────────────────────────
  lines.push('PIC TYPE SYSTEM')
  lines.push(hr)
  for (const p of schema.picTypes) {
    lines.push(`${pad(p.syntax, 18)} ${p.description}`)
    lines.push(`${pad('', 18)} Example: ${p.example}`)
    lines.push(`${pad('', 18)} Note:    ${p.notes}`)
    lines.push('')
  }

  // ── Divisions ─────────────────────────────────────────
  lines.push('DIVISIONS')
  lines.push(hr)
  for (const d of schema.divisions) {
    const req = d.required ? '[required]' : '[optional]'
    lines.push(`${d.name}  ${req}`)
    lines.push(`  ${d.description}`)
    lines.push(`  Key clauses: ${d.keyClauses.join(', ')}`)
    lines.push('')
  }

  // ── Notes ─────────────────────────────────────────────
  lines.push('AUTHORING NOTES')
  lines.push(hr)
  for (const note of schema.notes) {
    lines.push(`  • ${note}`)
  }
  lines.push('')

  return lines.join('\n')
}
