import { Command } from 'commander'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { parse } from '../../parser/rcl.js'
import { inspect } from '../../compiler/index.js'

interface FieldSnapshot {
  name: string
  pic:  string
}

function extractFields(program: ReturnType<typeof parse>): FieldSnapshot[] {
  const result: FieldSnapshot[] = []
  function walk(fields: ReturnType<typeof parse>['data']['workingStorage']): void {
    for (const f of fields) {
      result.push({ name: f.name, pic: f.pic })
      walk(f.children)
    }
  }
  walk(program.data.workingStorage)
  walk(program.data.items)
  return result
}

function diffFields(before: FieldSnapshot[], after: FieldSnapshot[]): {
  added: FieldSnapshot[]
  removed: FieldSnapshot[]
  changed: Array<{ name: string; from: string; to: string }>
} {
  const beforeMap = new Map(before.map(f => [f.name, f.pic]))
  const afterMap  = new Map(after.map(f => [f.name, f.pic]))

  const added   = after.filter(f => !beforeMap.has(f.name))
  const removed = before.filter(f => !afterMap.has(f.name))
  const changed: Array<{ name: string; from: string; to: string }> = []

  for (const [name, pic] of afterMap) {
    if (beforeMap.has(name) && beforeMap.get(name) !== pic) {
      changed.push({ name, from: beforeMap.get(name)!, to: pic })
    }
  }

  return { added, removed, changed }
}

export const historyCommand = new Command('history')
  .argument('<file>', 'path to .rcl source file')
  .option('--commits <n>', 'number of commits to look back', '1')
  .option('--json', 'output as machine-readable JSON')
  .description('Show DATA field changes between commits')
  .addHelpText('after', `
  Requires git. Diffs DATA fields between HEAD and HEAD~n.
  Useful for understanding what changed before editing.`)
  .action((file: string, opts: { commits?: string; json?: boolean }) => {
    const absInput = resolve(file)
    if (!existsSync(absInput)) {
      process.stderr.write(`File not found: ${absInput}\n`)
      process.exit(1)
    }

    const n = parseInt(opts.commits ?? '1', 10)
    if (isNaN(n) || n < 1) {
      process.stderr.write(`--commits must be a positive integer\n`)
      process.exit(1)
    }

    // Check git is available and file is tracked
    let oldSource: string
    try {
      oldSource = execSync(`git show HEAD~${n}:"${file}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch {
      process.stderr.write(`git show HEAD~${n}:${file} failed — is this file tracked and does HEAD~${n} exist?\n`)
      process.exit(1)
    }

    // Current state via inspect (full pipeline)
    const currentResult = inspect(absInput)
    if (!currentResult.program) {
      process.stderr.write(`Could not parse current ${file}\n`)
      process.exit(1)
    }

    // Past state: parse the raw old source through the same pipeline steps
    // We use a temp approach: write to a temp file and inspect it,
    // or just parse the raw source directly for field extraction
    let oldProgram: ReturnType<typeof parse>
    try {
      // Parse old source directly — field names/PIC are usually stable even without preprocessing
      oldProgram = parse(oldSource)
    } catch {
      process.stderr.write(`Could not parse HEAD~${n} version of ${file}\n`)
      process.exit(1)
    }

    const before = extractFields(oldProgram)
    const after  = extractFields(currentResult.program)
    const diff   = diffFields(before, after)

    const commitRef = `HEAD~${n}..HEAD`
    const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0

    if (opts.json) {
      process.stdout.write(JSON.stringify({
        file: absInput,
        range: commitRef,
        added:   diff.added,
        removed: diff.removed,
        changed: diff.changed,
        unchanged: after.length - diff.added.length - diff.changed.length,
      }, null, 2) + '\n')
      return
    }

    const hr = '─'.repeat(60)
    const lines: string[] = ['', `${absInput}  (${commitRef})`, hr]

    if (!hasChanges) {
      lines.push('  No DATA field changes.')
    } else {
      if (diff.added.length > 0) {
        lines.push(`  Added (${diff.added.length}):`)
        for (const f of diff.added) {
          lines.push(`    + ${f.name.padEnd(32)} ${f.pic}`)
        }
      }
      if (diff.removed.length > 0) {
        lines.push(`  Removed (${diff.removed.length}):`)
        for (const f of diff.removed) {
          lines.push(`    - ${f.name.padEnd(32)} ${f.pic}`)
        }
      }
      if (diff.changed.length > 0) {
        lines.push(`  Changed (${diff.changed.length}):`)
        for (const c of diff.changed) {
          lines.push(`    ~ ${c.name.padEnd(32)} ${c.from} → ${c.to}`)
        }
      }
    }

    lines.push('')
    process.stdout.write(lines.join('\n') + '\n')
  })
