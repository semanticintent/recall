import { Command } from 'commander'
import { compileCommand } from './commands/compile.js'
import { checkCommand } from './commands/check.js'
import { buildCommand } from './commands/build.js'

const program = new Command()

program
  .name('recall')
  .description('RECALL — the source that remembers. A COBOL-inspired web interface language.')
  .version('0.2.0')

program.addCommand(compileCommand)
program.addCommand(checkCommand)
program.addCommand(buildCommand)

program.parse()
