// ─────────────────────────────────────────────────────────
// RECALL Diagnostics — error code registry
// ─────────────────────────────────────────────────────────

import type { DiagnosticCategory, DiagnosticSeverity } from './types.js'

export interface CodeDefinition {
  code:        string
  severity:    DiagnosticSeverity
  category:    DiagnosticCategory
  message:     string          // static message template (shown in terminal)
  description: string          // full explanation of what the error means
  example:     string          // minimal RECALL snippet triggering the error
  fix:         string          // how to fix it
  seeAlso:     string[]        // related codes
}

export const CODES: Record<string, CodeDefinition> = {

  // ── Errors ───────────────────────────────────────────

  'RCL-001': {
    code:        'RCL-001',
    severity:    'error',
    category:    'type-mismatch',
    message:     'Type mismatch',
    description: 'An element received a variable of an incompatible PIC type. For example, HEADING-1 expects a string (PIC X) but was given a numeric field (PIC 9).',
    example:     '01 VISIT-COUNT PIC 9(6) VALUE "142398".\nDISPLAY HEADING-1 VISIT-COUNT.   ← numeric in string context',
    fix:         'Use an element that accepts the actual type (e.g. LABEL accepts numeric), or redeclare the field as PIC X.',
    seeAlso:     ['RCL-007', 'RCL-008', 'RCL-W05'],
  },

  'RCL-002': {
    code:        'RCL-002',
    severity:    'error',
    category:    'value-constraint',
    message:     'Value exceeds declared length',
    description: 'The VALUE string is longer than the declared PIC X(n) maximum. RECALL enforces length at compile time to prevent truncation in generated HTML.',
    example:     '01 HERO-HEAD PIC X(40) VALUE "This heading is much longer than forty characters.".',
    fix:         'Either shorten the value to fit PIC X(n), or increase n to match the value length: PIC X(51).',
    seeAlso:     ['RCL-W02'],
  },

  'RCL-003': {
    code:        'RCL-003',
    severity:    'error',
    category:    'unknown-element',
    message:     'Unknown element',
    description: 'A DISPLAY statement references an element name that is not registered — not a built-in and no LOAD PLUGIN is present. A "did you mean?" suggestion is shown when the name is close to a known element.',
    example:     'DISPLAY HEADING1 PAGE-TITLE.   ← missing hyphen',
    fix:         'Correct the element name (e.g. HEADING-1 not HEADING1). For plugin elements, add LOAD PLUGIN in the ENVIRONMENT DIVISION. Run `recall schema` to see all valid elements.',
    seeAlso:     [],
  },

  'RCL-004': {
    code:        'RCL-004',
    severity:    'error',
    category:    'unknown-identifier',
    message:     'Unknown identifier',
    description: 'A USING clause or group reference names a variable that does not exist in the DATA DIVISION. Either the field was never declared, or the name is misspelled.',
    example:     'DISPLAY NAVIGATION USING NAV-LINKS.   ← NAV-LINKS not in DATA DIVISION',
    fix:         'Declare the group in the ITEMS SECTION. Run `recall check <file> --inspect` to see what LOAD FROM generated — field names may differ from the JSON key (e.g. revenueQ1 → REVENUE-Q1).',
    seeAlso:     ['RCL-007'],
  },

  'RCL-005': {
    code:        'RCL-005',
    severity:    'error',
    category:    'missing-required',
    message:     'Missing required division',
    description: 'The PROCEDURE DIVISION is absent or has no sections. Without it, no HTML can be generated.',
    example:     'IDENTIFICATION DIVISION.\n   PROGRAM-ID. MY-SITE.\n* No PROCEDURE DIVISION',
    fix:         'Add a PROCEDURE DIVISION with at least one section containing DISPLAY statements, ending with STOP RUN.',
    seeAlso:     ['RCL-013'],
  },

  'RCL-006': {
    code:        'RCL-006',
    severity:    'error',
    category:    'missing-required',
    message:     'Missing required identification field',
    description: 'A required field in the IDENTIFICATION DIVISION is absent. PROGRAM-ID and PAGE-TITLE are required for every RECALL program.',
    example:     'IDENTIFICATION DIVISION.\n   AUTHOR. Michael Shatny.\n* PROGRAM-ID and PAGE-TITLE missing',
    fix:         'Add PROGRAM-ID and PAGE-TITLE to the IDENTIFICATION DIVISION.',
    seeAlso:     ['RCL-W03'],
  },

  'RCL-007': {
    code:        'RCL-007',
    severity:    'error',
    category:    'group-shape',
    message:     'USING requires a group, not a scalar',
    description: 'An element that requires a group (CARD-LIST, NAVIGATION, TABS, SIDEBAR-NAV) was given a USING clause pointing to a scalar field, or the USING clause is absent entirely.',
    example:     '01 PAGE-TITLE PIC X(60) VALUE "My Site".\nDISPLAY NAVIGATION USING PAGE-TITLE.   ← scalar, not group',
    fix:         'Declare a group in the ITEMS SECTION and reference it via USING. Groups must have at least one child field (level 05 or 10).',
    seeAlso:     ['RCL-004', 'RCL-008', 'RCL-W01'],
  },

  'RCL-008': {
    code:        'RCL-008',
    severity:    'error',
    category:    'group-shape',
    message:     'Group used where scalar expected',
    description: 'A string-accepting element (HEADING-1, PARAGRAPH, LABEL, etc.) received a group reference where a scalar value is expected.',
    example:     '01 FEATURES.\n   05 FEATURES-1 PIC X(40) VALUE "Fast".\nDISPLAY HEADING-1 FEATURES.   ← group in string context',
    fix:         'Use a group element (CARD-LIST, TABLE, STAT-GRID) for groups, or reference a scalar child field directly.',
    seeAlso:     ['RCL-007', 'RCL-001'],
  },

  'RCL-009': {
    code:        'RCL-009',
    severity:    'error',
    category:    'format',
    message:     'Invalid DATE format',
    description: 'A field declared PIC DATE has a value that does not match ISO 8601 (YYYY-MM-DD).',
    example:     '01 PUBLISH-DATE PIC DATE VALUE "April 5, 2026".   ← not ISO 8601',
    fix:         'Use YYYY-MM-DD format: VALUE "2026-04-05".',
    seeAlso:     [],
  },

  'RCL-010': {
    code:        'RCL-010',
    severity:    'error',
    category:    'format',
    message:     'Invalid URL format',
    description: 'A field declared PIC URL has a value that does not begin with http://, https://, or /. Relative paths like "images/logo.png" are not accepted.',
    example:     '01 LOGO-SRC PIC URL VALUE "images/logo.png".   ← relative path not allowed',
    fix:         'Use a full URL (https://...) or a root-relative path starting with /: VALUE "/images/logo.png".',
    seeAlso:     [],
  },

  'RCL-011': {
    code:        'RCL-011',
    severity:    'error',
    category:    'format',
    message:     'PCT value out of range',
    description: 'A field declared PIC PCT has a value outside the 0–100 range. PCT fields represent percentages.',
    example:     '01 ACCURACY PIC PCT VALUE "142".   ← exceeds 100',
    fix:         'Use a numeric value between 0 and 100: VALUE "78".',
    seeAlso:     [],
  },

  'RCL-012': {
    code:        'RCL-012',
    severity:    'error',
    category:    'value-constraint',
    message:     'Non-numeric value in PIC 9 field',
    description: 'A field declared PIC 9(n) contains non-numeric characters (commas, letters, symbols) in its VALUE. PIC 9 fields are strictly numeric.',
    example:     '01 VISIT-COUNT PIC 9(6) VALUE "142,398".   ← comma not allowed in PIC 9',
    fix:         'Remove non-numeric characters (VALUE "142398"), or declare the field as PIC X if display formatting is needed (PIC X(10) VALUE "142,398").',
    seeAlso:     ['RCL-001'],
  },

  'RCL-013': {
    code:        'RCL-013',
    severity:    'error',
    category:    'structural',
    message:     'Missing STOP RUN',
    description: 'The PROCEDURE DIVISION does not end with STOP RUN. This statement is required to signal the end of the program.',
    example:     'PROCEDURE DIVISION.\n   RENDER-MAIN.\n      DISPLAY HEADING-1 "Hello".\n* STOP RUN missing',
    fix:         'Add STOP RUN. as the final statement in the PROCEDURE DIVISION, after all sections.',
    seeAlso:     ['RCL-005'],
  },

  'RCL-014': {
    code:        'RCL-014',
    severity:    'error',
    category:    'structural',
    message:     'Component referenced before DEFINE',
    description: 'A component is used in the PROCEDURE DIVISION before its DEFINE block appears in the COMPONENT DIVISION.',
    example:     'PROCEDURE DIVISION.\n   RENDER.\n      DISPLAY MY-CARD.\n* MY-CARD DEFINE block missing or after PROCEDURE',
    fix:         'Ensure the COMPONENT DIVISION appears before the PROCEDURE DIVISION and contains the DEFINE block for every component used.',
    seeAlso:     ['RCL-015'],
  },

  'RCL-015': {
    code:        'RCL-015',
    severity:    'error',
    category:    'unknown-identifier',
    message:     'Cannot resolve COPY FROM path',
    description: 'A COPY FROM directive references a file or package path that cannot be found on disk.',
    example:     'COPY FROM "components/nav.rcpy".   ← file not found',
    fix:         'Verify the path is correct relative to the .rcl file. For npm package paths (@scope/pkg/file.rcpy), verify the package is installed.',
    seeAlso:     ['RCL-018'],
  },

  'RCL-016': {
    code:        'RCL-016',
    severity:    'error',
    category:    'type-mismatch',
    message:     'Component parameter type mismatch',
    description: 'A component was called with a WITH clause that passes a value of the wrong type for an ACCEPTS parameter.',
    example:     'DEFINE MY-CARD.\n   ACCEPTS TITLE, SCORE.\n   ...\nDISPLAY MY-CARD WITH TITLE METRICS-GROUP.   ← group where string expected',
    fix:         'Match the type of the bound value to what the component ACCEPTS declaration expects.',
    seeAlso:     ['RCL-017', 'RCL-001'],
  },

  'RCL-017': {
    code:        'RCL-017',
    severity:    'error',
    category:    'missing-required',
    message:     'Missing required component parameter',
    description: 'A component was called without providing all parameters declared in its ACCEPTS clause.',
    example:     'DEFINE PRICING-CARD.\n   ACCEPTS TIER, PRICE, FEATURES.\nDISPLAY PRICING-CARD WITH TIER "A" WITH PRICE "$0".\n* FEATURES not provided',
    fix:         'Provide all ACCEPTS fields via WITH clauses when displaying the component.',
    seeAlso:     ['RCL-016'],
  },

  'RCL-018': {
    code:        'RCL-018',
    severity:    'error',
    category:    'structural',
    message:     'Circular COPY detected',
    description: 'A COPY FROM chain creates a cycle — file A copies B which copies A (directly or transitively).',
    example:     '* nav.rcpy: COPY FROM "header.rcpy"\n* header.rcpy: COPY FROM "nav.rcpy"   ← cycle',
    fix:         'Restructure components so no file includes itself. Extract shared content into a third file that neither file includes.',
    seeAlso:     ['RCL-015'],
  },

  'RCL-019': {
    code:        'RCL-019',
    severity:    'error',
    category:    'structural',
    message:     'LOAD FROM file not found',
    description: 'A LOAD FROM directive in the DATA DIVISION references a JSON or CSV file that does not exist at the specified path.',
    example:     'DATA DIVISION.\n   LOAD FROM "data/metrics.json".   ← file not found',
    fix:         'Verify the file path is correct relative to the .rcl source file. Run `recall check <file> --inspect` to preview what LOAD FROM would generate once the file exists.',
    seeAlso:     ['RCL-020'],
  },

  'RCL-020': {
    code:        'RCL-020',
    severity:    'error',
    category:    'structural',
    message:     'LOAD FROM file is not valid JSON or CSV',
    description: 'A LOAD FROM directive found the target file but could not parse it. The file is malformed JSON or invalid CSV.',
    example:     'DATA DIVISION.\n   LOAD FROM "data/metrics.json".   ← file exists but is malformed JSON',
    fix:         'Validate the file with a JSON linter. Ensure JSON top-level is an object (not an array). For CSV, ensure the first row is a header row.',
    seeAlso:     ['RCL-019'],
  },

  'RCL-021': {
    code:        'RCL-021',
    severity:    'error',
    category:    'unknown-identifier',
    message:     'Unknown RECORD type',
    description: 'A RECORD expansion (01 GROUP RECORD SHAPE ROWS n.) references a shape name that was never defined with a RECORD...END RECORD block in the DATA DIVISION.',
    example:     '01 METRICS RECORD METRIC-ROW ROWS 4.   ← METRIC-ROW not defined',
    fix:         'Define the record shape before using it:\n  RECORD METRIC-ROW.\n     10 LABEL PIC X(50).\n     10 VALUE PIC X(20).\n  END RECORD.',
    seeAlso:     ['RCL-004'],
  },

  'RCL-022': {
    code:        'RCL-022',
    severity:    'error',
    category:    'format',
    message:     'Palette key has trailing period',
    description: 'A colour key in the PALETTE SECTION ends with a period. The key is stored with the period included, so any lookup against the clean name silently fails and the colour is never applied to the compiled output.',
    example:     'COLOR-BG.  "#080a10".   ← key stored as "COLOR-BG." — lookup for COLOR-BG finds nothing',
    fix:         'Remove the period from the key name: COLOR-BG  "#080a10".',
    seeAlso:     [],
  },

  'RCL-023': {
    code:        'RCL-023',
    severity:    'error',
    category:    'syntax',
    message:     'Statement has no terminator',
    description: 'A PROCEDURE DIVISION statement does not end with a period. Every RECALL statement must be terminated with a full stop.',
    example:     'DISPLAY HEADING-1 PAGE-TITLE   ← missing period',
    fix:         'Add a period at the end of the statement: DISPLAY HEADING-1 PAGE-TITLE.',
    seeAlso:     [],
  },

  // ── Warnings ─────────────────────────────────────────

  'RCL-W01': {
    code:        'RCL-W01',
    severity:    'warning',
    category:    'group-shape',
    message:     'Group is empty',
    description: 'A group referenced by a USING clause is declared but has no child items. The element will render an empty container with no visible content.',
    example:     '01 FEATURES.   ← no children\nDISPLAY CARD-LIST USING FEATURES.',
    fix:         'Add child fields (level 05 or 10) to the group, or remove the DISPLAY statement if the group is intentionally empty.',
    seeAlso:     ['RCL-007'],
  },

  'RCL-W02': {
    code:        'RCL-W02',
    severity:    'warning',
    category:    'value-constraint',
    message:     'Value near declared length limit',
    description: 'A VALUE string is using more than 90% of its declared PIC X(n) length. The file compiles, but the declaration may need widening if the value grows.',
    example:     '01 HERO-SUB PIC X(60) VALUE "A platform built for the modern intelligence cycle.".   ← 52/60 chars',
    fix:         'Widen the declaration for headroom: PIC X(80). Or leave as-is if the value is stable.',
    seeAlso:     ['RCL-002'],
  },

  'RCL-W03': {
    code:        'RCL-W03',
    severity:    'warning',
    category:    'missing-required',
    message:     'Missing optional identification field',
    description: 'AUTHOR or DATE-WRITTEN is absent from the IDENTIFICATION DIVISION. These fields are optional but recommended — they are part of the RECALL provenance model and travel with the generated HTML.',
    example:     'IDENTIFICATION DIVISION.\n   PROGRAM-ID. MY-SITE.\n* AUTHOR and DATE-WRITTEN not set',
    fix:         'Add AUTHOR and DATE-WRITTEN to the IDENTIFICATION DIVISION.',
    seeAlso:     ['RCL-006'],
  },

  'RCL-W04': {
    code:        'RCL-W04',
    severity:    'warning',
    category:    'structural',
    message:     'Unreachable procedure section',
    description: 'A section is defined in the PROCEDURE DIVISION but contains no DISPLAY statements. It produces no output and may be an unfinished placeholder.',
    example:     'RENDER-EMPTY.\n   * Nothing here',
    fix:         'Add DISPLAY statements to the section, or remove it if not needed.',
    seeAlso:     [],
  },

  'RCL-W06': {
    code:        'RCL-W06',
    severity:    'warning',
    category:    'data',
    message:     'Field has no VALUE clause',
    description: 'A field is referenced in PROCEDURE DIVISION but was declared without a VALUE clause. The field renders empty. For AI compositor clarity, every referenced field should have an explicit VALUE.',
    example:     '01 PAGE-SUBTITLE PIC X.\nDISPLAY PARAGRAPH PAGE-SUBTITLE.   ← no VALUE declared',
    fix:         'Add VALUE "..." to the field declaration, or VALUE "" to explicitly declare an intentional empty.',
    seeAlso:     ['RCL-006'],
  },

  'RCL-W05': {
    code:        'RCL-W05',
    severity:    'warning',
    category:    'type-mismatch',
    message:     'Implicit string coercion',
    description: 'A numeric value (PIC 9) is used in a context that expects a string. The compiler coerces it, but the intent may have been to format the number differently.',
    example:     '01 REVENUE PIC 9(8) VALUE "4800000".\nDISPLAY PARAGRAPH REVENUE.   ← numeric coerced to string',
    fix:         'Declare the field as PIC X if it is intended for display as text, or use LABEL which explicitly accepts numeric values.',
    seeAlso:     ['RCL-001'],
  },
}

export function getCode(code: string): CodeDefinition {
  const def = CODES[code]
  if (!def) throw new Error(`Unknown diagnostic code: ${code}`)
  return def
}
