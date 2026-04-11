# Contributing to RECALL

Thanks for your interest. This document covers the areas where contributions are most valuable and how to make one.

---

## Getting started

```sh
git clone https://github.com/semanticintent/recall-compiler
cd recall-compiler
npm install
npm test         # 124 tests — all should pass before you start
npm run build    # compile TypeScript → dist/
```

---

## Where to contribute

### Bug reports

Open an issue. Include the `.rcl` source that triggers the bug, the diagnostic or output you got, and what you expected. The more minimal the reproduction, the faster the fix.

### Diagnostic improvements

The diagnostic codes in `src/diagnostics/codes.ts` have `message`, `description`, `example`, and `fix` fields. If a code's message is unclear or its fix suggestion is wrong, that's a straightforward improvement — no parser changes required.

### New elements

New RECALL elements are registered in the generator (`src/generator/html.ts`). Look at how `BADGE` or `CALLOUT` are implemented — the pattern is a renderer function that takes a `DisplayStatement` and `DataDivision` and returns an HTML string.

### Parser and type-checker changes

These are the most sensitive areas. The parser never throws — it always produces a partial AST and surfaces issues as `ParseWarning` entries. The type-checker accumulates all diagnostics before returning. Any change here requires tests in `tests/`.

### Tests

Tests live in `tests/`. They use [vitest](https://vitest.dev). Each test file corresponds to a compiler subsystem. The suite runs in under 250ms — keep it that way.

---

## Before sending a PR

- `npm test` — all 124 tests pass
- `npm run build` — no TypeScript errors
- `recall check examples/landing.rcl` — no regressions on the canonical example
- For parser or type-checker changes, add tests covering the new behaviour and edge cases

Open an issue first for significant changes (new division, new element vocabulary, grammar changes). Small fixes and diagnostic improvements can go straight to a PR.

---

## Project structure

```
src/
├── parser/         .rcl source → ReclProgram AST
├── typechecker/    AST → DiagnosticCollector (type and structural checks)
├── generator/      AST → HTML string
├── compiler/       orchestrates parse + typecheck + generate; CLI-facing API
├── diagnostics/    DiagnosticCollector, code registry (all 33 RCL codes)
├── diff/           semantic diff between two .rcl sources
├── expand/         WITH INTENT compositor integration
├── manifest/       Pipeline Manifest — machine-readable project summary
├── scaffold/       component scaffolding from plugin manifests
├── schema/         element registry and PIC type definitions
└── cli/            recall CLI commands
```

---

## License

By contributing you agree that your contributions will be licensed under the MIT License.
