# RNA Layout Tool

Publication-focused RNA figure editor for building clean SVG/PNG RNA maps from explicit sequences.

The current v1 workflow is centered on tRNA cloverleaf figures: paste a sequence, rebuild the scaffold, adjust bases and labels directly on the canvas, edit pair bonds, and export a paper-ready figure.

## What It Does

- Draws tRNA layouts from explicit RNA sequences.
- Uses Sprinzl-style slots for stable tRNA positioning.
- Supports modified-base tokens such as `Gm`, `m1A`, `s4U`, `D`, `Ψ`, and `X`.
- Lets you drag bases and labels on the canvas.
- Lets you add or remove visible pair bonds.
- Exports clean SVG, PNG, and figure JSON.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

This app uses Next.js.

```bash
npm run build
npm run start
```

The production build is generated in `.next/`.

## Deploy To Vercel

Vercel can deploy this repository directly from GitHub.

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Keep the default Next.js settings.
4. Vercel will run `npm run build` automatically.

The included `vercel.json` pins the framework to Next.js and uses `.next` as the build output directory.

## Export Figures

- Use `Export SVG` for publication, Illustrator, PowerPoint, or manuscript workflows.
- Use `Export PNG` for quick sharing.
- Use `Export JSON` to save the sequence, slot mapping, pair edges, and modifications.

SVG export is intended to be clean: no debug axes, no hidden nodes, and no temporary layout artifacts.

## Project Structure

```text
src/app/          Next.js app entry and global styles
src/components/   Editor UI, toolbar, inspector, and SVG canvas
src/lib/          RNA model, Sprinzl slot mapping, layout, parsing, and export helpers
scripts/          Structural regression tests
```

## Scripts

```bash
npm run dev             # start local development server
npm run build           # create production Next.js build
npm run start           # serve production build locally
npm run test:structure  # run renderer/layout regression tests
```
