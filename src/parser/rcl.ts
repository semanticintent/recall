// ─────────────────────────────────────────────────────────
// RECALL Parser — .rcl source → ReclProgram AST
// ─────────────────────────────────────────────────────────

export type Division = 'IDENTIFICATION' | 'ENVIRONMENT' | 'DATA' | 'PROCEDURE' | 'COMPONENT'

// ─────────────────────────────────────────────────────────
// Source location — attached to every AST node
// file is empty string from parse(); the compiler/type-checker
// fills it in once the file path is known.
// ─────────────────────────────────────────────────────────

export interface NodeLocation {
  line:   number   // 1-indexed
  col:    number   // 1-indexed, points to the primary token
  length: number   // character span of the primary token
  source: string   // the full raw source line for caret display
}

// ─────────────────────────────────────────────────────────
// AST interfaces
// ─────────────────────────────────────────────────────────

export interface ParseWarning {
  code:    string
  message: string
  hint:    string
  loc:     NodeLocation
}

export interface ReclProgram {
  identification: IdentificationDivision
  environment:    EnvironmentDivision
  data:           DataDivision
  component:      ComponentDivision
  procedure:      ProcedureDivision
  parseWarnings:  ParseWarning[]   // diagnostics emitted during parsing, drained by typeCheck()
}

export interface IdentificationDivision {
  programId: string
  author?: string
  dateWritten?: string
  pageTitle: string
  description?: string
  favicon?: string
  language?: string
  programIdSet: boolean   // false when RECALL-PROGRAM default was applied
  pageTitleSet: boolean   // false when "RECALL Page" default was applied
}

export interface PaletteKeyError {
  raw: string        // the key as written, including the trailing period
  loc: NodeLocation
}

export interface EnvironmentDivision {
  viewport: 'RESPONSIVE' | 'FIXED-WIDTH' | 'FULL-WIDTH'
  colorMode: 'DARK' | 'LIGHT' | 'SYSTEM'
  fontPrimary?: string
  fontSecondary?: string
  language: string
  palette: Record<string, string>
  paletteKeyErrors: PaletteKeyError[]   // keys with trailing periods — RCL-022
  styleBlock?: string
  plugins: string[]
  suppressDefaultCss: boolean
}

export type DataLevel = 1 | 5 | 10

export interface DataField {
  level:    DataLevel
  name:     string
  pic:      string
  value:    string
  valueSet: boolean    // true if VALUE clause was present (even if VALUE "")
  comment?: string     // COMMENT "..." clause — intent metadata for AI tooling
  children: DataField[]
  loc?:     NodeLocation   // points at the variable name token
}

export interface DataDivision {
  workingStorage: DataField[]
  items: DataField[]
}

export interface AcceptsParam {
  name:     string
  required: boolean   // declared with REQUIRED keyword
}

export interface ComponentDef {
  name: string
  accepts: AcceptsParam[]
  body: DisplayStatement
  loc?: NodeLocation   // points at the DEFINE name token
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
  loc?: NodeLocation   // points at the element name token
}

export interface ProcedureSection {
  name: string
  statements: DisplayStatement[]
  loc?: NodeLocation   // points at the section header
}

export interface ProcedureDivision {
  sections:   ProcedureSection[]
  hasStopRun: boolean   // true when STOP RUN. was present in source
}

// ─────────────────────────────────────────────────────────
// Internal bucket type — lines with original line numbers
// ─────────────────────────────────────────────────────────

interface LineEntry {
  raw:     string   // original source line (untrimmed)
  lineNum: number   // 1-indexed position in source file
}

interface JoinedLine {
  text:    string   // joined/cleaned statement text
  lineNum: number   // line number of the first line in the join
  source:  string   // raw source of the first line (for caret display)
}

// ─────────────────────────────────────────────────────────
// Location helpers
// ─────────────────────────────────────────────────────────

/** Find 1-indexed column of a token in a source line. Returns 1 if not found. */
function findCol(source: string, token: string): number {
  const idx = source.indexOf(token)
  return idx >= 0 ? idx + 1 : 1
}

function makeLoc(lineNum: number, source: string, token: string): NodeLocation {
  const col = findCol(source, token)
  return { line: lineNum, col, length: token.length, source }
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
  const trimmed = stripped.trim()
  // Treat any line whose first non-space character is * as a comment
  if (trimmed.startsWith('*')) return ''
  return trimmed
}

function extractString(token: string): string {
  // Remove surrounding quotes
  if ((token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1)
  }
  return token
}

function parsePicValue(tokens: string[]): { pic: string; value: string; valueSet: boolean; comment?: string } {
  // e.g. PIC X(60) VALUE "hello" COMMENT "intent note"
  const picIdx     = tokens.indexOf('PIC')
  const valueIdx   = tokens.indexOf('VALUE')
  const commentIdx = tokens.indexOf('COMMENT')
  const pic = picIdx >= 0 && picIdx + 1 < tokens.length ? tokens[picIdx + 1] : 'X'

  // VALUE ends at COMMENT (if present), otherwise takes the rest
  const valueEnd = commentIdx >= 0 ? commentIdx : tokens.length
  const value = valueIdx >= 0 && valueIdx + 1 < valueEnd
    ? extractString(tokens.slice(valueIdx + 1, valueEnd).join(' '))
    : ''

  const comment = commentIdx >= 0 && commentIdx + 1 < tokens.length
    ? extractString(tokens.slice(commentIdx + 1).join(' '))
    : undefined

  return { pic, value, comment, valueSet: valueIdx >= 0 }
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

function parseIdentification(lines: LineEntry[]): IdentificationDivision {
  const result: Partial<IdentificationDivision> = {}
  for (const { raw } of lines) {
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
    programId:    result.programId   ?? 'RECALL-PROGRAM',
    pageTitle:    result.pageTitle   ?? 'RECALL Page',
    author:       result.author,
    dateWritten:  result.dateWritten,
    description:  result.description,
    favicon:      result.favicon,
    programIdSet: result.programId   !== undefined,
    pageTitleSet: result.pageTitle   !== undefined,
  }
}

function parseEnvironment(lines: LineEntry[]): EnvironmentDivision {
  const result: Partial<EnvironmentDivision> = { palette: {}, paletteKeyErrors: [] }
  let inStyleBlock = false
  const styleLines: string[] = []

  for (const { raw, lineNum } of lines) {
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
    if (kw === 'LOAD' && tokens[1] === 'PLUGIN') {
      if (!result.plugins) result.plugins = []
      result.plugins.push(tokens[2])
    }
    if (kw === 'SUPPRESS-DEFAULT-CSS' && tokens[1] === 'YES') {
      result.suppressDefaultCss = true
    }

    // Palette: COLOR-ACCENT #... (shorthand) or 01 COLOR-ACCENT PIC X(7) VALUE "#..."
    if (kw === '01') {
      const name = tokens[1]
      const { value } = parsePicValue(tokens.slice(2))
      if (name && value) result.palette![name] = value
    } else if (/^COLOR-/.test(kw)) {
      if (kw.endsWith('.')) {
        // RCL-022: trailing period on palette key — flag it, do not store
        result.paletteKeyErrors!.push({ raw: kw, loc: makeLoc(lineNum, raw, kw) })
      } else {
        const value = extractString(tokens.slice(1).join(' ')) || tokens[1]
        if (value) result.palette![kw] = value
      }
    }
  }

  let styleBlock: string | undefined
  if (styleLines.length > 0) {
    const joined = styleLines.join('\n')
    styleBlock = joined.replace(/^["']|["']\.?$/gm, '').trim()
  }

  return {
    viewport:           result.viewport           ?? 'RESPONSIVE',
    colorMode:          result.colorMode          ?? 'DARK',
    fontPrimary:        result.fontPrimary,
    fontSecondary:      result.fontSecondary,
    language:           result.language           ?? 'EN',
    palette:            result.palette            ?? {},
    paletteKeyErrors:   result.paletteKeyErrors   ?? [],
    styleBlock,
    plugins:            result.plugins            ?? [],
    suppressDefaultCss: result.suppressDefaultCss ?? false,
  }
}

function parseDataField(tokens: string[], lineNum: number, raw: string): DataField {
  const level = parseInt(tokens[0], 10) as DataLevel
  const name = tokens[1]
  const rest = tokens.slice(2)
  const { pic, value, comment, valueSet } = parsePicValue(rest)
  const loc = makeLoc(lineNum, raw, name)
  return { level, name, pic, value, valueSet, comment, children: [], loc }
}

function parseData(lines: LineEntry[]): DataDivision {
  const workingStorage: DataField[] = []
  const items: DataField[] = []
  let section: 'WORKING-STORAGE' | 'ITEMS' | null = null
  let stack: DataField[] = []

  for (const { raw, lineNum } of lines) {
    const line = cleanLine(raw)
    if (!line) continue
    if (line.startsWith('WORKING-STORAGE SECTION')) { section = 'WORKING-STORAGE'; stack = []; continue }
    if (line.startsWith('ITEMS SECTION'))           { section = 'ITEMS';           stack = []; continue }
    if (!section) continue

    const tokens = line.replace(/\.$/, '').split(/\s+/)
    const level = parseInt(tokens[0], 10)
    if (isNaN(level)) continue

    const field = parseDataField(tokens, lineNum, raw)
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
  const line = rawTokens.join(' ')
  const tokens = tokeniseLine(line)

  const element = tokens[1] as DisplayElement
  let value: string | undefined
  const clauses: DisplayClause[] = []

  let i = 2
  if (i < tokens.length && !['WITH', 'ON-CLICK', 'USING', 'HREF', 'ID'].includes(tokens[i])) {
    value = extractString(tokens[i])
    i++
  }

  while (i < tokens.length) {
    const kw = tokens[i]
    if (kw === 'WITH' && i + 1 < tokens.length && tokens[i + 1] === 'DATA') {
      const fields: string[] = []
      let j = i + 2
      while (j < tokens.length && tokens[j] !== 'WITH') {
        const name = tokens[j].replace(/,+$/, '').trim()
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
      clauses.push({ key: 'ON-CLICK', value: extractString(tokens[i + 2]) })
      i += 3
    } else if (kw === 'HREF' && i + 1 < tokens.length) {
      clauses.push({ key: 'HREF', value: extractString(tokens[i + 1]) })
      i += 2
    } else {
      i++
    }
  }

  // loc attached by caller (has access to lineNum and raw source)
  return { element, value, clauses, children: [] }
}

function joinContinuationLines(lines: LineEntry[]): JoinedLine[] {
  const joined: JoinedLine[] = []
  let currentText   = ''
  let currentLineNum = 0
  let currentSource  = ''

  for (const { raw, lineNum } of lines) {
    const line = cleanLine(raw)
    if (!line) continue

    const isNewStatement =
      line.startsWith('DISPLAY') ||
      line.startsWith('STOP') ||
      line.startsWith('COPY FROM') ||
      line.startsWith('DEFINE ') ||
      line.startsWith('END DEFINE') ||
      line.startsWith('END SECTION') ||
      line.startsWith('ACCEPTS ') ||
      (!line.includes(' ') && line.endsWith('.')) // section header

    if (isNewStatement) {
      if (currentText) joined.push({ text: currentText, lineNum: currentLineNum, source: currentSource })
      currentText    = line
      currentLineNum = lineNum
      currentSource  = raw
    } else {
      currentText = currentText ? `${currentText} ${line}` : line
      if (!currentSource) { currentLineNum = lineNum; currentSource = raw }
    }
  }
  if (currentText) joined.push({ text: currentText, lineNum: currentLineNum, source: currentSource })
  return joined
}

function parseProcedure(lines: LineEntry[]): { division: ProcedureDivision; warnings: ParseWarning[] } {
  const sections: ProcedureSection[] = []
  let current: ProcedureSection | null = null
  const sectionStack: DisplayStatement[] = []
  const joined = joinContinuationLines(lines)
  let hasStopRun = false
  const warnings: ParseWarning[] = []

  for (const { text, lineNum, source } of joined) {
    if (!text) continue
    if (text === 'STOP RUN.' || text === 'STOP RUN') { hasStopRun = true; continue }

    // Section header: single word ending with .
    if (!text.startsWith('DISPLAY') && text.endsWith('.') && !text.startsWith('STOP') && !text.includes(' ')) {
      const name = text.replace(/\.$/, '').trim()
      if (name) {
        const loc = makeLoc(lineNum, source, name)
        current = { name, statements: [], loc }
        sectionStack.length = 0
        sections.push(current)
        continue
      }
    }

    if (text === 'STOP SECTION.' || text.startsWith('END SECTION')) {
      sectionStack.pop()
      continue
    }

    if (text.startsWith('DISPLAY') && current) {
      // RCL-023: check for missing terminator before stripping the dot
      if (!text.endsWith('.')) {
        const col = text.length + 1
        warnings.push({
          code:    'RCL-023',
          message: 'Statement has no terminator',
          hint:    'Every RECALL statement must end with a period (.)',
          loc:     { line: lineNum, col, length: 1, source },
        })
      }
      const tokens = text.replace(/\.$/, '').split(/\s+/)
      const stmt = parseDisplayStatement(tokens)
      // Attach location — point at the element name (tokens[1])
      const elementToken = tokens[1] ?? ''
      stmt.loc = makeLoc(lineNum, source, elementToken)

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
    } else if (text.startsWith('COPY FROM') && current) {
      const tokens = text.replace(/\.$/, '').split(/\s+/)
      const filePath = extractString(tokens.slice(2).join(' '))
      const loc = makeLoc(lineNum, source, filePath)
      const stmt: DisplayStatement = { element: 'COPY', value: filePath, clauses: [], children: [], loc }
      const parent = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : null
      if (parent) {
        parent.children.push(stmt)
      } else {
        current.statements.push(stmt)
      }
    }
  }

  return { division: { sections, hasStopRun }, warnings }
}

function parseComponentDivision(lines: LineEntry[]): ComponentDivision {
  const components: ComponentDef[] = []
  const joined = joinContinuationLines(lines)

  let i = 0
  while (i < joined.length) {
    const { text, lineNum, source } = joined[i]

    if (text.startsWith('DEFINE ')) {
      const name = text.replace(/^DEFINE\s+/, '').replace(/\.$/, '').trim()
      const loc = makeLoc(lineNum, source, name)
      let accepts: AcceptsParam[] = []
      const body: DisplayStatement = { element: 'SECTION', clauses: [], children: [] }
      let currentSection: DisplayStatement = body
      i++

      const sectionStack: DisplayStatement[] = []

      while (i < joined.length && joined[i].text !== 'END DEFINE.') {
        const inner = joined[i]

        if (inner.text.startsWith('ACCEPTS ')) {
          const raw = inner.text.replace(/^ACCEPTS\s+/, '').replace(/\.$/, '')
          // Split on commas; each item may be "PARAM-NAME" or "PARAM-NAME REQUIRED"
          accepts = raw.split(',').map(s => s.trim()).filter(Boolean).map(item => {
            const parts = item.split(/\s+/)
            return { name: parts[0], required: parts.includes('REQUIRED') }
          })
        } else if (inner.text.startsWith('DISPLAY')) {
          const tokens = inner.text.replace(/\.$/, '').split(/\s+/)
          const stmt = parseDisplayStatement(tokens)
          const elementToken = tokens[1] ?? ''
          stmt.loc = makeLoc(inner.lineNum, inner.source, elementToken)

          if (stmt.element === 'SECTION') {
            if (currentSection === body && body.clauses.length === 0 && body.children.length === 0) {
              body.element = 'SECTION'
              body.clauses = stmt.clauses
              body.value   = stmt.value
            } else {
              currentSection.children.push(stmt)
              sectionStack.push(currentSection)
              currentSection = stmt
            }
          } else {
            currentSection.children.push(stmt)
          }
        } else if (inner.text === 'STOP SECTION.') {
          currentSection = sectionStack.length > 0 ? sectionStack.pop()! : body
        }

        i++
      }

      components.push({ name, accepts, body, loc })
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

  const buckets: Record<Division, LineEntry[]> = {
    IDENTIFICATION: [],
    ENVIRONMENT:    [],
    DATA:           [],
    COMPONENT:      [],
    PROCEDURE:      [],
  }

  let currentDivision: Division | null = null
  let inValueString = false

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const lineNum = i + 1   // 1-indexed
    const t = raw.trim()

    // Track multi-line VALUE strings — never detect division headers inside them
    if (inValueString) {
      if (currentDivision) buckets[currentDivision].push({ raw, lineNum })
      if (t.endsWith('".')) inValueString = false
      continue
    }
    if (t.includes('VALUE "') && !t.endsWith('".')) {
      inValueString = true
      if (currentDivision) buckets[currentDivision].push({ raw, lineNum })
      continue
    }

    const div = detectDivision(raw)
    if (div) { currentDivision = div; continue }
    if (currentDivision) buckets[currentDivision].push({ raw, lineNum })
  }

  const { division: procedure, warnings: parseWarnings } = parseProcedure(buckets.PROCEDURE)

  return {
    identification: parseIdentification(buckets.IDENTIFICATION),
    environment:    parseEnvironment(buckets.ENVIRONMENT),
    data:           parseData(buckets.DATA),
    component:      parseComponentDivision(buckets.COMPONENT),
    procedure,
    parseWarnings,
  }
}
