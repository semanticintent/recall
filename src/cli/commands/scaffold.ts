import { Command } from 'commander'
import { writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { scaffold, listComponents } from '../../scaffold/index.js'

export const scaffoldCommand = new Command('scaffold')
  .description('Generate a working .rcl file from a plugin component manifest')
  .argument('[component]', 'Component name to scaffold (e.g. PAGE-HERO)')
  .requiredOption('--plugin <package>', 'Plugin package to scaffold from (e.g. @semanticintent/recall-ui)')
  .option('--list', 'List all available components in the plugin')
  .option('--out <path>', 'Output file path or directory (default: print to stdout)')
  .action((component: string | undefined, opts: {
    plugin:  string
    list?:   boolean
    out?:    string
  }) => {

    // ── --list mode ──────────────────────────────────────
    if (opts.list) {
      const result = listComponents({ plugin: opts.plugin })
      if (!result.ok) {
        process.stderr.write(`\nERROR: ${result.error}\n\n`)
        process.exit(1)
      }
      process.stdout.write(`\nComponents in ${result.package}:\n\n`)
      for (const [name, def] of Object.entries(result.components)) {
        const accepts = def.accepts.map(a => `${a.name} (${a.kind})`).join(', ')
        process.stdout.write(`  ${name.padEnd(20)} ${def.intent}\n`)
        process.stdout.write(`  ${''.padEnd(20)} Accepts: ${accepts}\n\n`)
      }
      return
    }

    // ── Scaffold mode ────────────────────────────────────
    if (!component) {
      process.stderr.write(
        `\nERROR: Component name is required.\n` +
        `Usage: recall scaffold PAGE-HERO --plugin @semanticintent/recall-ui\n` +
        `       recall scaffold --list --plugin @semanticintent/recall-ui\n\n`
      )
      process.exit(1)
    }

    const result = scaffold({ plugin: opts.plugin, component })

    if (!result.ok) {
      process.stderr.write(`\nERROR: ${result.error}\n\n`)
      process.exit(1)
    }

    const source = result.source!

    // ── Output: stdout ───────────────────────────────────
    if (!opts.out) {
      process.stdout.write(source + '\n')
      return
    }

    // ── Output: file or directory ────────────────────────
    let outPath = resolve(opts.out)

    // If --out is a directory, generate filename from component name
    if (existsSync(outPath) && !outPath.endsWith('.rcl')) {
      const filename = result.component!.toLowerCase().replace(/-/g, '-') + '.rcl'
      outPath = join(outPath, filename)
    }

    if (!outPath.endsWith('.rcl')) outPath += '.rcl'

    if (existsSync(outPath)) {
      process.stderr.write(
        `\nERROR: ${outPath} already exists.\n` +
        `Hint: Choose a different output path or delete the existing file.\n\n`
      )
      process.exit(1)
    }

    writeFileSync(outPath, source, 'utf-8')
    process.stdout.write(
      `\nScaffolded ${result.component} from ${result.plugin}\n` +
      `Output: ${outPath}\n\n` +
      `Next steps:\n` +
      `  1. Fill in your content values in DATA DIVISION\n` +
      `  2. recall check ${outPath}\n` +
      `  3. recall compile ${outPath}\n\n`
    )
  })
