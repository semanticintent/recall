// ─────────────────────────────────────────────────────────
// RECALL HTML Generator — ReclProgram AST → HTML string
// ─────────────────────────────────────────────────────────

import { createRequire } from 'module'
let RECALL_VERSION = '1.0.x'
try {
  const _require = createRequire(import.meta.url)
  RECALL_VERSION = (_require('../../package.json') as { version: string }).version
} catch { /* Workers / bundled environments without filesystem */ }

import type {
  ReclProgram,
  EnvironmentDivision,
  DataDivision,
  DataField,
  DisplayStatement,
  DisplayClause,
  ComponentDef,
  AuditDivision,
} from '../parser/rcl.js'

export type ComponentRegistry = Map<string, ComponentDef>

// ─────────────────────────────────────────────────────────
// Plugin element registry — third-party renderers
// ─────────────────────────────────────────────────────────

export type PluginRenderer = (stmt: DisplayStatement, data: DataDivision) => string

const pluginRegistry = new Map<string, PluginRenderer>()

export function registerElement(name: string, renderer: PluginRenderer): void {
  pluginRegistry.set(name.toUpperCase(), renderer)
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function clause(clauses: DisplayClause[], key: string, fallback = ''): string {
  return clauses.find(c => c.key === key)?.value ?? fallback
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveValue(val: string | undefined, data: DataDivision): string {
  if (!val) return ''
  // If it looks like a variable name (all caps, hyphens), resolve from data
  if (/^[A-Z][A-Z0-9-]+$/.test(val)) {
    const all = [...data.workingStorage, ...data.items]
    const field = all.find(f => f.name === val)
    if (field) return field.value
  }
  return val
}

function resolveGroup(name: string, data: DataDivision): DataField | undefined {
  return [...data.workingStorage, ...data.items].find(f => f.name === name)
}

// ─────────────────────────────────────────────────────────
// CSS generation
// ─────────────────────────────────────────────────────────

function generateCss(env: EnvironmentDivision): string {
  const p = env.palette
  const bg      = p['COLOR-BG']      ?? (env.colorMode === 'DARK' ? '#0a0a0a' : '#ffffff')
  const text     = p['COLOR-TEXT']    ?? (env.colorMode === 'DARK' ? '#e0e0e0' : '#111111')
  const muted    = p['COLOR-MUTED']   ?? (env.colorMode === 'DARK' ? '#555555' : '#888888')
  const accent   = p['COLOR-ACCENT']  ?? '#00ff41'
  const border   = p['COLOR-BORDER']  ?? (env.colorMode === 'DARK' ? '#222222' : '#dddddd')
  const fontMono = env.fontPrimary    ?? 'IBM Plex Mono'
  const fontSans = env.fontSecondary  ?? 'IBM Plex Sans'

  const fontImport = `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontMono)}:wght@400;500;600&family=${encodeURIComponent(fontSans)}:wght@300;400;500;600&display=swap');`

  const colorScheme = env.colorMode === 'SYSTEM'
    ? `@media (prefers-color-scheme: light) { :root { --bg: #fff; --text: #111; } }`
    : ''

  return `${fontImport}
:root {
  --bg: ${bg};
  --text: ${text};
  --muted: ${muted};
  --accent: ${accent};
  --border: ${border};
  --font-mono: '${fontMono}', 'Courier New', monospace;
  --font-sans: '${fontSans}', 'Segoe UI', sans-serif;
}
${colorScheme}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-mono); background: var(--bg); color: var(--text); line-height: 1.7; font-size: 16px; -webkit-font-smoothing: antialiased; }
.container { max-width: 900px; margin: 0 auto; padding: 0 24px; }
a { color: var(--accent); text-decoration: none; }
a:hover { opacity: 0.8; }
nav { padding: 16px 0; border-bottom: 1px solid var(--border); }
nav.sticky { position: sticky; top: 0; z-index: 100; background: var(--bg); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; max-width: 900px; margin: 0 auto; padding: 0 24px; }
.nav-logo { font-weight: 600; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: var(--text); cursor: pointer; transition: color 0.15s; }
.nav-logo:hover { color: var(--accent); opacity: 1; }
.nav-links { display: flex; gap: 32px; }
.nav-links a { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: var(--text); opacity: 0.6; transition: color 0.15s, opacity 0.15s; }
.nav-links a:hover { color: var(--accent); opacity: 1; }
section { padding: 80px 0; }
section.padding-small  { padding: 40px 0; }
section.padding-medium { padding: 60px 0; }
section.padding-large  { padding: 120px 0; }
section.style-grid-bg { background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px); background-size: 48px 48px; }
.layout-centered { display: flex; flex-direction: column; align-items: center; text-align: center; }
.btn-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.layout-grid { display: grid; gap: 24px; }
.layout-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.layout-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.layout-flex { display: flex; gap: 24px; flex-wrap: wrap; }
.layout-stack { display: flex; flex-direction: column; gap: 20px; align-items: stretch; }
h1 { font-size: clamp(26px, 3vw, 40px); font-weight: 600; line-height: 1.1; margin-bottom: 24px; }
h2 { font-size: clamp(22px, 2.5vw, 34px); font-weight: 600; line-height: 1.15; margin-bottom: 16px; }
h3 { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
h1.style-mono, h2.style-mono, h3.style-mono { font-family: var(--font-mono); }
h1.style-sans, h2.style-sans, h3.style-sans { font-family: var(--font-sans); }
p { font-family: var(--font-sans); color: var(--muted); max-width: 680px; margin-bottom: 16px; line-height: 1.8; font-size: 18px; }
.layout-centered p { font-size: 20px; line-height: 1.75; }
p.color-text  { color: var(--text); }
p.color-accent { color: var(--accent); }
p code { font-family: var(--font-mono); font-size: 0.85em; color: var(--accent); background: rgba(0,255,65,0.07); padding: 1px 6px; border: 1px solid rgba(0,255,65,0.15); }
.recall-label { display: inline-block; align-self: flex-start; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); font-family: var(--font-mono); margin-bottom: 16px; background: rgba(0,255,65,0.07); padding: 4px 10px; }
.recall-btn { display: inline-block; padding: 12px 28px; font-family: var(--font-mono); font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; border: none; transition: opacity 0.2s; }
.recall-btn.primary  { background: var(--accent); color: var(--bg); }
.recall-btn.ghost    { background: transparent; border: 1px solid var(--border); color: var(--text); }
.recall-btn.outline  { background: transparent; border: 1px solid var(--accent); color: var(--accent); }
.recall-btn:hover { opacity: 0.85; }
.code-block-wrap { margin: 16px 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); width: 100%; }
.code-block-header { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); border-bottom: 1px solid var(--border); padding: 9px 16px; }
.code-block-actions { display: flex; align-items: center; gap: 10px; }
.code-block-lang { font-family: var(--font-mono); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); opacity: 0.7; }
.code-copy-btn { background: none; border: none; cursor: pointer; color: var(--muted); padding: 0; opacity: 0.4; transition: opacity 0.15s, color 0.15s; line-height: 1; display: flex; align-items: center; }
.code-copy-btn:hover { opacity: 0.9; }
.code-copy-btn.copied { color: var(--accent); opacity: 1; }
.icon-check { display: none; }
.code-copy-btn.copied .icon-copy { display: none; }
.code-copy-btn.copied .icon-check { display: block; }
.code-block-dots { display: flex; gap: 6px; align-items: center; }
.code-block-dots span { width: 10px; height: 10px; border-radius: 50%; }
.code-block-dots span:nth-child(1) { background: #ff5f57; }
.code-block-dots span:nth-child(2) { background: #febc2e; }
.code-block-dots span:nth-child(3) { background: #28c840; }
pre.code-block { font-family: var(--font-mono); font-size: 13px; background: #0e0e0e; padding: 20px 24px; overflow-x: auto; line-height: 1.75; color: #c9d1d9; margin: 0; white-space: pre; }
.tok-kw   { color: #7ee787; }
.tok-stmt { color: var(--accent); }
.tok-with { color: #d2a8ff; }
.tok-str  { color: #f0b060; }
.tok-num  { color: #79b8ff; }
.tok-field { color: #79b8ff; }
.card { background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 28px 24px; }
.card.hover-lift { transition: transform 0.2s, border-color 0.2s; }
.card.hover-lift:hover { transform: translateY(-3px); border-color: var(--accent); }
.card h3 { font-family: var(--font-mono); font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
.card p { font-size: 14px; margin-bottom: 12px; color: rgba(224,224,224,0.75); }
.card-tag { font-family: var(--font-mono); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); }
.card a { display: block; color: inherit; text-decoration: none; height: 100%; }
.recall-divider { border: none; border-top: 1px solid var(--border); margin: 40px 0; }
.recall-divider.dashed { border-top-style: dashed; }
.recall-divider.spacing-small  { margin: 20px 0; }
.recall-divider.spacing-large  { margin: 80px 0; }
.recall-input-group { margin-bottom: 20px; }
.recall-input-group label { display: block; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; font-family: var(--font-mono); }
.recall-input-group input, .recall-input-group textarea { width: 100%; background: transparent; border: 1px solid var(--border); color: var(--text); font-family: var(--font-mono); font-size: 14px; padding: 10px 14px; outline: none; resize: vertical; }
.recall-input-group input:focus, .recall-input-group textarea:focus { border-color: var(--accent); }
.recall-banner { padding: 12px 24px; background: var(--accent); color: var(--bg); font-family: var(--font-mono); font-size: 13px; letter-spacing: 1px; text-align: center; }
footer { padding: 40px 0; border-top: 1px solid var(--border); }
footer p { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); max-width: 100%; }
footer.align-center { text-align: center; }
footer.align-right  { text-align: right; }
.layout-sidebar { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; align-items: start; }
.layout-split { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
.split-col { display: flex; flex-direction: column; gap: 20px; }
.sidebar-rail { border-right: 1px solid var(--border); padding: 32px 0; }
.sidebar-rail.sticky { position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.sidebar-logo { padding: 0 24px 24px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600; color: var(--text); border-bottom: 1px solid var(--border); margin-bottom: 24px; display: block; }
.sidebar-group { margin-bottom: 28px; padding: 0 24px; }
.sidebar-group-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; display: block; }
.sidebar-link { display: block; font-size: 13px; color: var(--text); opacity: 0.65; padding: 5px 0; transition: color 0.15s, opacity 0.15s; font-family: var(--font-mono); }
.sidebar-link:hover { color: var(--accent); opacity: 1; }
.sidebar-link.active { color: var(--accent); opacity: 1; }
.sidebar-content { padding: 48px; min-width: 0; }
.recall-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
.recall-table th { background: rgba(255,255,255,0.05); border: 1px solid var(--border); padding: 10px 14px; text-align: left; font-family: var(--font-mono); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); }
.recall-table td { border: 1px solid var(--border); padding: 10px 14px; font-family: var(--font-mono); font-size: 13px; color: var(--text); vertical-align: top; line-height: 1.6; }
.recall-table tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
.recall-table.striped tr:nth-child(odd) td { background: rgba(255,255,255,0.02); }
.stat-grid { display: grid; gap: 1px; background: var(--border); border: 1px solid var(--border); margin: 16px 0; }
.stat-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.stat-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.stat-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
.stat-grid.cols-5 { grid-template-columns: repeat(5, 1fr); }
.stat-grid.cols-6 { grid-template-columns: repeat(6, 1fr); }
.stat-grid:not([class*="cols-"]) { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
.stat-card { background: var(--bg); padding: 20px 16px; text-align: center; }
.stat-value { font-family: var(--font-mono); font-size: 24px; font-weight: 600; color: var(--accent); line-height: 1; margin-bottom: 6px; }
.stat-label { font-family: var(--font-sans); font-size: 11px; font-weight: 500; color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase; }
@media (max-width: 768px) { .stat-grid.cols-5, .stat-grid.cols-6 { grid-template-columns: repeat(3, 1fr); } }
.recall-callout { padding: 14px 18px; border-left: 3px solid var(--accent); background: rgba(255,255,255,0.03); margin: 20px 0; width: 100%; box-sizing: border-box; }
.recall-callout.type-tip     { border-left-color: #4ade80; }
.recall-callout.type-warning { border-left-color: #facc15; }
.recall-callout.type-danger  { border-left-color: #f87171; }
.recall-callout-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-family: var(--font-mono); margin-bottom: 6px; color: var(--accent); }
.recall-callout.type-tip     .recall-callout-label { color: #4ade80; }
.recall-callout.type-warning .recall-callout-label { color: #facc15; }
.recall-callout.type-danger  .recall-callout-label { color: #f87171; }
.recall-callout p { margin: 0; color: var(--text); max-width: 100%; font-size: 14px; }
.recall-tabs { margin: 24px 0; border: 1px solid var(--border); }
.recall-tabs-header { display: flex; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02); }
.recall-tab-btn { padding: 10px 20px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; color: var(--muted); cursor: pointer; transition: color 0.15s; }
.recall-tab-btn:hover { color: var(--text); }
.recall-tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
.recall-tab-panel { display: none; padding: 0; }
.recall-tab-panel.active { display: block; }
.recall-tab-panel .code-block-wrap { border: none; border-radius: 0; margin: 0; }
@media (max-width: 768px) {
  .layout-grid.cols-2, .layout-grid.cols-3 { grid-template-columns: 1fr; }
  .layout-split { grid-template-columns: 1fr; }
  .nav-links { gap: 16px; }
  .layout-sidebar { grid-template-columns: 1fr; }
  .sidebar-rail { display: none; }
}
`
}

// ─────────────────────────────────────────────────────────
// Element renderers
// ─────────────────────────────────────────────────────────

function renderNavigation(stmt: DisplayStatement, data: DataDivision): string {
  const sticky  = clause(stmt.clauses, 'STICKY', 'NO') === 'YES'
  const logo    = clause(stmt.clauses, 'LOGO')
  const groupName = clause(stmt.clauses, 'USING')
  const group   = resolveGroup(groupName, data)
  let links = ''
  if (group) {
    // NAV-ITEM-1, NAV-ITEM-1-HREF pairs
    const items: { label: string; href: string }[] = []
    let i = 0
    while (i < group.children.length) {
      const child = group.children[i]
      if (child.name.match(/NAV-ITEM-\d+$/) || child.name.match(/ITEM-\d+$/)) {
        const hrefChild = group.children[i + 1]
        items.push({ label: child.value, href: hrefChild?.value ?? '#' })
        i += 2
      } else {
        i++
      }
    }
    links = items.map(it => `<a href="${escapeHtml(it.href)}">${escapeHtml(it.label)}</a>`).join('\n        ')
  }

  const navClass = sticky ? 'nav-inner sticky' : 'nav-inner'
  return `<nav${sticky ? ' class="sticky"' : ''}>
  <div class="${navClass}">
    ${logo ? `<a href="/index.html" class="nav-logo">${escapeHtml(logo)}</a>` : ''}
    <div class="nav-links">
      ${links}
    </div>
  </div>
</nav>`
}

// ─────────────────────────────────────────────────────────
// Component expansion — compile-time parameter binding
// ─────────────────────────────────────────────────────────

function bindParams(
  stmt: DisplayStatement,
  acceptNames: string[],
  bindings: Map<string, string>,
): DisplayStatement {
  const resolve = (v: string | undefined) =>
    v !== undefined && acceptNames.includes(v) ? (bindings.get(v) ?? v) : v
  return {
    element:  stmt.element,
    value:    resolve(stmt.value),
    clauses:  stmt.clauses.map(c => ({
      key:   c.key,
      value: acceptNames.includes(c.value) ? (bindings.get(c.value) ?? c.value) : c.value,
    })),
    children: stmt.children.map(child => bindParams(child, acceptNames, bindings)),
  }
}

function renderComponent(
  stmt: DisplayStatement,
  data: DataDivision,
  def: ComponentDef,
  registry: ComponentRegistry,
): string {
  const bindings    = new Map<string, string>()
  const acceptNames = def.accepts.map(a => a.name)

  // WITH DATA FIELD1, FIELD2 — bind by name from DATA DIVISION
  const dataClause = stmt.clauses.find(cl => cl.key === 'DATA')
  if (dataClause) {
    const fieldNames = dataClause.value.split(',').map(f => f.trim()).filter(Boolean)
    for (const name of fieldNames) {
      if (!acceptNames.includes(name)) continue
      const field = resolveGroup(name, data)
      if (field) {
        bindings.set(name, field.children.length > 0 ? name : (field.value || name))
      }
    }
  }

  // WITH PARAM "value" — literal clause bindings
  for (const param of acceptNames) {
    if (bindings.has(param)) continue
    const c = stmt.clauses.find(cl => cl.key === param)
    if (c) bindings.set(param, c.value)
  }

  const bound = bindParams(def.body, acceptNames, bindings)
  return renderStatementWithRegistry(bound, data, registry)
}

function renderSidebarNav(stmt: DisplayStatement, data: DataDivision): string {
  const logo      = clause(stmt.clauses, 'LOGO')
  const sticky    = clause(stmt.clauses, 'STICKY', 'NO') === 'YES'
  const groupName = clause(stmt.clauses, 'USING')
  const group     = resolveGroup(groupName, data)

  const groups: string[] = []

  if (group) {
    for (const section of group.children) {
      const labelField = section.children.find(f => f.name.endsWith('LABEL') || f.name === 'GROUP-LABEL')
      const label = labelField?.value ?? section.name

      const links: { label: string; href: string }[] = []
      let i = 0
      while (i < section.children.length) {
        const f = section.children[i]
        if (f.name.match(/NAV-LINK-\d+$/) || f.name.match(/LINK-\d+$/)) {
          const hrefField = section.children[i + 1]
          links.push({ label: f.value, href: hrefField?.value ?? '#' })
          i += 2
        } else {
          i++
        }
      }

      groups.push(`<div class="sidebar-group">
    <span class="sidebar-group-label">${escapeHtml(label)}</span>
    ${links.map(l => `<a href="${escapeHtml(l.href)}" class="sidebar-link">${escapeHtml(l.label)}</a>`).join('\n    ')}
  </div>`)
    }
  }

  return `<aside class="sidebar-rail${sticky ? ' sticky' : ''}">
  ${logo ? `<span class="sidebar-logo">${escapeHtml(logo)}</span>` : ''}
  ${groups.join('\n  ')}
</aside>`
}

function groupButtonRows(children: DisplayStatement[]): Array<DisplayStatement | DisplayStatement[]> {
  const out: Array<DisplayStatement | DisplayStatement[]> = []
  let i = 0
  while (i < children.length) {
    if (children[i].element === 'BUTTON') {
      const group: DisplayStatement[] = []
      while (i < children.length && children[i].element === 'BUTTON') group.push(children[i++])
      out.push(group.length > 1 ? group : group[0])
    } else {
      out.push(children[i++])
    }
  }
  return out
}

function renderSection(stmt: DisplayStatement, data: DataDivision, registry: ComponentRegistry = new Map()): string {
  const id          = clause(stmt.clauses, 'ID')
  const layout      = clause(stmt.clauses, 'LAYOUT', 'STACK').toLowerCase()
  const padding     = clause(stmt.clauses, 'PADDING', 'MEDIUM').toLowerCase()
  const columns     = clause(stmt.clauses, 'COLUMNS', '1')
  const styleClause = clause(stmt.clauses, 'STYLE', '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const classClause = clause(stmt.clauses, 'CLASS', '').trim()  // WITH CLASS overrides computed class entirely
  const bg          = clause(stmt.clauses, 'BACKGROUND')
  const inlineStyle = bg ? ` style="background:var(--${bg.replace('COLOR-', '').toLowerCase()})"` : ''
  const sectionClass = classClause
    ? classClause
    : `padding-${padding}${styleClause ? ` style-${styleClause}` : ''}`

  if (layout === 'sidebar') {
    const sidebarStmt  = stmt.children.find(c => c.element === 'SIDEBAR-NAV')
    const contentStmts = stmt.children.filter(c => c.element !== 'SIDEBAR-NAV')
    const sidebarHtml  = sidebarStmt ? renderSidebarNav(sidebarStmt, data) : '<aside class="sidebar-rail"></aside>'
    const contentHtml  = contentStmts.map(c => renderStatementWithRegistry(c, data, registry)).join('\n    ')
    return `<div${id ? ` id="${escapeHtml(id)}"` : ''} class="layout-sidebar"${inlineStyle}>
  ${sidebarHtml}
  <main class="sidebar-content">
    ${contentHtml}
  </main>
</div>`
  }

  if (layout === 'split') {
    const sections = stmt.children.filter(c => c.element === 'SECTION')
    const [left, right] = sections
    const leftHtml  = left  ? left.children.map(c => renderStatementWithRegistry(c, data, registry)).join('\n      ') : ''
    const rightHtml = right ? right.children.map(c => renderStatementWithRegistry(c, data, registry)).join('\n      ') : ''
    return `<section${id ? ` id="${escapeHtml(id)}"` : ''} class="${sectionClass}"${inlineStyle}>
  <div class="container layout-split">
    <div class="split-col">${leftHtml}</div>
    <div class="split-col">${rightHtml}</div>
  </div>
</section>`
  }

  const layoutClass = `layout-${layout}${layout === 'grid' ? ` cols-${columns}` : ''}`
  const inner = groupButtonRows(stmt.children).map(item => {
    if (Array.isArray(item)) {
      return `<div class="btn-row">${item.map(b => renderStatementWithRegistry(b, data, registry)).join('')}</div>`
    }
    return renderStatementWithRegistry(item, data, registry)
  }).join('\n  ')

  return `<section${id ? ` id="${escapeHtml(id)}"` : ''} class="${sectionClass}"${inlineStyle}>
  <div class="container ${layoutClass}">
  ${inner}
  </div>
</section>`
}

function renderHeading(stmt: DisplayStatement, data: DataDivision, level: 1 | 2 | 3): string {
  const text    = inlineMarkup(resolveValue(stmt.value, data))
  const style   = clause(stmt.clauses, 'STYLE', '').toLowerCase()
  const color   = clause(stmt.clauses, 'COLOR', '')
  const align   = clause(stmt.clauses, 'ALIGN', '').toLowerCase()
  const weight  = clause(stmt.clauses, 'WEIGHT', '').toLowerCase()

  const classes = [
    style   ? `style-${style}` : '',
    color   ? `color-${color.replace('COLOR-', '').toLowerCase()}` : '',
    align   ? `align-${align}` : '',
    weight  ? `weight-${weight}` : '',
  ].filter(Boolean).join(' ')

  return `<h${level}${classes ? ` class="${classes}"` : ''}>${text}</h${level}>`
}

// Inline markup: handles *emphasis* → <em> and `code` → <code>
// Splits on both patterns so each literal segment is HTML-escaped independently,
// while the marked segments are wrapped in the appropriate element.
function inlineMarkup(raw: string): string {
  return raw
    .split(/(\*[^*]+\*|`[^`]+`)/)
    .map(part => {
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        return `<em>${escapeHtml(part.slice(1, -1))}</em>`
      }
      if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`
      }
      return escapeHtml(part)
    })
    .join('')
}

// Kept for reference — inlineMarkup supersedes this but the name is preserved
// in case any internal callers were using it directly.
function inlineCode(raw: string): string {
  return inlineMarkup(raw)
}

function linkCitations(text: string): string {
  // Replace [N] with a link to #source-N
  return text.replace(/\[(\d+)\]/g, (_m, n) =>
    `<a class="cite" href="#source-${n}">[${n}]</a>`
  )
}

function renderParagraph(stmt: DisplayStatement, data: DataDivision): string {
  const resolved   = resolveValue(stmt.value, data)
  // If a variable name could not be resolved, skip rendering (graceful degradation)
  if (!resolved || (/^[A-Z][A-Z0-9-]+$/.test(stmt.value ?? '') && resolved === stmt.value)) return ''
  const raw        = inlineCode(resolved)
  const color      = clause(stmt.clauses, 'COLOR', '').replace('COLOR-', '').toLowerCase()
  const styleClause = clause(stmt.clauses, 'STYLE', '')
  const citations  = clause(stmt.clauses, 'CITATIONS', '') === 'YES'
  const hrefRaw    = clause(stmt.clauses, 'HREF', '')
  const text       = citations ? linkCitations(raw) : raw
  const cssClass   = styleClause ? styleClause.toLowerCase().replace(/_/g, '-') : (color ? `color-${color}` : '')
  // WITH HREF: wrap the paragraph text in an anchor
  const inner      = hrefRaw ? `<a href="${escapeHtml(hrefRaw)}">${text}</a>` : text
  return `<p${cssClass ? ` class="${cssClass}"` : ''}>${inner}</p>`
}

function renderButton(stmt: DisplayStatement, data: DataDivision): string {
  const text    = escapeHtml(resolveValue(stmt.value, data))
  const rawHref = clause(stmt.clauses, 'ON-CLICK') || clause(stmt.clauses, 'HREF', '#')
  const href    = resolveValue(rawHref, data) || rawHref
  const style   = clause(stmt.clauses, 'STYLE', 'PRIMARY').toLowerCase()
  const size    = clause(stmt.clauses, 'SIZE', '').toLowerCase()
  return `<a href="${escapeHtml(href)}" class="recall-btn ${style}${size ? ` size-${size}` : ''}">${text}</a>`
}

function renderCardList(stmt: DisplayStatement, data: DataDivision): string {
  const groupName  = clause(stmt.clauses, 'USING')
  const style      = clause(stmt.clauses, 'STYLE', 'BORDERED').toLowerCase()
  const hoverLift  = clause(stmt.clauses, 'HOVER-LIFT', 'NO') === 'YES'
  const columns    = clause(stmt.clauses, 'COLUMNS', '1')

  const group = resolveGroup(groupName, data)
  if (!group) return `<!-- CARD-LIST: group ${groupName} not found -->`

  const hoverClass = hoverLift ? ' hover-lift' : ''

  const cards = group.children.map(item => {
    const fields: Record<string, string> = {}
    item.children.forEach(f => { fields[f.name.replace(/.*-/, '')] = f.value })
    const title = fields['TITLE'] ?? item.name
    const desc  = fields['DESC']  ?? ''
    const tag   = fields['TAG']   ?? ''
    const href  = fields['HREF']  ?? '#'

    return `<div class="card${hoverClass}">
      <a href="${escapeHtml(href)}">
        <h3>${escapeHtml(title)}</h3>
        ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
        ${tag  ? `<span class="card-tag">${escapeHtml(tag)}</span>` : ''}
      </a>
    </div>`
  }).join('\n    ')

  return `<div class="layout-grid cols-${columns} style-${style}">
    ${cards}
  </div>`
}

function renderInput(stmt: DisplayStatement): string {
  const id          = clause(stmt.clauses, 'ID', 'field')
  const label       = clause(stmt.clauses, 'LABEL', '')
  const type        = clause(stmt.clauses, 'TYPE', 'TEXT').toLowerCase()
  const placeholder = clause(stmt.clauses, 'PLACEHOLDER', '')

  if (type === 'textarea') {
    return `<div class="recall-input-group">
    ${label ? `<label for="${escapeHtml(id)}">${escapeHtml(label)}</label>` : ''}
    <textarea id="${escapeHtml(id)}" placeholder="${escapeHtml(placeholder)}" rows="4"></textarea>
  </div>`
  }
  return `<div class="recall-input-group">
    ${label ? `<label for="${escapeHtml(id)}">${escapeHtml(label)}</label>` : ''}
    <input id="${escapeHtml(id)}" type="${type}" placeholder="${escapeHtml(placeholder)}" />
  </div>`
}

function parseLinkPairs(raw: string): Array<{ label: string; href: string }> {
  // Each entry is "Label words... https://url" — find the URL by scheme, not position,
  // so multi-word labels like "AI Platform https://..." are handled correctly.
  return raw.split(',').map(s => {
    const trimmed = s.trim()
    const urlMatch = trimmed.match(/\s+(https?:\/\/\S+)$/)
    if (urlMatch && urlMatch.index !== undefined) {
      return { label: trimmed.slice(0, urlMatch.index).trim(), href: urlMatch[1] }
    }
    // Fallback for bare paths or single-word labels
    const parts = trimmed.split(/\s+/)
    return { label: (parts.slice(0, -1).join(' ') || parts[0]) ?? '', href: parts[parts.length - 1] ?? '#' }
  }).filter(l => l.label)
}

function renderFooter(stmt: DisplayStatement, data: DataDivision): string {
  // Brand: resolve from stmt value first, then FOOTER-BRAND field, then empty
  const brandRaw   = stmt.value ?? clause(stmt.clauses, 'TEXT')
  const brand      = escapeHtml(resolveValue(brandRaw, data) || resolveValue('FOOTER-BRAND', data))
  const align      = clause(stmt.clauses, 'ALIGN', 'LEFT').toLowerCase()
  const linksRaw   = clause(stmt.clauses, 'LINKS', '')

  // WORKING-STORAGE fields — only use if field actually exists in data (avoid leaking field names as text)
  const allFields   = [...data.workingStorage, ...data.items]
  const footerMeta  = allFields.find(f => f.name === 'FOOTER-META')?.value  ?? ''
  const footerDisc  = allFields.find(f => f.name === 'FOOTER-DISCLOSURE')?.value ?? ''
  const footerLegal = allFields.find(f => f.name === 'FOOTER-LEGAL')?.value ?? ''

  // Meta row
  const metaHtml = footerMeta
    ? `\n    <div class="footer-meta">${escapeHtml(footerMeta)}</div>`
    : ''

  // Disclosure row — plain text + optional inline legal links (· Label · Label)
  let discHtml = ''
  if (footerDisc || footerLegal) {
    let legalHtml = ''
    if (footerLegal) {
      const legalLinks = parseLinkPairs(footerLegal)
      const legalAnchors = legalLinks.map(l =>
        `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`
      ).join(' · ')
      legalHtml = ` <span class="footer-legal"> · ${legalAnchors}</span>`
    }
    const discText = footerDisc ? escapeHtml(footerDisc) : ''
    discHtml = `\n    <p class="footer-disclosure">${discText}${legalHtml}</p>`
  }

  // Rich footer: brand → meta → nav-links → disclosure+legal
  if (brand || linksRaw || metaHtml || discHtml) {
    let navHtml = ''
    if (linksRaw) {
      const navLinks = parseLinkPairs(linksRaw)
      const navAnchors = navLinks.map(l =>
        `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`
      ).join('\n      ')
      navHtml = `\n    <div class="footer-links">\n      ${navAnchors}\n    </div>`
    }

    return `<footer>
  <div class="container">
    <span class="footer-brand">${brand}</span>${metaHtml}${navHtml}${discHtml}
  </div>
</footer>`
  }

  // Fallback: simple centred footer
  return `<footer class="align-${align}">
  <div class="container">
    <p>${brand}</p>
  </div>
</footer>`
}

function renderDivider(stmt: DisplayStatement): string {
  const style   = clause(stmt.clauses, 'STYLE', 'SOLID').toLowerCase()
  const spacing = clause(stmt.clauses, 'SPACING', 'MEDIUM').toLowerCase()
  return `<hr class="recall-divider ${style === 'dashed' ? 'dashed' : ''} spacing-${spacing}" />`
}

function renderBanner(stmt: DisplayStatement, data: DataDivision): string {
  const text = escapeHtml(resolveValue(stmt.value, data))
  return `<div class="recall-banner">${text}</div>`
}

function syntaxHighlight(escaped: string): string {
  let s = escaped
  // String literals: &quot;...&quot;
  s = s.replace(/(&quot;)((?:[^&]|&(?!quot;))*?)(&quot;)/g, '<span class="tok-str">$1$2$3</span>')
  // Division headers
  s = s.replace(/\b(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE|COMPONENT) (DIVISION)\b/g,
    '<span class="tok-kw">$1 $2</span>')
  // Section headers
  s = s.replace(/\b(WORKING-STORAGE|ITEMS|PALETTE|FONT|CONFIGURATION) (SECTION)\b/g,
    '<span class="tok-kw">$1 $2</span>')
  // STOP RUN / STOP SECTION before generic STOP
  s = s.replace(/\bSTOP (RUN|SECTION)\b/g, '<span class="tok-stmt">STOP $1</span>')
  // Display verbs
  s = s.replace(/\b(DISPLAY|COPY|PERFORM|MOVE|COMPUTE)\b/g, '<span class="tok-stmt">$1</span>')
  // Clause keywords
  s = s.replace(/\b(WITH|ON-CLICK|USING|FROM|PIC|VALUE)\b/g, '<span class="tok-with">$1</span>')
  // Identification fields
  s = s.replace(/\b(PROGRAM-ID|PAGE-TITLE|AUTHOR|DATE-WRITTEN|DESCRIPTION|FAVICON|VIEWPORT|COLOR-MODE|LANGUAGE|FONT-PRIMARY|FONT-SECONDARY)\b/g,
    '<span class="tok-field">$1</span>')
  // Level numbers at line start
  s = s.replace(/(^|\n)( *)(01|05|10)(\s)/g, '$1$2<span class="tok-num">$3</span>$4')
  return s
}

function renderCodeBlock(stmt: DisplayStatement, data: DataDivision): string {
  const raw = resolveValue(stmt.value, data)
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
  const lang = clause(stmt.clauses, 'LANGUAGE', '')
  const isRecall = !lang || ['recall', 'rcl', 'cobol', 'cbl'].includes(lang.toLowerCase())
  const highlighted = isRecall ? syntaxHighlight(escapeHtml(raw)) : escapeHtml(raw)
  const langLabel = lang || 'RECALL'
  const copyIcon  = `<svg class="icon-copy"  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
  const checkIcon = `<svg class="icon-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
  return `<div class="code-block-wrap">
  <div class="code-block-header">
    <div class="code-block-dots"><span></span><span></span><span></span></div>
    <div class="code-block-actions">
      <button class="code-copy-btn" aria-label="Copy code">${copyIcon}${checkIcon}</button>
      <span class="code-block-lang">${escapeHtml(langLabel)}</span>
    </div>
  </div>
  <pre class="code-block">${highlighted}</pre>
</div>`
}

function renderLabel(stmt: DisplayStatement, data: DataDivision): string {
  const text      = escapeHtml(resolveValue(stmt.value, data))
  const styleClause = clause(stmt.clauses, 'STYLE')
  const cssClass  = styleClause ? styleClause.toLowerCase().replace(/_/g, '-') : 'recall-label'
  return `<div class="${cssClass}">${text}</div>`
}

function renderImage(stmt: DisplayStatement, data: DataDivision): string {
  const src  = clause(stmt.clauses, 'SRC') || resolveValue(stmt.value, data)
  const alt  = clause(stmt.clauses, 'ALT', '')
  const size = clause(stmt.clauses, 'SIZE', 'FULL').toLowerCase()
  const widthMap: Record<string, string> = { full: '100%', half: '50%', quarter: '25%', auto: 'auto' }
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="width:${widthMap[size] ?? '100%'}" />`
}

function renderTable(stmt: DisplayStatement, data: DataDivision): string {
  // Group name: from value (v0.4: DISPLAY TABLE DIMENSIONS) or USING clause (legacy)
  const groupName  = stmt.value ?? clause(stmt.clauses, 'USING')
  // Column headers: COLUMNS clause (v0.4) or HEADERS (legacy)
  const headersRaw = clause(stmt.clauses, 'COLUMNS') || clause(stmt.clauses, 'HEADERS', '')
  const headers    = headersRaw ? headersRaw.split(',').map(h => h.trim()) : []
  const striped    = clause(stmt.clauses, 'STRIPED', 'NO') === 'YES'
  const group      = resolveGroup(groupName, data)
  if (!group) return `<!-- TABLE: group "${groupName}" not found -->`

  const headerRow = headers.length > 0
    ? `<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
    : ''

  const rows = group.children.map(row =>
    `<tr>${row.children.map(cell => `<td>${escapeHtml(cell.value)}</td>`).join('')}</tr>`
  ).join('\n    ')

  const tableClass = `recall-table${striped ? ' striped' : ''}`
  return `<table class="${tableClass}">
  ${headerRow}
  <tbody>
    ${rows}
  </tbody>
</table>`
}

function renderStatGrid(stmt: DisplayStatement, data: DataDivision): string {
  // Group name from value: DISPLAY STAT-GRID STATS WITH COLUMNS 6
  const groupName = stmt.value ?? clause(stmt.clauses, 'USING')
  const columns   = clause(stmt.clauses, 'COLUMNS', '0')
  const group     = resolveGroup(groupName, data)
  if (!group) return `<!-- STAT-GRID: group "${groupName}" not found -->`

  const cards = group.children.map(item => {
    // Detect VALUE and LABEL fields by name suffix (-VALUE, -LABEL)
    const valueField = item.children.find(f => f.name.endsWith('-VALUE') || f.name.endsWith('VALUE'))
    const labelField = item.children.find(f => f.name.endsWith('-LABEL') || f.name.endsWith('LABEL'))
    const val  = escapeHtml(valueField?.value ?? '')
    const lbl  = escapeHtml(labelField?.value ?? '')
    return `<div class="stat-card">
      <div class="stat-value">${val}</div>
      <div class="stat-label">${lbl}</div>
    </div>`
  }).join('\n    ')

  const colClass = parseInt(columns) > 0 ? ` cols-${columns}` : ''
  return `<div class="stat-grid${colClass}">
    ${cards}
  </div>`
}

function renderCallout(stmt: DisplayStatement, data: DataDivision): string {
  const text  = escapeHtml(resolveValue(stmt.value, data))
  const type  = clause(stmt.clauses, 'TYPE', 'NOTE').toLowerCase()
  const label = type.toUpperCase()
  return `<div class="recall-callout type-${type}">
  <div class="recall-callout-label">${label}</div>
  <p>${text}</p>
</div>`
}

function renderTabs(stmt: DisplayStatement, data: DataDivision): string {
  const groupName = clause(stmt.clauses, 'USING')
  const group     = resolveGroup(groupName, data)
  if (!group) return `<!-- TABS: group ${groupName} not found -->`

  const tabs = group.children.map(tab => {
    const fields: Record<string, string> = {}
    tab.children.forEach(f => {
      const key = f.name.replace(/^[^-]+-/, '')
      fields[key] = f.value
    })
    return {
      label:   fields['LABEL']   ?? tab.name,
      content: fields['CONTENT'] ?? '',
      lang:    fields['LANG']    ?? '',
    }
  })

  const buttons = tabs.map((t, i) =>
    `<button class="recall-tab-btn${i === 0 ? ' active' : ''}" data-tab="${i}">${escapeHtml(t.label)}</button>`
  ).join('\n    ')

  const panels = tabs.map((t, i) => {
    const raw = t.content.replace(/\\n/g, '\n').replace(/\\"/g, '"')
    const isRecall = !t.lang || ['recall', 'rcl', 'cobol', 'cbl'].includes(t.lang.toLowerCase())
    const highlighted = isRecall ? syntaxHighlight(escapeHtml(raw)) : escapeHtml(raw)
    return `<div class="recall-tab-panel${i === 0 ? ' active' : ''}" data-panel="${i}">
    <pre class="code-block">${highlighted}</pre>
  </div>`
  }).join('\n  ')

  return `<div class="recall-tabs">
  <div class="recall-tabs-header">
    ${buttons}
  </div>
  ${panels}
</div>`
}

// ─────────────────────────────────────────────────────────
// Main statement dispatcher
// ─────────────────────────────────────────────────────────

function renderStatementWithRegistry(
  stmt: DisplayStatement,
  data: DataDivision,
  registry: ComponentRegistry,
): string {
  // WITH INTENT — not yet expanded by `recall expand`. Render as a placeholder comment.
  // RCL-W09 is emitted by the type checker; the page still compiles.
  if (stmt.intent !== undefined) {
    return `<!-- WITH INTENT: ${stmt.intent} (unexpanded — run recall expand) -->`
  }

  switch (stmt.element) {
    case 'HEADING-1':   return renderHeading(stmt, data, 1)
    case 'HEADING-2':   return renderHeading(stmt, data, 2)
    case 'HEADING-3':   return renderHeading(stmt, data, 3)
    case 'PARAGRAPH':   return renderParagraph(stmt, data)
    case 'LABEL':       return renderLabel(stmt, data)
    case 'CODE-BLOCK':  return renderCodeBlock(stmt, data)
    case 'BUTTON':      return renderButton(stmt, data)
    case 'CARD-LIST':   return renderCardList(stmt, data)
    case 'INPUT':       return renderInput(stmt)
    case 'NAVIGATION':   return renderNavigation(stmt, data)
    case 'SIDEBAR-NAV':  return renderSidebarNav(stmt, data)
    case 'SECTION':      return renderSection(stmt, data, registry)
    case 'FOOTER':      return renderFooter(stmt, data)
    case 'DIVIDER':     return renderDivider(stmt)
    case 'BANNER':      return renderBanner(stmt, data)
    case 'IMAGE':       return renderImage(stmt, data)
    case 'TABLE':       return renderTable(stmt, data)
    case 'STAT-GRID':   return renderStatGrid(stmt, data)
    case 'CALLOUT':     return renderCallout(stmt, data)
    case 'TABS':        return renderTabs(stmt, data)
    case 'LINK': {
      const text = escapeHtml(resolveValue(stmt.value, data))
      const href = clause(stmt.clauses, 'HREF', '#')
      const target = clause(stmt.clauses, 'TARGET', 'SELF') === 'BLANK' ? ' target="_blank" rel="noopener"' : ''
      return `<a href="${escapeHtml(href)}"${target}>${text}</a>`
    }
    default: {
      const def = registry.get(stmt.element)
      if (def) return renderComponent(stmt, data, def, registry)
      const plugin = pluginRegistry.get(stmt.element)
      if (plugin) return plugin(stmt, data)
      return `<!-- RECALL: unknown element ${stmt.element} -->`
    }
  }
}

export function renderStatement(stmt: DisplayStatement, data: DataDivision): string {
  return renderStatementWithRegistry(stmt, data, new Map())
}

// ─────────────────────────────────────────────────────────
// Full HTML document generation
// ─────────────────────────────────────────────────────────

function generateAuditComment(audit: AuditDivision): string {
  const col = (s: string, w: number) => s.padEnd(w)
  const header = [
    `  created-by:   ${audit.createdBy}`,
    `  created-date: ${audit.createdDate}`,
  ]
  const changes = audit.changeLog.length > 0
    ? [`  changes:`, ...audit.changeLog.map(e =>
        `    ${col(e.date, 12)}${col(e.subject, 32)}${col(e.authorKind, 16)}"${e.note}"`
      )]
    : []
  return `<!--\n  RECALL AUDIT\n${[...header, ...changes].join('\n')}\n-->`
}

export function generate(program: ReclProgram, source: string): string {
  const { identification: id, environment: env, data, component, audit, procedure } = program

  // Resolve IDENTIFICATION fields that reference WORKING-STORAGE names
  const resolveIdField = (val: string | undefined): string | undefined => {
    if (!val) return undefined
    if (/^[A-Z][A-Z0-9-]+$/.test(val)) return resolveValue(val, data) || val
    return val
  }
  const pageTitle   = resolveIdField(id.pageTitle)   ?? 'RECALL Page'
  const description = resolveIdField(id.description)
  const ogTitle     = resolveIdField(resolveValue('CASE-TITLE', data) || undefined)
  const ogDesc      = resolveIdField(resolveValue('CASE-SUBTITLE', data) || undefined)

  const baseCss = env.suppressDefaultCss ? '' : generateCss(env)
  const css = env.styleBlock
    ? (baseCss ? `${baseCss}\n/* ── STYLE-BLOCK ── */\n${env.styleBlock}` : env.styleBlock)
    : baseCss

  // THEME-OVERRIDES: raw CSS from the brief, injected after the base theme.
  // Claude Desktop uses this to give each case its own visual identity —
  // accent colours, sector palette, emotional tone — without touching the template.
  const themeOverrides = resolveValue('THEME-OVERRIDES', data)
  const lang = id.language?.toLowerCase() ?? 'en'

  // Build component registry
  const registry: ComponentRegistry = new Map(
    component.components.map(def => [def.name, def])
  )

  // Render all sections
  const body = procedure.sections.map(section => {
    return section.statements.map(stmt => renderStatementWithRegistry(stmt, data, registry)).join('\n')
  }).join('\n')

  const hasTabs        = body.includes('recall-tabs')
  const hasCopyButtons = body.includes('code-block-wrap')
  const hasSidebar     = body.includes('sidebar-link')

  // Source embedding — the core RECALL principle
  const sourceComment = `<!--
${'*'.repeat(54)}
* RECALL COMPILED OUTPUT
* SOURCE: (embedded below)
* RECALL VERSION: ${RECALL_VERSION}
${'*'.repeat(54)}

${source.split('\n').map(l => (l ? `* ${l}` : '*')).join('\n')}

${'*'.repeat(54)}
-->`

  const viewport = env.viewport === 'FIXED-WIDTH'
    ? `<meta name="viewport" content="width=1200">`
    : `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

  const ogMeta = ogTitle ? `
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  ${ogDesc ? `<meta property="og:description" content="${escapeHtml(ogDesc)}">` : ''}
  <meta property="og:type" content="article">` : ''

  const tabsScript = hasTabs ? `<script>
document.querySelectorAll('.recall-tabs').forEach(function(tabs) {
  var btns = tabs.querySelectorAll('.recall-tab-btn');
  var panels = tabs.querySelectorAll('.recall-tab-panel');
  btns.forEach(function(btn, i) {
    btn.addEventListener('click', function() {
      btns.forEach(function(b) { b.classList.remove('active'); });
      panels.forEach(function(p) { p.classList.remove('active'); });
      btn.classList.add('active');
      panels[i].classList.add('active');
    });
  });
});
</script>` : ''

  const copyScript = hasCopyButtons ? `<script>
document.querySelectorAll('.code-copy-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var pre = btn.closest('.code-block-wrap').querySelector('.code-block');
    navigator.clipboard.writeText(pre.textContent || '').then(function() {
      btn.classList.add('copied');
      setTimeout(function() { btn.classList.remove('copied'); }, 1500);
    }).catch(function() {});
  });
});
</script>` : ''

  const sidebarScript = hasSidebar ? `<script>
(function() {
  var links = document.querySelectorAll('.sidebar-link[href^="#"]');
  var sections = document.querySelectorAll('section[id]');
  if (!links.length || !sections.length) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var id = entry.target.id;
        links.forEach(function(link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });
  sections.forEach(function(s) { observer.observe(s); });
})();
</script>` : ''

  const auditComment = audit ? generateAuditComment(audit) : ''

  return `${sourceComment}
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  ${viewport}
  <title>${escapeHtml(pageTitle)}</title>
  ${description   ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
  ${id.author     ? `<meta name="author" content="${escapeHtml(id.author)}">` : ''}
  ${id.favicon    ? `<link rel="icon" href="${escapeHtml(id.favicon)}">` : ''}${ogMeta}
  <style>
${css}
  </style>${themeOverrides ? `\n  <style id="theme-overrides">\n  :root { ${themeOverrides} }\n  </style>` : ''}
</head>
<body id="${id.programId.toLowerCase()}">
${body}
${tabsScript}${copyScript}${sidebarScript}${auditComment}</body>
</html>`
}
