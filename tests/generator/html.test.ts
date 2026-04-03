import { describe, it, expect } from 'vitest'
import { parse } from '../../src/parser/rcl.js'
import { generate } from '../../src/generator/html.js'

const SOURCE = `
IDENTIFICATION DIVISION.
   PROGRAM-ID.    GEN-TEST.
   PAGE-TITLE.    "Generator Test".
   DESCRIPTION.   "Testing HTML output".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT    RESPONSIVE.
      COLOR-MODE  DARK.
      LANGUAGE    EN.
   PALETTE SECTION.
      01 COLOR-ACCENT PIC X(7) VALUE "#7C3AED".
      01 COLOR-BG     PIC X(7) VALUE "#0C0E1A".

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 TITLE-TEXT  PIC X(40) VALUE "Built Different".
      01 BODY-TEXT   PIC X(80) VALUE "The source is the artifact.".
   ITEMS SECTION.

PROCEDURE DIVISION.

   RENDER-MAIN.
      DISPLAY SECTION ID "main"
         WITH LAYOUT CENTERED
         WITH PADDING LARGE.
         DISPLAY HEADING-1 TITLE-TEXT.
         DISPLAY PARAGRAPH BODY-TEXT.
         DISPLAY BUTTON "GET STARTED"
            ON-CLICK GOTO "#start"
            WITH STYLE PRIMARY.
      STOP SECTION.

   RENDER-FOOTER.
      DISPLAY FOOTER
         WITH TEXT "RECALL 0.1"
         WITH ALIGN CENTER.
      STOP SECTION.

   STOP RUN.
`

describe('HTML Generator', () => {
  it('produces valid HTML document', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('</html>')
  })

  it('embeds page title', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('<title>Generator Test</title>')
  })

  it('embeds description meta tag', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('name="description"')
    expect(html).toContain('Testing HTML output')
  })

  it('embeds .rcl source in comment block', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('RECALL COMPILED OUTPUT')
    expect(html).toContain('IDENTIFICATION DIVISION')
  })

  it('inlines CSS — no external stylesheets', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).not.toContain('<link rel="stylesheet"')
    expect(html).toContain('<style>')
  })

  it('generates palette CSS variables', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('--accent: #7C3AED')
    expect(html).toContain('--bg: #0C0E1A')
  })

  it('renders HEADING-1 with variable resolution', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('<h1')
    expect(html).toContain('Built Different')
  })

  it('renders PARAGRAPH with variable resolution', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('<p')
    expect(html).toContain('The source is the artifact.')
  })

  it('renders BUTTON as anchor tag', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('GET STARTED')
    expect(html).toContain('href="#start"')
    expect(html).toContain('recall-btn')
  })

  it('renders FOOTER', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('<footer')
    expect(html).toContain('RECALL 0.1')
  })

  it('sets body id from PROGRAM-ID', () => {
    const program = parse(SOURCE)
    const html = generate(program, SOURCE)
    expect(html).toContain('id="gen-test"')
  })
})
