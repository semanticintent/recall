// ─────────────────────────────────────────────────────────
// RECALL Diagnostics — error code registry
// ─────────────────────────────────────────────────────────

import type { DiagnosticCategory, DiagnosticSeverity } from './types.js'

export interface CodeDefinition {
  code:     string
  severity: DiagnosticSeverity
  category: DiagnosticCategory
  message:  string   // static message template
}

export const CODES: Record<string, CodeDefinition> = {

  // ── Errors ───────────────────────────────────────────

  'RCL-001': {
    code:     'RCL-001',
    severity: 'error',
    category: 'type-mismatch',
    message:  'Type mismatch',
  },
  'RCL-002': {
    code:     'RCL-002',
    severity: 'error',
    category: 'value-constraint',
    message:  'Value exceeds declared length',
  },
  'RCL-003': {
    code:     'RCL-003',
    severity: 'error',
    category: 'unknown-element',
    message:  'Unknown element',
  },
  'RCL-004': {
    code:     'RCL-004',
    severity: 'error',
    category: 'unknown-identifier',
    message:  'Unknown identifier',
  },
  'RCL-005': {
    code:     'RCL-005',
    severity: 'error',
    category: 'missing-required',
    message:  'Missing required division',
  },
  'RCL-006': {
    code:     'RCL-006',
    severity: 'error',
    category: 'missing-required',
    message:  'Missing required identification field',
  },
  'RCL-007': {
    code:     'RCL-007',
    severity: 'error',
    category: 'group-shape',
    message:  'USING requires a group, not a scalar',
  },
  'RCL-008': {
    code:     'RCL-008',
    severity: 'error',
    category: 'group-shape',
    message:  'Group used where scalar expected',
  },
  'RCL-009': {
    code:     'RCL-009',
    severity: 'error',
    category: 'format',
    message:  'Invalid DATE format',
  },
  'RCL-010': {
    code:     'RCL-010',
    severity: 'error',
    category: 'format',
    message:  'Invalid URL format',
  },
  'RCL-011': {
    code:     'RCL-011',
    severity: 'error',
    category: 'format',
    message:  'PCT value out of range',
  },
  'RCL-012': {
    code:     'RCL-012',
    severity: 'error',
    category: 'value-constraint',
    message:  'Non-numeric value in PIC 9 field',
  },
  'RCL-013': {
    code:     'RCL-013',
    severity: 'error',
    category: 'structural',
    message:  'Missing STOP RUN',
  },
  'RCL-014': {
    code:     'RCL-014',
    severity: 'error',
    category: 'structural',
    message:  'Component referenced before DEFINE',
  },
  'RCL-015': {
    code:     'RCL-015',
    severity: 'error',
    category: 'unknown-identifier',
    message:  'Cannot resolve COPY FROM path',
  },
  'RCL-016': {
    code:     'RCL-016',
    severity: 'error',
    category: 'type-mismatch',
    message:  'Component parameter type mismatch',
  },
  'RCL-017': {
    code:     'RCL-017',
    severity: 'error',
    category: 'missing-required',
    message:  'Missing required component parameter',
  },
  'RCL-018': {
    code:     'RCL-018',
    severity: 'error',
    category: 'structural',
    message:  'Circular COPY detected',
  },

  // ── Warnings ─────────────────────────────────────────

  'RCL-W01': {
    code:     'RCL-W01',
    severity: 'warning',
    category: 'group-shape',
    message:  'Group is empty',
  },
  'RCL-W02': {
    code:     'RCL-W02',
    severity: 'warning',
    category: 'value-constraint',
    message:  'Value near declared length limit',
  },
  'RCL-W03': {
    code:     'RCL-W03',
    severity: 'warning',
    category: 'missing-required',
    message:  'Missing optional identification field',
  },
  'RCL-W04': {
    code:     'RCL-W04',
    severity: 'warning',
    category: 'structural',
    message:  'Unreachable procedure section',
  },
  'RCL-W05': {
    code:     'RCL-W05',
    severity: 'warning',
    category: 'type-mismatch',
    message:  'Implicit string coercion',
  },
}

export function getCode(code: string): CodeDefinition {
  const def = CODES[code]
  if (!def) throw new Error(`Unknown diagnostic code: ${code}`)
  return def
}
