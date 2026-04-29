import { getCatalogItem, getDisplayBaseForToken } from "./biology";
import type {
  RnaDomain,
  RnaCcaStatus,
  RnaDomainType,
  RnaDomainScore,
  RnaNodeStatus,
  RnaPairStatus,
  RnaRegion,
  RnaStem,
} from "./types";

export type DotBracketPair = {
  i: number;
  j: number;
};

export type DotBracketRun = {
  start: number;
  end: number;
  length: number;
};

export type DotBracketStem = {
  fivePrimeStart: number;
  fivePrimeEnd: number;
  threePrimeStart: number;
  threePrimeEnd: number;
  length: number;
};

export type DotBracketLoop = DotBracketRun & {
  betweenStems: number[];
};

export type ParsedDotBracket = {
  pairs: DotBracketPair[];
  unpairedRuns: DotBracketRun[];
  stems: DotBracketStem[];
  loops: DotBracketLoop[];
  pairMap: Map<number, number>;
  compact: string;
  error: string | null;
};

export type StructureNode = {
  pos: number;
  sequenceIndex: number;
  base: string;
  originalToken: string;
  dotBracketChar: string;
  pairedIndex?: number;
  structuralDomain: RnaDomainType;
  region: RnaRegion;
  sprinzlLabel?: string;
  positionLabel: string;
  status: RnaNodeStatus;
  pairStatus?: RnaPairStatus;
  x: number;
  y: number;
  visible: true;
};

export type StructureLayoutResult = {
  inputSequence: string[];
  dotBracket: string;
  renderMode: "structure_constrained_mode" | "atypical_mode";
  nodes: StructureNode[];
  domains: RnaDomain[];
  backboneEdges: Array<{ sourceIndex: number; targetIndex: number }>;
  pairEdges: Array<{ sourceIndex: number; targetIndex: number; pairStatus: RnaPairStatus }>;
  stems: RnaStem[];
  anticodon: { sequence: string; confidence: "high" | "medium" | "low" | "unknown" };
  ccaStatus: RnaCcaStatus;
  warnings: string[];
};

type LayoutStem = DotBracketStem & {
  id: string;
  type: RnaDomainType;
  region: RnaRegion;
  center: Point;
  orientation: "vertical" | "horizontal";
  loopSide: "top" | "bottom" | "left" | "right";
  anchorPosition: NonNullable<RnaDomain["anchorPosition"]>;
  score: RnaDomainScore;
  tentative: boolean;
};

type Point = { x: number; y: number };

const CANVAS_CENTER: Point = { x: 640, y: 490 };
const CANVAS_BOUNDS = {
  minX: 90,
  maxX: 1190,
  minY: 90,
  maxY: 890,
};
const STEM_STEP = 36;
const STEM_GAP = 78;

function addUnpairedRun(runs: DotBracketRun[], start: number, end: number) {
  if (start > end) {
    return;
  }

  runs.push({
    start,
    end,
    length: end - start + 1,
  });
}

export function parseDotBracketStructure(dotBracket: string, sequenceLength: number): ParsedDotBracket {
  const compact = dotBracket.replace(/\s+/g, "");
  const stack: number[] = [];
  const pairs: DotBracketPair[] = [];
  const pairMap = new Map<number, number>();
  const unpairedRuns: DotBracketRun[] = [];

  if (compact.length !== sequenceLength) {
    return {
      pairs: [],
      unpairedRuns: [],
      stems: [],
      loops: [],
      pairMap,
      compact,
      error: `Dot-bracket length is ${compact.length}, but the sequence has ${sequenceLength} positions.`,
    };
  }

  let runStart: number | null = null;
  for (let index = 0; index < compact.length; index += 1) {
    const char = compact[index];
    const sequenceIndex = index + 1;

    if (char === ".") {
      runStart ??= sequenceIndex;
      continue;
    }

    if (runStart !== null) {
      addUnpairedRun(unpairedRuns, runStart, sequenceIndex - 1);
      runStart = null;
    }

    if (char === "(") {
      stack.push(sequenceIndex);
      continue;
    }

    if (char === ")") {
      const paired = stack.pop();
      if (!paired) {
        return {
          pairs: [],
          unpairedRuns: [],
          stems: [],
          loops: [],
          pairMap,
          compact,
          error: `Unmatched ")" at position ${sequenceIndex}.`,
        };
      }

      pairs.push({ i: paired, j: sequenceIndex });
      pairMap.set(paired, sequenceIndex);
      pairMap.set(sequenceIndex, paired);
      continue;
    }

    return {
      pairs: [],
      unpairedRuns: [],
      stems: [],
      loops: [],
      pairMap,
      compact,
      error: `Unsupported dot-bracket character "${char}" at position ${sequenceIndex}.`,
    };
  }

  if (runStart !== null) {
    addUnpairedRun(unpairedRuns, runStart, compact.length);
  }

  if (stack.length > 0) {
    return {
      pairs: [],
      unpairedRuns: [],
      stems: [],
      loops: [],
      pairMap,
      compact,
      error: `Unmatched "(" at position ${stack.at(-1)}.`,
    };
  }

  const orderedPairs = pairs.sort((left, right) => left.i - right.i || right.j - left.j);
  const stems = groupPairsIntoStems(orderedPairs);
  const loops = unpairedRuns.map((run) => ({
    ...run,
    betweenStems: stems
      .map((stem, index) => ({ stem, index }))
      .filter(({ stem }) => run.start > stem.fivePrimeEnd && run.end < stem.threePrimeStart)
      .map(({ index }) => index),
  }));

  return {
    pairs: orderedPairs,
    unpairedRuns,
    stems,
    loops,
    pairMap,
    compact,
    error: null,
  };
}

function groupPairsIntoStems(pairs: DotBracketPair[]): DotBracketStem[] {
  const stems: DotBracketStem[] = [];

  for (const pair of pairs) {
    const previous = stems.at(-1);
    if (
      previous &&
      pair.i === previous.fivePrimeEnd + 1 &&
      pair.j === previous.threePrimeStart - 1
    ) {
      previous.fivePrimeEnd = pair.i;
      previous.threePrimeStart = pair.j;
      previous.length += 1;
      continue;
    }

    stems.push({
      fivePrimeStart: pair.i,
      fivePrimeEnd: pair.i,
      threePrimeStart: pair.j,
      threePrimeEnd: pair.j,
      length: 1,
    });
  }

  return stems;
}

function getPairStatus(left: string, right: string): RnaPairStatus {
  const pair = `${left.toUpperCase()}-${right.toUpperCase()}`;

  if (["A-U", "U-A", "G-C", "C-G"].includes(pair)) {
    return "normal";
  }

  if (pair === "G-U" || pair === "U-G") {
    return "wobble";
  }

  return "mismatch";
}

function isUnknownToken(token: string) {
  const normalized = token.trim();

  return (
    normalized.length > 0 &&
    !/^[ACGUTN]$/i.test(normalized) &&
    !["D", "Y", "Q", "I", "X", "*"].includes(normalized) &&
    !getCatalogItem(normalized)
  );
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getLoopRange(stem: DotBracketStem) {
  return {
    start: stem.fivePrimeEnd + 1,
    end: stem.threePrimeStart - 1,
    length: Math.max(0, stem.threePrimeStart - stem.fivePrimeEnd - 1),
  };
}

function scoreStemLoop(stem: DotBracketStem, sequenceLength: number): RnaDomainScore {
  const loop = getLoopRange(stem);
  const loopSizeFitness = clamp01(1 - Math.abs(loop.length - 6) / 8);
  const loopCenter = loop.length > 0 ? (loop.start + loop.end) / 2 : (stem.fivePrimeEnd + stem.threePrimeStart) / 2;
  const centrality = clamp01(1 - Math.abs(loopCenter - sequenceLength / 2) / Math.max(1, sequenceLength / 2));
  const fiveSideLength = stem.fivePrimeEnd - stem.fivePrimeStart + 1;
  const threeSideLength = stem.threePrimeEnd - stem.threePrimeStart + 1;
  const symmetry = clamp01(
    1 - Math.abs(fiveSideLength - threeSideLength) / Math.max(1, fiveSideLength, threeSideLength),
  );
  const stemLength = stem.length;
  const normalizedStemLength = clamp01(stemLength / 7);

  return {
    stemLength,
    loopSizeFitness,
    centrality,
    symmetry,
    total:
      normalizedStemLength * 0.22 +
      loopSizeFitness * 0.36 +
      centrality * 0.32 +
      symmetry * 0.1,
  };
}

function getCcaStatus(sequence: string[]): RnaCcaStatus {
  const normalized = sequence.join("").toUpperCase().replaceAll("T", "U");

  if (normalized.endsWith("CCA")) {
    return "full";
  }

  if (normalized.endsWith("CC") || normalized.endsWith("C")) {
    return "partial";
  }

  return "missing";
}

function toRnaDomain(stem: LayoutStem): RnaDomain {
  return {
    id: stem.id,
    type: stem.type,
    range: {
      start: stem.fivePrimeStart,
      end: stem.threePrimeEnd,
    },
    stem: {
      fivePrimeStart: stem.fivePrimeStart,
      fivePrimeEnd: stem.fivePrimeEnd,
      threePrimeStart: stem.threePrimeStart,
      threePrimeEnd: stem.threePrimeEnd,
      length: stem.length,
    },
    score: stem.score,
    anchorPosition: stem.anchorPosition,
    tentative: stem.tentative,
  };
}

function getVariableRegionDomain(layoutStems: LayoutStem[]): RnaDomain | undefined {
  const anticodon = layoutStems.find((stem) => stem.type === "anticodon_arm_candidate");
  if (!anticodon) {
    return undefined;
  }

  const downstreamStem = layoutStems
    .filter(
      (stem) =>
        stem !== anticodon &&
        stem.fivePrimeStart > anticodon.threePrimeEnd &&
        stem.type !== "acceptor_candidate",
    )
    .sort((left, right) => left.fivePrimeStart - right.fivePrimeStart)
    .at(0);

  if (!downstreamStem) {
    return undefined;
  }

  const start = anticodon.threePrimeEnd + 1;
  const end = downstreamStem.fivePrimeStart - 1;
  if (start > end) {
    return undefined;
  }

  return {
    id: "domain-variable-region-candidate",
    type: "variable_region_candidate",
    range: { start, end },
    anchorPosition: "center-right",
    tentative: true,
  };
}

function getLayoutStems(stems: DotBracketStem[], sequenceLength: number): LayoutStem[] {
  if (stems.length === 0) {
    return [];
  }

  const getEndProximity = (stem: DotBracketStem) => {
    const fivePrimeScore = clamp01(1 - (stem.fivePrimeStart - 1) / Math.max(1, sequenceLength * 0.2));
    const threePrimeScore = clamp01(
      1 - (sequenceLength - stem.threePrimeEnd) / Math.max(1, sequenceLength * 0.2),
    );
    return (fivePrimeScore + threePrimeScore) / 2;
  };
  const outer = stems.reduce((best, stem) => {
    const score =
      stem.length * 0.7 +
      getEndProximity(stem) * 6 +
      (stem.threePrimeEnd - stem.fivePrimeStart) * 0.02;
    const bestScore =
      best.length * 0.7 +
      getEndProximity(best) * 6 +
      (best.threePrimeEnd - best.fivePrimeStart) * 0.02;
    return score > bestScore ? stem : best;
  }, stems[0]);
  const inner = stems
    .filter((stem) => stem !== outer)
    .sort((left, right) => left.fivePrimeStart - right.fivePrimeStart);
  const layouts = new Map<DotBracketStem, LayoutStem>();
  const scores = new Map(stems.map((stem) => [stem, scoreStemLoop(stem, sequenceLength)]));
  const isCloverleafLike = inner.length >= 3;
  const anticodonStem =
    inner.length > 0
      ? inner.reduce((best, stem) => {
          const score = scores.get(stem)?.total ?? 0;
          const bestScore = scores.get(best)?.total ?? 0;
          return score > bestScore ? stem : best;
        }, inner[0])
      : undefined;
  const dStem = anticodonStem
    ? inner.filter((stem) => stem.fivePrimeStart < anticodonStem.fivePrimeStart).at(0)
    : inner.at(0);
  const tStem = anticodonStem
    ? inner.filter((stem) => stem.fivePrimeStart > anticodonStem.fivePrimeStart).at(-1)
    : inner.at(-1);
  const variableStem =
    anticodonStem && tStem
      ? inner.find(
          (stem) =>
            stem !== anticodonStem &&
            stem !== tStem &&
            stem.fivePrimeStart > anticodonStem.threePrimeEnd &&
            stem.fivePrimeStart < tStem.fivePrimeStart,
        )
      : undefined;

  layouts.set(outer, {
    ...outer,
    id: "domain-acceptor-candidate",
    type: "acceptor_candidate",
    region: "acceptor",
    center: { x: CANVAS_CENTER.x, y: 255 },
    orientation: "vertical",
    loopSide: "top",
    anchorPosition: "top",
    score: scores.get(outer) ?? scoreStemLoop(outer, sequenceLength),
    tentative: !isCloverleafLike,
  });

  inner.forEach((stem, index) => {
    const fallbackFraction = (index + 1) / (inner.length + 1);
    let layout: Omit<LayoutStem, keyof DotBracketStem>;
    const score = scores.get(stem) ?? scoreStemLoop(stem, sequenceLength);

    if (stem === dStem && stem !== anticodonStem && isCloverleafLike) {
      layout = {
        id: "domain-D-arm-candidate",
        type: "D_arm_candidate",
        region: "d-loop",
        center: { x: 365, y: 430 },
        orientation: "horizontal",
        loopSide: "left",
        anchorPosition: "left",
        score,
        tentative: true,
      };
    } else if (stem === anticodonStem) {
      layout = {
        id: "domain-anticodon-arm-candidate",
        type: "anticodon_arm_candidate",
        region: "anticodon",
        center: { x: CANVAS_CENTER.x, y: isCloverleafLike ? 675 : 650 },
        orientation: "vertical",
        loopSide: "bottom",
        anchorPosition: "bottom",
        score,
        tentative: true,
      };
    } else if (stem === tStem && stem !== anticodonStem && isCloverleafLike) {
      layout = {
        id: "domain-T-arm-candidate",
        type: "T_arm_candidate",
        region: "t-loop",
        center: { x: 925, y: 430 },
        orientation: "horizontal",
        loopSide: "right",
        anchorPosition: "right",
        score,
        tentative: true,
      };
    } else if (stem === variableStem) {
      layout = {
        id: "domain-variable-region-candidate-stem",
        type: "variable_region_candidate",
        region: "variable",
        center: { x: 775, y: 555 },
        orientation: "horizontal",
        loopSide: "bottom",
        anchorPosition: "center-right",
        score,
        tentative: true,
      };
    } else if (!isCloverleafLike) {
      const angle = -Math.PI / 2 + fallbackFraction * Math.PI * 1.8;
      layout = {
        id: `domain-structure-candidate-${index + 1}`,
        type: "unknown",
        region: "extra",
        center: {
          x: CANVAS_CENTER.x + Math.cos(angle) * 220,
          y: CANVAS_CENTER.y + Math.sin(angle) * 180,
        },
        orientation: "vertical",
        loopSide: "bottom",
        anchorPosition: "unknown",
        score,
        tentative: true,
      };
    } else {
      layout = {
        id: `domain-unknown-candidate-${index + 1}`,
        type: "unknown",
        region: "extra",
        center: { x: 720 + index * 45, y: 560 + index * 24 },
        orientation: "horizontal",
        loopSide: "bottom",
        anchorPosition: "unknown",
        score,
        tentative: true,
      };
    }

    layouts.set(stem, {
      ...stem,
      ...layout,
    });
  });

  return stems.map(
    (stem) =>
      layouts.get(stem) ?? {
        ...stem,
        id: "domain-unknown-candidate",
        type: "unknown",
        region: "extra",
        center: CANVAS_CENTER,
        orientation: "horizontal",
        loopSide: "right",
        anchorPosition: "unknown",
        score: scores.get(stem) ?? scoreStemLoop(stem, sequenceLength),
        tentative: true,
      },
  );
}

function placeStem(points: Map<number, Point>, stem: LayoutStem) {
  const span = (stem.length - 1) * STEM_STEP;

  if (stem.orientation === "vertical") {
    const topY = stem.center.y - span / 2;
    const leftX = stem.center.x - STEM_GAP / 2;
    const rightX = stem.center.x + STEM_GAP / 2;

    for (let offset = 0; offset < stem.length; offset += 1) {
      const y = topY + offset * STEM_STEP;
      points.set(stem.fivePrimeStart + offset, { x: leftX, y });
      points.set(stem.threePrimeEnd - offset, { x: rightX, y });
    }
    return;
  }

  const startX =
    stem.loopSide === "left"
      ? stem.center.x + span / 2
      : stem.center.x - span / 2;
  const direction = stem.loopSide === "left" ? -1 : 1;
  const topY = stem.center.y - STEM_GAP / 2;
  const bottomY = stem.center.y + STEM_GAP / 2;

  for (let offset = 0; offset < stem.length; offset += 1) {
    const x = startX + direction * offset * STEM_STEP;
    points.set(stem.fivePrimeStart + offset, { x, y: topY });
    points.set(stem.threePrimeEnd - offset, { x, y: bottomY });
  }
}

function placeHairpinLoop(points: Map<number, Point>, stem: LayoutStem) {
  const loopStart = stem.fivePrimeEnd + 1;
  const loopEnd = stem.threePrimeStart - 1;

  if (loopStart > loopEnd) {
    return;
  }

  const from = points.get(stem.fivePrimeEnd);
  const to = points.get(stem.threePrimeStart);
  if (!from || !to) {
    return;
  }

  const count = loopEnd - loopStart + 1;
  const depth = Math.max(58, Math.min(150, 42 + count * 10));

  for (let index = 0; index < count; index += 1) {
    const position = loopStart + index;
    const t = (index + 1) / (count + 1);
    const curve = Math.sin(Math.PI * t);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    if (stem.loopSide === "left") {
      points.set(position, { x: x - depth * curve, y });
    } else if (stem.loopSide === "right") {
      points.set(position, { x: x + depth * curve, y });
    } else if (stem.loopSide === "bottom") {
      points.set(position, { x, y: y + depth * curve });
    } else {
      points.set(position, { x, y: y - depth * curve });
    }
  }
}

function placeThreePrimeTail(points: Map<number, Point>, outer: LayoutStem | undefined, sequence: string[]) {
  if (!outer) {
    return;
  }

  const tailStart = outer.threePrimeEnd + 1;
  if (tailStart > sequence.length) {
    return;
  }

  const anchor = points.get(outer.threePrimeEnd);
  if (!anchor) {
    return;
  }

  const terminal = sequence.slice(-3).join("").toUpperCase().replaceAll("T", "U");
  const isCcaLike =
    terminal === "CCA" ||
    sequence.slice(-2).join("").toUpperCase().replaceAll("T", "U") === "CC" ||
    sequence.at(-1)?.toUpperCase().replace("T", "U") === "C";
  const slope = isCcaLike ? { x: 32, y: -30 } : { x: 28, y: -18 };

  for (let position = tailStart; position <= sequence.length; position += 1) {
    const offset = position - tailStart + 1;
    points.set(position, {
      x: anchor.x + slope.x * offset,
      y: anchor.y + slope.y * offset,
    });
  }
}

function interpolateBackboneRun(
  points: Map<number, Point>,
  start: number,
  end: number,
  sequenceLength: number,
) {
  if (start > end) {
    return;
  }

  const before = points.get(start - 1);
  const after = points.get(end + 1);
  const count = end - start + 1;

  if (!before && !after) {
    const radius = Math.max(80, count * 13);
    for (let position = start; position <= end; position += 1) {
      const t = (position - start) / Math.max(1, count - 1);
      const angle = -Math.PI / 2 + t * Math.PI * 2;
      points.set(position, {
        x: CANVAS_CENTER.x + Math.cos(angle) * radius,
        y: CANVAS_CENTER.y + Math.sin(angle) * radius,
      });
    }
    return;
  }

  const from = before ?? after ?? CANVAS_CENTER;
  const to = after ?? before ?? CANVAS_CENTER;
  const mid = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
  const outward = {
    x: mid.x - CANVAS_CENTER.x,
    y: mid.y - CANVAS_CENTER.y,
  };
  const length = Math.hypot(outward.x, outward.y) || 1;
  const localLift = Math.min(110, Math.max(26, count * 12));
  const control = {
    x: mid.x + (outward.x / length) * localLift,
    y: mid.y + (outward.y / length) * localLift,
  };

  for (let position = start; position <= end; position += 1) {
    const t = (position - start + 1) / (count + 1);
    const inv = 1 - t;
    points.set(position, {
      x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
      y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
    });
  }

  const first = points.get(1);
  if (!first && sequenceLength > 0) {
    points.set(1, { x: CANVAS_CENTER.x, y: CANVAS_CENTER.y });
  }
}

function fillUnplacedNodes(points: Map<number, Point>, sequenceLength: number) {
  let cursor = 1;

  while (cursor <= sequenceLength) {
    if (points.has(cursor)) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    while (cursor <= sequenceLength && !points.has(cursor)) {
      cursor += 1;
    }
    interpolateBackboneRun(points, start, cursor - 1, sequenceLength);
  }
}

function centerAndFit(points: Map<number, Point>) {
  const values = Array.from(points.values());
  if (values.length === 0) {
    return;
  }

  const minX = Math.min(...values.map((point) => point.x));
  const maxX = Math.max(...values.map((point) => point.x));
  const minY = Math.min(...values.map((point) => point.y));
  const maxY = Math.max(...values.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const maxWidth = CANVAS_BOUNDS.maxX - CANVAS_BOUNDS.minX;
  const maxHeight = CANVAS_BOUNDS.maxY - CANVAS_BOUNDS.minY;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const currentCenter = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };

  for (const [key, point] of points.entries()) {
    points.set(key, {
      x: Math.round(CANVAS_CENTER.x + (point.x - currentCenter.x) * scale),
      y: Math.round(CANVAS_CENTER.y + (point.y - currentCenter.y) * scale),
    });
  }
}

function assignSprinzlAnnotations(sequence: string[], stems: LayoutStem[]) {
  const labels = new Map<number, string>();
  const acceptor = stems.find((stem) => stem.type === "acceptor_candidate");
  const dArm = stems.find((stem) => stem.type === "D_arm_candidate");
  const anticodon = stems.find((stem) => stem.type === "anticodon_arm_candidate");
  const tArm = stems.find((stem) => stem.type === "T_arm_candidate");
  const variable = stems.find((stem) => stem.type === "variable_region_candidate");
  const sequenceLength = sequence.length;
  const normalizedTail = sequence.slice(-3).join("").toUpperCase().replaceAll("T", "U");

  if (acceptor && acceptor.length >= 4) {
    for (let offset = 0; offset < acceptor.length; offset += 1) {
      if (offset < 7) {
        labels.set(acceptor.fivePrimeStart + offset, String(1 + offset));
        labels.set(acceptor.threePrimeEnd - offset, String(72 - offset));
      }
    }
  }

  if (dArm && dArm.length >= 2) {
    for (let offset = 0; offset < dArm.length; offset += 1) {
      labels.set(dArm.fivePrimeStart + offset, String(10 + offset));
      labels.set(dArm.threePrimeEnd - offset, String(25 - offset));
    }
  }

  if (anticodon && anticodon.length >= 3) {
    for (let offset = 0; offset < anticodon.length; offset += 1) {
      labels.set(anticodon.fivePrimeStart + offset, String(27 + offset));
      labels.set(anticodon.threePrimeEnd - offset, String(43 - offset));
    }

    const loopStart = anticodon.fivePrimeEnd + 1;
    const loopEnd = anticodon.threePrimeStart - 1;
    const loopLength = loopEnd - loopStart + 1;
    const anticodonStart = loopStart + Math.max(0, Math.floor((loopLength - 3) / 2));
    [34, 35, 36].forEach((label, index) => {
      if (anticodonStart + index <= loopEnd) {
        labels.set(anticodonStart + index, String(label));
      }
    });
  }

  if (variable) {
    for (let offset = 0; offset < variable.length; offset += 1) {
      labels.set(variable.fivePrimeStart + offset, `e1${offset + 1}`);
      labels.set(variable.threePrimeEnd - offset, `e2${offset + 1}`);
    }
  }

  if (tArm && tArm.length >= 3) {
    for (let offset = 0; offset < tArm.length; offset += 1) {
      labels.set(tArm.fivePrimeStart + offset, String(49 + offset));
      labels.set(tArm.threePrimeEnd - offset, String(65 - offset));
    }
  }

  if (normalizedTail === "CCA") {
    labels.set(sequenceLength - 2, "74");
    labels.set(sequenceLength - 1, "75");
    labels.set(sequenceLength, "76");
    if (sequenceLength > 3) {
      labels.set(sequenceLength - 3, "73");
    }
  } else if (sequence.slice(-2).join("").toUpperCase().replaceAll("T", "U") === "CC") {
    labels.set(sequenceLength - 1, "74");
    labels.set(sequenceLength, "75");
  } else if (sequence.at(-1)?.toUpperCase().replace("T", "U") === "C") {
    labels.set(sequenceLength, "74");
  }

  return labels;
}

function getNodeDomain(
  index: number,
  stems: LayoutStem[],
  extraDomains: RnaDomain[],
): { type: RnaDomainType; region: RnaRegion } {
  const pairedStem = stems.find(
    (stem) =>
      (index >= stem.fivePrimeStart && index <= stem.fivePrimeEnd) ||
      (index >= stem.threePrimeStart && index <= stem.threePrimeEnd),
  );

  if (pairedStem) {
    return { type: pairedStem.type, region: pairedStem.region };
  }

  const extraDomain = extraDomains.find(
    (domain) => index >= domain.range.start && index <= domain.range.end,
  );
  if (extraDomain) {
    return {
      type: extraDomain.type,
      region: extraDomain.type === "variable_region_candidate" ? "variable" : "extra",
    };
  }

  const loopStem = stems
    .filter((stem) => stem.type !== "acceptor_candidate")
    .filter((stem) => index > stem.fivePrimeEnd && index < stem.threePrimeStart)
    .sort(
      (left, right) =>
        left.threePrimeStart - left.fivePrimeEnd - (right.threePrimeStart - right.fivePrimeEnd),
    )
    .at(0);
  if (loopStem) {
    return { type: loopStem.type, region: loopStem.region };
  }

  const acceptor = stems.find((stem) => stem.type === "acceptor_candidate");
  if (acceptor && index > acceptor.threePrimeEnd) {
    return { type: "tail_candidate", region: "tail" };
  }

  return { type: "unassigned_candidate", region: "extra" };
}

function getAnticodonSummary(sequence: string[], stems: LayoutStem[]) {
  const anticodon = stems.find((stem) => stem.type === "anticodon_arm_candidate");
  if (!anticodon) {
    return { sequence: "", confidence: "unknown" as const };
  }

  const loop = getLoopRange(anticodon);
  if (loop.length < 3) {
    return { sequence: "", confidence: "unknown" as const };
  }

  const start = loop.start + Math.floor((loop.length - 3) / 2);
  const anticodonSequence = sequence.slice(start - 1, start + 2).join("");
  const confidence: "high" | "medium" | "low" =
    loop.length >= 5 && loop.length <= 7
      ? "high"
      : loop.length >= 4 && loop.length <= 9
        ? "medium"
        : "low";

  return { sequence: anticodonSequence, confidence };
}

function getStructureWarnings(sequence: string[], stems: LayoutStem[], ccaStatus: RnaCcaStatus) {
  const warnings: string[] = [];

  if (ccaStatus === "partial") {
    warnings.push("partial CCA tail");
  } else if (ccaStatus === "missing") {
    warnings.push("missing CCA tail");
  }

  if (!stems.some((stem) => stem.type === "D_arm_candidate")) {
    warnings.push("tentative D arm candidate is ambiguous");
  }

  if (!stems.some((stem) => stem.type === "T_arm_candidate")) {
    warnings.push("tentative T arm candidate is ambiguous");
  }

  return warnings;
}

export function buildStructureConstrainedLayout(
  sequence: string[],
  dotBracket: string,
): StructureLayoutResult {
  const parsed = parseDotBracketStructure(dotBracket, sequence.length);
  const warnings = sequence
    .filter(isUnknownToken)
    .map((token) => `invalid or noncanonical RNA token "${token.trim()}"`);

  if (parsed.error) {
    return {
      inputSequence: sequence,
      dotBracket: parsed.compact,
      renderMode: "atypical_mode",
      nodes: [],
      domains: [],
      backboneEdges: [],
      pairEdges: [],
      stems: [],
      anticodon: { sequence: "", confidence: "unknown" },
      ccaStatus: getCcaStatus(sequence),
      warnings: [parsed.error],
    };
  }

  const layoutStems = getLayoutStems(parsed.stems, sequence.length);
  const variableDomain = getVariableRegionDomain(layoutStems);
  const extraDomains = [variableDomain].filter((domain): domain is RnaDomain => Boolean(domain));
  const ccaStatus = getCcaStatus(sequence);
  const points = new Map<number, Point>();
  layoutStems.forEach((stem) => placeStem(points, stem));
  layoutStems.forEach((stem) => placeHairpinLoop(points, stem));
  placeThreePrimeTail(
    points,
    layoutStems.find((stem) => stem.type === "acceptor_candidate"),
    sequence,
  );
  fillUnplacedNodes(points, sequence.length);
  centerAndFit(points);

  warnings.push(...getStructureWarnings(sequence, layoutStems, ccaStatus));

  const pairEdges = parsed.pairs.map((pair) => {
    const left = getDisplayBaseForToken(sequence[pair.i - 1] ?? "");
    const right = getDisplayBaseForToken(sequence[pair.j - 1] ?? "");
    const pairStatus = getPairStatus(left, right);

    if (pairStatus === "mismatch") {
      warnings.push(`pair mismatch at indices ${pair.i}-${pair.j}: ${left}-${right}`);
    }

    return {
      sourceIndex: pair.i,
      targetIndex: pair.j,
      pairStatus,
    };
  });

  const pairStatusByIndex = new Map<number, RnaPairStatus>();
  pairEdges.forEach((edge) => {
    pairStatusByIndex.set(edge.sourceIndex, edge.pairStatus);
    pairStatusByIndex.set(edge.targetIndex, edge.pairStatus);
  });

  const sprinzlLabels = assignSprinzlAnnotations(sequence, layoutStems);
  const nodes = sequence.map((token, index) => {
    const sequenceIndex = index + 1;
    const point = points.get(sequenceIndex) ?? CANVAS_CENTER;
    const pairStatus = pairStatusByIndex.get(sequenceIndex);
    const sprinzlLabel = sprinzlLabels.get(sequenceIndex);
    const domain = getNodeDomain(sequenceIndex, layoutStems, extraDomains);
    const status: RnaNodeStatus =
      pairStatus === "mismatch"
        ? "mismatch"
        : domain.type === "unknown" && parsed.compact[index] === "."
          ? "unassigned_extra"
          : "present";

    return {
      pos: sequenceIndex,
      sequenceIndex,
      base: getDisplayBaseForToken(token),
      originalToken: token,
      dotBracketChar: parsed.compact[index],
      pairedIndex: parsed.pairMap.get(sequenceIndex),
      structuralDomain: domain.type,
      region: domain.region,
      sprinzlLabel,
      positionLabel: String(sequenceIndex),
      status,
      pairStatus,
      x: point.x,
      y: point.y,
      visible: true,
    } satisfies StructureNode;
  });

  const stems: RnaStem[] = pairEdges.map((edge) => ({
    from: edge.sourceIndex,
    to: edge.targetIndex,
    pairStatus: edge.pairStatus,
    style: edge.pairStatus === "mismatch" ? "dashed" : undefined,
  }));
  const backboneEdges = Array.from({ length: Math.max(0, sequence.length - 1) }, (_, index) => ({
    sourceIndex: index + 1,
    targetIndex: index + 2,
  }));
  const domains = [...layoutStems.map(toRnaDomain), ...extraDomains];
  const anticodon = getAnticodonSummary(sequence, layoutStems);
  const renderMode =
    sequence.length < 71 || layoutStems.filter((stem) => stem.type !== "acceptor_candidate").length < 3
      ? "atypical_mode"
      : "structure_constrained_mode";

  return {
    inputSequence: sequence,
    dotBracket: parsed.compact,
    renderMode,
    nodes,
    domains,
    backboneEdges,
    pairEdges,
    stems,
    anticodon,
    ccaStatus,
    warnings: Array.from(new Set(warnings)),
  };
}
