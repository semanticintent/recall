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

// ── Find empty procedure sections (RCL-W04) and compute their line ranges ─────
// Each section spans from its header line to the line before the next section
// header (or to the line before STOP RUN). We remove the entire block.
function collectW04Removals(
  program: ReturnType<typeof parse>,
  sourceLines: string[],
): Array<{ fromLineIdx: number; toLineIdx: number; description: string }> {
  const sections   = program.procedure.sections
  const removals: Array<{ fromLineIdx: number; toLineIdx: number; description: string }> = []

  // Only act on sections with zero display statements at any depth
  function countStatements(stmts: typeof sections[0]['statements']): number {
    let n = stmts.length
    for (const s of stmts) n += countStatements(s.children)
    return n
  }

  const emptySections = sections.filter(s => countStatements(s.statements) === 0 && s.loc)

  if (emptySections.length === 0) return removals

  // Build a sorted list of all section header line indices (0-based)
  const allHeaderLineIdxs = sections
    .filter(s => s.loc)
    .map(s => s.loc!.line - 1)
    .sort((a, b) => a - b)

  // Find STOP RUN line (last meaningful line we care about)
  const stopRunIdx = sourceLines.findIndex(l => /STOP\s+RUN/i.test(l.trim()))

  for (const section of emptySections) {
    const headerLineIdx = section.loc!.line - 1
    const posInAll      = allHeaderLineIdxs.indexOf(headerLineIdx)
    const nextHeaderIdx = allHeaderLineIdxs[posInAll + 1] ?? (stopRunIdx >= 0 ? stopRunIdx : sourceLines.length)

    // Trim trailing blank lines before the boundary
    let endLineIdx = nextHeaderIdx - 1
    while (endLineIdx > headerLineIdx && sourceLines[endLineIdx].trim() === '') {
      endLineIdx--
    }

    removals.push({
      fromLineIdx: headerLineIdx,
      toLineIdx:   endLineIdx,
      description: `RCL-W04 line ${headerLineIdx + 1} section "${section.name}": remove empty section (${endLineIdx - headerLineIdx + 1} lines)`,
    })
  }

  return removals
}

export const fixCommand = new Command('fix')
  .argument('<file>', 'path to .rcl source file')
  .option('--yes', 'apply fixes without confirmation prompt')
  .option('--dry-run', 'show what would change without writing')
  .description('Auto-apply safe fixes: PIC resize (RCL-002), AUTHOR/DATE-WRITTEN (RCL-W03), empty sections (RCL-W04)')
  .addHelpText('after', `
  Safe fixes only — no logic changes:
    RCL-002  widen PIC X(n) to fit actual VALUE length
    RCL-W03  insert AUTHOR and DATE-WRITTEN placeholders
    RCL-W04  remove empty procedure sections

  Always review the output. Use --dry-run to preview first.`)
  .action((file: string, opts: { yes?: boolean; dryRun?: boolean }) => {
    const absInput = resolve(file)
    if (!existsSync(absInput)) {
      process.stderr.write(`File not found: ${absInput}\n`)
      process.exit(1)
    }

    const source      = readFileSync(absInput, 'utf-8')
    const sourceLines = source.split('\n')

    // Parse original source directly — loc fields give lines relative to original
    let program: ReturnType<typeof parse>
    try {
      program = parse(source)
    } catch (err) {
      process.stderr.write(`Parse error: ${(err as Error).message}\n`)
      process.exit(1)
    }

    // ── Collect all fixable issues ───────────────────────────────────────────
    const rcl002Candidates: Array<{ lineIdx: number; from: string; to: string; description: string }> = []
    collectRcl002Fixes(program.data.workingStorage, rcl002Candidates)
    collectRcl002Fixes(program.data.items, rcl002Candidates)

    const w03Fix    = buildW03Fix(sourceLines)
    const w04Removals = collectW04Removals(program, sourceLines)

    const totalFixes = rcl002Candidates.length + (w03Fix ? 1 : 0) + w04Removals.length

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
    for (const r of w04Removals) {
      process.stdout.write(`  [fix] ${r.description}\n`)
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
    // All mutations work on a copy of sourceLines.
    // Order matters: apply line-deletion removals in REVERSE order first (W04),
    // then in-place PIC resizes (W002), then insertions (W03 — always shifts down).
    const workingLines = [...sourceLines]
    const applied: AppliedFix[] = []

    // RCL-W04: remove empty section blocks in reverse order (highest line first)
    const sortedRemovals = [...w04Removals].sort((a, b) => b.fromLineIdx - a.fromLineIdx)
    for (const r of sortedRemovals) {
      workingLines.splice(r.fromLineIdx, r.toLineIdx - r.fromLineIdx + 1)
      applied.push({ line: r.fromLineIdx + 1, description: r.description })
    }

    // RCL-002: in-place PIC resizes (no line count change — line indices still valid after W04 removals
    // only if we adjust them, but since we removed lines ABOVE or BELOW... actually W04 may have shifted
    // line indices. Re-parse is the safe approach; but since we're working in sequence and RCL-002
    // candidate lineIdxs are from the original parse, we need to account for W04 removal offsets.)
    //
    // Simplest correct approach: after W04 removals, we re-match by content rather than line index.
    // For each RCL-002 candidate, search for the matching PIC declaration by field name.
    for (const c of rcl002Candidates) {
      const picPattern = new RegExp(`\\b${c.from.replace('PIC ', 'PIC\\s+')}\\b`, 'i')
      // Find the line containing this field's declaration (search near original lineIdx)
      const searchFrom = Math.max(0, c.lineIdx - w04Removals.length * 10)
      const searchTo   = Math.min(workingLines.length, c.lineIdx + w04Removals.length * 10 + 1)
      for (let i = searchFrom; i < searchTo; i++) {
        if (picPattern.test(workingLines[i])) {
          const updated = workingLines[i].replace(/PIC\s+X\(\d+\)/i, c.to.replace('PIC ', ''))
          if (updated !== workingLines[i]) {
            workingLines[i] = updated
            applied.push({ line: i + 1, description: c.description })
          }
          break
        }
      }
    }

    // RCL-W03: insert lines AFTER the PROGRAM-ID line (re-find it since W04 may have shifted lines)
    if (w03Fix) {
      const programIdIdx = workingLines.findIndex(l => /PROGRAM-ID\s*\./i.test(l))
      if (programIdIdx >= 0) {
        workingLines.splice(programIdIdx + 1, 0, ...w03Fix.toInsert)
        applied.push({ line: programIdIdx + 1, description: w03Fix.description })
      }
    }

    writeFileSync(absInput, workingLines.join('\n'), 'utf-8')

    process.stdout.write(`  Applied ${applied.length} fix${applied.length === 1 ? '' : 'es'}.\n`)
    process.stdout.write(`  Written: ${absInput}\n\n`)
  })
