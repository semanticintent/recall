import { Command } from 'commander'
import { compileCommand } from './commands/compile.js'
import { checkCommand } from './commands/check.js'
import { buildCommand } from './commands/build.js'
import { schemaCommand } from './commands/schema.js'
import { explainCommand } from './commands/explain.js'
import { statsCommand } from './commands/stats.js'
import { historyCommand } from './commands/history.js'
import { fixCommand } from './commands/fix.js'

const program = new Command()

program
  .name('recall')
  .description('RECALL — the source that remembers. A COBOL-inspired web interface language.')
  .version('0.8.6')
  .addHelpText('after', `
Workflow:
  Before writing .rcl — read the language schema:
    recall schema --json          all elements, PIC types, divisions (machine-readable)
    recall schema                 same, human-readable

  Before writing DISPLAY statements — inspect LOAD FROM output:
    recall check <file> --inspect show every DATA symbol generated from LOAD FROM

  Type-check without compiling:
    recall check <file>                text diagnostics
    recall check <file> --strict       warnings promoted to errors
    recall check <file> --format json  machine-readable diagnostics
    recall check <file> --quiet        exit-code only (0=clean, 1=errors, 2=warnings)

  Auto-fix safe diagnostics:
    recall fix <file> --dry-run        preview what would change
    recall fix <file> --yes            apply PIC resize + AUTHOR fixes

  Track DATA field changes across commits:
    recall history <file>              diff HEAD~1 → HEAD
    recall history <file> --commits 3  look back 3 commits

  Orient before editing an existing file:
    recall stats <file>                field counts, groups, elements, warnings
    recall stats <file> --json         machine-readable summary

  Look up a diagnostic code:
    recall explain RCL-007             human-readable entry
    recall explain RCL-007 --json      machine-readable JSON
    recall explain --list              all codes with summaries`)

program.addCommand(compileCommand)
program.addCommand(checkCommand)
program.addCommand(buildCommand)
program.addCommand(schemaCommand)
program.addCommand(explainCommand)
program.addCommand(statsCommand)
program.addCommand(historyCommand)
program.addCommand(fixCommand)

program.parse()
