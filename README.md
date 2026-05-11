# RNA Layout Tool

Publication-focused RNA figure editor for drawing clean RNA secondary-structure maps from explicit sequences, fixed templates, and manual annotations.

This is a structure plotting tool, not a structure prediction tool. The intended workflow is:

```text
reference sequence + fixed structure template + annotation table -> publication-style RNA figure
```

## Current Capabilities

- Draws tRNA cloverleaf figures using stable Sprinzl-style template slots.
- Draws 5S rRNA with a fixed literature-style secondary-structure template.
- Displays nucleotides as editable SVG text for publication output.
- Draws base-pairing lines from template-defined pairs or user-provided dot-bracket input.
- Recognizes lab modification codes and symbols from `symblol_notebook/symbol_mapping.csv`.
- Supports manual display position labels, including ambiguous tRNA positions such as `17A`, `20A`, and `20B`.
- Supports separate annotation layers for modifications, bisulfite candidates, terminal chemistry, isoforms, truncations, and extensions.
- Exports SVG, PNG, and figure JSON.

## Layout Presets

- `tRNA Cloverleaf`
- `rRNA 5S Secondary Structure`
- `mRNA Linear Strand`
- `miRNA Hairpin`
- `Free canvas`

The old artificial `rRNA Compact Fold` behavior has been replaced. rRNA rendering now uses a fixed 5S rRNA coordinate template and does not generate spiral, circular, force-directed, or random folds.

## tRNA Notes

tRNA layout uses a Sprinzl-style scaffold, but some positions need human judgment. In particular, positions such as `17`, `17A`, `20`, `20A`, and `20B` should be manually confirmed.

Use the `Position Editor` panel:

- `Display position label`: the label shown on the figure.
- `Reference slot`: the template slot used as a coordinate reference.

This lets the user decide whether a nucleotide should be labeled `17A`, `20B`, left blank, or given another lab-specific label.

## 5S rRNA Notes

The 5S rRNA preset is template-based:

```text
position | base | x | y | paired_with | region | optional label
```

The first implementation targets 120 nt 5S rRNA. If the input sequence length is not 120, the app shows a warning and keeps the fixed template visible instead of drawing a broken partial structure.

## Modification Input

The sequence parser recognizes both standard bases and modification tokens. Examples:

```text
Gm
m1A
m7G
ms2i6A
D
psi
K   -> m1G
B   -> Cm
J   -> Um
P   -> psi
T   -> m5U
*   -> ms2i6A
```

Numbers in modification symbols are rendered as superscripts on the canvas, for example `i6A` and `m7G`.

## Display Themes

Only two themes are kept intentionally:

- `Publication`: plain text, clean pairing lines, manuscript-friendly output.
- `Light`: interactive editing view with visible nucleotide handles.

Older project JSON files using removed themes are normalized to `Publication` on import.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm run start
```

## Tests

```bash
npm run test:structure
```

The structure test covers tRNA template mapping, modification parsing, dot-bracket pairing, and the fixed 5S rRNA template.

## Export Figures

- Use `Export SVG` for Illustrator, PowerPoint, manuscript editing, and publication workflows.
- Use `Export PNG` for quick sharing.
- Use `Export JSON` to save sequence, slot mapping, pair edges, modifications, and annotations.

## Deploy To Vercel

Vercel can deploy this repository directly from GitHub.

1. Import the repository in Vercel.
2. Keep the default Next.js settings.
3. Vercel will run `npm run build` automatically.

The included `vercel.json` pins the framework to Next.js.

## Project Structure

```text
src/app/          Next.js app entry and global styles
src/components/   Toolbar, inspector, and SVG canvas
src/lib/          RNA data model, templates, parsers, layout, export helpers
scripts/          Layout and renderer regression tests
symblol_notebook/ Lab modification mapping CSV files
```

## Repository

[https://github.com/Chencharl/rna-layout-tool](https://github.com/Chencharl/rna-layout-tool)
