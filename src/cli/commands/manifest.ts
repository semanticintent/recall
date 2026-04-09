import { Command } from 'commander'
import {
  getManifest,
  formatManifest,
  formatManifestLayer,
} from '../../manifest/index.js'
import type { ManifestLayers } from '../../manifest/index.js'

export const manifestCommand = new Command('manifest')
  .description('Print the RECALL Pipeline Manifest — unified AI entry point for the full pipeline')
  .option('--json', 'Output as machine-readable JSON')
  .option('--layer <name>', 'Print a single layer: language | components | crd | compositor')
  .option('--plugin <package>', 'Plugin package to resolve component list from')
  .addHelpText('after', `
  Assembles all four pipeline schema layers into one document:
    language    Language Schema — all valid RECALL elements and PIC types
    components  Component Manifest — plugin components and their field shapes
    crd         Common Record Description — brief ↔ DATA DIVISION field agreement
    compositor  Compositor Contract — WITH INTENT expansion protocol

  Examples:
    recall manifest
    recall manifest --json
    recall manifest --layer crd
    recall manifest --layer language --json
    recall manifest --json --plugin @stratiqx/recall-components`)
  .action((opts: { json?: boolean; layer?: string; plugin?: string }) => {
    const manifest = getManifest({ plugin: opts.plugin })

    if (opts.layer) {
      const validLayers: (keyof ManifestLayers)[] = ['language', 'components', 'crd', 'compositor']
      if (!validLayers.includes(opts.layer as keyof ManifestLayers)) {
        process.stderr.write(
          `  Error: unknown layer "${opts.layer}". Valid: ${validLayers.join(', ')}\n`
        )
        process.exit(1)
      }
      const layer = manifest.layers[opts.layer as keyof ManifestLayers]
      if (opts.json) {
        process.stdout.write(JSON.stringify(layer, null, 2) + '\n')
      } else {
        process.stdout.write(formatManifestLayer(opts.layer, layer))
      }
      return
    }

    if (opts.json) {
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n')
    } else {
      process.stdout.write(formatManifest(manifest))
    }
  })
