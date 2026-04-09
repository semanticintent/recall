// ─────────────────────────────────────────────────────────
// RECALL — Pipeline Manifest
//
// Assembles all four schema layers into one machine-readable
// payload. The single entry point an AI orchestrator reads
// before touching anything in the pipeline.
//
// Lineage: Hopper's 1959 Program Library Directory —
// the catalogue of what exists and what contract each
// entry honours.
// ─────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { getSchema } from '../schema/index.js'
import type { RecallSchema } from '../schema/index.js'

// ── Types ────────────────────────────────────────────────

export interface LanguageLayer {
  command: string
  purpose: string
  data:    RecallSchema
}

export interface ComponentsLayer {
  package:    string
  manifest:   string
  purpose:    string
  components: string[] | null  // null = not resolved; pass --plugin to populate
}

export interface CRDLayer {
  document: string
  command:  string
  purpose:  string
  checks:   string[]
}

export interface CompositorLayer {
  document: string
  command:  string
  purpose:  string
}

export interface ManifestLayers {
  language:   LanguageLayer
  components: ComponentsLayer
  crd:        CRDLayer
  compositor: CompositorLayer
}

export interface PipelineManifest {
  schema:      string
  generated:   string
  philosophy:  string
  layers:      ManifestLayers
  methodology: Record<string, string>
}

// ── Core builder ─────────────────────────────────────────

export function getManifest(opts: { plugin?: string } = {}): PipelineManifest {
  return {
    schema:    'recall-manifest/1.0',
    generated: new Date().toISOString(),
    philosophy:
      'Structured publishing language. Source is the artifact. ' +
      'AI authors, compiler renders, human reviews.',
    layers: {
      language: {
        command: 'recall schema --json',
        purpose: 'All valid RECALL elements, PIC types, divisions, and clauses',
        data:    getSchema(),
      },
      components: {
        package:    '@stratiqx/recall-components',
        manifest:   '@stratiqx/recall-components/components/index.json',
        purpose:    'Field definitions and group shapes for available plugin components',
        components: resolveComponentNames(opts.plugin),
      },
      crd: {
        document: 'docs/COMMON-RECORD-DESCRIPTION.md',
        command:  'recall crd <file.rcl> --against <brief.json>',
        purpose:  'Field agreement across MCP inputSchema, brief JSON, and DATA DIVISION',
        checks:   ['CRD-001', 'CRD-002', 'CRD-003', 'CRD-004'],
      },
      compositor: {
        document: 'docs/COMPOSITOR-CONTRACT.md',
        command:  'recall expand <file.rcl>',
        purpose:  'WITH INTENT expansion protocol between recall expand and an AI compositor',
      },
    },
    methodology: {
      authoring:  'AI assembles brief against Common Record Description',
      rendering:  'RECALL compiler + plugin renderers produce self-contained HTML',
      validation: 'inputSchema descriptions enforce field discipline at authoring time',
      provenance: 'brief JSON persisted alongside HTML — source always recoverable',
    },
  }
}

// ── Component resolution ─────────────────────────────────

function resolveComponentNames(plugin?: string): string[] | null {
  const pkg = plugin ?? '@stratiqx/recall-components'
  try {
    const req = createRequire(import.meta.url)
    const manifest = req(`${pkg}/components/index.json`) as {
      components?: Record<string, unknown>
    }
    return manifest.components ? Object.keys(manifest.components) : null
  } catch {
    return null
  }
}

// ── Human-readable formatter ─────────────────────────────

function pad(s: string, n: number): string {
  return s.padEnd(n)
}

export function formatManifest(manifest: PipelineManifest): string {
  const lines: string[] = []
  const { layers, methodology } = manifest

  lines.push('')
  lines.push('  RECALL — Pipeline Manifest')
  lines.push(`  ${manifest.schema}`)
  lines.push('')
  lines.push('  Philosophy')
  lines.push(`  ${manifest.philosophy}`)
  lines.push('')
  lines.push('  Layers')
  lines.push('')

  // language
  const langData = layers.language.data
  const elemCount = langData.elements.length
  const picCount  = langData.picTypes.length
  const divCount  = langData.divisions.length
  lines.push(`  ${pad('language', 14)} ${layers.language.command}`)
  lines.push(`  ${pad('', 14)} ${layers.language.purpose}`)
  lines.push(`  ${pad('', 14)} Elements: ${elemCount}  PIC types: ${picCount}  Divisions: ${divCount}`)
  lines.push('')

  // components
  const compLine = layers.components.components
    ? layers.components.components.join(', ')
    : 'not resolved — pass --plugin <package>'
  lines.push(`  ${pad('components', 14)} ${layers.components.manifest}`)
  lines.push(`  ${pad('', 14)} ${layers.components.purpose}`)
  lines.push(`  ${pad('', 14)} Components: ${compLine}`)
  lines.push('')

  // crd
  lines.push(`  ${pad('crd', 14)} ${layers.crd.command}`)
  lines.push(`  ${pad('', 14)} ${layers.crd.purpose}`)
  lines.push(`  ${pad('', 14)} Checks: ${layers.crd.checks.join('  ')}`)
  lines.push('')

  // compositor
  lines.push(`  ${pad('compositor', 14)} ${layers.compositor.command}`)
  lines.push(`  ${pad('', 14)} ${layers.compositor.purpose}`)
  lines.push('')

  // methodology
  lines.push('  Methodology')
  for (const [key, val] of Object.entries(methodology)) {
    lines.push(`  ${pad(key, 14)} ${val}`)
  }
  lines.push('')

  return lines.join('\n')
}

export function formatManifestLayer(
  name: string,
  layer: LanguageLayer | ComponentsLayer | CRDLayer | CompositorLayer,
): string {
  const lines: string[] = []
  lines.push('')
  lines.push(`  ${name}`)
  lines.push('')
  for (const [key, val] of Object.entries(layer)) {
    if (key === 'data') {
      lines.push(`  ${pad('data', 12)} <inlined — use --json to view>`)
    } else if (Array.isArray(val)) {
      lines.push(`  ${pad(key, 12)} ${(val as string[]).join(', ')}`)
    } else if (val === null) {
      lines.push(`  ${pad(key, 12)} not resolved — pass --plugin <package>`)
    } else {
      lines.push(`  ${pad(key, 12)} ${String(val)}`)
    }
  }
  lines.push('')
  return lines.join('\n')
}
