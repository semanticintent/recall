// ─────────────────────────────────────────────────────────
// RECALL — recall scaffold
//
// Reads a component manifest from an installed plugin package
// and generates a working .rcl file pre-populated with the
// correct DATA DIVISION fields and PROCEDURE DIVISION usage.
//
// Designed for future extraction to @semanticintent/recall-tools.
// All logic is in pure functions — no side effects except the
// final file write, which is handled by the CLI command layer.
// ─────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'

// ── Manifest types ───────────────────────────────────────

export interface ManifestAccept {
  name:    string
  kind:    'scalar' | 'group'
  pic:     string | null
  comment: string
}

export interface ManifestGroupChild {
  level:   string
  suffix:  string
  pic:     string | null
  comment: string
}

export interface ManifestComponent {
  file:          string
  define:        string
  intent:        string
  'when-to-use': string
  accepts:       ManifestAccept[]
  'group-shape'?: Record<string, {
    level:    string
    children: ManifestGroupChild[]
  }>
}

export interface ComponentManifest {
  version:      string
  package:      string
  defaultTheme: string
  components:   Record<string, ManifestComponent>
}

// ── Scaffold result ──────────────────────────────────────

export interface ScaffoldResult {
  ok:        boolean
  source?:   string   // generated .rcl source
  error?:    string
  component?: string
  plugin?:   string
}

// ── Manifest resolution ──────────────────────────────────

function resolveManifest(
  pluginPackage: string,
  cwd: string,
): { manifest: ComponentManifest; packageDir: string } | { error: string } {
  try {
    const req = createRequire(join(cwd, 'package.json'))
    const packageDir = dirname(req.resolve(`${pluginPackage}/package.json`))
    const manifestPath = join(packageDir, 'components', 'index.json')

    if (!existsSync(manifestPath)) {
      return {
        error: `No component manifest found in ${pluginPackage}.\n` +
               `Expected: ${manifestPath}\n` +
               `Hint: This plugin does not support recall scaffold yet.`
      }
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ComponentManifest
    return { manifest, packageDir }
  } catch {
    return {
      error: `Cannot resolve package ${pluginPackage}.\n` +
             `Hint: Run npm install ${pluginPackage} in your project directory first.`
    }
  }
}

// ── Source generation ────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function generateWorkingStorage(accepts: ManifestAccept[]): string {
  const scalars = accepts.filter(a => a.kind === 'scalar')
  if (scalars.length === 0) return ''

  const lines = scalars.map(a => {
    const pic     = a.pic ?? 'X(60)'
    const value   = pic === 'URL' ? '"/path"' : pic === '9' ? '"0"' : `"[${a.name}]"`
    const comment = a.comment ? `\n         COMMENT "${a.comment}"` : ''
    return `      01 ${a.name} PIC ${pic} VALUE ${value}.${comment}`
  })

  return lines.join('\n')
}

function generateItemsSection(
  accepts:    ManifestAccept[],
  groupShape: ManifestComponent['group-shape'],
): string {
  const groups = accepts.filter(a => a.kind === 'group')
  if (groups.length === 0) return ''

  const lines: string[] = []

  for (const group of groups) {
    const shape = groupShape?.[group.name]
    if (!shape) {
      // No shape defined — generate a minimal placeholder group
      lines.push(`      01 ${group.name}.`)
      lines.push(`         05 ${group.name}-1 PIC X(60) VALUE "[item 1]".`)
      continue
    }

    lines.push(`      01 ${group.name}.`)

    // Generate two example items from the shape
    for (let i = 1; i <= 2; i++) {
      const hasContainer = shape.children.some(c => c.pic === null)
      if (hasContainer) {
        lines.push(`         05 ${group.name}-${i}.`)
        for (const child of shape.children.filter(c => c.pic !== null)) {
          const value = `"[${group.name}-${i}${child.suffix}]"`
          lines.push(`            10 ${group.name}-${i}${child.suffix} PIC ${child.pic} VALUE ${value}.`)
        }
      } else {
        for (const child of shape.children) {
          const value = `"[${group.name}-${i}${child.suffix}]"`
          lines.push(`         05 ${group.name}-${i}${child.suffix} PIC ${child.pic ?? 'X(60)'} VALUE ${value}.`)
        }
      }
    }
  }

  return lines.join('\n')
}

function generateProcedure(
  componentName: string,
  define:        string,
  accepts:       ManifestAccept[],
): string {
  const withClauses = accepts.map(a => {
    if (a.kind === 'group') {
      return `         USING ${a.name}`
    }
    return `         WITH ${a.name} ${a.name}`
  }).join('\n')

  return [
    `   RENDER-MAIN.`,
    `      DISPLAY ${define}`,
    withClauses + '.',
    `   STOP SECTION.`,
  ].join('\n')
}

// ── Main scaffold function ───────────────────────────────

export function scaffold(opts: {
  plugin:    string
  component: string
  cwd?:      string
}): ScaffoldResult {
  const cwd = opts.cwd ?? process.cwd()

  // 1. Resolve manifest
  const resolved = resolveManifest(opts.plugin, cwd)
  if ('error' in resolved) return { ok: false, error: resolved.error }

  const { manifest, packageDir } = resolved

  // 2. Find component
  const componentKey = opts.component.toUpperCase()
  const component    = manifest.components[componentKey]

  if (!component) {
    const available = Object.keys(manifest.components).join(', ')
    const lower     = componentKey.toLowerCase()
    const suggestion = Object.keys(manifest.components)
      .find(k => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()))
    return {
      ok:    false,
      error: `Component ${componentKey} not found in ${opts.plugin}.\n` +
             `Available: ${available}` +
             (suggestion ? `\nDid you mean: ${suggestion}?` : ''),
    }
  }

  // 3. Resolve theme COPY path
  const themePath  = join(packageDir, manifest.defaultTheme)
  const themeRelative = existsSync(themePath)
    ? `"${opts.plugin}/${manifest.defaultTheme}"`
    : null

  // 4. Resolve component COPY path
  const componentCopy = `"${opts.plugin}/${component.file}"`

  // 5. Generate source sections
  const workingStorage = generateWorkingStorage(component.accepts)
  const itemsSection   = generateItemsSection(component.accepts, component['group-shape'])
  const procedureBody  = generateProcedure(componentKey, component.define, component.accepts)

  // 6. Assemble full .rcl source
  const themeLine = themeRelative
    ? `   COPY FROM ${themeRelative}.`
    : `   CONFIGURATION SECTION.\n      VIEWPORT    RESPONSIVE.\n      COLOR-MODE  DARK.\n      LANGUAGE    EN.`

  const source = [
    `* Generated by recall scaffold`,
    `* Plugin:    ${opts.plugin}`,
    `* Component: ${componentKey}`,
    `* Intent:    ${component.intent}`,
    ``,
    `IDENTIFICATION DIVISION.`,
    `   PROGRAM-ID.   MY-PAGE.`,
    `   PAGE-TITLE.   "My Page".`,
    `   AUTHOR.       .`,
    `   DATE-WRITTEN. ${today()}.`,
    ``,
    `ENVIRONMENT DIVISION.`,
    themeLine,
    ``,
    `DATA DIVISION.`,
    `   WORKING-STORAGE SECTION.`,
    workingStorage || `      * no scalar fields`,
    `   ITEMS SECTION.`,
    itemsSection || `      * no group fields`,
    ``,
    `PROCEDURE DIVISION.`,
    ``,
    procedureBody,
    ``,
    `   STOP RUN.`,
  ].join('\n')

  return {
    ok:        true,
    source,
    component: componentKey,
    plugin:    opts.plugin,
  }
}

// ── List components in a plugin ──────────────────────────

export function listComponents(opts: {
  plugin: string
  cwd?:   string
}): { ok: true; components: Record<string, ManifestComponent>; package: string } |
    { ok: false; error: string } {
  const cwd      = opts.cwd ?? process.cwd()
  const resolved = resolveManifest(opts.plugin, cwd)
  if ('error' in resolved) return { ok: false, error: resolved.error }

  return {
    ok:         true,
    components: resolved.manifest.components,
    package:    opts.plugin,
  }
}
