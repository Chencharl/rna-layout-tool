import { getRenderableBase } from "./annotations";
import { buildRadialLayout } from "./radialLayout";
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

/**
 * Reference used for the fixed 5S template.
 *
 * Sequence: human 5S rRNA, positions 1-120 (GenBank X71804.1, the human entry
 * in the Rfam RF00001 seed alignment; the seed covers 1-119 and position 120 is
 * the next U of the mature 3' end).
 * Structure: Rfam RF00001 consensus secondary structure (published structure,
 * PMID 11283358) projected onto that sequence. 34 base pairs: 30 Watson-Crick
 * and 4 G-U on the human sequence. Position 120 is unpaired.
 *
 * The pairing is taken from the reference, never predicted here.
 */
export const RRNA_5S_REFERENCE_SEQUENCE =
  "GUCUACGGCCAUACCACCCUGAACGCGCCCGAUCUCGUCUGAUCUCGGAAGCUAAGCAGGGUCGGGCCUGGUUAGUACUUGGAUGGGAGACCGCCUGGGAAUACCGGGUGCUGUAGGCUU";
export const RRNA_5S_REFERENCE_STRUCTURE =
  "(((((((((....((.(((((...((..((((((......))..))))..))....)))))..))(((.((....(.((.....((....)).....)).)..)).))))))))))))..";

// Spacing for the text themes; the Bubble theme re-arranges from the same pairs.
const TEMPLATE_SPACING = 27;
const TEMPLATE_PAIR_WIDTH = 60;
const TEMPLATE_CANVAS = { width: 1280, height: 980 };

function shouldShowPositionLabel(position: number) {
  return position === 1 || position % 10 === 0 || position === RRNA_5S_LENGTH;
}

function parseReferencePairs(structure: string): Array<number | null> {
  const partner: Array<number | null> = Array.from({ length: structure.length }, () => null);
  const stack: number[] = [];

  structure.split("").forEach((symbol, index) => {
    if (symbol === "(") {
      stack.push(index);
    } else if (symbol === ")") {
      const open = stack.pop();
      if (open === undefined) {
        throw new Error("5S rRNA reference structure is unbalanced.");
      }
      partner[open] = index;
      partner[index] = open;
    }
  });

  if (stack.length > 0) {
    throw new Error("5S rRNA reference structure is unbalanced.");
  }

  return partner;
}

/** Region of every position, derived from the reference pairing. */
function classifyRegions(partner: Array<number | null>): Array<Rrna5STemplateRow["region"]> {
  const count = partner.length;
  const regions: Array<Rrna5STemplateRow["region"]> = Array.from({ length: count }, () => "junction");
  // Enclosing pair (index of its 5' base) for every position, or -1 for the exterior.
  const enclosing: number[] = Array.from({ length: count }, () => -1);
  const stack: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const mate = partner[index];
    if (mate !== null && mate < index) {
      stack.pop();
    }
    enclosing[index] = stack.length > 0 ? stack[stack.length - 1] : -1;
    if (mate !== null && mate > index) {
      stack.push(index);
    }
  }

  // Helices that continue the exterior-closing stack form the terminal stem.
  const terminal = new Set<number>();
  for (let index = 0; index < count; index += 1) {
    const mate = partner[index];
    if (mate === null || mate < index) {
      continue;
    }
    const parent = enclosing[index];
    const stacksOnParent = parent >= 0 && parent + 1 === index && (partner[parent] as number) - 1 === mate;
    if (parent === -1 || (stacksOnParent && terminal.has(parent))) {
      terminal.add(index);
    }
    const region = terminal.has(index) ? "terminal_stem" : "internal_stem";
    regions[index] = region;
    regions[mate] = region;
  }

  for (let index = 0; index < count; index += 1) {
    if (partner[index] !== null) {
      continue;
    }

    const open = enclosing[index];
    if (open === -1) {
      regions[index] = "junction";
      continue;
    }

    const close = partner[open] as number;
    let helices = 0;
    let unpairedBefore = 0;
    let unpairedAfter = 0;
    let cursor = open + 1;
    while (cursor < close) {
      const mate = partner[cursor];
      if (mate !== null && mate > cursor) {
        helices += 1;
        cursor = mate + 1;
      } else {
        if (helices === 0) {
          unpairedBefore += 1;
        } else {
          unpairedAfter += 1;
        }
        cursor += 1;
      }
    }

    if (helices === 0) {
      regions[index] = "hairpin_loop";
    } else if (helices === 1) {
      regions[index] = unpairedBefore === 0 || unpairedAfter === 0 ? "bulge" : "internal_loop";
    } else {
      regions[index] = "junction";
    }
  }

  return regions;
}

function buildTemplateRows(): Rrna5STemplateRow[] {
  if (
    RRNA_5S_REFERENCE_SEQUENCE.length !== RRNA_5S_LENGTH ||
    RRNA_5S_REFERENCE_STRUCTURE.length !== RRNA_5S_LENGTH
  ) {
    throw new Error("5S rRNA reference sequence and structure must both be 120 positions long.");
  }

  const partner = parseReferencePairs(RRNA_5S_REFERENCE_STRUCTURE);
  const regions = classifyRegions(partner);
  const nodes = Array.from({ length: RRNA_5S_LENGTH }, (_, index) => ({
    pos: index + 1,
    base: RRNA_5S_REFERENCE_SEQUENCE[index],
    x: 0,
    y: 0,
  }));
  const stems = partner.flatMap((mate, index) =>
    mate !== null && mate > index ? [{ from: index + 1, to: mate + 1 }] : [],
  );
  const layout = buildRadialLayout(nodes, stems, TEMPLATE_SPACING, TEMPLATE_PAIR_WIDTH);

  if (!layout) {
    throw new Error("5S rRNA template could not be laid out from the reference structure.");
  }

  const offsetX = (TEMPLATE_CANVAS.width - layout.width) / 2;
  const offsetY = (TEMPLATE_CANVAS.height - layout.height) / 2;

  return nodes.map((node, index) => {
    const point = layout.positions.get(node.pos);
    const mate = partner[index];

    if (!point) {
      throw new Error(`5S rRNA template is missing position ${node.pos}.`);
    }

    return {
      position: node.pos,
      base: node.base as Rrna5STemplateRow["base"],
      x: Math.round(point.x + offsetX),
      y: Math.round(point.y + offsetY),
      paired_with: mate === null ? null : mate + 1,
      region: regions[index],
      label: shouldShowPositionLabel(node.pos) ? String(node.pos) : undefined,
    };
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
