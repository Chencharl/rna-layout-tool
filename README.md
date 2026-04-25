# RNA Layout Tool

SVG-based RNA figure editor for building publication-ready RNA maps from explicit sequences.

This v1 focuses on a manually editable tRNA cloverleaf workflow: paste a theoretical sequence, start from a scaffold, adjust nucleotide positions directly on the canvas, add modification/adduct labels, optionally apply Vienna dot-bracket stem pairings, and export clean SVG/PNG.

## Current V1 Features

- tRNA cloverleaf scaffold with editable nucleotide coordinates.
- Explicit sequence input with support for custom tokens such as `D`, `*`, `X`, `mG`, and `s4U`.
- Optional Vienna secondary-structure input for replacing visible stem pairings.
- Direct canvas manipulation for moving bases, moving labels, and adding points.
- Position editor for base, coordinate, modification, adduct, and note edits.
- Canvas label deletion for quick cleanup.
- Dynamic ladder alignment for selected stem regions.
- SVG, PNG, and project JSON export.
- Project JSON import for restoring exact figure states.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm run start
```

## Recommended Workflow

1. Paste the explicit theoretical RNA sequence.
2. Choose the closest layout scaffold.
3. Rebuild the scaffold if the sequence length changes.
4. Use the canvas to manually polish nucleotide positions and labels.
5. Use `Align Selected Ladder` when a stem/laddder needs to be re-parallelized.
6. Add modification, adduct, and note labels from the position editor.
7. Export SVG for publication/slide editing or PNG for quick sharing.

## V1 Scope Notes

- The sequence is treated as the source of truth, but nucleotide coordinates are explicit project data so manual edits can be preserved.
- Position numbers are hidden by default because some tRNA structural positions are optional or family-specific.
- For length changes, the scaffold is regenerated from the current template instead of stretching old coordinates.
- Vienna dot-bracket input controls visible base-pairing stems; it does not override manually edited coordinates.

## Roadmap

- Independent colors for D loop, T loop, anticodon loop, variable loop, and stems.
- Freeform-like infinite canvas panning and continuous zoom.
- More stable loop-aware deformation when dragging a single point.
- Better family-specific tRNA templates, including variable-loop-specific layouts.
- R2DT/RNAcanvas-inspired import and editing flows.
- mRNA, rRNA, miRNA, and other RNA layout presets.

## Project Structure

```text
src/app/               Next.js app entry and global styles
src/components/        RNA editor UI, canvas, toolbar, inspector, table
src/lib/               RNA data model, templates, validation, import/export, sequence parsing
```

