import { Command } from 'commander'
import { compile, loadPlugins } from '../../compiler/index.js'

export const compileCommand = new Command('compile')
  .argument('<file>', 'path to .rcl source file')
  .option('--out <dir>', 'output directory (default: same as source)')
  .option('--strict', 'treat warnings as errors')
  .description('Transpile a .rcl source file to a self-contained HTML file')
  .action(async (file: string, options: { out?: string; strict?: boolean }) => {
    await loadPlugins(file)
    const result = compile(file, options.out, { strict: options.strict })

    if (result.ok) {
      console.log(`\n✓ COMPILED SUCCESSFULLY`)
      console.log(`  SOURCE: ${result.inputPath}`)
      console.log(`  OUTPUT: ${result.outputPath}\n`)
      // Exit 2 — warnings present, output written (not an error, but not clean)
      if (result.warnings) process.exit(2)
    } else {
      // Exit 1 — errors, no output written
      console.error(`\n  ${result.error}\n`)
      process.exit(1)
    }
  })
