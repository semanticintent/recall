import { Command } from 'commander'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { diff } from '../../diff/index.js'
import type { Change, DataChange, ProcedureChange, IdentificationChange } from '../../diff/index.js'

const hr = '─'.repeat(60)

// ─────────────────────────────────────────────────────────
// Git helpers
// ─────────────────────────────────────────────────────────

function gitShow(ref: string, file: string): string {
  try {
    return execSync(`git show ${ref}:${file}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`git show ${ref}:${file} failed:\n${msg}\n`)
    process.exit(1)
  }
}

// ─────────────────────────────────────────────────────────
// Human-readable formatting
// ─────────────────────name──────────────────────────────────

const OP_LABEL: Record<string, string> = {
  added:   'ADDED  ',
  removed: 'REMOVED',
  changed: 'CHANGED',
}

function formatChange(c: Change): string[] {
  const lines: string[] = []

  if (c.division === 'DATA') {
    const dc = c as DataChange
    const op = OP_LABEL[dc.operation]
    if (dc.operation === 'changed') {
      lines.push(`  ${op}   ${dc.field.padEnd(28)} ${JSON.stringify(dc.from)} → ${JSON.stringify(dc.to)}`)
    } else {
      lines.push(`  ${op}   ${dc.field}${dc.pic ? `  PIC ${dc.pic}` : ''}`)
    }
  }

  if (c.division === 'PROCEDURE') {
    const pc = c as ProcedureChange
    const op = OP_LABEL[pc.operation]
    if (pc.operation === 'changed' && pc.detail) {
      lines.push(`  ${op}   ${pc.section}`)
      for (const d of pc.detail) {
        lines.push(`    ${OP_LABEL[d.operation]}   ${d.element}`)
      }
    } else {
      const suffix = pc.statements !== undefined ? `  (${pc.statements} statement${pc.statements === 1 ? '' : 's'})` : ''
      lines.push(`  ${op}   ${pc.section}${suffix}`)
    }
  }

  if (c.division === 'IDENTIFICATION') {
    const ic = c as IdentificationChange
    const op = OP_LABEL[ic.operation]
    lines.push(`  ${op}   ${ic.field.padEnd(28)} ${JSON.stringify(ic.from)} → ${JSON.stringify(ic.to)}`)
  }

  return lines
}

function formatDiff(result: ReturnType<typeof diff>): string {
  if (result.changes.length === 0) {
    return `\nRECALL DIFF  ${result.from} → ${result.to}\n${hr}\n  No changes detected.\n`
  }

  const lines = [`\nRECALL DIFF  ${result.from} → ${result.to}`, hr]

  const byDiv: Record<string, Change[]> = { DATA: [], PROCEDURE: [], IDENTIFICATION: [] }
  for (const c of result.changes) byDiv[c.division].push(c)

  const order = ['DATA', 'PROCEDURE', 'IDENTIFICATION'] as const
  for (const div of order) {
    const group = byDiv[div]
    if (!group.length) continue
    lines.push(`\n${div} DIVISION`)
    for (const c of group) lines.push(...formatChange(c))
  }

  lines.push('')
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────
// Command
// ─────────────────────────────────────────────────────────

export const diffCommand = new Command('diff')
  .description('Semantic diff between two .rcl sources or two git revisions')
  .argument('<a>', 'first file path, or git ref when three arguments given')
  .argument('<b>', 'second file path, or git ref when three arguments given')
  .argument('[file]', 'path to .rcl file when comparing git revisions')
  .option('--format <fmt>', 'output format: text (default) or json', 'text')
  .addHelpText('after', `
  Compare two files:
    recall diff v1.rcl v2.rcl

  Compare two git revisions of the same file:
    recall diff HEAD~1 HEAD page.rcl

  Machine-readable output:
    recall diff --format json v1.rcl v2.rcl
    recall diff --format json HEAD~1 HEAD page.rcl`)
  .action((a: string, b: string, file: string | undefined, opts: { format: string }) => {
    let sourceA: string
    let sourceB: string
    let fromLabel: string
    let toLabel: string

    if (file) {
      // Git revision mode: a=ref1, b=ref2, file=path
      const absFile = file  // relative to git root — git show expects that
      sourceA   = gitShow(a, absFile)
      sourceB   = gitShow(b, absFile)
      fromLabel = `${a}:${file}`
      toLabel   = `${b}:${file}`
    } else {
      // File comparison mode: a=path1, b=path2
      const absA = resolve(a)
      const absB = resolve(b)
      if (!existsSync(absA)) { process.stderr.write(`File not found: ${absA}\n`); process.exit(1) }
      if (!existsSync(absB)) { process.stderr.write(`File not found: ${absB}\n`); process.exit(1) }
      sourceA   = readFileSync(absA, 'utf-8')
      sourceB   = readFileSync(absB, 'utf-8')
      fromLabel = a
      toLabel   = b
    }

    const result = diff(sourceA, sourceB, fromLabel, toLabel)

    if (opts.format === 'json') {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } else {
      process.stdout.write(formatDiff(result))
    }
  })
