import { Command } from 'commander'
import { getSchema, formatSchema } from '../../schema/index.js'

export const schemaCommand = new Command('schema')
  .description('Print the RECALL language schema — all elements, PIC types, and divisions')
  .addHelpText('after', `
  Run this before writing any .rcl source to know what elements, PIC types,
  and clauses are valid. Use --json for programmatic consumption (e.g. by Claude).`)
  .option('--json', 'Output as machine-readable JSON (default: human-readable text)')
  .action((opts: { json?: boolean }) => {
    const schema = getSchema()
    if (opts.json) {
      process.stdout.write(JSON.stringify(schema, null, 2) + '\n')
    } else {
      process.stdout.write(formatSchema(schema))
    }
  })
