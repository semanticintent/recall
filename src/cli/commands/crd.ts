import { Command } from 'commander'
import { validateCRD, formatCRDResult } from '../../compiler/crd.js'

export const crdCommand = new Command('crd')
  .argument('<file>', 'path to .rcl source file')
  .option('--against <brief>', 'brief JSON to validate against')
  .option('--format <fmt>', 'output format: text (default) or json')
  .option('--strict', 'treat warnings as errors')
  .option('--quiet', 'suppress output; use exit code only (0=clean, 1=errors, 2=warnings)')
  .description('Validate Common Record Description — brief JSON against DATA DIVISION')
  .addHelpText('after', `
  Checks three agreements across the pipeline layers:
    CRD-001  Brief field not in DATA DIVISION
    CRD-002  DATA DIVISION field not in brief (warning)
    CRD-003  Brief value exceeds PIC X(n) — will truncate (warning)
    CRD-004  Group cardinality mismatch

  Examples:
    recall crd uc-230.rcl --against uc-230.json
    recall crd uc-230.rcl --against uc-230.json --format json
    recall crd uc-230.rcl --against uc-230.json --strict`)
  .action((file: string, opts: {
    against?: string
    format?:  string
    strict?:  boolean
    quiet?:   boolean
  }) => {
    if (!opts.against) {
      console.error('  Error: --against <brief.json> is required')
      process.exit(1)
    }

    const result = validateCRD(file, opts.against, { strict: opts.strict })
    const formatJson = opts.format === 'json'

    if (formatJson) {
      process.stdout.write(JSON.stringify({
        ok:       result.ok,
        rclPath:  result.rclPath,
        briefPath: result.briefPath,
        errors:   result.errors,
        warnings: result.warnings,
      }, null, 2) + '\n')
    } else if (!opts.quiet) {
      process.stdout.write(formatCRDResult(result))
    }

    if (!result.ok) process.exit(1)
    if (result.warnings.length > 0) process.exit(2)
    process.exit(0)
  })
