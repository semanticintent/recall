import { Command } from 'commander'
import { check } from '../../compiler/index.js'

export const checkCommand = new Command('check')
  .argument('<file>', 'path to .rcl source file')
  .description('Validate .rcl syntax without compiling')
  .action((file: string) => {
    const result = check(file)

    if (result.ok) {
      console.log(`\n✓ SYNTAX VALID`)
      console.log(`  FILE: ${result.inputPath}\n`)
    } else {
      console.error(`\nRECALL SYNTAX ERRORS`)
      console.error(`  FILE: ${result.inputPath}\n`)
      result.errors.forEach(e => console.error(`  ✗ ${e}`))
      console.error('')
      process.exit(1)
    }
  })
