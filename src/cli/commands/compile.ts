import { Command } from 'commander'
import { compile } from '../../compiler/index.js'

export const compileCommand = new Command('compile')
  .argument('<file>', 'path to .rcl source file')
  .option('--out <dir>', 'output directory (default: same as source)')
  .description('Transpile a .rcl source file to a self-contained HTML file')
  .action((file: string, options: { out?: string }) => {
    const result = compile(file, options.out)

    if (result.ok) {
      console.log(`\n✓ COMPILED SUCCESSFULLY`)
      console.log(`  SOURCE: ${result.inputPath}`)
      console.log(`  OUTPUT: ${result.outputPath}\n`)
    } else {
      console.error(`\nRECALL COMPILATION ERROR`)
      console.error(`  FILE: ${result.inputPath}`)
      console.error(`\n  ${result.error}\n`)
      process.exit(1)
    }
  })
