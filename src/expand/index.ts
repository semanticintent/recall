// ─────────────────────────────────────────────────────────
// recall expand — WITH INTENT compositor integration
// Pure functions only. No side effects beyond file I/O.
// CLI wrapper: src/cli/commands/expand.ts
// Compositor contract: docs/COMPOSITOR-CONTRACT.md
// ─────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, basename, dirname, join } from 'node:path'
import { check, parseFromSource } from '../compiler/index.js'
import { COMPOSITOR_SYSTEM_PROMPT } from './prompt.js'
import type { DisplayStatement, DataField } from '../parser/rcl.js'

// ─────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────

export interface ExpandOptions {
  inputPath:    string
  outDir?:      string    // default: same directory as input
  dryRun?:      boolean   // print payload, no API call, no file write
  apiKey?:      string    // Anthropic API key — falls back to ANTHROPIC_API_KEY env var
  model?:       string    // default: claude-opus-4-6
}

export interface CompositorPayloadField {
  name:      string
  pic:       string
  section:   string
  comment?:  string
}

export interface CompositorPayload {
  schemaVersion:     '1.0'
  intent:            string
  element:           string
  dataFields:        CompositorPayloadField[]
  availableFields:   CompositorPayloadField[]
  palette:           Record<string, string>
  componentRegistry: string[]
  programId:         string
}

export interface ExpandResult {
  ok:          boolean
  inputPath:   string
  outputPath?: string
  payloads?:   CompositorPayload[]   // populated on dry-run
  error?:      string
}

// ─────────────────────────────────────────────────────────
// Payload builder
// ─────────────────────────────────────────────────────────

function fieldToPayload(f: DataField): CompositorPayloadField {
  const entry: CompositorPayloadField = {
    name:    f.name,
    pic:     f.pic,
    section: f.children.length > 0 ? 'items' : 'working-storage',
  }
  if (f.comment) entry.comment = f.comment
  return entry
}

function collectScalarFields(fields: DataField[]): DataField[] {
  const out: DataField[] = []
  for (const f of fields) {
    if (f.children.length === 0) out.push(f)
    else out.push(...collectScalarFields(f.children))
  }
  return out
}

function buildPayload(
  stmt:      DisplayStatement,
  program:   ReturnType<typeof parseFromSource>,
): CompositorPayload {
  const dataClause = stmt.clauses.find(c => c.key === 'DATA')
  const dataFieldNames = dataClause
    ? dataClause.value.split(',').map(n => n.trim()).filter(Boolean)
    : []

  const allScalars = [
    ...collectScalarFields(program.data.workingStorage),
    ...collectScalarFields(program.data.items),
  ]

  const dataFields = dataFieldNames
    .map(name => allScalars.find(f => f.name === name))
    .filter((f): f is DataField => f !== undefined)
    .map(fieldToPayload)

  const availableFields = allScalars.map(fieldToPayload)

  const componentRegistry = program.component.components.map(c => c.name)

  return {
    schemaVersion:   '1.0',
    intent:          stmt.intent!,
    element:         String(stmt.element),
    dataFields,
    availableFields,
    palette:         program.environment.palette,
    componentRegistry,
    programId:       program.identification.programId,
  }
}

// ─────────────────────────────────────────────────────────
// Compositor call
// ─────────────────────────────────────────────────────────

async function callCompositor(
  payload: CompositorPayload,
  apiKey:  string,
  model:   string,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system:     COMPOSITOR_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: JSON.stringify(payload, null, 2) },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>
  }

  const text = data.content.find(b => b.type === 'text')?.text ?? ''

  // Extract JSON from response — compositor returns { "source": "..." }
  let parsed: { source?: string }
  try {
    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`Compositor returned non-JSON response: ${text.slice(0, 200)}`)
  }

  if (typeof parsed.source !== 'string' || !parsed.source.trim()) {
    throw new Error(`Compositor response missing "source" field`)
  }

  return parsed.source.trim()
}

// ─────────────────────────────────────────────────────────
// Source rewriter — replaces WITH INTENT stmts with expansion
// ─────────────────────────────────────────────────────────

function collectIntentStatements(stmts: DisplayStatement[]): DisplayStatement[] {
  const out: DisplayStatement[] = []
  for (const s of stmts) {
    if (s.intent !== undefined) out.push(s)
    out.push(...collectIntentStatements(s.children))
  }
  return out
}

function rewriteSource(source: string, expansions: Map<string, string>): string {
  const lines = source.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const t = lines[i].trim()

    // Detect the start of a WITH INTENT DISPLAY block
    if (t.startsWith('DISPLAY ') && t.toUpperCase().includes('WITH INTENT')) {
      // Single-line case
      const intentMatch = t.match(/WITH INTENT\s+"([^"]+)"/)
      if (intentMatch) {
        const expansion = expansions.get(intentMatch[1])
        if (expansion) {
          // Emit the expansion with consistent indentation
          const indent = lines[i].match(/^(\s*)/)?.[1] ?? '      '
          for (const expLine of expansion.split('\n')) {
            out.push(indent + expLine.trim())
          }
          i++
          continue
        }
      }
    }

    // Detect multi-line DISPLAY ... WITH INTENT block (DISPLAY on one line, WITH INTENT on next)
    if (t.startsWith('DISPLAY ') && !t.includes('WITH INTENT')) {
      // Look ahead for WITH INTENT on a continuation line
      let j = i + 1
      let intentText: string | undefined
      while (j < lines.length) {
        const next = lines[j].trim()
        if (next.startsWith('DISPLAY') || next.startsWith('STOP')) break
        const m = next.match(/WITH INTENT\s+"([^"]+)"/)
        if (m) { intentText = m[1]; break }
        j++
      }

      if (intentText && expansions.has(intentText)) {
        // Skip lines from i through the statement's final period
        let k = i
        while (k < lines.length) {
          if (lines[k].trim().endsWith('.')) { k++; break }
          k++
        }
        const expansion = expansions.get(intentText)!
        const indent = lines[i].match(/^(\s*)/)?.[1] ?? '      '
        for (const expLine of expansion.split('\n')) {
          out.push(indent + expLine.trim())
        }
        i = k
        continue
      }
    }

    out.push(lines[i])
    i++
  }

  return out.join('\n')
}

// ─────────────────────────────────────────────────────────
// Main expand() function
// ─────────────────────────────────────────────────────────

export async function expand(opts: ExpandOptions): Promise<ExpandResult> {
  const absInput = resolve(opts.inputPath)

  if (!existsSync(absInput)) {
    return { ok: false, inputPath: absInput, error: `FILE NOT FOUND: ${absInput}` }
  }

  if (!absInput.endsWith('.rcl')) {
    return { ok: false, inputPath: absInput, error: `NOT A RECALL SOURCE FILE. EXPECTED .rcl EXTENSION.` }
  }

  let source: string
  try {
    source = readFileSync(absInput, 'utf-8')
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `CANNOT READ FILE: ${(err as Error).message}` }
  }

  // Parse to find WITH INTENT statements
  let program: ReturnType<typeof parseFromSource>
  try {
    program = parseFromSource(source, dirname(absInput))
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `PARSE ERROR: ${(err as Error).message}` }
  }

  const intentStmts: DisplayStatement[] = []
  for (const section of program.procedure.sections) {
    intentStmts.push(...collectIntentStatements(section.statements))
  }

  if (intentStmts.length === 0) {
    return { ok: false, inputPath: absInput, error: `No WITH INTENT clauses found in ${absInput}` }
  }

  // Build payloads
  const payloads = intentStmts.map(stmt => buildPayload(stmt, program))

  // Dry run — return payloads without calling compositor
  if (opts.dryRun) {
    return { ok: true, inputPath: absInput, payloads }
  }

  const apiKey = opts.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? ''
  if (!apiKey) {
    return { ok: false, inputPath: absInput, error: `ANTHROPIC_API_KEY not set. Pass --api-key or set the environment variable.` }
  }

  const model = opts.model ?? 'claude-opus-4-6'

  // Call compositor for each WITH INTENT statement
  const expansions = new Map<string, string>()
  for (let idx = 0; idx < intentStmts.length; idx++) {
    const stmt    = intentStmts[idx]
    const payload = payloads[idx]
    try {
      const expanded = await callCompositor(payload, apiKey, model)
      expansions.set(stmt.intent!, expanded)
    } catch (err) {
      return {
        ok: false,
        inputPath: absInput,
        error: `[RCL-027] Compositor failed for "${stmt.intent}": ${(err as Error).message}`,
      }
    }
  }

  // Rewrite source — replace WITH INTENT statements with expansions
  const expandedSource = rewriteSource(source, expansions)

  // Determine output path
  const outDir    = opts.outDir ? resolve(opts.outDir) : dirname(absInput)
  const stem      = basename(absInput, '.rcl')
  const outputPath = join(outDir, `${stem}.expanded.rcl`)

  // Validate the expanded source before writing
  const tmpPath = join(outDir, `${stem}.expanded.rcl.tmp`)
  try {
    writeFileSync(tmpPath, expandedSource, 'utf-8')
    const checkResult = check(tmpPath)
    if (!checkResult.ok) {
      // Clean up temp file and return RCL-027
      try { require('node:fs').unlinkSync(tmpPath) } catch { /* ignore */ }
      return {
        ok:        false,
        inputPath: absInput,
        error:     `[RCL-027] Expanded source failed validation:\n${checkResult.errors.join('\n')}`,
      }
    }
    // Rename to final path
    require('node:fs').renameSync(tmpPath, outputPath)
  } catch (err) {
    return { ok: false, inputPath: absInput, error: `CANNOT WRITE OUTPUT: ${(err as Error).message}` }
  }

  return { ok: true, inputPath: absInput, outputPath }
}
