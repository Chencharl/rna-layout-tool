import type { RnaNucleotide, RnaStem } from "./types";

/**
 * Structure-driven arrangement for the Bubble theme on fixed rRNA templates.
 *
 * The rRNA templates store coordinates tuned for plain text glyphs, which are
 * too tight for one circle per base. This module rebuilds coordinates from the
 * template's own pairing map: stacked pairs become ladders, every loop becomes
 * a circle, and the unpaired exterior runs along a baseline (or a ring when it
 * is long). It never predicts structure; pairs come from the template.
 */

export type RadialPoint = { x: number; y: number };

export type RadialLayoutResult = {
  positions: Map<number, RadialPoint>;
  width: number;
  height: number;
};

export const RADIAL_SPACING = 30;
export const RADIAL_PAIR_WIDTH = 46;
const RADIAL_MARGIN = 70;
const EXTERIOR_RING_THRESHOLD = 12;
const SIBLING_STEM_GAP = 2.4;
const TWO_PI = Math.PI * 2;

type LoopItem = { kind: "base"; index: number } | { kind: "stem"; open: number; close: number };

function solveRadius(chords: number[]): number {
  const longest = Math.max(...chords);
  const totalAngle = (radius: number) =>
    chords.reduce((sum, chord) => sum + 2 * Math.asin(Math.min(1, chord / (2 * radius))), 0);
  let low = longest / 2 + 1e-6;

  if (totalAngle(low) <= TWO_PI) {
    return low;
  }

  let high = Math.max(low * 2, chords.reduce((sum, chord) => sum + chord, 0));
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const middle = (low + high) / 2;
    if (totalAngle(middle) > TWO_PI) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return high;
}

/** Keep only properly nested pairs so the structure can be drawn without crossings. */
function buildPartnerTable(count: number, pairs: Array<[number, number]>): Array<number | null> {
  const partner: Array<number | null> = Array.from({ length: count }, () => null);
  const accepted: Array<[number, number]> = [];

  [...pairs]
    .map(([left, right]) => (left < right ? [left, right] : [right, left]) as [number, number])
    .filter(([left, right]) => left !== right)
    .sort((a, b) => a[0] - b[0] || b[1] - a[1])
    .forEach(([left, right]) => {
      if (partner[left] !== null || partner[right] !== null) {
        return;
      }

      const crosses = accepted.some(
        ([open, close]) => (open < left && left < close && close < right) || (left < open && open < right && right < close),
      );
      if (crosses) {
        return;
      }

      partner[left] = right;
      partner[right] = left;
      accepted.push([left, right]);
    });

  return partner;
}

function collectItems(partner: Array<number | null>, from: number, to: number): LoopItem[] {
  const items: LoopItem[] = [];
  let index = from;

  while (index <= to) {
    const mate = partner[index];
    if (mate !== null && mate > index && mate <= to) {
      items.push({ kind: "stem", open: index, close: mate });
      index = mate + 1;
    } else {
      items.push({ kind: "base", index });
      index += 1;
    }
  }

  return items;
}

/**
 * Extra room (in backbone steps) between a loop's closing pair and a helix that
 * leaves the loop right next to it. Without it such a helix points back toward
 * the parent and can run into it; the layout retries with more room until no
 * two positions collide.
 */
const CLOSING_PAD_STEPS = [0, 1.5, 2.5, 3.5, 5, 7];

function countCollisions(points: RadialPoint[], minimum: number): number {
  let collisions = 0;
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      if (Math.hypot(points[left].x - points[right].x, points[left].y - points[right].y) < minimum) {
        collisions += 1;
      }
    }
  }
  return collisions;
}

export function buildRadialLayout(
  nucleotides: RnaNucleotide[],
  stems: RnaStem[],
  spacing = RADIAL_SPACING,
  pairWidth = RADIAL_PAIR_WIDTH,
): RadialLayoutResult | null {
  let best: { result: RadialLayoutResult; collisions: number } | null = null;

  for (const closingPad of CLOSING_PAD_STEPS) {
    const result = buildRadialLayoutOnce(nucleotides, stems, spacing, pairWidth, closingPad);
    if (!result) {
      return null;
    }

    const collisions = countCollisions([...result.positions.values()], spacing * 0.9);
    if (!best || collisions < best.collisions) {
      best = { result, collisions };
    }
    if (collisions === 0) {
      break;
    }
  }

  return best ? best.result : null;
}

function buildRadialLayoutOnce(
  nucleotides: RnaNucleotide[],
  stems: RnaStem[],
  spacing: number,
  pairWidth: number,
  closingPad: number,
): RadialLayoutResult | null {
  const chain = [...nucleotides].sort(
    (left, right) => (left.sequenceIndex ?? left.pos) - (right.sequenceIndex ?? right.pos) || left.pos - right.pos,
  );
  const count = chain.length;
  const indexByPos = new Map(chain.map((nucleotide, index) => [nucleotide.pos, index]));
  const pairs: Array<[number, number]> = [];

  stems.forEach((stem) => {
    const left = indexByPos.get(stem.from);
    const right = indexByPos.get(stem.to);
    if (left !== undefined && right !== undefined) {
      pairs.push([left, right]);
    }
  });

  const partner = buildPartnerTable(count, pairs);
  if (count === 0 || !partner.some((mate) => mate !== null)) {
    return null;
  }

  const points: Array<RadialPoint | null> = Array.from({ length: count }, () => null);

  function placeLoop(open: number, close: number, openPoint: RadialPoint, closePoint: RadialPoint, direction: RadialPoint) {
    points[open] = openPoint;
    points[close] = closePoint;

    if (close - open <= 1) {
      return;
    }

    // Stacked pair: continue the ladder.
    if (partner[open + 1] === close - 1 && open + 1 < close - 1) {
      placeLoop(
        open + 1,
        close - 1,
        { x: openPoint.x + direction.x * spacing, y: openPoint.y + direction.y * spacing },
        { x: closePoint.x + direction.x * spacing, y: closePoint.y + direction.y * spacing },
        direction,
      );
      return;
    }

    const items = collectItems(partner, open + 1, close - 1);
    const chords: number[] = [];
    items.forEach((item, index) => {
      // Two helices that leave a loop side by side get extra room between them.
      const besideStem = item.kind === "stem" && index > 0 && items[index - 1].kind === "stem";
      // A helix right next to the closing pair is pushed round the loop so it does not fold back.
      const besideClosing = item.kind === "stem" && index === 0;
      chords.push(
        besideStem ? spacing * SIBLING_STEM_GAP : besideClosing ? spacing * (1 + closingPad) : spacing,
      );
      if (item.kind === "stem") {
        chords.push(pairWidth);
      }
    });
    chords.push(items[items.length - 1].kind === "stem" ? spacing * (1 + closingPad) : spacing);

    const radius = solveRadius([...chords, pairWidth]);
    const closingAngle = 2 * Math.asin(Math.min(1, pairWidth / (2 * radius)));
    const rawAngles = chords.map((chord) => 2 * Math.asin(Math.min(1, chord / (2 * radius))));
    const scale = (TWO_PI - closingAngle) / rawAngles.reduce((sum, angle) => sum + angle, 0);
    const height = Math.sqrt(Math.max(radius * radius - (pairWidth / 2) ** 2, 0));
    const centre = {
      x: (openPoint.x + closePoint.x) / 2 + direction.x * height,
      y: (openPoint.y + closePoint.y) / 2 + direction.y * height,
    };
    let angle = Math.atan2(openPoint.y - centre.y, openPoint.x - centre.x);
    const tangent = { x: -Math.sin(angle), y: Math.cos(angle) };
    const sweep = tangent.x * (openPoint.x - closePoint.x) + tangent.y * (openPoint.y - closePoint.y) >= 0 ? 1 : -1;
    let chordIndex = 0;
    const step = () => {
      angle += sweep * rawAngles[chordIndex] * scale;
      chordIndex += 1;
      return { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
    };

    items.forEach((item) => {
      if (item.kind === "base") {
        points[item.index] = step();
        return;
      }

      const childOpen = step();
      const childClose = step();
      const middle = { x: (childOpen.x + childClose.x) / 2, y: (childOpen.y + childClose.y) / 2 };
      const length = Math.hypot(middle.x - centre.x, middle.y - centre.y) || 1;
      placeLoop(item.open, item.close, childOpen, childClose, {
        x: (middle.x - centre.x) / length,
        y: (middle.y - centre.y) / length,
      });
    });
  }

  const exterior = collectItems(partner, 0, count - 1);
  const exteriorUnpaired = exterior.filter((item) => item.kind === "base").length;

  if (exteriorUnpaired <= EXTERIOR_RING_THRESHOLD) {
    // Short exterior: straight baseline with stems growing upward.
    let cursor = 0;
    exterior.forEach((item) => {
      if (item.kind === "base") {
        points[item.index] = { x: cursor, y: 0 };
        cursor += spacing;
        return;
      }

      placeLoop(item.open, item.close, { x: cursor, y: 0 }, { x: cursor + pairWidth, y: 0 }, { x: 0, y: -1 });
      const nextItem = exterior[exterior.indexOf(item) + 1];
      cursor += pairWidth + (nextItem?.kind === "stem" ? spacing * SIBLING_STEM_GAP : spacing);
    });
  } else {
    // Long exterior (for example the 5.8S leader): an open ring with stems pointing outward.
    const chords: number[] = [];
    exterior.forEach((item, index) => {
      if (index > 0) {
        const besideStem = item.kind === "stem" && exterior[index - 1].kind === "stem";
        chords.push(besideStem ? spacing * SIBLING_STEM_GAP : spacing);
      }
      if (item.kind === "stem") {
        chords.push(pairWidth);
      }
    });
    const gap = spacing * 4;
    const radius = solveRadius([...chords, gap]);
    const gapAngle = 2 * Math.asin(Math.min(1, gap / (2 * radius)));
    const rawAngles = chords.map((chord) => 2 * Math.asin(Math.min(1, chord / (2 * radius))));
    const total = rawAngles.reduce((sum, angle) => sum + angle, 0) || 1;
    const scale = (TWO_PI - gapAngle) / total;
    // Start left of the opening at the top and run counter-clockwise, so the 5′
    // end descends on the left as in a cloverleaf and the 3′ end returns on the right.
    let angle = -Math.PI / 2 - gapAngle / 2;
    let chordIndex = 0;
    const here = () => ({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    const advance = () => {
      angle -= rawAngles[chordIndex] * scale;
      chordIndex += 1;
    };

    exterior.forEach((item, index) => {
      if (index > 0) {
        advance();
      }

      if (item.kind === "base") {
        points[item.index] = here();
        return;
      }

      const childOpen = here();
      advance();
      const childClose = here();
      const middle = { x: (childOpen.x + childClose.x) / 2, y: (childOpen.y + childClose.y) / 2 };
      const length = Math.hypot(middle.x, middle.y) || 1;
      placeLoop(item.open, item.close, childOpen, childClose, { x: middle.x / length, y: middle.y / length });
    });
  }

  const placed = points.filter((point): point is RadialPoint => point !== null);
  if (placed.length !== count) {
    return null;
  }

  const minX = Math.min(...placed.map((point) => point.x));
  const maxX = Math.max(...placed.map((point) => point.x));
  const minY = Math.min(...placed.map((point) => point.y));
  const maxY = Math.max(...placed.map((point) => point.y));
  const positions = new Map<number, RadialPoint>();

  chain.forEach((nucleotide, index) => {
    const point = points[index] as RadialPoint;
    positions.set(nucleotide.pos, {
      x: Math.round((point.x - minX + RADIAL_MARGIN) * 100) / 100,
      y: Math.round((point.y - minY + RADIAL_MARGIN) * 100) / 100,
    });
  });

  return {
    positions,
    width: Math.ceil(maxX - minX + RADIAL_MARGIN * 2),
    height: Math.ceil(maxY - minY + RADIAL_MARGIN * 2),
  };
}

/**
 * Apply the radial arrangement to a set of nucleotides, centred on the canvas.
 * Returns the input untouched when no pairs are available.
 */
export function arrangeNucleotidesRadially<T extends RnaNucleotide>(
  nucleotides: T[],
  stems: RnaStem[],
  canvas: { width: number; height: number },
): { nucleotides: T[]; canvasWidth: number; canvasHeight: number } {
  const layout = buildRadialLayout(nucleotides, stems);

  if (!layout) {
    return { nucleotides, canvasWidth: canvas.width, canvasHeight: canvas.height };
  }

  const canvasWidth = Math.max(canvas.width, layout.width);
  const canvasHeight = Math.max(canvas.height, layout.height);
  const offsetX = (canvasWidth - layout.width) / 2;
  const offsetY = (canvasHeight - layout.height) / 2;

  return {
    nucleotides: nucleotides.map((nucleotide) => {
      const point = layout.positions.get(nucleotide.pos);
      return point ? { ...nucleotide, x: Math.round(point.x + offsetX), y: Math.round(point.y + offsetY) } : nucleotide;
    }),
    canvasWidth,
    canvasHeight,
  };
}
