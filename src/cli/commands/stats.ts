import { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '../../parser/rcl.js'
import { typeCheck } from '../../typechecker/index.js'
import { inspect } from '../../compiler/index.js'

const hr = '─'.repeat(60)

function countStatements(stmts: ReturnType<typeof parse>['procedure']['sections'][0]['statements']): number {
  let n = stmts.length
  for (const s of stmts) n += countStatements(s.children)
  return n
}

function flatFields(fields: ReturnType<typeof parse>['data']['workingStorage']): typeof fields {
  const result: typeof fields = []
  for (const f of fields) {
    result.push(f)
    result.push(...flatFields(f.children))
  }
  return result
}

export const statsCommand = new Command('stats')
  .argument('<file>', 'path to .rcl source file')
  .option('--json', 'output as machine-readable JSON')
  .description('Show a quick orientation summary of a .rcl file before editing')
  .addHelpText('after', `
  Run before editing to know what you are working with:
  field counts, groups, elements used, warnings, plugins.`)
  .action((file: string, opts: { json?: boolean }) => {
    const absInput = resolve(file)
    if (!existsSync(absInput)) {
      process.stderr.write(`File not found: ${absInput}\n`)
      process.exit(1)
    }

    // inspect() runs the full preprocessor pipeline and returns the parsed program
    const inspectResult = inspect(absInput)

    if (!inspectResult.program) {
      process.stderr.write(`Parse error: could not parse ${absInput}\n`)
      process.exit(1)
    }

    const program     = inspectResult.program
    const loadEntries = inspectResult.entries
    const source      = readFileSync(absInput, 'utf-8')

    // ── Gather stats ─────────────────────────────────────────
    const wsFields    = flatFields(program.data.workingStorage)
    const itemFields  = flatFields(program.data.items)
    const groups      = program.data.items.filter(f => f.children.length > 0)
    const scalars     = wsFields.filter(f => f.children.length === 0)
    const commented   = [...wsFields, ...itemFields].filter(f => f.comment)
    const plugins     = program.environment.plugins
    const sections    = program.procedure.sections
    const totalStmts  = sections.reduce((n, s) => n + countStatements(s.statements), 0)
    const sourceLines = source.split('\n').length

    // Quick type-check for warning count (no output)
    const dc = typeCheck(program, absInput, { strict: false })

    const groupSummary = groups.map(g => ({
      name: g.name,
      rows: g.children.length,
    }))

    if (opts.json) {
      process.stdout.write(JSON.stringify({
        file:         absInput,
        sourceLines,
        scalars:      scalars.length,
        groups:       groups.length,
        groupDetail:  groupSummary,
        loadFrom:     loadEntries.length,
        sections:     sections.length,
        displays:     totalStmts,
        plugins:      plugins.length > 0 ? plugins : [],
        errors:       dc.errors().length,
        warnings:     dc.warnings().length,
        commented:    commented.length,
      }, null, 2) + '\n')
      return
    }

    // ── Human-readable output ─────────────────────────────────
    const lines: string[] = ['', `${absInput}`, hr]
    lines.push(`  Source         ${sourceLines} lines`)
    lines.push(`  Scalars        ${scalars.length} WORKING-STORAGE fields`)
    lines.push(`  Groups         ${groups.length} ITEMS groups`)

    for (const g of groupSummary) {
      lines.push(`    ${g.name.padEnd(28)} ${g.rows} row${g.rows === 1 ? '' : 's'}`)
    }

    if (loadEntries.length > 0) {
      lines.push(`  LOAD FROM      ${loadEntries.length} file${loadEntries.length === 1 ? '' : 's'}`)
      for (const e of loadEntries) {
        lines.push(`    ${e.file.split('/').pop()!.padEnd(30)} ${e.generated.length} generated lines`)
      }
    }

    lines.push(`  Sections       ${sections.length}`)
    lines.push(`  DISPLAY        ${totalStmts} statements`)

    if (plugins.length > 0) {
      lines.push(`  Plugins        ${plugins.join(', ')}`)
    }

    if (commented.length > 0) {
      lines.push(`  COMMENT        ${commented.length} field${commented.length === 1 ? '' : 's'} with intent notes`)
    }

    const errCount  = dc.errors().length
    const warnCount = dc.warnings().length
    if (errCount > 0)  lines.push(`  Errors         ${errCount}`)
    if (warnCount > 0) lines.push(`  Warnings       ${warnCount}`)
    if (errCount === 0 && warnCount === 0) lines.push(`  Diagnostics    clean`)

    lines.push('')
    process.stdout.write(lines.join('\n') + '\n')
  })
