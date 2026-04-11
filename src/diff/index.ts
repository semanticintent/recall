import { parse } from '../parser/rcl.js'
import type { DataField, DisplayStatement, ReclProgram } from '../parser/rcl.js'

// ─────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────

export interface DiffResult {
  schema:  'recall-diff/1.0'
  from:    string
  to:      string
  changes: Change[]
}

export type Change =
  | DataChange
  | ProcedureChange
  | IdentificationChange

export interface DataChange {
  division:  'DATA'
  operation: 'added' | 'removed' | 'changed'
  field:     string
  pic?:      string
  from?:     string
  to?:       string
}

export interface ProcedureChange {
  division:    'PROCEDURE'
  operation:   'added' | 'removed' | 'changed'
  section:     string
  statements?: number      // count for removed; present on added too
  detail?:     StatementChange[]
}

export interface StatementChange {
  operation: 'added' | 'removed' | 'changed'
  element:   string
  from?:     string
  to?:       string
}

export interface IdentificationChange {
  division:  'IDENTIFICATION'
  operation: 'changed'
  field:     string
  from:      string
  to:        string
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Flatten a DataField tree into a map of name → field (scalars only). */
function flatScalars(fields: DataField[]): Map<string, DataField> {
  const result = new Map<string, DataField>()
  const walk = (fs: DataField[]) => {
    for (const f of fs) {
      if (f.children.length === 0) result.set(f.name, f)
      walk(f.children)
    }
  }
  walk(fields)
  return result
}

/** Stable key for a DisplayStatement — element name + intent (if any). */
function stmtKey(s: DisplayStatement): string {
  return s.intent ? `${s.element}::${s.intent}` : String(s.element)
}

/** Flat representation of a statement for change reporting. */
function stmtLabel(s: DisplayStatement): string {
  return s.intent ? `${s.element} WITH INTENT "${s.intent}"` : String(s.element)
}

/** Count all statements recursively. */
function countStatements(stmts: DisplayStatement[]): number {
  let n = stmts.length
  for (const s of stmts) n += countStatements(s.children)
  return n
}

// ─────────────────────────────────────────────────────────
// Division diffing
// ─────────────────────────────────────────────────────────

function diffData(a: ReclProgram, b: ReclProgram): DataChange[] {
  const changes: DataChange[] = []

  const allA = flatScalars([...a.data.workingStorage, ...a.data.items])
  const allB = flatScalars([...b.data.workingStorage, ...b.data.items])

  for (const [name, fa] of allA) {
    if (!allB.has(name)) {
      changes.push({ division: 'DATA', operation: 'removed', field: name, pic: fa.pic })
    } else {
      const fb = allB.get(name)!
      if (fa.value !== fb.value) {
        changes.push({ division: 'DATA', operation: 'changed', field: name, from: fa.value, to: fb.value })
      }
    }
  }

  for (const [name, fb] of allB) {
    if (!allA.has(name)) {
      changes.push({ division: 'DATA', operation: 'added', field: name, pic: fb.pic })
    }
  }

  return changes
}

function diffStatements(a: DisplayStatement[], b: DisplayStatement[]): StatementChange[] {
  const changes: StatementChange[] = []

  const mapA = new Map(a.map(s => [stmtKey(s), s]))
  const mapB = new Map(b.map(s => [stmtKey(s), s]))

  for (const [key, sa] of mapA) {
    if (!mapB.has(key)) {
      changes.push({ operation: 'removed', element: stmtLabel(sa) })
    }
  }

  for (const [key, sb] of mapB) {
    if (!mapA.has(key)) {
      changes.push({ operation: 'added', element: stmtLabel(sb) })
    }
  }

  return changes
}

function diffProcedure(a: ReclProgram, b: ReclProgram): ProcedureChange[] {
  const changes: ProcedureChange[] = []

  const mapA = new Map(a.procedure.sections.map(s => [s.name, s]))
  const mapB = new Map(b.procedure.sections.map(s => [s.name, s]))

  for (const [name, sa] of mapA) {
    if (!mapB.has(name)) {
      changes.push({
        division: 'PROCEDURE', operation: 'removed', section: name,
        statements: countStatements(sa.statements),
      })
    } else {
      const sb = mapB.get(name)!
      const detail = diffStatements(sa.statements, sb.statements)
      if (detail.length > 0) {
        changes.push({ division: 'PROCEDURE', operation: 'changed', section: name, detail })
      }
    }
  }

  for (const [name, sb] of mapB) {
    if (!mapA.has(name)) {
      changes.push({
        division: 'PROCEDURE', operation: 'added', section: name,
        statements: countStatements(sb.statements),
      })
    }
  }

  return changes
}

function diffIdentification(a: ReclProgram, b: ReclProgram): IdentificationChange[] {
  const changes: IdentificationChange[] = []
  const idA = a.identification
  const idB = b.identification

  const fields: Array<keyof typeof idA> = ['programId', 'author', 'dateWritten', 'pageTitle', 'description']
  for (const field of fields) {
    const va = String(idA[field] ?? '')
    const vb = String(idB[field] ?? '')
    if (va !== vb) {
      changes.push({ division: 'IDENTIFICATION', operation: 'changed', field, from: va, to: vb })
    }
  }

  return changes
}

// ─────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────

export function diff(sourceA: string, sourceB: string, fromLabel = 'a', toLabel = 'b'): DiffResult {
  const progA = parse(sourceA)
  const progB = parse(sourceB)

  const changes: Change[] = [
    ...diffData(progA, progB),
    ...diffProcedure(progA, progB),
    ...diffIdentification(progA, progB),
  ]

  return { schema: 'recall-diff/1.0', from: fromLabel, to: toLabel, changes }
}
