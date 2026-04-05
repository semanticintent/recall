import { Command } from 'commander'
import { build } from '../../compiler/index.js'

export const buildCommand = new Command('build')
  .argument('<dir>', 'source directory containing .rcl files')
  .option('--out <dir>', 'output directory (default: public/)')
  .description('Compile all .rcl files in a directory to self-contained HTML')
  .action(async (dir: string, options: { out?: string }) => {
    const result = await build(dir, options.out)

    if (result.errors.length > 0) {
      console.error(`\nRECALL BUILD ERRORS`)
      result.errors.forEach(e => {
        console.error(`  ✗ ${e.inputPath}`)
        console.error(`    ${e.error}`)
      })
    }

    if (result.compiled.length > 0) {
      console.log(`\n✓ BUILD COMPLETE`)
      console.log(`  SOURCE: ${result.srcDir}`)
      console.log(`  OUTPUT: ${result.outDir}`)
      console.log(`  PAGES:  ${result.compiled.length} compiled`)
      result.compiled.forEach(r => {
        console.log(`    → ${r.outputPath}`)
      })
      console.log('')
    }

    if (!result.ok) {
      console.error(`  ${result.errors.length} error(s). BUILD FAILED.\n`)
      process.exit(1)
    }
  })
