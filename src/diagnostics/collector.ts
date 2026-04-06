// ─────────────────────────────────────────────────────────
// RECALL Diagnostics — collector
//
// Never throws. Accumulates all diagnostics, reports at once.
// The compiler decides when to abort — after full collection.
// ─────────────────────────────────────────────────────────

import type { Diagnostic, DiagnosticSeverity, SourceLocation } from './types.js'
import { getCode } from './codes.js'

export class DiagnosticCollector {
  private items: Diagnostic[] = []

  add(
    code:     string,
    location: SourceLocation,
    why:      string,
    hint?:    string,
  ): void {
    const def = getCode(code)
    this.items.push({
      code:     def.code,
      severity: def.severity,
      category: def.category,
      location,
      message:  def.message,
      why,
      hint,
    })
  }

  error(code: string, location: SourceLocation, why: string, hint?: string): void {
    this.add(code, location, why, hint)
  }

  warning(code: string, location: SourceLocation, why: string, hint?: string): void {
    this.add(code, location, why, hint)
  }

  hasErrors(): boolean {
    return this.items.some(d => d.severity === 'error')
  }

  hasWarnings(): boolean {
    return this.items.some(d => d.severity === 'warning')
  }

  errors(): Diagnostic[] {
    return this.items.filter(d => d.severity === 'error')
  }

  warnings(): Diagnostic[] {
    return this.items.filter(d => d.severity === 'warning')
  }

  getAll(): Diagnostic[] {
    return [...this.items]
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  /** Promote all warnings to errors (--strict mode) */
  promoteWarnings(): void {
    for (const item of this.items) {
      if (item.severity === 'warning') {
        item.severity = 'error'
      }
    }
  }

  /** Serialise to JSON (--format json) */
  toJSON(): object {
    return {
      errors:      this.errors().length,
      warnings:    this.warnings().length,
      diagnostics: this.items.map(d => {
        const source = d.location.source ?? ''
        const caret  = source
          ? ' '.repeat(Math.max(0, d.location.col - 1)) + '^'.repeat(Math.max(1, d.location.length))
          : ''
        return {
          code:     d.code,
          severity: d.severity,
          category: d.category,
          file:     d.location.file,
          line:     d.location.line,
          col:      d.location.col,
          message:  d.message,
          why:      d.why,
          hint:     d.hint ?? null,
          source:   source || null,
          caret:    caret  || null,
        }
      }),
    }
  }
}
