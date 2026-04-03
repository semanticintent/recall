import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from '../../src/compiler/index.js'

const TMP = '/tmp/recall-copy-test'

const COMPONENT = `
IDENTIFICATION DIVISION.
   PROGRAM-ID. MY-FOOTER.

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 FOOTER-COPY-TEXT PIC X(40) VALUE "Built with RECALL".

PROCEDURE DIVISION.
   COMPONENT.
      DISPLAY FOOTER
         WITH TEXT FOOTER-COPY-TEXT
         WITH ALIGN CENTER.
      STOP SECTION.
`

const COMPONENT_NAV = `
IDENTIFICATION DIVISION.
   PROGRAM-ID. MY-NAV.

DATA DIVISION.
   ITEMS SECTION.
      01 NAV-COPY-ITEMS.
         05 NAV-ITEM-1      PIC X(20) VALUE "HOME".
         05 NAV-ITEM-1-HREF PIC X(80) VALUE "/".

PROCEDURE DIVISION.
   COMPONENT.
      DISPLAY NAVIGATION USING NAV-COPY-ITEMS
         WITH STICKY YES
         WITH LOGO "TEST".
      STOP SECTION.
`

const SOURCE_WITH_COPY = `
IDENTIFICATION DIVISION.
   PROGRAM-ID.  COPY-TEST.
   PAGE-TITLE.  "Copy Test".

ENVIRONMENT DIVISION.
   CONFIGURATION SECTION.
      VIEWPORT   RESPONSIVE.
      COLOR-MODE DARK.
      LANGUAGE   EN.
   PALETTE SECTION.

DATA DIVISION.
   WORKING-STORAGE SECTION.
      01 HEADING PIC X(20) VALUE "Hello RECALL".
   ITEMS SECTION.

PROCEDURE DIVISION.

   RENDER-NAV.
      COPY FROM "components/nav.rcl".

   RENDER-MAIN.
      DISPLAY HEADING-1 HEADING.
   STOP SECTION.

   RENDER-FOOTER.
      COPY FROM "components/footer.rcl".

   STOP RUN.
`

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(join(TMP, 'components'), { recursive: true })
}

describe('COPY statement', () => {
  it('inlines component procedure into parent', () => {
    setup()
    writeFileSync(join(TMP, 'components', 'footer.rcl'), COMPONENT)
    writeFileSync(join(TMP, 'components', 'nav.rcl'), COMPONENT_NAV)
    writeFileSync(join(TMP, 'main.rcl'), SOURCE_WITH_COPY)
    const result = compile(join(TMP, 'main.rcl'))
    expect(result.ok).toBe(true)
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    expect(html).toContain('<footer')
    expect(html).toContain('Built with RECALL')
  })

  it('merges component data into parent data', () => {
    setup()
    writeFileSync(join(TMP, 'components', 'footer.rcl'), COMPONENT)
    writeFileSync(join(TMP, 'components', 'nav.rcl'), COMPONENT_NAV)
    writeFileSync(join(TMP, 'main.rcl'), SOURCE_WITH_COPY)
    compile(join(TMP, 'main.rcl'))
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    // FOOTER-COPY-TEXT from component data should be resolved
    expect(html).toContain('Built with RECALL')
    // NAV-COPY-ITEMS from component data should be resolved
    expect(html).toContain('<nav')
    expect(html).toContain('HOME')
  })

  it('component data does not pollute component source comment', () => {
    setup()
    writeFileSync(join(TMP, 'components', 'footer.rcl'), COMPONENT)
    writeFileSync(join(TMP, 'components', 'nav.rcl'), COMPONENT_NAV)
    writeFileSync(join(TMP, 'main.rcl'), SOURCE_WITH_COPY)
    compile(join(TMP, 'main.rcl'))
    const html = readFileSync(join(TMP, 'main.html'), 'utf-8')
    // Embedded source is the main file, not the component
    expect(html).toContain('COPY-TEST')
    expect(html).toContain('COPY FROM')
  })
})
