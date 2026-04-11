import { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parse } from '../../parser/rcl.js'
import { typeCheck } from '../../typechecker/index.js'
import { inspect } from '../../compiler/index.js'

// ─── Pipeline aggregate mode ─────────────────────────────

interface CaseMeta {
  compile_ms:       number
  output_chars:     number
  fields_populated: number
  fields_total:     number
  coverage_pct:     number
  truncations:      number
  human_touches:    number
}

function runPipelineStats(indexPath: string, opts: { json?: boolean }): void {
  if (!existsSync(indexPath)) {
    process.stderr.write(`index.json not found: ${indexPath}\n`)
    process.stderr.write(`Run from a case-studies directory, or pass --index <path>\n`)
    process.exit(1)
  }

  const cases = JSON.parse(readFileSync(indexPath, 'utf-8')) as Array<Record<string, unknown>>
  const withMeta = cases.filter(c => c['meta']) as Array<Record<string, unknown> & { meta: CaseMeta }>

  if (withMeta.length === 0) {
    process.stdout.write('No compiled cases with telemetry meta found in index.json.\n')
    process.stdout.write('Recompile at least one case to generate telemetry.\n')
    return
  }

  const count         = withMeta.length
  const avg_ms        = Math.round(withMeta.reduce((s, c) => s + c.meta.compile_ms, 0) / count)
  const avg_chars     = Math.round(withMeta.reduce((s, c) => s + c.meta.output_chars, 0) / count)
  const avg_coverage  = Math.round(withMeta.reduce((s, c) => s + c.meta.coverage_pct, 0) / count)
  const total_trunc   = withMeta.reduce((s, c) => s + c.meta.truncations, 0)
  const avg_touches   = Math.round(withMeta.reduce((s, c) => s + c.meta.human_touches, 0) / count * 10) / 10

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      compiled_cases:   count,
      avg_compile_ms:   avg_ms,
      avg_output_chars: avg_chars,
      avg_coverage_pct: avg_coverage,
      total_truncations: total_trunc,
      avg_human_touches: avg_touches,
    }, null, 2) + '\n')
    return
  }

  const pad = (s: string) => s.padEnd(24)
  const lines = [
    '',
    `Pipeline Telemetry  ${indexPath}`,
    hr,
    `  ${pad('Compiled cases:')}   ${count}`,
    `  ${pad('Avg compile_ms:')}   ${avg_ms}`,
    `  ${pad('Avg output_chars:')} ${avg_chars.toLocaleString()}`,
    `  ${pad('Avg coverage_pct:')} ${avg_coverage}%`,
    `  ${pad('Total truncations:')}${total_trunc}`,
    `  ${pad('Avg human_touches:')}${avg_touches}`,
    '',
  ]
  process.stdout.write(lines.join('\n') + '\n')
}

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
  .argument('[file]', 'path to .rcl source file (omit for pipeline telemetry aggregate)')
  .option('--json', 'output as machine-readable JSON')
  .option('--index <path>', 'path to index.json for pipeline mode (default: uc-000/index.json in CWD)')
  .description('Show stats for a .rcl file, or aggregate telemetry across all compiled cases')
  .addHelpText('after', `
  Single-file orientation (run before editing):
    recall stats page.rcl                   field counts, groups, elements, warnings
    recall stats page.rcl --json            machine-readable summary

  Pipeline telemetry (run from case-studies directory):
    recall stats                            aggregate compile_ms, coverage, truncations
    recall stats --json                     machine-readable aggregate
    recall stats --index path/to/index.json explicit index path`)
  .action((file: string | undefined, opts: { json?: boolean; index?: string }) => {
    // No file argument — pipeline aggregate mode
    if (!file) {
      const indexPath = opts.index
        ? resolve(opts.index)
        : resolve(join(process.cwd(), 'uc-000', 'index.json'))
      runPipelineStats(indexPath, opts)
      return
    }

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
