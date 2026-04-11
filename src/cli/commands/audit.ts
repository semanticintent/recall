import { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '../../parser/rcl.js'
import type { AuditDivision } from '../../parser/rcl.js'

const hr = '─'.repeat(60)

// ─────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────

function formatAudit(audit: AuditDivision, since?: string): string {
  const entries = since
    ? audit.changeLog.filter(e => e.date >= since)
    : audit.changeLog

  const lines = ['', `AUDIT DIVISION`, hr]
  lines.push(`  Created by:   ${audit.createdBy}`)
  lines.push(`  Created date: ${audit.createdDate}`)

  if (entries.length === 0) {
    lines.push(`  Change log:   (empty${since ? ` since ${since}` : ''})`)
  } else {
    lines.push(`  Change log:${since ? `  (since ${since})` : ''}`)
    for (const e of entries) {
      lines.push(`    ${e.date}  ${e.subject.padEnd(32)}${e.authorKind.padEnd(16)}"${e.note}"`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────
// Command
// ─────────────────────────────────────────────────────────

export const auditCommand = new Command('audit')
  .description('Print the AUDIT DIVISION change log from a .rcl file')
  .argument('<file>', 'path to .rcl source file')
  .option('--format <fmt>', 'output format: text (default) or json', 'text')
  .option('--since <date>', 'filter change log to entries on or after this ISO date (YYYY-MM-DD)')
  .addHelpText('after', `
  Print full change log:
    recall audit page.rcl

  Filter by date:
    recall audit page.rcl --since 2026-04-08

  Machine-readable:
    recall audit page.rcl --format json
    recall audit page.rcl --since 2026-04-08 --format json`)
  .action((file: string, opts: { format: string; since?: string }) => {
    const absInput = resolve(file)
    if (!existsSync(absInput)) {
      process.stderr.write(`File not found: ${absInput}\n`)
      process.exit(1)
    }

    const source = readFileSync(absInput, 'utf-8')
    const program = parse(source)

    if (!program.audit) {
      process.stderr.write(`No AUDIT DIVISION found in ${absInput}\n`)
      process.exit(1)
    }

    const audit = program.audit
    const entries = opts.since
      ? audit.changeLog.filter(e => e.date >= opts.since!)
      : audit.changeLog

    if (opts.format === 'json') {
      process.stdout.write(JSON.stringify({
        createdBy:   audit.createdBy,
        createdDate: audit.createdDate,
        changeLog:   entries.map(e => ({
          date:       e.date,
          subject:    e.subject,
          authorKind: e.authorKind,
          note:       e.note,
        })),
      }, null, 2) + '\n')
      return
    }

    process.stdout.write(formatAudit(audit, opts.since))
  })
