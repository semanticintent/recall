// ─────────────────────────────────────────────────────────
// RECALL Diagnostics — public API
// ─────────────────────────────────────────────────────────

export type { Diagnostic, DiagnosticSeverity, DiagnosticCategory, SourceLocation } from './types.js'
export type { CodeDefinition } from './codes.js'
export { CODES, getCode } from './codes.js'
export { DiagnosticCollector } from './collector.js'
export { renderDiagnostics, printDiagnostics } from './renderer.js'
