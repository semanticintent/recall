import { Command } from 'commander'
import { compileCommand } from './commands/compile.js'
import { checkCommand } from './commands/check.js'
import { buildCommand } from './commands/build.js'
import { schemaCommand } from './commands/schema.js'
import { explainCommand } from './commands/explain.js'
import { statsCommand } from './commands/stats.js'
import { historyCommand } from './commands/history.js'
import { fixCommand } from './commands/fix.js'
import { scaffoldCommand } from './commands/scaffold.js'
import { expandCommand } from './commands/expand.js'
import { crdCommand } from './commands/crd.js'
import { manifestCommand } from './commands/manifest.js'
import { diffCommand } from './commands/diff.js'
import { auditCommand } from './commands/audit.js'

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

  Pipeline telemetry (run from case-studies directory):
    recall stats                       aggregate compile_ms, coverage, truncations
    recall stats --json                machine-readable aggregate
    recall stats --index <path>        explicit path to index.json

  Semantic diff between two .rcl sources:
    recall diff v1.rcl v2.rcl          compare two files
    recall diff HEAD~1 HEAD page.rcl   compare git revisions
    recall diff --format json v1.rcl v2.rcl  machine-readable output
    recall diff HEAD~1 HEAD page.rcl --suggest-audit  suggest an AUDIT DIVISION entry

  AUDIT DIVISION — provenance and change log:
    recall audit page.rcl              print change log
    recall audit page.rcl --since 2026-04-08  filter by date
    recall audit page.rcl --format json  machine-readable

  Look up a diagnostic code:
    recall explain RCL-007             human-readable entry
    recall explain RCL-007 --json      machine-readable JSON
    recall explain --list              all codes with summaries

  Scaffold a new .rcl from a plugin component:
    recall scaffold PAGE-HERO --plugin @semanticintent/recall-ui
    recall scaffold PAGE-HERO --plugin @semanticintent/recall-ui --out ./my-page.rcl
    recall scaffold --list --plugin @semanticintent/recall-ui

  Expand WITH INTENT clauses using an AI compositor:
    recall expand page.rcl              calls compositor, writes page.expanded.rcl
    recall expand page.rcl --dry-run    print payload without making an API call
    recall expand page.rcl --out ./out  write to a specific output directory

  Validate Common Record Description (brief JSON vs DATA DIVISION):
    recall crd page.rcl --against brief.json
    recall crd page.rcl --against brief.json --format json
    recall crd page.rcl --against brief.json --strict

  Print the Pipeline Manifest — unified AI entry point:
    recall manifest                                        human-readable summary
    recall manifest --json                                 machine-readable JSON
    recall manifest --layer crd                            single layer
    recall manifest --json --plugin @stratiqx/recall-components  include component list`)

program.addCommand(compileCommand)
program.addCommand(checkCommand)
program.addCommand(buildCommand)
program.addCommand(schemaCommand)
program.addCommand(explainCommand)
program.addCommand(statsCommand)
program.addCommand(historyCommand)
program.addCommand(fixCommand)
program.addCommand(scaffoldCommand)
program.addCommand(expandCommand)
program.addCommand(crdCommand)
program.addCommand(manifestCommand)
program.addCommand(diffCommand)
program.addCommand(auditCommand)

program.parse()
