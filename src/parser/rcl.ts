// ─────────────────────────────────────────────────────────
// RECALL Parser — .rcl source → ReclProgram AST
// ─────────────────────────────────────────────────────────

export type Division = 'IDENTIFICATION' | 'ENVIRONMENT' | 'DATA' | 'PROCEDURE' | 'COMPONENT'

export interface ReclProgram {
  identification: IdentificationDivision
  environment: EnvironmentDivision
  data: DataDivision
  component: ComponentDivision
  procedure: ProcedureDivision
}

export interface IdentificationDivision {
  programId: string
  author?: string
  dateWritten?: string
  pageTitle: string
  description?: string
  favicon?: string
  language?: string
}

export interface EnvironmentDivision {
  viewport: 'RESPONSIVE' | 'FIXED-WIDTH' | 'FULL-WIDTH'
  colorMode: 'DARK' | 'LIGHT' | 'SYSTEM'
  fontPrimary?: string
  fontSecondary?: string
  language: string
  palette: Record<string, string>
  styleBlock?: string
}

export type DataLevel = 1 | 5 | 10

export interface DataField {
  level: DataLevel
  name: string
  pic: string
  value: string
  children: DataField[]
}

export interface DataDivision {
  workingStorage: DataField[]
  items: DataField[]
}

export interface ComponentDef {
  name: string
  accepts: string[]
  body: DisplayStatement
}

export interface ComponentDivision {
  components: ComponentDef[]
}

export type DisplayElement =
  | 'HEADING-1' | 'HEADING-2' | 'HEADING-3'
  | 'PARAGRAPH' | 'LABEL' | 'CODE-BLOCK'
  | 'BUTTON' | 'LINK' | 'IMAGE' | 'DIVIDER'
  | 'SECTION' | 'NAVIGATION' | 'FOOTER'
  | 'CARD-LIST' | 'INPUT' | 'BANNER'
  | 'TABLE' | 'STAT-GRID'
  | 'COPY'

export interface DisplayClause {
  key: string
  value: string
}

export interface DisplayStatement {
  element: DisplayElement | string
  value?: string        // variable name or literal
  clauses: DisplayClause[]
  children: DisplayStatement[]
}

export interface ProcedureSection {
  name: string
  statements: DisplayStatement[]
}

export interface ProcedureDivision {
  sections: ProcedureSection[]
}

// ─────────────────────────────────────────────────────────
// Tokenisation helpers
// ─────────────────────────────────────────────────────────

function stripComment(line: string): string {
  // Column 7 indicator: if 7th char is *, it's a comment line
  if (line.length >= 7 && line[6] === '*') return ''
  // Inline * comments after a period
  return line
}

function cleanLine(raw: string): string {
  const stripped = stripComment(raw)
  return stripped.trim()
}

function extractString(token: string): string {
  // Remove surrounding quotes
  if ((token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1)
  }
  return token
}

function parsePicValue(tokens: string[]): { pic: string; value: string } {
  // e.g. PIC X(60) VALUE "hello"
  const picIdx = tokens.indexOf('PIC')
  const valueIdx = tokens.indexOf('VALUE')
  const pic = picIdx >= 0 && picIdx + 1 < tokens.length ? tokens[picIdx + 1] : 'X'
  const value = valueIdx >= 0 && valueIdx + 1 < tokens.length
    ? extractString(tokens.slice(valueIdx + 1).join(' '))
    : ''
  return { pic, value }
}

// ─────────────────────────────────────────────────────────
// Division detection
// ─────────────────────────────────────────────────────────

function detectDivision(line: string): Division | null {
  const t = line.trim()
  if (t.startsWith('IDENTIFICATION DIVISION')) return 'IDENTIFICATION'
  if (t.startsWith('ENVIRONMENT DIVISION'))   return 'ENVIRONMENT'
  if (t.startsWith('DATA DIVISION'))          return 'DATA'
  if (t.startsWith('COMPONENT DIVISION'))     return 'COMPONENT'
  if (t.startsWith('PROCEDURE DIVISION'))     return 'PROCEDURE'
  return null
}

// ─────────────────────────────────────────────────────────
// Division parsers
// ─────────────────────────────────────────────────────────

function parseIdentification(lines: string[]): IdentificationDivision {
  const result: Partial<IdentificationDivision> = {}
  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) continue
    const tokens = line.replace(/\.$/, '').split(/\s+/)
    const kw = tokens[0]
    const val = extractString(tokens.slice(1).join(' '))
    if (kw === 'PROGRAM-ID.')   result.programId   = val || tokens[1]
    if (kw === 'AUTHOR.')       result.author       = val
    if (kw === 'DATE-WRITTEN.') result.dateWritten  = val
    if (kw === 'PAGE-TITLE.')   result.pageTitle    = val
    if (kw === 'DESCRIPTION.')  result.description  = val
    if (kw === 'FAVICON.')      result.favicon      = val
  }
  return {
    programId:   result.programId   ?? 'RECALL-PROGRAM',
    pageTitle:   result.pageTitle   ?? 'RECALL Page',
    author:      result.author,
    dateWritten: result.dateWritten,
    description: result.description,
    favicon:     result.favicon,
  }
}

function parseEnvironment(lines: string[]): EnvironmentDivision {
  const result: Partial<EnvironmentDivision> = { palette: {} }
  let inStyleBlock = false
  const styleLines: string[] = []

  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) continue

    // Detect STYLE-BLOCK section
    if (line === 'STYLE-BLOCK' || line === 'STYLE-BLOCK.') {
      inStyleBlock = true
      continue
    }

    // Exit STYLE-BLOCK when another known section starts
    if (inStyleBlock) {
      if (line.endsWith('SECTION.') || line.endsWith('SECTION') ||
          line === 'CONFIGURATION SECTION' || line === 'PALETTE SECTION' ||
          line === 'FONT SECTION') {
        inStyleBlock = false
      } else {
        // Collect raw lines — strip surrounding quotes if present
        const stripped = raw.replace(/^\s+/, '')
        styleLines.push(stripped)
        continue
      }
    }

    if (line.endsWith('SECTION.') || line === 'CONFIGURATION SECTION' ||
        line === 'PALETTE SECTION' || line === 'FONT SECTION') continue

    const tokens = line.replace(/\.$/, '').split(/\s+/)
    const kw = tokens[0]

    if (kw === 'VIEWPORT')       result.viewport      = tokens[1] as EnvironmentDivision['viewport']
    if (kw === 'COLOR-MODE')     result.colorMode     = tokens[1] as EnvironmentDivision['colorMode']
    if (kw === 'FONT-PRIMARY')   result.fontPrimary   = extractString(tokens.slice(1).join(' '))
    if (kw === 'FONT-SECONDARY') result.fontSecondary = extractString(tokens.slice(1).join(' '))
    if (kw === 'LANGUAGE')       result.language      = tokens[1]

    // Palette: COLOR-ACCENT #... (shorthand) or 01 COLOR-ACCENT PIC X(7) VALUE "#..."
    if (kw === '01') {
      const name = tokens[1]
      const { value } = parsePicValue(tokens.slice(2))
      if (name && value) result.palette![name] = value
    } else if (/^COLOR-/.test(kw)) {
      const value = extractString(tokens.slice(1).join(' ')) || tokens[1]
      if (value) result.palette![kw] = value
    }
  }

  // Join style block lines, strip wrapping quotes from multi-line string values
  let styleBlock: string | undefined
  if (styleLines.length > 0) {
    const joined = styleLines.join('\n')
    // Strip leading/trailing quote if the whole block is wrapped
    styleBlock = joined.replace(/^["']|["']\.?$/gm, '').trim()
  }

  return {
    viewport:      result.viewport      ?? 'RESPONSIVE',
    colorMode:     result.colorMode     ?? 'DARK',
    fontPrimary:   result.fontPrimary,
    fontSecondary: result.fontSecondary,
    language:      result.language      ?? 'EN',
    palette:       result.palette       ?? {},
    styleBlock,
  }
}

function parseDataField(tokens: string[]): DataField {
  const level = parseInt(tokens[0], 10) as DataLevel
  const name = tokens[1]
  const rest = tokens.slice(2)
  const { pic, value } = parsePicValue(rest)
  return { level, name, pic, value, children: [] }
}

function parseData(lines: string[]): DataDivision {
  const workingStorage: DataField[] = []
  const items: DataField[] = []
  let section: 'WORKING-STORAGE' | 'ITEMS' | null = null
  let stack: DataField[] = []

  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) continue
    if (line.startsWith('WORKING-STORAGE SECTION')) { section = 'WORKING-STORAGE'; stack = []; continue }
    if (line.startsWith('ITEMS SECTION'))           { section = 'ITEMS';           stack = []; continue }
    if (!section) continue

    const tokens = line.replace(/\.$/, '').split(/\s+/)
    const level = parseInt(tokens[0], 10)
    if (isNaN(level)) continue

    const field = parseDataField(tokens)
    const target = section === 'WORKING-STORAGE' ? workingStorage : items

    if (level === 1) {
      target.push(field)
      stack = [field]
    } else if (level === 5) {
      const parent = stack.find(f => f.level === 1)
      parent?.children.push(field)
      stack = stack.filter(f => f.level === 1)
      stack.push(field)
    } else if (level === 10) {
      const parent = stack.find(f => f.level === 5)
      parent?.children.push(field)
    }
  }

  return { workingStorage, items }
}

function tokeniseLine(line: string): string[] {
  // Tokenise respecting quoted strings
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of line) {
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true
      quoteChar = ch
      current += ch
    } else if (inQuote && ch === quoteChar) {
      inQuote = false
      current += ch
      tokens.push(current)
      current = ''
    } else if (!inQuote && ch === ' ') {
      if (current) { tokens.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

function parseDisplayStatement(rawTokens: string[]): DisplayStatement {
  // Re-tokenise the joined line respecting quoted strings
  const line = rawTokens.join(' ')
  const tokens = tokeniseLine(line)

  const element = tokens[1] as DisplayElement
  let value: string | undefined
  const clauses: DisplayClause[] = []

  let i = 2
  // Next token might be a value (not a keyword)
  if (i < tokens.length && !['WITH', 'ON-CLICK', 'USING', 'HREF', 'ID'].includes(tokens[i])) {
    value = extractString(tokens[i])
    i++
  }

  while (i < tokens.length) {
    const kw = tokens[i]
    if (kw === 'WITH' && i + 1 < tokens.length && tokens[i + 1] === 'DATA') {
      // WITH DATA FIELD1, FIELD2, FIELD3 — collect all field names until next WITH or end
      const fields: string[] = []
      let j = i + 2
      while (j < tokens.length && tokens[j] !== 'WITH') {
        const name = tokens[j].replace(/,+$/, '').trim()  // strip trailing commas
        if (name) fields.push(name)
        j++
      }
      if (fields.length > 0) clauses.push({ key: 'DATA', value: fields.join(',') })
      i = j
    } else if (kw === 'WITH' && i + 2 < tokens.length) {
      clauses.push({ key: tokens[i + 1], value: extractString(tokens[i + 2]) })
      i += 3
    } else if (kw === 'ID' && i + 1 < tokens.length) {
      clauses.push({ key: 'ID', value: extractString(tokens[i + 1]) })
      i += 2
    } else if (kw === 'USING' && i + 1 < tokens.length) {
      clauses.push({ key: 'USING', value: tokens[i + 1] })
      i += 2
    } else if (kw === 'ON-CLICK' && i + 2 < tokens.length) {
      // ON-CLICK GOTO "#href"
      clauses.push({ key: 'ON-CLICK', value: extractString(tokens[i + 2]) })
      i += 3
    } else if (kw === 'HREF' && i + 1 < tokens.length) {
      clauses.push({ key: 'HREF', value: extractString(tokens[i + 1]) })
      i += 2
    } else {
      i++
    }
  }

  return { element, value, clauses, children: [] }
}

function joinContinuationLines(lines: string[]): string[] {
  const joined: string[] = []
  let current = ''

  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) continue

    const isNewStatement =
      line.startsWith('DISPLAY') ||
      line.startsWith('STOP') ||
      line.startsWith('COPY FROM') ||
      line.startsWith('DEFINE ') ||
      line.startsWith('END DEFINE') ||
      line.startsWith('ACCEPTS ') ||
      (!line.includes(' ') && line.endsWith('.')) // section header

    if (isNewStatement) {
      if (current) joined.push(current)
      current = line
    } else {
      current = current ? `${current} ${line}` : line
    }
  }
  if (current) joined.push(current)
  return joined
}

function parseProcedure(lines: string[]): ProcedureDivision {
  const sections: ProcedureSection[] = []
  let current: ProcedureSection | null = null
  const sectionStack: DisplayStatement[] = []
  const joined = joinContinuationLines(lines)

  for (const line of joined) {
    if (!line || line === 'STOP RUN.') continue

    // Section header: single word ending with .
    if (!line.startsWith('DISPLAY') && line.endsWith('.') && !line.startsWith('STOP') && !line.includes(' ')) {
      const name = line.replace(/\.$/, '').trim()
      if (name) {
        current = { name, statements: [] }
        sectionStack.length = 0
        sections.push(current)
        continue
      }
    }

    if (line === 'STOP SECTION.') {
      sectionStack.pop()
      continue
    }

    if (line.startsWith('DISPLAY') && current) {
      const tokens = line.replace(/\.$/, '').split(/\s+/)
      const stmt = parseDisplayStatement(tokens)
      const parent = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : null
      if (stmt.element === 'SECTION') {
        if (parent) {
          parent.children.push(stmt)
        } else {
          current.statements.push(stmt)
        }
        sectionStack.push(stmt)
      } else {
        if (parent) {
          parent.children.push(stmt)
        } else {
          current.statements.push(stmt)
        }
      }
    } else if (line.startsWith('COPY FROM') && current) {
      const tokens = line.replace(/\.$/, '').split(/\s+/)
      const filePath = extractString(tokens.slice(2).join(' '))
      const stmt: DisplayStatement = { element: 'COPY', value: filePath, clauses: [], children: [] }
      const parent = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : null
      if (parent) {
        parent.children.push(stmt)
      } else {
        current.statements.push(stmt)
      }
    }
  }

  return { sections }
}

function parseComponentDivision(lines: string[]): ComponentDivision {
  const components: ComponentDef[] = []
  const joined = joinContinuationLines(lines)

  let i = 0
  while (i < joined.length) {
    const line = joined[i]

    if (line.startsWith('DEFINE ')) {
      const name = line.replace(/^DEFINE\s+/, '').replace(/\.$/, '').trim()
      let accepts: string[] = []
      // wrapper SECTION that holds all body children
      const body: DisplayStatement = { element: 'SECTION', clauses: [], children: [] }
      let currentSection: DisplayStatement = body
      i++

      const sectionStack: DisplayStatement[] = []

      while (i < joined.length && joined[i] !== 'END DEFINE.') {
        const inner = joined[i]

        if (inner.startsWith('ACCEPTS ')) {
          const raw = inner.replace(/^ACCEPTS\s+/, '').replace(/\.$/, '')
          accepts = raw.split(/[\s,]+/).filter(Boolean)
        } else if (inner.startsWith('DISPLAY')) {
          const tokens = inner.replace(/\.$/, '').split(/\s+/)
          const stmt = parseDisplayStatement(tokens)
          if (stmt.element === 'SECTION') {
            if (currentSection === body && body.clauses.length === 0 && body.children.length === 0) {
              // First SECTION in the DEFINE block — promote it to be the body
              body.element = 'SECTION'
              body.clauses = stmt.clauses
              body.value   = stmt.value
              // currentSection stays as body; don't push to stack
            } else {
              // Nested SECTION — add as child and push current onto stack
              currentSection.children.push(stmt)
              sectionStack.push(currentSection)
              currentSection = stmt
            }
          } else {
            currentSection.children.push(stmt)
          }
        } else if (inner === 'STOP SECTION.') {
          currentSection = sectionStack.length > 0 ? sectionStack.pop()! : body
        }

        i++
      }

      components.push({ name, accepts, body })
    }

    i++
  }

  return { components }
}

// ─────────────────────────────────────────────────────────
// Main parse entry point
// ─────────────────────────────────────────────────────────

export function parse(source: string): ReclProgram {
  const rawLines = source.split('\n')

  const buckets: Record<Division, string[]> = {
    IDENTIFICATION: [],
    ENVIRONMENT:    [],
    DATA:           [],
    COMPONENT:      [],
    PROCEDURE:      [],
  }

  let currentDivision: Division | null = null

  for (const line of rawLines) {
    const div = detectDivision(line)
    if (div) { currentDivision = div; continue }
    if (currentDivision) buckets[currentDivision].push(line)
  }

  return {
    identification: parseIdentification(buckets.IDENTIFICATION),
    environment:    parseEnvironment(buckets.ENVIRONMENT),
    data:           parseData(buckets.DATA),
    component:      parseComponentDivision(buckets.COMPONENT),
    procedure:      parseProcedure(buckets.PROCEDURE),
  }
}
