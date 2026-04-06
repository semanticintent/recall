import { Command } from 'commander'
import { compileCommand } from './commands/compile.js'
import { checkCommand } from './commands/check.js'
import { buildCommand } from './commands/build.js'
import { schemaCommand } from './commands/schema.js'
import { explainCommand } from './commands/explain.js'

const program = new Command()

program
  .name('recall')
  .description('RECALL — the source that remembers. A COBOL-inspired web interface language.')
  .version('0.2.0')
  .addHelpText('after', `
Workflow:
  Before writing .rcl — read the language schema:
    recall schema --json          all elements, PIC types, divisions (machine-readable)
    recall schema                 same, human-readable

  Before writing DISPLAY statements — inspect LOAD FROM output:
    recall check <file> --inspect show every DATA symbol generated from LOAD FROM

  Type-check without compiling:
    recall check <file>           text diagnostics
    recall check <file> --strict  warnings promoted to errors
    recall check <file> --format json  machine-readable diagnostics

  Look up a diagnostic code:
    recall explain RCL-007        human-readable entry
    recall explain RCL-007 --json machine-readable JSON
    recall explain --list         all codes with summaries`)

program.addCommand(compileCommand)
program.addCommand(checkCommand)
program.addCommand(buildCommand)
program.addCommand(schemaCommand)
program.addCommand(explainCommand)

program.parse()
