import type { RnaNucleotide, RnaStem } from "./types";

/**
 * Geometry helpers for the "bubble" display theme: one circle per nucleotide,
 * a thin backbone underneath, and modification labels placed outside the figure.
 * Everything here is pure so it can be unit tested without a DOM.
 */

export type BubblePoint = { x: number; y: number };

export type BubbleLabelPlacement = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  leaderFrom: BubblePoint;
  leaderTo: BubblePoint;
};

export const BUBBLE_MAX_RADIUS = 14;
export const BUBBLE_MIN_RADIUS = 7;
export const BUBBLE_GAP = 3;
export const BUBBLE_LABEL_FONT_SIZE = 12;

const ANTICODON_LABELS = new Set(["34", "35", "36"]);

function isDrawable(nucleotide: RnaNucleotide) {
  return nucleotide.visible !== false;
}

/** Largest radius (capped) that keeps paired, template-fixed bubbles from touching. */
export function getBubbleRadius(nucleotides: RnaNucleotide[], stems: RnaStem[]): number {
  const paired = new Set<number>();
  stems.forEach((stem) => {
    paired.add(stem.from);
    paired.add(stem.to);
  });

  const fixed = nucleotides.filter((nucleotide) => isDrawable(nucleotide) && paired.has(nucleotide.pos));
  let minDistance = Number.POSITIVE_INFINITY;

  for (let left = 0; left < fixed.length; left += 1) {
    for (let right = left + 1; right < fixed.length; right += 1) {
      const distance = Math.hypot(fixed[left].x - fixed[right].x, fixed[left].y - fixed[right].y);
      if (distance > 0 && distance < minDistance) {
        minDistance = distance;
      }
    }
  }

  if (!Number.isFinite(minDistance)) {
    return BUBBLE_MAX_RADIUS;
  }

  return Math.max(BUBBLE_MIN_RADIUS, Math.min(BUBBLE_MAX_RADIUS, (minDistance - BUBBLE_GAP) / 2));
}

/**
 * Display positions for every nucleotide. Paired bases keep their template
 * coordinates; unpaired bases that would overlap another bubble are nudged apart.
 * Stored coordinates are never changed.
 */
export function spreadOverlappingBubbles(
  nucleotides: RnaNucleotide[],
  stems: RnaStem[],
  radius: number,
  gap = BUBBLE_GAP,
): Map<number, BubblePoint> {
  const positions = new Map<number, BubblePoint>();
  const drawable = nucleotides.filter(isDrawable);
  drawable.forEach((nucleotide) => positions.set(nucleotide.pos, { x: nucleotide.x, y: nucleotide.y }));

  const paired = new Set<number>();
  stems.forEach((stem) => {
    paired.add(stem.from);
    paired.add(stem.to);
  });

  const free = drawable.filter((nucleotide) => !paired.has(nucleotide.pos)).map((nucleotide) => nucleotide.pos);
  const all = drawable.map((nucleotide) => nucleotide.pos);
  const required = radius * 2 + gap;

  for (let iteration = 0; iteration < 200; iteration += 1) {
    let moved = false;

    free.forEach((pos) => {
      const current = positions.get(pos);
      if (!current) {
        return;
      }

      all.forEach((otherPos) => {
        if (otherPos === pos) {
          return;
        }

        const other = positions.get(otherPos);
        if (!other) {
          return;
        }

        let dx = current.x - other.x;
        let dy = current.y - other.y;
        let distance = Math.hypot(dx, dy);

        if (distance >= required) {
          return;
        }

        if (distance < 0.01) {
          // Coincident points: separate along a deterministic direction.
          dx = pos < otherPos ? -1 : 1;
          dy = 0;
          distance = 1;
        }

        const share = paired.has(otherPos) ? 1 : 0.5;
        const push = (required - distance) * share * 0.5;
        current.x += (dx / distance) * push;
        current.y += (dy / distance) * push;
        moved = true;
      });
    });

    if (!moved) {
      break;
    }
  }

  return positions;
}

export function isAnticodonNucleotide(nucleotide: RnaNucleotide): boolean {
  const label = nucleotide.positionLabel ?? nucleotide.sprinzlLabel;
  return label !== undefined && ANTICODON_LABELS.has(label);
}

/** Spell a modification symbol the way it is printed in figures (psi -> Ψ). */
export function formatBubbleModification(symbol: string): string {
  return symbol.replace(/psi/g, "Ψ");
}

function estimateTextWidth(text: string, fontSize: number) {
  return Math.max(fontSize, text.length * fontSize * 0.6);
}

type Box = { left: number; right: number; top: number; bottom: number };

function boxesOverlap(a: Box, b: Box) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function boxHitsCircle(box: Box, center: BubblePoint, radius: number) {
  const nearestX = Math.max(box.left, Math.min(center.x, box.right));
  const nearestY = Math.max(box.top, Math.min(center.y, box.bottom));
  return Math.hypot(center.x - nearestX, center.y - nearestY) < radius;
}

function anchorFor(directionX: number): BubbleLabelPlacement["anchor"] {
  if (directionX > 0.35) {
    return "start";
  }

  if (directionX < -0.35) {
    return "end";
  }

  return "middle";
}

function labelBox(point: BubblePoint, anchor: BubbleLabelPlacement["anchor"], width: number, fontSize: number): Box {
  const left = anchor === "start" ? point.x : anchor === "end" ? point.x - width : point.x - width / 2;
  return {
    left: left - 1,
    right: left + width + 1,
    top: point.y - fontSize * 0.62,
    bottom: point.y + fontSize * 0.62,
  };
}

/**
 * Place one text label per requested nucleotide outside its bubble.
 * The preferred direction points away from the pairing partner (stems) or away
 * from the loop centre (unpaired bases). If that spot collides with a bubble or
 * an earlier label, nearby directions and larger distances are tried.
 */
export function buildBubbleLabelLayout(
  nucleotides: RnaNucleotide[],
  stems: RnaStem[],
  positions: Map<number, BubblePoint>,
  radius: number,
  labelTextByPos: Map<number, string>,
  fontSize = BUBBLE_LABEL_FONT_SIZE,
): Map<number, BubbleLabelPlacement> {
  const placements = new Map<number, BubbleLabelPlacement>();
  const drawable = nucleotides.filter((nucleotide) => isDrawable(nucleotide) && positions.has(nucleotide.pos));

  if (drawable.length === 0) {
    return placements;
  }

  const partnerByPos = new Map<number, number>();
  stems.forEach((stem) => {
    partnerByPos.set(stem.from, stem.to);
    partnerByPos.set(stem.to, stem.from);
  });

  const points = drawable.map((nucleotide) => positions.get(nucleotide.pos) as BubblePoint);
  const figureCentre = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };

  const regionCentres = new Map<string, BubblePoint>();
  const regionMembers = new Map<string, BubblePoint[]>();
  drawable.forEach((nucleotide) => {
    const key = nucleotide.region ?? "unassigned";
    const members = regionMembers.get(key) ?? [];
    members.push(positions.get(nucleotide.pos) as BubblePoint);
    regionMembers.set(key, members);
  });
  regionMembers.forEach((members, key) => {
    regionCentres.set(key, {
      x: members.reduce((sum, point) => sum + point.x, 0) / members.length,
      y: members.reduce((sum, point) => sum + point.y, 0) / members.length,
    });
  });

  const placedBoxes: Box[] = [];
  const angleOffsets = [0, 25, -25, 50, -50, 80, -80, 115, -115, 150, -150, 180];
  const distances = [radius + 13, radius + 22, radius + 32];

  [...labelTextByPos.keys()]
    .sort((left, right) => left - right)
    .forEach((pos) => {
      const nucleotide = drawable.find((candidate) => candidate.pos === pos);
      const origin = positions.get(pos);
      const text = labelTextByPos.get(pos);

      if (!nucleotide || !origin || !text) {
        return;
      }

      const partner = partnerByPos.get(pos);
      const partnerPoint = partner !== undefined ? positions.get(partner) : undefined;
      const reference = partnerPoint ?? regionCentres.get(nucleotide.region ?? "unassigned") ?? figureCentre;
      let dx = origin.x - reference.x;
      let dy = origin.y - reference.y;

      if (Math.hypot(dx, dy) < 6) {
        dx = origin.x - figureCentre.x;
        dy = origin.y - figureCentre.y;
      }

      if (Math.hypot(dx, dy) < 0.01) {
        dx = 0;
        dy = -1;
      }

      const baseAngle = Math.atan2(dy, dx);
      const width = estimateTextWidth(text, fontSize);
      let chosen: BubbleLabelPlacement | null = null;
      let fallback: BubbleLabelPlacement | null = null;
      let chosenBox: Box | null = null;

      for (const distance of distances) {
        for (const offset of angleOffsets) {
          const angle = baseAngle + (offset * Math.PI) / 180;
          const unitX = Math.cos(angle);
          const unitY = Math.sin(angle);
          const point = { x: origin.x + unitX * distance, y: origin.y + unitY * distance };
          const anchor = anchorFor(unitX);
          const box = labelBox(point, anchor, width, fontSize);
          const candidate: BubbleLabelPlacement = {
            x: point.x,
            y: point.y,
            anchor,
            leaderFrom: { x: origin.x + unitX * (radius + 2), y: origin.y + unitY * (radius + 2) },
            leaderTo: { x: origin.x + unitX * (distance - 4), y: origin.y + unitY * (distance - 4) },
          };

          if (!fallback) {
            fallback = candidate;
          }

          const hitsBubble = drawable.some((other) => {
            const centre = positions.get(other.pos) as BubblePoint;
            return boxHitsCircle(box, centre, radius + 1);
          });

          if (hitsBubble || placedBoxes.some((placed) => boxesOverlap(placed, box))) {
            continue;
          }

          chosen = candidate;
          chosenBox = box;
          break;
        }

        if (chosen) {
          break;
        }
      }

      const placement = chosen ?? fallback;
      if (!placement) {
        return;
      }

      placements.set(pos, placement);
      placedBoxes.push(chosenBox ?? labelBox({ x: placement.x, y: placement.y }, placement.anchor, width, fontSize));
    });

  return placements;
}
