import {
  filterCurrentAnnotations,
} from "./biology";
import { getRenderableBase } from "./annotations";
import { buildRrna5SLayout, RRNA_5S_TEMPLATE_ROWS } from "./rrna5s";
import { buildRrna5_8sLayout, RRNA_5_8S_CANONICAL_LENGTH } from "./rrna5_8s";
import { buildSprinzlTRnaLayout } from "./sprinzl";
import type { RnaNucleotide, RnaProject, RnaStem, RnaTemplate } from "./types";

type TrnaPoint = { pos: number; x: number; y: number };

// Canonical tRNA layout rules used by the default scaffold:
// 1. The acceptor, D, anticodon, and T stems are drawn as parallel "ladders".
// 2. The D-loop, anticodon loop, T-loop, and variable loop are laid out as ordered rings.
// 3. Sequence order always follows one continuous 5' -> 3' backbone around those rings.
const TRNA_LADDER_GAP = 80;
const TRNA_STEP = 40;
const TRNA_CANVAS_CENTER = { x: 640, y: 490 };

function arcPoints(
  positions: number[],
  center: { x: number; y: number },
  radius: { x: number; y: number },
  startDegrees: number,
  endDegrees: number,
) {
  return positions.map((pos, index) => {
    const fraction = positions.length === 1 ? 0 : index / (positions.length - 1);
    const degrees = startDegrees + (endDegrees - startDegrees) * fraction;
    const radians = (degrees * Math.PI) / 180;

    return {
      pos,
      x: Math.round(center.x + Math.cos(radians) * radius.x),
      y: Math.round(center.y + Math.sin(radians) * radius.y),
    };
  });
}

function horizontalStem(
  leftPositions: number[],
  rightPositions: number[],
  x: number,
  y: number,
  step = TRNA_STEP,
) {
  return [
    ...leftPositions.map((pos, index) => ({
      pos,
      x,
      y: y + index * step,
    })),
    ...rightPositions.map((pos, index) => ({
      pos,
      x: x + TRNA_LADDER_GAP,
      y: y + index * step,
    })),
  ];
}

function verticalStem(
  topPositions: number[],
  bottomPositions: number[],
  x: number,
  y: number,
  step = TRNA_STEP + 4,
  gapDirection: 1 | -1 = 1,
) {
  return [
    ...topPositions.map((pos, index) => ({
      pos,
      x: x + index * step,
      y,
    })),
    ...bottomPositions.map((pos, index) => ({
      pos,
      x: x + index * step,
      y: y + TRNA_LADDER_GAP * gapDirection,
    })),
  ];
}

function centerTrnaPoint<TPoint extends TrnaPoint>(point: TPoint, bounds: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}): TPoint {
  const offsetX = TRNA_CANVAS_CENTER.x - (bounds.minX + bounds.maxX) / 2;
  const offsetY = TRNA_CANVAS_CENTER.y - (bounds.minY + bounds.maxY) / 2;

  return {
    ...point,
    x: Math.round(point.x + offsetX),
    y: Math.round(point.y + offsetY),
  };
}

function centerTrnaPoints(points: TrnaPoint[]): TrnaPoint[] {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };

  return points.map((point) => centerTrnaPoint(point, bounds));
}

function buildCanonicalTrnaCoords(): TrnaPoint[] {
  const acceptorStem = horizontalStem(
    [1, 2, 3, 4, 5, 6, 7],
    [72, 71, 70, 69, 68, 67, 66],
    600,
    100,
  );
  const dStem = verticalStem([13, 12, 11, 10], [22, 23, 24, 25], 365, 405, 40);
  const anticodonStem = horizontalStem([27, 28, 29, 30, 31], [43, 42, 41, 40, 39], 580, 560);
  const tStem = verticalStem([65, 64, 63, 62, 61], [49, 50, 51, 52, 53], 760, 370, 40);

  return centerTrnaPoints([
    ...acceptorStem,
    { pos: 8, x: 555, y: 360 },
    { pos: 9, x: 520, y: 385 },
    ...dStem,
    ...arcPoints([14, 15, 16, 17, 18, 19, 20, 21], { x: 270, y: 445 }, { x: 95, y: 80 }, -60, -300),
    { pos: 26, x: 535, y: 505 },
    ...anticodonStem,
    ...arcPoints([32, 33, 34, 35, 36, 37, 38], { x: 620, y: 730 }, { x: 80, y: 82 }, 160, 20),
    { pos: 44, x: 700, y: 535 },
    { pos: 45, x: 735, y: 510 },
    { pos: 46, x: 770, y: 530 },
    { pos: 47, x: 790, y: 570 },
    { pos: 48, x: 800, y: 500 },
    ...tStem,
    ...arcPoints([54, 55, 56, 57, 58, 59, 60], { x: 960, y: 410 }, { x: 90, y: 78 }, 100, -100),
    { pos: 73, x: 720, y: 80 },
    { pos: 74, x: 760, y: 62 },
    { pos: 75, x: 800, y: 54 },
    { pos: 76, x: 840, y: 54 },
  ]).sort((left, right) => left.pos - right.pos);
}

const TRNA_CANONICAL_COORDS = buildCanonicalTrnaCoords();

const TRNA_CANONICAL_STEMS: RnaStem[] = [];

const TRNA_76_TEMPLATE: RnaTemplate = {
  id: "trna_classic",
  name: "tRNA Cloverleaf",
  moleculeType: "tRNA",
  length: 76,
  numberingMode: "trna_standard",
  nucleotides: TRNA_CANONICAL_COORDS,
  stems: TRNA_CANONICAL_STEMS,
};

const LINEAR_GENERIC_TEMPLATE: RnaTemplate = {
  id: "linear_generic",
  name: "mRNA Linear Strand",
  moleculeType: "mRNA",
  numberingMode: "raw",
  nucleotides: [],
  stems: [],
};

const MIRNA_HAIRPIN_TEMPLATE: RnaTemplate = {
  id: "mirna_hairpin",
  name: "miRNA Hairpin",
  moleculeType: "custom",
  numberingMode: "raw",
  nucleotides: [],
  stems: [],
};

const RRNA_5S_TEMPLATE: RnaTemplate = {
  id: "rrna_5s_secondary_structure",
  name: "rRNA 5S Secondary Structure",
  moleculeType: "rRNA",
  length: 120,
  numberingMode: "raw",
  nucleotides: RRNA_5S_TEMPLATE_ROWS.map((row) => ({
    pos: row.position,
    base: row.base,
    x: row.x,
    y: row.y,
    positionLabel: row.label,
    region: row.region,
  })),
  stems: RRNA_5S_TEMPLATE_ROWS.flatMap((row) =>
    row.paired_with && row.position < row.paired_with
      ? [{ from: row.position, to: row.paired_with }]
      : [],
  ),
};

const RRNA_5_8S_TEMPLATE: RnaTemplate = {
  id: "rrna_5_8s_secondary_structure",
  name: "rRNA 5.8S Secondary Structure",
  moleculeType: "rRNA",
  length: RRNA_5_8S_CANONICAL_LENGTH,
  numberingMode: "raw",
  nucleotides: [],
  stems: [],
};

const FREE_CANVAS_TEMPLATE: RnaTemplate = {
  id: "free_canvas",
  name: "Free canvas",
  moleculeType: "custom",
  numberingMode: "raw",
  nucleotides: [],
  stems: [],
};

function buildTrnaTemplate(length: number): RnaTemplate {
  const sequence = Array.from({ length }, (_, index) => {
    if (index === length - 3) {
      return "C";
    }
    if (index === length - 2) {
      return "C";
    }
    if (index === length - 1) {
      return "A";
    }

    return "A";
  });
  const layout = buildSprinzlTRnaLayout(sequence);

  return {
    ...TRNA_76_TEMPLATE,
    length,
    nucleotides: layout.mappedPositions,
    stems: layout.stems,
  };
}

export const BUILTIN_TEMPLATES: RnaTemplate[] = [
  TRNA_76_TEMPLATE,
  LINEAR_GENERIC_TEMPLATE,
  MIRNA_HAIRPIN_TEMPLATE,
  RRNA_5S_TEMPLATE,
  RRNA_5_8S_TEMPLATE,
  FREE_CANVAS_TEMPLATE,
];

export function getTemplateById(
  templateId: string,
  templates: RnaTemplate[],
): RnaTemplate | undefined {
  const normalizedId =
    templateId === "trna_76_cloverleaf"
      ? "trna_classic"
      : templateId === "rrna_compact"
        ? "rrna_5s_secondary_structure"
        : templateId;

  return templates.find((template) => template.id === normalizedId);
}

export function materializeTemplate(
  template: RnaTemplate,
  length: number,
): RnaTemplate {
  if (template.id === "trna_classic") {
    return buildTrnaTemplate(length);
  }

  if (template.id === "rrna_5s_secondary_structure") {
    return RRNA_5S_TEMPLATE;
  }

  if (template.id === "free_canvas") {
    const perRow = 10;
    return {
      ...template,
      length,
      nucleotides: Array.from({ length }, (_, index) => ({
        pos: index + 1,
        x: 120 + (index % perRow) * 56,
        y: 120 + Math.floor(index / perRow) * 56,
      })),
      stems: [],
    };
  }

  if (template.id === "mirna_hairpin") {
    const leftCount = Math.max(4, Math.floor(length * 0.4));
    const loopCount = Math.max(4, Math.floor(length * 0.18));
    const rightCount = Math.max(4, length - leftCount - loopCount);

    const nucleotides = [];
    for (let i = 0; i < leftCount; i += 1) {
      nucleotides.push({
        pos: nucleotides.length + 1,
        x: 340,
        y: 140 + i * 30,
      });
    }
    for (let i = 0; i < loopCount; i += 1) {
      const angle = Math.PI - (Math.PI * i) / Math.max(1, loopCount - 1);
      nucleotides.push({
        pos: nucleotides.length + 1,
        x: 400 + Math.cos(angle) * 60,
        y: 140 + leftCount * 30 + Math.sin(angle) * 60,
      });
    }
    for (let i = 0; i < rightCount; i += 1) {
      nucleotides.push({
        pos: nucleotides.length + 1,
        x: 460,
        y: 140 + (rightCount - 1 - i) * 30,
      });
    }

    return {
      ...template,
      length,
      nucleotides,
      stems: Array.from({ length: Math.min(leftCount, rightCount) }, (_, index) => ({
        from: index + 1,
        to: length - index,
      })).filter((stem) => stem.from + 2 < stem.to),
    };
  }

  const rowSize = 38;
  const gap = 46;
  const perRow = 12;

  return {
    ...template,
    length,
    nucleotides: Array.from({ length }, (_, index) => {
      const row = Math.floor(index / perRow);
      const column = index % perRow;

      return {
        pos: index + 1,
        x: 100 + column * gap,
        y: 120 + row * rowSize,
      };
    }),
    stems: [],
  };
}

function getRenderableSprinzlNodes(
  nodes: RnaNucleotide[],
  showReferenceOverlay: boolean,
) {
  if (showReferenceOverlay) {
    return nodes;
  }

  return nodes.filter((node) => node.status !== "missing");
}

function filterStemsToRenderedNodes(stems: RnaStem[], nodes: RnaNucleotide[]) {
  const renderedPositions = new Set(nodes.map((node) => node.pos));

  return stems.filter(
    (stem) => renderedPositions.has(stem.from) && renderedPositions.has(stem.to),
  );
}

function filterCurrentAnnotationsForNodes(labels: RnaProject["labels"], nodes: RnaNucleotide[]) {
  const renderedPositions = new Set(nodes.map((node) => node.pos));
  const maxPosition = Math.max(0, ...renderedPositions);

  return filterCurrentAnnotations(labels, maxPosition).filter((label) =>
    renderedPositions.has(label.pos),
  );
}

function preservePositionLabels(
  nextNodes: RnaNucleotide[],
  previousNodes: RnaNucleotide[],
) {
  const hasManualPositionLabel = (node: RnaNucleotide) =>
    node.positionLabel !== undefined &&
    node.positionLabel !== (node.sprinzlLabel ?? String(node.pos));
  const previousBySequenceIndex = new Map(
    previousNodes
      .filter((node) => node.sequenceIndex !== undefined)
      .map((node) => [node.sequenceIndex as number, node]),
  );
  const previousByPos = new Map(previousNodes.map((node) => [node.pos, node]));

  return nextNodes.map((node) => {
    const previous =
      node.sequenceIndex !== undefined
        ? previousBySequenceIndex.get(node.sequenceIndex)
        : previousByPos.get(node.pos);

    if (!previous || !hasManualPositionLabel(previous)) {
      return node;
    }

    return {
      ...node,
      positionLabel: previous.positionLabel,
    };
  });
}

export function remapProjectToTemplate(
  project: RnaProject,
  template: RnaTemplate,
): RnaProject {
  if (template.id === "trna_classic") {
    const layout = buildSprinzlTRnaLayout(project.sequence, {
      runValidation: project.settings.runSprinzlValidation,
    });
    const renderedNodes = getRenderableSprinzlNodes(
      layout.mappedPositions,
      project.settings.showSprinzlOverlay,
    );
    const renderedStems = filterStemsToRenderedNodes(layout.stems, renderedNodes);
    const preservedLabels = filterCurrentAnnotationsForNodes(project.labels, renderedNodes);

    return {
      ...project,
      moleculeType: template.moleculeType,
      numberingMode: template.numberingMode ?? project.numberingMode,
      templateId: template.id,
      nucleotides: renderedNodes,
      stems: renderedStems,
      labels: preservedLabels,
      mappingWarnings: layout.warnings,
      renderMode: layout.renderMode,
      unassignedExtraBases: layout.unassignedExtraBases,
    };
  }

  if (template.id === "rrna_5s_secondary_structure") {
    const layout = buildRrna5SLayout(project.sequence);
    const preservedLabels = filterCurrentAnnotationsForNodes(project.labels, layout.nucleotides);

    return {
      ...project,
      moleculeType: "rRNA",
      numberingMode: template.numberingMode ?? project.numberingMode,
      templateId: template.id,
      nucleotides: layout.nucleotides,
      stems: layout.stems,
      labels: preservedLabels,
      mappingWarnings: layout.warnings,
      renderMode: "rrna_5s_template",
      unassignedExtraBases: [],
    };
  }

  if (template.id === "rrna_5_8s_secondary_structure") {
    const layout = buildRrna5_8sLayout(project.sequence);
    const preservedLabels = filterCurrentAnnotationsForNodes(project.labels, layout.nucleotides);

    return {
      ...project,
      moleculeType: "rRNA",
      numberingMode: template.numberingMode ?? project.numberingMode,
      templateId: template.id,
      nucleotides: layout.nucleotides,
      stems: layout.stems,
      labels: preservedLabels,
      mappingWarnings: layout.warnings,
      renderMode: "rrna_5_8s_template",
      unassignedExtraBases: [],
      settings: {
        ...project.settings,
        canvasHeight: Math.max(project.settings.canvasHeight, layout.recommendedCanvasHeight),
      },
    };
  }

  const resolvedTemplate = materializeTemplate(template, project.sequence.length);
  const preservedLabels = filterCurrentAnnotations(project.labels, project.sequence.length);

  return {
    ...project,
    moleculeType: template.moleculeType,
    numberingMode: template.numberingMode ?? project.numberingMode,
    templateId: template.id,
    nucleotides: resolvedTemplate.nucleotides.map((position, index) => {
      const previous = project.nucleotides[index];

      return {
        pos: position.pos,
        base: getRenderableBase(project.sequence[index] ?? ""),
        x: position.x,
        y: position.y,
        sequenceIndex: index + 1,
        originalToken: project.sequence[index],
        positionLabel: String(position.pos),
        status: "present" as const,
        visible: previous?.visible ?? true,
        fontSize: previous?.fontSize,
        color: previous?.color,
      };
    }),
    stems: resolvedTemplate.stems ?? [],
    labels: preservedLabels,
    mappingWarnings: [],
    renderMode: "standard",
    unassignedExtraBases: [],
  };
}

export function syncProjectToSequence(
  project: RnaProject,
  nextSequence: string[],
  template: RnaTemplate,
): RnaProject {
  if (template.id === "trna_classic") {
    const layout = buildSprinzlTRnaLayout(nextSequence, {
      runValidation: project.settings.runSprinzlValidation,
    });
    const renderedNodes = getRenderableSprinzlNodes(
      layout.mappedPositions,
      project.settings.showSprinzlOverlay,
    );
    const labeledNodes = preservePositionLabels(renderedNodes, project.nucleotides);
    const renderedStems = filterStemsToRenderedNodes(layout.stems, renderedNodes);
    const preservedLabels = filterCurrentAnnotationsForNodes(project.labels, labeledNodes);

    return {
      ...project,
      sequence: nextSequence,
      nucleotides: labeledNodes,
      stems: renderedStems,
      labels: preservedLabels,
      mappingWarnings: layout.warnings,
      renderMode: layout.renderMode,
      unassignedExtraBases: layout.unassignedExtraBases,
    };
  }

  if (template.id === "rrna_5s_secondary_structure") {
    const layout = buildRrna5SLayout(nextSequence);
    const labeledNodes = preservePositionLabels(layout.nucleotides, project.nucleotides);
    const preservedLabels = filterCurrentAnnotationsForNodes(project.labels, labeledNodes);

    return {
      ...project,
      sequence: nextSequence,
      nucleotides: labeledNodes,
      stems: layout.stems,
      labels: preservedLabels,
      mappingWarnings: layout.warnings,
      renderMode: "rrna_5s_template",
      unassignedExtraBases: [],
    };
  }

  if (template.id === "rrna_5_8s_secondary_structure") {
    const layout = buildRrna5_8sLayout(nextSequence);
    const labeledNodes = preservePositionLabels(layout.nucleotides, project.nucleotides);
    const preservedLabels = filterCurrentAnnotationsForNodes(project.labels, labeledNodes);

    return {
      ...project,
      sequence: nextSequence,
      nucleotides: labeledNodes,
      stems: layout.stems,
      labels: preservedLabels,
      mappingWarnings: layout.warnings,
      renderMode: "rrna_5_8s_template",
      unassignedExtraBases: [],
      settings: {
        ...project.settings,
        canvasHeight: Math.max(project.settings.canvasHeight, layout.recommendedCanvasHeight),
      },
    };
  }

  const resolvedTemplate = materializeTemplate(template, nextSequence.length);
  const lastKnown = project.nucleotides.at(-1);
  const preservedLabels = filterCurrentAnnotations(project.labels, nextSequence.length);
  const preserveCoordinates = project.sequence.length === nextSequence.length;

  return {
    ...project,
    sequence: nextSequence,
    nucleotides: nextSequence.map((base, index) => {
      const existing = preserveCoordinates ? project.nucleotides[index] : undefined;
      const fallback = resolvedTemplate.nucleotides[index] ?? {
        pos: index + 1,
        x: (lastKnown?.x ?? 120) + (index - project.nucleotides.length + 1) * 42,
        y: lastKnown?.y ?? 120,
      };

      return {
        pos: index + 1,
        base: getRenderableBase(base),
        x: existing?.x ?? fallback.x,
        y: existing?.y ?? fallback.y,
        sequenceIndex: index + 1,
        originalToken: base,
        positionLabel: existing?.positionLabel ?? String(index + 1),
        status: "present" as const,
        visible: existing?.visible ?? true,
        fontSize: existing?.fontSize,
        color: existing?.color,
      };
    }),
    stems: resolvedTemplate.stems ?? [],
    labels: preservedLabels,
    mappingWarnings: [],
    renderMode: "standard",
    unassignedExtraBases: [],
  };
}
