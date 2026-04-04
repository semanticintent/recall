// ─────────────────────────────────────────────────────────
// RECALL HTML Generator — ReclProgram AST → HTML string
// ─────────────────────────────────────────────────────────

import type {
  ReclProgram,
  EnvironmentDivision,
  DataDivision,
  DataField,
  DisplayStatement,
  DisplayClause,
  ComponentDef,
} from '../parser/rcl.js'

export type ComponentRegistry = Map<string, ComponentDef>

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
.nav-logo { font-weight: 600; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: var(--text); }
.nav-links { display: flex; gap: 32px; }
.nav-links a { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.nav-links a:hover { color: var(--text); }
section { padding: 80px 0; }
section.padding-small  { padding: 40px 0; }
section.padding-medium { padding: 60px 0; }
section.padding-large  { padding: 100px 0; }
.layout-centered { display: flex; flex-direction: column; align-items: center; text-align: center; }
.layout-grid { display: grid; gap: 24px; }
.layout-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.layout-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.layout-flex { display: flex; gap: 24px; flex-wrap: wrap; }
.layout-stack { display: flex; flex-direction: column; gap: 20px; }
h1 { font-size: clamp(28px, 5vw, 52px); font-weight: 600; line-height: 1.1; margin-bottom: 20px; }
h2 { font-size: clamp(22px, 3vw, 36px); font-weight: 600; line-height: 1.2; margin-bottom: 16px; }
h3 { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
h1.style-mono, h2.style-mono, h3.style-mono { font-family: var(--font-mono); }
h1.style-sans, h2.style-sans, h3.style-sans { font-family: var(--font-sans); }
p { font-family: var(--font-sans); color: var(--muted); max-width: 680px; margin-bottom: 16px; line-height: 1.8; }
p.color-text  { color: var(--text); }
p.color-accent { color: var(--accent); }
.recall-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); font-family: var(--font-mono); margin-bottom: 8px; }
.recall-btn { display: inline-block; padding: 12px 28px; font-family: var(--font-mono); font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; border: none; transition: opacity 0.2s; }
.recall-btn.primary  { background: var(--accent); color: var(--bg); }
.recall-btn.ghost    { background: transparent; border: 1px solid var(--border); color: var(--text); }
.recall-btn.outline  { background: transparent; border: 1px solid var(--accent); color: var(--accent); }
.recall-btn:hover { opacity: 0.85; }
pre.code-block { font-family: var(--font-mono); font-size: 13px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); padding: 24px; overflow-x: auto; line-height: 1.6; color: var(--accent); margin: 16px 0; }
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
@media (max-width: 768px) {
  .layout-grid.cols-2, .layout-grid.cols-3 { grid-template-columns: 1fr; }
  .nav-links { gap: 16px; }
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
  const stickyClass = sticky ? ' sticky' : ''

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

  return `<nav class="${stickyClass}">
  <div class="nav-inner">
    ${logo ? `<span class="nav-logo">${escapeHtml(logo)}</span>` : ''}
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
  accepts: string[],
  bindings: Map<string, string>,
): DisplayStatement {
  const resolve = (v: string | undefined) =>
    v !== undefined && accepts.includes(v) ? (bindings.get(v) ?? v) : v
  return {
    element:  stmt.element,
    value:    resolve(stmt.value),
    clauses:  stmt.clauses.map(c => ({
      key:   c.key,
      value: accepts.includes(c.value) ? (bindings.get(c.value) ?? c.value) : c.value,
    })),
    children: stmt.children.map(child => bindParams(child, accepts, bindings)),
  }
}

function renderComponent(
  stmt: DisplayStatement,
  data: DataDivision,
  def: ComponentDef,
  registry: ComponentRegistry,
): string {
  const bindings = new Map<string, string>()
  for (const param of def.accepts) {
    const c = stmt.clauses.find(cl => cl.key === param)
    if (c) bindings.set(param, c.value)
  }
  const bound = bindParams(def.body, def.accepts, bindings)
  return renderStatementWithRegistry(bound, data, registry)
}

function renderSection(stmt: DisplayStatement, data: DataDivision, registry: ComponentRegistry = new Map()): string {
  const id         = clause(stmt.clauses, 'ID')
  const layout     = clause(stmt.clauses, 'LAYOUT', 'STACK').toLowerCase()
  const padding    = clause(stmt.clauses, 'PADDING', 'MEDIUM').toLowerCase()
  const columns    = clause(stmt.clauses, 'COLUMNS', '1')
  const bg         = clause(stmt.clauses, 'BACKGROUND')

  const layoutClass = `layout-${layout}${layout === 'grid' ? ` cols-${columns}` : ''}`
  const style = bg ? ` style="background:var(--${bg.replace('COLOR-', '').toLowerCase()})"` : ''

  const inner = stmt.children.map(c => renderStatementWithRegistry(c, data, registry)).join('\n  ')

  return `<section${id ? ` id="${escapeHtml(id)}"` : ''} class="padding-${padding}"${style}>
  <div class="container ${layoutClass}">
  ${inner}
  </div>
</section>`
}

function renderHeading(stmt: DisplayStatement, data: DataDivision, level: 1 | 2 | 3): string {
  const text    = escapeHtml(resolveValue(stmt.value, data))
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

function renderParagraph(stmt: DisplayStatement, data: DataDivision): string {
  const text  = escapeHtml(resolveValue(stmt.value, data))
  const color = clause(stmt.clauses, 'COLOR', '').replace('COLOR-', '').toLowerCase()
  return `<p${color ? ` class="color-${color}"` : ''}>${text}</p>`
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

function renderFooter(stmt: DisplayStatement, data: DataDivision): string {
  const text  = escapeHtml(resolveValue(stmt.value ?? clause(stmt.clauses, 'TEXT'), data))
  const align = clause(stmt.clauses, 'ALIGN', 'LEFT').toLowerCase()
  return `<footer class="align-${align}">
  <div class="container">
    <p>${text}</p>
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

function renderCodeBlock(stmt: DisplayStatement, data: DataDivision): string {
  const text = escapeHtml(resolveValue(stmt.value, data))
  const lang = clause(stmt.clauses, 'LANGUAGE', '')
  return `<pre class="code-block"${lang ? ` data-language="${lang}"` : ''}>${text}</pre>`
}

function renderLabel(stmt: DisplayStatement, data: DataDivision): string {
  const text = escapeHtml(resolveValue(stmt.value, data))
  return `<div class="recall-label">${text}</div>`
}

function renderImage(stmt: DisplayStatement, data: DataDivision): string {
  const src  = clause(stmt.clauses, 'SRC') || resolveValue(stmt.value, data)
  const alt  = clause(stmt.clauses, 'ALT', '')
  const size = clause(stmt.clauses, 'SIZE', 'FULL').toLowerCase()
  const widthMap: Record<string, string> = { full: '100%', half: '50%', quarter: '25%', auto: 'auto' }
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="width:${widthMap[size] ?? '100%'}" />`
}

// ─────────────────────────────────────────────────────────
// Main statement dispatcher
// ─────────────────────────────────────────────────────────

function renderStatementWithRegistry(
  stmt: DisplayStatement,
  data: DataDivision,
  registry: ComponentRegistry,
): string {
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
    case 'NAVIGATION':  return renderNavigation(stmt, data)
    case 'SECTION':     return renderSection(stmt, data, registry)
    case 'FOOTER':      return renderFooter(stmt, data)
    case 'DIVIDER':     return renderDivider(stmt)
    case 'BANNER':      return renderBanner(stmt, data)
    case 'IMAGE':       return renderImage(stmt, data)
    case 'LINK': {
      const text = escapeHtml(resolveValue(stmt.value, data))
      const href = clause(stmt.clauses, 'HREF', '#')
      const target = clause(stmt.clauses, 'TARGET', 'SELF') === 'BLANK' ? ' target="_blank" rel="noopener"' : ''
      return `<a href="${escapeHtml(href)}"${target}>${text}</a>`
    }
    default: {
      const def = registry.get(stmt.element)
      if (def) return renderComponent(stmt, data, def, registry)
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

export function generate(program: ReclProgram, source: string): string {
  const { identification: id, environment: env, data, component, procedure } = program

  const css  = generateCss(env)
  const lang = id.language?.toLowerCase() ?? 'en'

  // Build component registry
  const registry: ComponentRegistry = new Map(
    component.components.map(def => [def.name, def])
  )

  // Render all sections
  const body = procedure.sections.map(section => {
    return section.statements.map(stmt => renderStatementWithRegistry(stmt, data, registry)).join('\n')
  }).join('\n')

  // Source embedding — the core RECALL principle
  const sourceComment = `<!--
${'*'.repeat(54)}
* RECALL COMPILED OUTPUT
* SOURCE: (embedded below)
* RECALL VERSION: 0.1
${'*'.repeat(54)}

${source.split('\n').map(l => (l ? `* ${l}` : '*')).join('\n')}

${'*'.repeat(54)}
-->`

  const viewport = env.viewport === 'FIXED-WIDTH'
    ? `<meta name="viewport" content="width=1200">`
    : `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

  return `${sourceComment}
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  ${viewport}
  <title>${escapeHtml(id.pageTitle)}</title>
  ${id.description ? `<meta name="description" content="${escapeHtml(id.description)}">` : ''}
  ${id.author      ? `<meta name="author" content="${escapeHtml(id.author)}">` : ''}
  ${id.favicon     ? `<link rel="icon" href="${escapeHtml(id.favicon)}">` : ''}
  <style>
${css}
  </style>
</head>
<body id="${id.programId.toLowerCase()}">
${body}
</body>
</html>`
}
