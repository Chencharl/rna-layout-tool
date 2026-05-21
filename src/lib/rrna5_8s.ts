/**
 * 5.8S rRNA secondary-structure layout — fixed-coordinate approach.
 *
 * Every canonical nucleotide position has a hard-coded (x, y) derived from the
 * reference publication figure.  Variable-length sequences are handled by
 * extending the 5′ tail rather than recomputing the whole topology:
 *
 *   short 5.8S  (≤153 nt)  → align to the 3′ end of the table; truncated 5′ tail
 *   canonical   (153 nt)   → direct 1-to-1 mapping
 *   long  5.8S  (>153 nt)  → prepend extra 5′ positions above the canonical leader
 *
 * Canonical pairing map (1-based positions):
 *   Stem-A (8 bp):  52↔115, 53↔114, 54↔113, 55↔112, 56↔111, 57↔110, 58↔109, 59↔108
 *   Stem-B (9 bp):  61↔88,  62↔87,  63↔86,  64↔85,  65↔84,  66↔83,  67↔82,  68↔81,  69↔80
 *   Stem-D (6 bp):  116↔132, 117↔131, 118↔130, 119↔129, 120↔128, 121↔127
 */

import { getRenderableBase } from "./annotations";
import type { RnaNucleotide, RnaPairStatus, RnaStem } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RRNA_5_8S_CANONICAL_LENGTH = 153;

/** Minimum length before a "truncation" warning fires (5′ tail 11-12 nt short). */
const TRUNCATION_THRESHOLD = 141;

// Canonical vertical spacing for the 5′ leader and for extra 5′ positions added
// when the input sequence is longer than the canonical 153 nt.
const LEADER_X = 110;
const LEADER_Y_FIRST = 72;   // y of canonical position 1
const LEADER_SPACING = 24;   // px between consecutive leader nucleotides

// ---------------------------------------------------------------------------
// Fixed coordinate table — 153 positions, 1-indexed.
// Coordinates are (x, y) in SVG pixels on a 1280 × 900 canvas.
// Derived from the reference 5.8S rRNA secondary-structure figure.
// ---------------------------------------------------------------------------

/**
 * Canonical (x, y) for each position 1..153.
 * Index 0 is unused; canonical position p is at COORDS[p].
 */
const COORDS: ReadonlyArray<readonly [number, number]> = [
  /* 0 – placeholder */ [0, 0],

  // ── 5′ leader (1-21): near-vertical column at left edge ──────────────
  /* 1  */ [110,  72],
  /* 2  */ [115,  96],
  /* 3  */ [120, 121],
  /* 4  */ [106, 145],
  /* 5  */ [105, 170],
  /* 6  */ [103, 194],
  /* 7  */ [102, 220],
  /* 8  */ [101, 243],
  /* 9  */ [ 98, 268],
  /* 10 */ [ 98, 291],
  /* 11 */ [ 97, 316],
  /* 12 */ [ 96, 341],
  /* 13 */ [ 98, 365],
  /* 14 */ [ 99, 389],
  /* 15 */ [ 98, 414],
  /* 16 */ [ 96, 439],
  /* 17 */ [ 98, 462],
  /* 18 */ [103, 487],
  /* 19 */ [106, 511],
  /* 20 */ [111, 536],
  /* 21 */ [123, 556],

  // ── SS2 + SS3 arc (22-39): large hook sweeping to bottom-right ───────
  /* 22 */ [145, 570],
  /* 23 */ [166, 584],
  /* 24 */ [185, 598],
  /* 25 */ [206, 612],
  /* 26 */ [227, 625],
  /* 27 */ [249, 640],
  /* 28 */ [269, 653],
  /* 29 */ [290, 668],
  /* 30 */ [310, 680],
  /* 31 */ [331, 695],
  /* 32 */ [352, 709],
  /* 33 */ [370, 692],
  /* 34 */ [391, 677],
  /* 35 */ [413, 665],
  /* 36 */ [437, 655],
  /* 37 */ [460, 647],
  /* 38 */ [485, 642],
  /* 39 */ [510, 643],

  // ── SS3 / loop linker (40-51): climbing back left toward Stem-A ───────
  /* 40 */ [520, 620],
  /* 41 */ [520, 596],
  /* 42 */ [520, 572],
  /* 43 */ [493, 572],
  /* 44 */ [470, 581],
  /* 45 */ [446, 589],
  /* 46 */ [431, 608],
  /* 47 */ [407, 616],
  /* 48 */ [382, 612],
  /* 49 */ [364, 598],
  /* 50 */ [354, 574],
  /* 51 */ [359, 550],

  // ── Stem-A 5′ strand (52-59): diagonal, lower-left → upper-right ─────
  /* 52 */ [375, 531],
  /* 53 */ [400, 524],
  /* 54 */ [424, 528],
  /* 55 */ [446, 520],
  /* 56 */ [471, 511],
  /* 57 */ [467, 487],
  /* 58 */ [474, 462],
  /* 59 */ [489, 442],

  // ── j5p (60): junction to Stem-B ──────────────────────────────────────
  /* 60 */ [511, 430],

  // ── Stem-B 5′ strand (61-69): rightward arc, lower → upper ──────────
  /* 61 */ [537, 427],
  /* 62 */ [563, 434],
  /* 63 */ [592, 450],
  /* 64 */ [621, 466],
  /* 65 */ [644, 457],
  /* 66 */ [656, 438],
  /* 67 */ [655, 413],
  /* 68 */ [667, 393],
  /* 69 */ [679, 371],

  // ── Loop-B (70-79): arc at far-right of Stem-B ───────────────────────
  /* 70 */ [705, 373],
  /* 71 */ [728, 368],
  /* 72 */ [749, 357],
  /* 73 */ [768, 342],
  /* 74 */ [781, 322],
  /* 75 */ [790, 299],
  /* 76 */ [791, 276],
  /* 77 */ [789, 253],
  /* 78 */ [778, 231],
  /* 79 */ [764, 212],

  // ── Stem-B 3′ strand (80-88): returning leftward ─────────────────────
  /* 80 */ [744, 198],
  /* 81 */ [721, 189],
  /* 82 */ [697, 185],
  /* 83 */ [672, 187],
  /* 84 */ [651, 196],
  /* 85 */ [631, 211],
  /* 86 */ [615, 228],
  /* 87 */ [605, 250],
  /* 88 */ [600, 273],

  // ── SS-100 / j1_3p (89-107): arc descending from Stem-B ──────────────
  /* 89  */ [601, 296],
  /* 90  */ [608, 319],
  /* 91  */ [621, 339],
  /* 92  */ [609, 360],
  /* 93  */ [596, 381],
  /* 94  */ [626, 397],
  /* 95  */ [638, 376],
  /* 96  */ [651, 355],
  /* 97  */ [660, 378],
  /* 98  */ [660, 408],
  /* 99  */ [630, 495],
  /* 100 */ [627, 527],
  /* 101 */ [610, 553],
  /* 102 */ [586, 572],
  /* 103 */ [553, 572],
  /* 104 */ [586, 596],
  /* 105 */ [553, 596],
  /* 106 */ [585, 620],
  /* 107 */ [553, 620],

  // ── Stem-A 3′ strand (108-115): pairs with 52-59 (perpendicular offset)
  /* 108 */ [567, 537],
  /* 109 */ [551, 556],
  /* 110 */ [545, 581],
  /* 111 */ [548, 606],
  /* 112 */ [523, 615],
  /* 113 */ [501, 623],
  /* 114 */ [477, 618],
  /* 115 */ [452, 625],

  // ── Stem-D 5′ strand (116-121): sweeping down-right ──────────────────
  /* 116 */ [596, 644],
  /* 117 */ [620, 654],
  /* 118 */ [645, 663],
  /* 119 */ [665, 674],
  /* 120 */ [688, 686],
  /* 121 */ [702, 666],

  // ── Loop-D (122-126): small loop at outer end of Stem-D ──────────────
  /* 122 */ [718, 643],
  /* 123 */ [745, 637],
  /* 124 */ [769, 653],
  /* 125 */ [775, 681],
  /* 126 */ [757, 704],

  // ── Stem-D 3′ strand (127-132): returning inward ─────────────────────
  /* 127 */ [729, 685],
  /* 128 */ [716, 704],
  /* 129 */ [792, 773],
  /* 130 */ [813, 717],
  /* 131 */ [813, 758],
  /* 132 */ [834, 703],

  // ── SS4 / 3′ extension (133-153): sweeping to lower-right ────────────
  /* 133 */ [741, 723],
  /* 134 */ [774, 746],
  /* 135 */ [793, 732],
  /* 136 */ [853, 730],
  /* 137 */ [832, 784],
  /* 138 */ [853, 770],
  /* 139 */ [873, 756],
  /* 140 */ [873, 828],
  /* 141 */ [893, 742],
  /* 142 */ [914, 728],
  /* 143 */ [914, 686],
  /* 144 */ [934, 713],
  /* 145 */ [936, 673],
  /* 146 */ [954, 699],
  /* 147 */ [970, 810],
  /* 148 */ [978, 695],
  /* 149 */ [1017, 795],
  /* 150 */ [1042, 788],
  /* 151 */ [1066, 781],
  /* 152 */ [1163, 753],
  /* 153 */ [1257, 723],
];

// ---------------------------------------------------------------------------
// Canonical pairing map (1-based positions, 153-nt reference)
// ---------------------------------------------------------------------------

const CANONICAL_PAIRS: readonly [number, number][] = [
  // Stem-A (8 bp)
  [52, 115], [53, 114], [54, 113], [55, 112],
  [56, 111], [57, 110], [58, 109], [59, 108],
  // Stem-B (9 bp)
  [61, 88], [62, 87], [63, 86], [64, 85],
  [65, 84], [66, 83], [67, 82], [68, 81], [69, 80],
  // Stem-D (6 bp)
  [116, 132], [117, 131], [118, 130],
  [119, 129], [120, 128], [121, 127],
];

// ---------------------------------------------------------------------------
// Pair-status helper
// ---------------------------------------------------------------------------

function getPairStatus(a: string, b: string): RnaPairStatus {
  const p = `${a.toUpperCase()}-${b.toUpperCase()}`;
  if (["A-U", "U-A", "G-C", "C-G"].includes(p)) return "normal";
  if (p === "G-U" || p === "U-G") return "wobble";
  return "custom";
}

// ---------------------------------------------------------------------------
// Position label helper
// ---------------------------------------------------------------------------

function shouldLabel(canonicalPos: number): boolean {
  return canonicalPos === 1 || canonicalPos % 10 === 0 || canonicalPos === RRNA_5_8S_CANONICAL_LENGTH;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Bottom y of the canonical 153-nt layout (last SS5 position). */
const CANONICAL_BOTTOM_Y = COORDS[RRNA_5_8S_CANONICAL_LENGTH][1]; // 786
/** Top margin above the first nucleotide. */
const CANVAS_TOP_MARGIN = 40;
/** Bottom margin below the last nucleotide. */
const CANVAS_BOTTOM_MARGIN = 80;

/**
 * Build the nucleotide + stem layout for a 5.8S rRNA sequence.
 *
 * Alignment rules (all relative to canonical 153-nt coordinates):
 *
 *   seqLen == 153  → direct 1-to-1 mapping
 *   seqLen > 153   → extra (seqLen−153) nucleotides prepend the 5′ leader;
 *                    the whole structure shifts DOWN so the first extra position
 *                    lands at y = LEADER_Y_FIRST and the topology never changes
 *   seqLen < 153   → truncated 5′ tail; sequence starts at canonical pos
 *                    (154 − seqLen) so the structural core is always placed
 *
 * Modifications arrive via the annotation layer only.
 *
 * Returns `recommendedCanvasHeight` so callers can resize the SVG canvas to fit.
 */
export function buildRrna5_8sLayout(sequence: string[]): {
  nucleotides: RnaNucleotide[];
  stems: RnaStem[];
  warnings: string[];
  recommendedCanvasHeight: number;
} {
  const seqLen = sequence.length;
  const warnings: string[] = [];

  // ── Warning thresholds ──────────────────────────────────────────────────
  if (seqLen > RRNA_5_8S_CANONICAL_LENGTH + 40) {
    warnings.push(
      `Sequence is ${seqLen} nt — ${seqLen - RRNA_5_8S_CANONICAL_LENGTH} nt longer than the ` +
      `${RRNA_5_8S_CANONICAL_LENGTH}-nt canonical 5.8S template. ` +
      `Extra 5′ positions have been added above the leader.`,
    );
  }

  if (seqLen < TRUNCATION_THRESHOLD) {
    warnings.push(
      `Sequence is ${seqLen} nt — likely a 5′-truncated isoform ` +
      `(${RRNA_5_8S_CANONICAL_LENGTH - seqLen} nt shorter than canonical). ` +
      `The 5′ tail is absent from the figure.`,
    );
  }

  // ── Canonical offset ──────────────────────────────────────────────────────
  // extra > 0  → long form (prepend extra positions)
  // extra < 0  → truncation (skip first |extra| canonical positions)
  const extra = seqLen - RRNA_5_8S_CANONICAL_LENGTH;
  const canonicalStart = 1 - extra; // canonical position that aligns to seq idx 0

  // ── y-shift for long-form sequences ──────────────────────────────────────
  // When extra > 0 we shift every coordinate DOWN so the first extra position
  // lands at y = LEADER_Y_FIRST (same as canonical pos 1) and the entire
  // structural core moves with it — topology never changes.
  const yShift = extra > 0 ? extra * LEADER_SPACING : 0;

  // ── Recommended canvas height ─────────────────────────────────────────────
  const bottomY = CANONICAL_BOTTOM_Y + yShift;
  const recommendedCanvasHeight = bottomY + CANVAS_BOTTOM_MARGIN;

  // ── Build nucleotides ────────────────────────────────────────────────────
  const nucleotides: RnaNucleotide[] = sequence.map((token, idx) => {
    const canPos = canonicalStart + idx; // 1-based canonical position
    const base = getRenderableBase(token) || token;

    let x: number;
    let y: number;
    let posLabel: string | undefined;

    if (canPos >= 1 && canPos <= RRNA_5_8S_CANONICAL_LENGTH) {
      // Within the canonical table — apply yShift for long forms
      [x, y] = COORDS[canPos];
      y += yShift;
      posLabel = shouldLabel(canPos) ? String(canPos) : undefined;
    } else if (canPos < 1) {
      // Extra 5′ nucleotides prepended above canonical pos 1.
      // idx=0 lands at LEADER_Y_FIRST; each step below adds LEADER_SPACING.
      // (canonical pos 1 will be at LEADER_Y_FIRST + extra*LEADER_SPACING = COORDS[1] + yShift)
      x = LEADER_X;
      y = LEADER_Y_FIRST + idx * LEADER_SPACING;
      // Label every 10th sequence position
      posLabel = (idx + 1) % 10 === 0 ? String(idx + 1) : undefined;
    } else {
      // canPos > canonical length — safety fallback (should not be reached)
      x = COORDS[RRNA_5_8S_CANONICAL_LENGTH][0] + (canPos - RRNA_5_8S_CANONICAL_LENGTH) * 20;
      y = COORDS[RRNA_5_8S_CANONICAL_LENGTH][1] + yShift;
      posLabel = undefined;
    }

    return {
      pos: idx + 1,
      base,
      x,
      y,
      sequenceIndex: idx + 1,
      originalToken: token,
      positionLabel: posLabel,
      status: "present" as const,
      visible: true,
    };
  });

  // ── Build stems ───────────────────────────────────────────────────────────
  // Remap canonical pair positions to sequence positions via the same offset.
  const seqPosByCanonical = new Map<number, number>();
  for (let idx = 0; idx < seqLen; idx++) {
    const canPos = canonicalStart + idx;
    if (canPos >= 1 && canPos <= RRNA_5_8S_CANONICAL_LENGTH) {
      seqPosByCanonical.set(canPos, idx + 1); // seq pos = idx+1
    }
  }

  const nucleotideBySeqPos = new Map(nucleotides.map((n) => [n.pos, n]));

  const stems: RnaStem[] = [];
  for (const [canA, canB] of CANONICAL_PAIRS) {
    const seqA = seqPosByCanonical.get(canA);
    const seqB = seqPosByCanonical.get(canB);
    if (seqA === undefined || seqB === undefined) continue;

    const nA = nucleotideBySeqPos.get(seqA);
    const nB = nucleotideBySeqPos.get(seqB);
    if (!nA || !nB) continue;

    stems.push({
      from: seqA,
      to: seqB,
      pairStatus: getPairStatus(nA.base, nB.base),
    });
  }

  return { nucleotides, stems, warnings, recommendedCanvasHeight };
}
