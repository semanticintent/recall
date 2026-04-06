import { Command } from 'commander'
import { check } from '../../compiler/index.js'

export const checkCommand = new Command('check')
  .argument('<file>', 'path to .rcl source file')
  .option('--strict', 'treat warnings as errors')
  .option('--format <fmt>', 'output format: text (default) or json')
  .description('Type-check a .rcl file without compiling — reports all errors and warnings')
  .action((file: string, options: { strict?: boolean; format?: string }) => {
    const formatJson = options.format === 'json'
    const result = check(file, { strict: options.strict, formatJson })

    if (result.ok) {
      if (!formatJson) {
        console.log(`\n  ✓  ${result.inputPath}\n`)
      }
      // Exit 2 — warnings present but no errors
      if (result.warnings) process.exit(2)
    } else {
      // Exit 1 — errors present
      process.exit(1)
    }
  })
