// ─────────────────────────────────────────────────────────
// RECALL Diagnostics — terminal renderer
//
// Renders structured diagnostics to terminal output with:
//   - colour-coded severity
//   - exact file:line:col location
//   - source line + caret pointing at offending token
//   - what / why / hint
//   - summary line
// ─────────────────────────────────────────────────────────

import type { Diagnostic } from './types.js'
import type { DiagnosticCollector } from './collector.js'

// ── Colours ──────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
}

// ── Caret rendering ───────────────────────────────────────

function renderCaret(col: number, length: number): string {
  const pad   = ' '.repeat(Math.max(0, col - 1))
  const caret = '^'.repeat(Math.max(1, length))
  return `  ${pad}${C.red}${caret}${C.reset}`
}

// ── Single diagnostic block ───────────────────────────────

function renderDiagnostic(d: Diagnostic): string {
  const lines: string[] = []
  const isError = d.severity === 'error'

  const severityLabel = isError
    ? `${C.red}${C.bold}ERROR${C.reset}`
    : `${C.yellow}${C.bold}WARNING${C.reset}`

  const loc = `${C.cyan}${d.location.file}:${d.location.line}:${d.location.col}${C.reset}`

  // Header: ERROR [RCL-001] type-mismatch — file:line:col
  lines.push(
    `${severityLabel} ${C.bold}[${d.code}]${C.reset} ${C.dim}${d.category}${C.reset} — ${loc}`
  )

  // Source line + caret
  if (d.location.source) {
    lines.push(`  ${d.location.source}`)
    lines.push(renderCaret(d.location.col, d.location.length))
  }

  // What
  lines.push(`  ${C.bold}${d.message}${C.reset}`)

  // Why
  lines.push(`  ${d.why}`)

  // Hint (optional)
  if (d.hint) {
    lines.push(`  ${C.dim}Hint: ${d.hint}${C.reset}`)
  }

  lines.push('')
  return lines.join('\n')
}

// ── Summary line ──────────────────────────────────────────

function renderSummary(collector: DiagnosticCollector): string {
  const errCount  = collector.errors().length
  const warnCount = collector.warnings().length

  const hr = `${C.gray}${'─'.repeat(45)}${C.reset}`

  if (errCount === 0 && warnCount === 0) {
    return `${hr}\n${C.bold}  ✓  No issues found${C.reset}\n`
  }

  const parts: string[] = []

  if (errCount > 0) {
    parts.push(`${C.red}${C.bold}${errCount} error${errCount === 1 ? '' : 's'}${C.reset}`)
  }
  if (warnCount > 0) {
    parts.push(`${C.yellow}${C.bold}${warnCount} warning${warnCount === 1 ? '' : 's'}${C.reset}`)
  }

  const aborted = errCount > 0
    ? ` ${C.red}— compilation aborted${C.reset}\n  ${C.dim}No output written.${C.reset}`
    : ` ${C.yellow}— compiled with warnings${C.reset}`

  return `${hr}\n  ${parts.join(', ')}${aborted}\n`
}

// ── Public renderer ───────────────────────────────────────

export function renderDiagnostics(collector: DiagnosticCollector): string {
  const all = collector.getAll()
  if (all.length === 0) return ''

  const blocks = all.map(renderDiagnostic).join('')
  const summary = renderSummary(collector)

  return '\n' + blocks + summary
}

/** Print diagnostics to stderr */
export function printDiagnostics(collector: DiagnosticCollector): void {
  const output = renderDiagnostics(collector)
  if (output) process.stderr.write(output)
}
