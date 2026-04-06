import { Command } from 'commander'
import { CODES, getCode } from '../../diagnostics/codes.js'

const hr = '─'.repeat(60)

function pad(s: string, n: number): string {
  return s.padEnd(n)
}

function formatEntry(code: string, json: boolean): void {
  const def = getCode(code)

  if (json) {
    process.stdout.write(JSON.stringify(def, null, 2) + '\n')
    return
  }

  const severityColor = def.severity === 'error' ? '\x1b[31m' : '\x1b[33m'
  const reset = '\x1b[0m'
  const bold  = '\x1b[1m'
  const dim   = '\x1b[2m'

  const lines: string[] = [
    '',
    `${bold}${severityColor}${def.code}${reset}  ${bold}${def.message}${reset}`,
    `${dim}${def.severity.toUpperCase()}  ·  ${def.category}${reset}`,
    hr,
    '',
    def.description,
    '',
    `${bold}Example${reset}`,
    ...def.example.split('\n').map(l => `  ${dim}${l}${reset}`),
    '',
    `${bold}Fix${reset}`,
    ...def.fix.split('\n').map(l => `  ${l}`),
  ]

  if (def.seeAlso.length > 0) {
    lines.push('', `${dim}See also: ${def.seeAlso.join(', ')}${reset}`)
  }

  lines.push('')
  process.stdout.write(lines.join('\n') + '\n')
}

export const explainCommand = new Command('explain')
  .description('Look up a diagnostic code — description, example, and fix')
  .addHelpText('after', `
  Examples:
    recall explain RCL-007            human-readable entry
    recall explain RCL-007 --json     machine-readable JSON
    recall explain --list             all codes with one-line summaries`)
  .argument('[code]', 'diagnostic code to explain (e.g. RCL-007)')
  .option('--json', 'output as machine-readable JSON')
  .option('--list', 'list all codes with one-line summaries')
  .action((code: string | undefined, opts: { json?: boolean; list?: boolean }) => {
    // ── --list ─────────────────────────────────────────────
    if (opts.list) {
      const errors   = Object.values(CODES).filter(c => c.severity === 'error')
      const warnings = Object.values(CODES).filter(c => c.severity === 'warning')

      if (opts.json) {
        process.stdout.write(JSON.stringify(
          Object.fromEntries(Object.entries(CODES).map(([k, v]) => [k, {
            severity:    v.severity,
            category:    v.category,
            message:     v.message,
            description: v.description,
          }])),
          null, 2
        ) + '\n')
        return
      }

      process.stdout.write(`\nErrors (${errors.length})\n${hr}\n`)
      for (const c of errors) {
        process.stdout.write(`  ${pad(c.code, 10)} ${pad(c.category, 18)} ${c.message}\n`)
      }
      process.stdout.write(`\nWarnings (${warnings.length})\n${hr}\n`)
      for (const c of warnings) {
        process.stdout.write(`  ${pad(c.code, 10)} ${pad(c.category, 18)} ${c.message}\n`)
      }
      process.stdout.write('\n')
      return
    }

    // ── single code ────────────────────────────────────────
    if (!code) {
      process.stderr.write('Provide a code (e.g. recall explain RCL-007) or use --list\n')
      process.exit(1)
    }

    const normalised = code.toUpperCase()
    if (!CODES[normalised]) {
      process.stderr.write(`Unknown code: ${code}\nRun recall explain --list to see all valid codes.\n`)
      process.exit(1)
    }

    formatEntry(normalised, opts.json ?? false)
  })
