// ─────────────────────────────────────────────────────────
// RECALL — Common Record Description (CRD) Validator
//
// Validates that a brief JSON (storage layer) and a RECALL
// DATA DIVISION (compiler layer) agree on field names, PIC X
// lengths, and group cardinalities.
//
// Three checks:
//   CRD-001  Brief field not in DATA DIVISION
//   CRD-002  DATA DIVISION field not in brief
//   CRD-003  Brief value would truncate at PIC X(n) limit
//   CRD-004  Group cardinality mismatch
// ─────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parseFromSource } from './index.js'
import type { DataField } from '../parser/rcl.js'

// ── Types ────────────────────────────────────────────────

export interface CRDIssue {
  code:    string
  field:   string
  message: string
  hint?:   string
}

export interface CRDResult {
  ok:        boolean
  rclPath:   string
  briefPath: string
  errors:    CRDIssue[]
  warnings:  CRDIssue[]
}

// ── Helpers ──────────────────────────────────────────────

function picMaxLen(pic: string): number | null {
  const m = pic.match(/PIC\s+X\((\d+)\)/i)
  return m ? parseInt(m[1], 10) : null
}

// Walk all DataField nodes recursively, building a flat map of
// leaf field name → max PIC X length (null if not X(n))
function buildDataMap(
  fields: DataField[],
  out: Map<string, number | null> = new Map(),
): Map<string, number | null> {
  for (const f of fields) {
    if (f.children?.length) {
      buildDataMap(f.children, out)
    } else {
      out.set(f.name, picMaxLen(f.pic ?? ''))
    }
  }
  return out
}

// Walk ITEMS SECTION groups, building a map of
// group name → number of child rows (05-level items)
function buildGroupRowMap(items: DataField[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const group of items) {
    // Count direct 05-level children that represent rows
    const rows = group.children?.filter(c => String(c.level) === '5' || String(c.level) === '05') ?? []
    if (rows.length > 0) map.set(group.name, rows.length)
  }
  return map
}

// Flatten a brief JSON to:
//   scalars: { FIELD-NAME → string value }
//   groups:  { GROUP-NAME → item count }
function flattenBrief(brief: Record<string, unknown>): {
  scalars: Map<string, string>
  groups:  Map<string, number>
} {
  const scalars = new Map<string, string>()
  const groups  = new Map<string, number>()

  for (const [key, val] of Object.entries(brief)) {
    if (Array.isArray(val)) {
      groups.set(key, val.length)
    } else if (val !== null && val !== undefined && typeof val !== 'object') {
      scalars.set(key, String(val))
    }
  }
  return { scalars, groups }
}

// ── Main validator ───────────────────────────────────────

export function validateCRD(
  rclPath:   string,
  briefPath: string,
  opts: { strict?: boolean } = {},
): CRDResult {
  const errors:   CRDIssue[] = []
  const warnings: CRDIssue[] = []

  const absRcl   = resolve(rclPath)
  const absBrief = resolve(briefPath)
  const baseDir  = dirname(absRcl)

  // 1. Parse RCL → DATA DIVISION
  let rclSource: string
  let briefJson: Record<string, unknown>
  try {
    rclSource = readFileSync(absRcl, 'utf-8')
  } catch {
    errors.push({ code: 'CRD-000', field: '', message: `Cannot read RCL file: ${absRcl}` })
    return { ok: false, rclPath: absRcl, briefPath: absBrief, errors, warnings }
  }
  try {
    briefJson = JSON.parse(readFileSync(absBrief, 'utf-8'))
  } catch {
    errors.push({ code: 'CRD-000', field: '', message: `Cannot read or parse brief JSON: ${absBrief}` })
    return { ok: false, rclPath: absRcl, briefPath: absBrief, errors, warnings }
  }

  let program: ReturnType<typeof parseFromSource>
  try {
    program = parseFromSource(rclSource, baseDir)
  } catch (e) {
    errors.push({ code: 'CRD-000', field: '', message: `RCL parse error: ${String(e)}` })
    return { ok: false, rclPath: absRcl, briefPath: absBrief, errors, warnings }
  }

  // 2. Build DATA DIVISION maps
  const allDataFields = [
    ...program.data.workingStorage,
    ...program.data.items,
  ]
  const dataMap     = buildDataMap(allDataFields)
  const groupRowMap = buildGroupRowMap(program.data.items)

  // 3. Flatten brief
  const { scalars: briefScalars, groups: briefGroups } = flattenBrief(briefJson)

  // ── CRD-001: Brief scalar field not in DATA DIVISION ──
  for (const [key] of briefScalars) {
    if (!dataMap.has(key)) {
      errors.push({
        code:    'CRD-001',
        field:   key,
        message: `Brief field "${key}" has no matching DATA DIVISION declaration`,
        hint:    'Add the field to the DATA DIVISION or remove it from the brief',
      })
    }
  }

  // ── CRD-002: DATA DIVISION leaf field not in brief ────
  // Skip group child fields — they live inside brief arrays (e.g. DIMENSIONS-1-CODE
  // comes from DIMENSIONS[0].DIM-CODE), not as flat brief keys.
  const groupNames = new Set(briefGroups.keys())
  for (const [name] of dataMap) {
    if (briefScalars.has(name)) continue
    // Check if this field is a child of a known group (e.g. DIMENSIONS-1-CODE → DIMENSIONS)
    const parentGroup = [...groupNames].find(g =>
      name.startsWith(g + '-') && /^\d+/.test(name.slice(g.length + 1))
    )
    if (parentGroup) continue  // array items handled by CRD-004
    warnings.push({
      code:    'CRD-002',
      field:   name,
      message: `DATA field "${name}" has no corresponding brief value — will render empty`,
      hint:    'Populate the field in the brief JSON or mark it optional in the CRD',
    })
  }

  // ── CRD-003: Truncation detection ─────────────────────
  for (const [key, value] of briefScalars) {
    const maxLen = dataMap.get(key)
    if (maxLen !== null && maxLen !== undefined && value.length > maxLen) {
      warnings.push({
        code:    'CRD-003',
        field:   key,
        message: `"${key}" value is ${value.length} chars — exceeds PIC X(${maxLen}), will truncate by ${value.length - maxLen} chars`,
        hint:    `Increase PIC X to X(${value.length}) or shorten the value`,
      })
    }
  }

  // ── CRD-004: Group cardinality ─────────────────────────
  for (const [groupName, briefCount] of briefGroups) {
    const dataRows = groupRowMap.get(groupName)
    if (dataRows !== undefined && briefCount !== dataRows) {
      errors.push({
        code:    'CRD-004',
        field:   groupName,
        message: `Group "${groupName}": brief has ${briefCount} items but DATA DIVISION has ${dataRows} rows`,
        hint:    'Align brief array length with DATA DIVISION group row count',
      })
    }
  }

  const hasErrors = errors.length > 0 || (opts.strict && warnings.length > 0)
  return {
    ok:        !hasErrors,
    rclPath:   absRcl,
    briefPath: absBrief,
    errors,
    warnings,
  }
}

// ── Formatter ────────────────────────────────────────────

export function formatCRDResult(result: CRDResult): string {
  const lines: string[] = []
  const relRcl   = result.rclPath.replace(process.cwd() + '/', '')
  const relBrief = result.briefPath.replace(process.cwd() + '/', '')

  lines.push(`\n  CRD — Common Record Description`)
  lines.push(`  RCL:   ${relRcl}`)
  lines.push(`  Brief: ${relBrief}\n`)

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push(`  ✓  All layers agree\n`)
    return lines.join('\n')
  }

  for (const e of result.errors) {
    lines.push(`  ✗  [${e.code}]  ${e.message}`)
    if (e.hint) lines.push(`        → ${e.hint}`)
  }

  for (const w of result.warnings) {
    lines.push(`  ⚠  [${w.code}]  ${w.message}`)
    if (w.hint) lines.push(`        → ${w.hint}`)
  }

  const summary: string[] = []
  if (result.errors.length)   summary.push(`${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`)
  if (result.warnings.length) summary.push(`${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`)
  lines.push(`\n  ${summary.join(', ')}\n`)

  return lines.join('\n')
}
