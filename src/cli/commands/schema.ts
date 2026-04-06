import { Command } from 'commander'
import { getSchema, formatSchema } from '../../schema/index.js'

export const schemaCommand = new Command('schema')
  .description('Print the RECALL language schema — all elements, PIC types, and divisions')
  .option('--json', 'Output as machine-readable JSON (default: human-readable text)')
  .action((opts: { json?: boolean }) => {
    const schema = getSchema()
    if (opts.json) {
      process.stdout.write(JSON.stringify(schema, null, 2) + '\n')
    } else {
      process.stdout.write(formatSchema(schema))
    }
  })
