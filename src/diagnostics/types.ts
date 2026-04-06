// ─────────────────────────────────────────────────────────
// RECALL Diagnostics — core types
// ─────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning'

export type DiagnosticCategory =
  | 'type-mismatch'
  | 'value-constraint'
  | 'unknown-identifier'
  | 'unknown-element'
  | 'missing-required'
  | 'group-shape'
  | 'structural'
  | 'format'

export interface SourceLocation {
  file:   string   // absolute path to .rcl source
  line:   number   // 1-indexed
  col:    number   // 1-indexed, points to offending token start
  length: number   // character span for caret rendering
  source: string   // the full source line, for caret display
}

export interface Diagnostic {
  code:     string               // e.g. RCL-001
  severity: DiagnosticSeverity
  category: DiagnosticCategory
  location: SourceLocation
  message:  string               // what is wrong
  why:      string               // why it is wrong
  hint?:    string               // how to fix it
}
