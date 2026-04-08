import { Command } from 'commander'
import { expand } from '../../expand/index.js'

export const expandCommand = new Command('expand')
  .description('Expand WITH INTENT clauses using an AI compositor')
  .argument('<file>', 'RECALL source file (.rcl)')
  .option('--dry-run', 'Print compositor payload without making an API call')
  .option('--out <dir>', 'Output directory for the expanded file (default: same as input)')
  .option('--api-key <key>', 'Anthropic API key (default: $ANTHROPIC_API_KEY)')
  .option('--model <model>', 'Model to use (default: claude-opus-4-6)')
  .action(async (file: string, opts: {
    dryRun?:  boolean
    out?:     string
    apiKey?:  string
    model?:   string
  }) => {
    const result = await expand({
      inputPath: file,
      outDir:    opts.out,
      dryRun:    opts.dryRun,
      apiKey:    opts.apiKey,
      model:     opts.model,
    })

    if (opts.dryRun) {
      if (!result.ok) {
        process.stderr.write(`\nERROR: ${result.error}\n\n`)
        process.exit(1)
      }
      process.stdout.write(`\nCompositor payload(s) for ${file}:\n\n`)
      for (const payload of result.payloads ?? []) {
        process.stdout.write(JSON.stringify(payload, null, 2) + '\n\n')
      }
      return
    }

    if (!result.ok) {
      process.stderr.write(`\nERROR: ${result.error}\n\n`)
      process.exit(1)
    }

    process.stdout.write(
      `\nExpanded: ${result.outputPath}\n\n` +
      `Next steps:\n` +
      `  1. Review the expanded source\n` +
      `  2. recall check ${result.outputPath}\n` +
      `  3. Rename to ${file} and commit\n\n`
    )
  })
