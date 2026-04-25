# RNA Layout Tool — Codex Implementation Spec

## Goal

Build a production-usable editor for RNA diagrams that lets the user:

- paste a reference sequence
- choose a layout template
- render the RNA automatically
- edit bases position-by-position
- add, remove, and style modification labels
- export clean SVG/PNG for slides
- reuse the same workflow later for tRNA, mRNA, rRNA

This is not a demo. It should be usable for real figure-making.

---

## Product scope

### Phase 1: must work well

1. **tRNA 76-nt cloverleaf editor**
2. **Position-aware editing table**
3. **Modification label layer**
4. **SVG export**
5. **JSON import/export for projects**
6. **Multiple saved templates**

### Phase 2: extensibility

1. linear RNA layout for mRNA
2. custom coordinate layout for rRNA or arbitrary small RNA
3. import coordinates from JSON
4. drag-to-adjust labels and nucleotide positions
5. slide-friendly themes

---

## Core requirements

### 1. Data model

Use a normalized project model:

```ts
export type RnaProject = {
  id: string;
  title: string;
  moleculeType: "tRNA" | "mRNA" | "rRNA" | "custom";
  sequence: string[];
  numberingMode: "raw" | "trna_standard";
  templateId: string;
  nucleotides: Array<{
    pos: number;
    base: string;
    x: number;
    y: number;
    visible?: boolean;
    fontSize?: number;
    color?: string;
  }>;
  stems: Array<{
    from: number;
    to: number;
    style?: "line" | "dashed";
  }>;
  labels: Array<{
    id: string;
    pos: number;
    text: string;
    color: string;
    dx: number;
    dy: number;
    fontSize?: number;
    fontWeight?: number | string;
  }>;
  annotations: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    color?: string;
  }>;
  settings: {
    showPositionNumbers: boolean;
    showStemLines: boolean;
    canvasWidth: number;
    canvasHeight: number;
    nucleotideFontSize: number;
    numberFontSize: number;
    theme: "light" | "publication" | "slides";
  };
};
```

Rules:

- sequence is the source of truth
- nucleotide positions are explicit objects, not inferred at render time
- labels are independent objects, not hard-coded from sequence text
- templates populate nucleotide coordinates and stem pairs

---

### 2. Templates

Implement a template registry.

```ts
export type RnaTemplate = {
  id: string;
  name: string;
  moleculeType: "tRNA" | "mRNA" | "rRNA" | "custom";
  length?: number;
  numberingMode?: "raw" | "trna_standard";
  nucleotides: Array<{ pos: number; x: number; y: number }>;
  stems?: Array<{ from: number; to: number; style?: "line" | "dashed" }>;
};
```

Must ship with:

1. `trna_76_cloverleaf`
2. `linear_generic`

Behavior:

- if the chosen template length does not match sequence length, show a blocking validation error
- allow future custom template import from JSON

---

### 3. UI requirements

#### Left panel

- title input
- template selector
- molecule type selector
- sequence textarea
- validation status
- project import/export buttons
- export SVG button
- export PNG button
- toggle controls:
  - show position numbers
  - show stems
  - theme
  - font size sliders

#### Middle/right main canvas

- SVG render area
- zoom controls
- fit-to-view button
- optional drag mode for label repositioning

#### Bottom or side table

Editable grid with columns:

- position
- base
- x
- y
- label text
- label color
- label dx
- label dy

This table must allow fast edits without manually touching code.

---

### 4. Validation rules

Implement explicit validation with readable messages.

Must validate:

- sequence length matches template length
- all nucleotide positions are unique
- all label positions refer to existing nucleotides
- template JSON schema is valid
- project JSON schema is valid
- bases may be canonical or custom tokens, but tokens must be one rendered unit per position

Important:

- support custom symbols like `D`, `*`, `X`, `mG`, `s4U`
- do not force single-character biology assumptions at the data level
- rendering may abbreviate visually, but the underlying token can be multi-character

---

### 5. Rendering rules

Use SVG.

Each nucleotide position renders:

- nucleotide text at `(x, y)`
- optional position number near it
- optional modification label offset by `(dx, dy)`

Each stem renders as a line between paired nucleotide coordinates.

Rendering must support:

- multi-character nucleotide tokens
- per-position font size override
- per-position color override
- label overlap tolerance better than current prototype

Do not hard-code modification labels into the render layer.

---

### 6. Export behavior

#### SVG export

- clean standalone SVG
- embedded dimensions
- no runtime-specific markup
- title-safe filename

#### PNG export

- render SVG to canvas and export PNG
- transparent background optional

#### Project export

- export full project JSON

#### Project import

- import project JSON and restore exact state

---

## Technical requirements

### Stack

- React
- TypeScript
- SVG rendering
- no dependency on `window.React`
- no direct global DOM querying for main editor state
- use refs where needed

### State management

Use structured React state. Recommended:

- `useReducer` for project editing actions
- memoized selectors for derived rows / validation

### Suggested file structure

```text
src/
  app/
    page.tsx
  components/
    RNAEditor.tsx
    RNACanvas.tsx
    RNAToolbar.tsx
    RNATable.tsx
    ValidationPanel.tsx
  lib/
    templates.ts
    types.ts
    validation.ts
    exportSvg.ts
    exportPng.ts
    projectIO.ts
    numbering.ts
    geometry.ts
```

---

## Implementation corrections versus current prototype

The current prototype is not sufficient. The new implementation must fix these design problems:

1. **No dependence on **``
2. **Static coordinates and stems moved outside component body**
3. **Use project object state, not freeform sequence string as the only editable state**
4. **Support multi-character tokens cleanly**
5. **Use refs instead of **``
6. **Do not rebuild rendering assumptions from raw text every time**
7. **Separate template data, project data, labels, and render logic**
8. **Add import/export so the tool is actually reusable**
9. **Provide validation errors in UI**
10. **Allow label offset editing, otherwise publication figure cleanup is still manual**

---

## Minimum accepted deliverable

Codex should deliver a working React app with:

- one complete 76-nt tRNA template
- one linear RNA template
- editable sequence table
- editable modification labels
- SVG export
- JSON project save/load
- clear validation
- usable layout without manual code edits

If any of the following are missing, the deliverable is incomplete:

- cannot import/export a project
- cannot edit labels per position
- cannot render a full 76-nt tRNA from a reference sequence
- cannot export a clean figure
- crashes on multi-character tokens

---

## Example default project

Use this as the default loaded example:

- title: `Phe tRNA working layout`
- template: `trna_76_cloverleaf`
- sequence: `GCCCGGAUAGCUCAGDCGGDAGAGCAGGGGAUUGAA*AUCCCCGUgXCCUUGGuUCGAUUCCGAGUCCGGGCACCA`
- labels:
  - pos 8 → `s4U`
  - pos 16 → `D`
  - pos 20 → `D`
  - pos 37 → `ms2i6A` or `*`
  - pos 47 → `X`
  - pos 54 → `mU`

---

## Nice-to-have after core build works

- drag labels directly on canvas
- snap-to-grid for labels
- auto layout presets for common tRNA families
- publication theme matching journal figure style
- duplicate project button
- per-base color coding by confidence or modification type

---

## Final instruction for implementation

Build this as a usable editor, not a mockup. The user should be able to open it, paste a reference sequence, edit bases and modification labels, switch templates later, and export a figure without touching source code.

