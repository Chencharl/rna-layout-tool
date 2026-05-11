import { getRenderableBase } from "./annotations";
import type { RnaNucleotide, RnaPairStatus, RnaStem } from "./types";

export type Rrna5STemplateRow = {
  position: number;
  base: "A" | "C" | "G" | "U";
  x: number;
  y: number;
  paired_with: number | null;
  region:
    | "terminal_stem"
    | "internal_stem"
    | "hairpin_loop"
    | "internal_loop"
    | "bulge"
    | "junction";
  label?: string;
};

export type RrnaStructureAnnotation = {
  position?: number;
  annotation_type:
    | "modification"
    | "bisulfite_shift"
    | "five_prime_chemistry"
    | "three_prime_heterogeneity"
    | "isoform"
    | "truncation"
    | "extension";
  label: string;
  color_group?: string;
  note?: string;
};

const RRNA_5S_LENGTH = 120;
const BASE_PATTERN = ["G", "C", "U", "A"] as const;

function baseForPosition(position: number): Rrna5STemplateRow["base"] {
  return BASE_PATTERN[(position - 1) % BASE_PATTERN.length];
}

function shouldShowPositionLabel(position: number) {
  return position === 1 || position % 10 === 0 || position === RRNA_5S_LENGTH;
}

function makeRow(
  position: number,
  x: number,
  y: number,
  region: Rrna5STemplateRow["region"],
): Rrna5STemplateRow {
  return {
    position,
    base: baseForPosition(position),
    x: Math.round(x),
    y: Math.round(y),
    paired_with: null,
    region,
    label: shouldShowPositionLabel(position) ? String(position) : undefined,
  };
}

function addStem(
  rows: Map<number, Rrna5STemplateRow>,
  fivePrimePositions: number[],
  threePrimePositions: number[],
  xLeft: number,
  xRight: number,
  yStart: number,
  yStep: number,
  region: Rrna5STemplateRow["region"],
) {
  fivePrimePositions.forEach((position, index) => {
    const partner = threePrimePositions[index];
    const y = yStart + index * yStep;
    const left = makeRow(position, xLeft, y, region);
    const right = makeRow(partner, xRight, y, region);

    left.paired_with = partner;
    right.paired_with = position;
    rows.set(position, left);
    rows.set(partner, right);
  });
}

function addLine(
  rows: Map<number, Rrna5STemplateRow>,
  positions: number[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  region: Rrna5STemplateRow["region"],
) {
  positions.forEach((position, index) => {
    const t = positions.length === 1 ? 0 : index / (positions.length - 1);
    rows.set(
      position,
      makeRow(
        position,
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t,
        region,
      ),
    );
  });
}

function addArc(
  rows: Map<number, Rrna5STemplateRow>,
  positions: number[],
  center: { x: number; y: number },
  radius: { x: number; y: number },
  startDegrees: number,
  endDegrees: number,
  region: Rrna5STemplateRow["region"],
) {
  positions.forEach((position, index) => {
    const t = positions.length === 1 ? 0 : index / (positions.length - 1);
    const degrees = startDegrees + (endDegrees - startDegrees) * t;
    const radians = (degrees * Math.PI) / 180;

    rows.set(
      position,
      makeRow(
        position,
        center.x + Math.cos(radians) * radius.x,
        center.y + Math.sin(radians) * radius.y,
        region,
      ),
    );
  });
}

function buildTemplateRows() {
  const rows = new Map<number, Rrna5STemplateRow>();

  addStem(rows, [1, 2, 3, 4, 5, 6, 7, 8], [120, 119, 118, 117, 116, 115, 114, 113], 280, 360, 340, 28, "terminal_stem");
  addLine(rows, [9, 10, 11, 12, 13, 14], { x: 300, y: 590 }, { x: 470, y: 595 }, "internal_loop");

  addStem(rows, [15, 16, 17, 18, 19, 20, 21, 22], [54, 53, 52, 51, 50, 49, 48, 47], 510, 590, 545, -28, "internal_stem");
  addLine(rows, [23, 24], { x: 485, y: 315 }, { x: 455, y: 275 }, "bulge");
  addStem(rows, [25, 26, 27, 28, 29, 30, 31], [45, 44, 43, 42, 41, 40, 39], 420, 500, 245, -28, "internal_stem");
  addArc(rows, [32, 33, 34, 35, 36, 37, 38], { x: 460, y: 52 }, { x: 72, y: 54 }, 160, -160, "hairpin_loop");
  rows.set(46, makeRow(46, 535, 300, "bulge"));

  addLine(rows, [55, 56, 57, 58, 59, 60], { x: 625, y: 555 }, { x: 700, y: 605 }, "junction");
  addStem(rows, [61, 62, 63, 64, 65, 66, 67, 68], [99, 98, 97, 96, 95, 94, 93, 92], 700, 780, 630, 28, "internal_stem");
  addLine(rows, [69, 70], { x: 820, y: 840 }, { x: 865, y: 815 }, "bulge");
  addStem(rows, [71, 72, 73, 74, 75, 76, 77], [89, 88, 87, 86, 85, 84, 83], 880, 960, 790, -28, "internal_stem");
  addArc(rows, [78, 79, 80, 81, 82], { x: 920, y: 575 }, { x: 88, y: 54 }, 145, -145, "hairpin_loop");
  addLine(rows, [90, 91], { x: 865, y: 815 }, { x: 805, y: 826 }, "bulge");

  addStem(rows, [100, 101, 102, 103, 104, 105], [112, 111, 110, 109, 108, 107], 765, 845, 530, -28, "internal_stem");
  rows.set(106, makeRow(106, 805, 342, "hairpin_loop"));

  return Array.from({ length: RRNA_5S_LENGTH }, (_, index) => {
    const position = index + 1;
    const row = rows.get(position);

    if (!row) {
      throw new Error(`5S rRNA template is missing position ${position}.`);
    }

    return row;
  });
}

export const RRNA_5S_TEMPLATE_ROWS: Rrna5STemplateRow[] = buildTemplateRows();

function getPairStatus(left: string, right: string): RnaPairStatus {
  const pair = `${left.toUpperCase()}-${right.toUpperCase()}`;

  if (["A-U", "U-A", "G-C", "C-G"].includes(pair)) {
    return "normal";
  }

  if (pair === "G-U" || pair === "U-G") {
    return "wobble";
  }

  return "custom";
}

export function buildRrna5SLayout(sequence: string[]) {
  const isLengthMatched = sequence.length === RRNA_5S_LENGTH;
  const warnings = isLengthMatched
    ? []
    : [
        `5S rRNA template expects ${RRNA_5S_LENGTH} positions, but the sequence has ${sequence.length}. Showing the fixed template without partial sequence mapping.`,
      ];
  const nucleotides: RnaNucleotide[] = RRNA_5S_TEMPLATE_ROWS.map((row) => {
    const token = isLengthMatched ? sequence[row.position - 1] : row.base;

    return {
      pos: row.position,
      base: getRenderableBase(token) || row.base,
      x: row.x,
      y: row.y,
      sequenceIndex: isLengthMatched ? row.position : undefined,
      originalToken: isLengthMatched ? token : row.base,
      positionLabel: row.label,
      region: row.region,
      status: isLengthMatched ? "present" : "inferred",
      visible: true,
    };
  });
  const nucleotideByPos = new Map(nucleotides.map((nucleotide) => [nucleotide.pos, nucleotide]));
  const stems: RnaStem[] = RRNA_5S_TEMPLATE_ROWS.flatMap((row) => {
    if (!row.paired_with || row.position > row.paired_with) {
      return [];
    }

    const left = nucleotideByPos.get(row.position);
    const right = nucleotideByPos.get(row.paired_with);

    if (!left || !right) {
      return [];
    }

    return [
      {
        from: row.position,
        to: row.paired_with,
        pairStatus: getPairStatus(left.base, right.base),
      },
    ];
  });

  return {
    nucleotides,
    stems,
    warnings,
  };
}
