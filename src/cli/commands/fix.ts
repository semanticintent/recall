import { Command } from 'commander'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '../../parser/rcl.js'

interface AppliedFix {
  line:        number
  description: string
}

// Extract declared PIC X(n) size from a pic string like "X(80)" → 80
function picSize(pic: string): number {
  const m = pic.match(/X\((\d+)\)/i)
  return m ? parseInt(m[1], 10) : 0
}

// ── Walk all data fields and find those where value.length > picSize ──────────
function collectRcl002Fixes(
  fields: ReturnType<typeof parse>['data']['workingStorage'],
  fixes: Array<{ lineIdx: number; from: string; to: string; description: string }>,
): void {
  for (const f of fields) {
    if (f.loc && f.value) {
      const declared = picSize(f.pic)
      const needed   = f.value.length
      if (declared > 0 && needed > declared) {
        fixes.push({
          lineIdx:     f.loc.line - 1,   // 0-based
          from:        `PIC ${f.pic}`,
          to:          `PIC X(${needed})`,
          description: `RCL-002 line ${f.loc.line} ${f.name}: PIC X(${declared}) → PIC X(${needed})`,
        })
      }
    }
    collectRcl002Fixes(f.children, fixes)
  }
}

// ── Find and insert missing AUTHOR / DATE-WRITTEN in the IDENTIFICATION block ──
function buildW03Fix(
  sourceLines: string[],
): { lineIdx: number; description: string; toInsert: string[] } | null {
  const programIdIdx = sourceLines.findIndex(l => /PROGRAM-ID\s*\./i.test(l))
  if (programIdIdx < 0) return null

  const block        = sourceLines.slice(0, Math.min(sourceLines.length, programIdIdx + 15)).join('\n')
  const hasAuthor    = /AUTHOR\s*\./i.test(block)
  const hasDateW     = /DATE-WRITTEN\s*\./i.test(block)
  if (hasAuthor && hasDateW) return null

  const indent    = (sourceLines[programIdIdx].match(/^(\s*)/) ?? ['', '   '])[1]
  const toInsert: string[] = []
  if (!hasAuthor)  toInsert.push(`${indent}AUTHOR. Unknown.`)
  if (!hasDateW) {
    const today = new Date().toISOString().slice(0, 10)
    toInsert.push(`${indent}DATE-WRITTEN. ${today}.`)
  }

  return {
    lineIdx:     programIdIdx,          // insert AFTER this line (0-based)
    description: `RCL-W03: insert ${toInsert.map(l => l.trim()).join(', ')} after PROGRAM-ID`,
    toInsert,
  }
}

export const fixCommand = new Command('fix')
  .argument('<file>', 'path to .rcl source file')
  .option('--yes', 'apply fixes without confirmation prompt')
  .option('--dry-run', 'show what would change without writing')
  .description('Auto-apply safe fixes: PIC resize (RCL-002), AUTHOR/DATE-WRITTEN (RCL-W03)')
  .addHelpText('after', `
  Safe fixes only — no logic changes:
    RCL-002  widen PIC X(n) to fit actual VALUE length
    RCL-W03  insert AUTHOR and DATE-WRITTEN placeholders

  Always review the output. Use --dry-run to preview first.`)
  .action((file: string, opts: { yes?: boolean; dryRun?: boolean }) => {
    const absInput = resolve(file)
    if (!existsSync(absInput)) {
      process.stderr.write(`File not found: ${absInput}\n`)
      process.exit(1)
    }

    const source      = readFileSync(absInput, 'utf-8')
    const sourceLines = source.split('\n')

    // Parse original source directly — field.loc gives lines relative to original
    let program: ReturnType<typeof parse>
    try {
      program = parse(source)
    } catch (err) {
      process.stderr.write(`Parse error: ${(err as Error).message}\n`)
      process.exit(1)
    }

    // ── RCL-002 fixes ───────────────────────────────────────────────────────
    const rcl002Candidates: Array<{ lineIdx: number; from: string; to: string; description: string }> = []
    collectRcl002Fixes(program.data.workingStorage, rcl002Candidates)
    collectRcl002Fixes(program.data.items, rcl002Candidates)

    // ── RCL-W03 fix ─────────────────────────────────────────────────────────
    const w03Fix = buildW03Fix(sourceLines)

    const totalFixes = rcl002Candidates.length + (w03Fix ? 1 : 0)

    if (totalFixes === 0) {
      process.stdout.write('\nNo auto-fixable issues found.\n\n')
      process.exit(0)
    }

    // ── Preview ─────────────────────────────────────────────────────────────
    process.stdout.write('\n')
    process.stdout.write(`  ${absInput}\n`)
    process.stdout.write('  ' + '─'.repeat(58) + '\n')
    for (const c of rcl002Candidates) {
      process.stdout.write(`  [fix] ${c.description}\n`)
    }
    if (w03Fix) {
      process.stdout.write(`  [fix] ${w03Fix.description}\n`)
    }
    process.stdout.write('\n')

    if (opts.dryRun) {
      process.stdout.write('  (dry-run — no changes written)\n\n')
      process.exit(0)
    }

    if (!opts.yes) {
      process.stdout.write(`  Applying ${totalFixes} fix${totalFixes === 1 ? '' : 'es'}...\n\n`)
    }

    // ── Apply fixes ──────────────────────────────────────────────────────────
    // Work on a mutable copy. Apply in REVERSE line order so insertions
    // don't shift subsequent line indices.
    const workingLines = [...sourceLines]

    // RCL-002: in-place PIC resizes (no line count change, order doesn't matter)
    const applied: AppliedFix[] = []
    for (const c of rcl002Candidates) {
      const original = workingLines[c.lineIdx]
      if (!original) continue
      const updated = original.replace(/PIC\s+X\(\d+\)/i, c.to.replace('PIC ', ''))
      if (updated !== original) {
        workingLines[c.lineIdx] = updated
        applied.push({ line: c.lineIdx + 1, description: c.description })
      }
    }

    // RCL-W03: insert lines AFTER the PROGRAM-ID line
    if (w03Fix) {
      workingLines.splice(w03Fix.lineIdx + 1, 0, ...w03Fix.toInsert)
      applied.push({ line: w03Fix.lineIdx + 1, description: w03Fix.description })
    }

    writeFileSync(absInput, workingLines.join('\n'), 'utf-8')

    process.stdout.write(`  Applied ${applied.length} fix${applied.length === 1 ? '' : 'es'}.\n`)
    process.stdout.write(`  Written: ${absInput}\n\n`)
  })
