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
const LEADER_X = 85;
const LEADER_Y_FIRST = 78;   // y of canonical position 1
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

  // ── 5′ leader (1-21): straight vertical line ──────────────────────────
  /* 1  */ [85, 78],
  /* 2  */ [85, 102],
  /* 3  */ [85, 126],
  /* 4  */ [85, 150],
  /* 5  */ [85, 174],
  /* 6  */ [85, 198],
  /* 7  */ [85, 222],
  /* 8  */ [85, 246],
  /* 9  */ [85, 270],
  /* 10 */ [85, 294],
  /* 11 */ [85, 318],
  /* 12 */ [85, 342],
  /* 13 */ [85, 366],
  /* 14 */ [85, 390],
  /* 15 */ [85, 414],
  /* 16 */ [85, 438],
  /* 17 */ [85, 462],
  /* 18 */ [85, 486],
  /* 19 */ [85, 510],
  /* 20 */ [85, 534],
  /* 21 */ [85, 558],

  // ── SS2 arc (22-40): large sweep at bottom-left ───────────────────────
  // Ellipse: center=(291,607), rx=199, ry=123, sweeping 200° → -20°
  /* 22 */ [104, 565],
  /* 23 */ [94,  590],
  /* 24 */ [93,  617],
  /* 25 */ [101, 642],
  /* 26 */ [117, 667],
  /* 27 */ [141, 688],
  /* 28 */ [173, 706],
  /* 29 */ [209, 719],
  /* 30 */ [249, 727],
  /* 31 */ [291, 730],
  /* 32 */ [333, 727],
  /* 33 */ [373, 719],
  /* 34 */ [409, 706],
  /* 35 */ [441, 688],
  /* 36 */ [465, 667],
  /* 37 */ [481, 642],
  /* 38 */ [489, 617],
  /* 39 */ [488, 590],
  /* 40 */ [478, 565],

  // ── SS3 linker (41-51): diagonal from arc end to Stem-A outer ─────────
  /* 41 */ [484, 554],
  /* 42 */ [490, 543],
  /* 43 */ [496, 533],
  /* 44 */ [502, 522],
  /* 45 */ [509, 511],
  /* 46 */ [515, 501],
  /* 47 */ [521, 490],
  /* 48 */ [527, 479],
  /* 49 */ [534, 469],
  /* 50 */ [540, 458],
  /* 51 */ [546, 447],

  // ── Stem-A 5′ strand (52-59): going up-right, outer → inner ──────────
  // Each pair (52↔115 … 59↔108) shares the same y; dx=55 between strands.
  /* 52 */ [546, 447],
  /* 53 */ [551, 425],
  /* 54 */ [556, 403],
  /* 55 */ [561, 381],
  /* 56 */ [566, 359],
  /* 57 */ [571, 337],
  /* 58 */ [576, 315],
  /* 59 */ [581, 293],

  // ── j5p (60): junction connector ──────────────────────────────────────
  /* 60 */ [531, 284],

  // ── Stem-B 5′ strand (61-69): vertical, going up ─────────────────────
  /* 61 */ [490, 275],
  /* 62 */ [490, 257],
  /* 63 */ [490, 238],
  /* 64 */ [490, 220],
  /* 65 */ [490, 201],
  /* 66 */ [490, 183],
  /* 67 */ [490, 164],
  /* 68 */ [490, 146],
  /* 69 */ [490, 128],

  // ── Loop-B (70-79): arc at top of Stem-B ─────────────────────────────
  // Ellipse: center=(522,128), rx=32, ry=72, sweeping 180° → 360°
  /* 70 */ [490, 128],
  /* 71 */ [492, 104],
  /* 72 */ [497, 83],
  /* 73 */ [506, 67],
  /* 74 */ [516, 59],
  /* 75 */ [528, 59],
  /* 76 */ [538, 67],
  /* 77 */ [547, 83],
  /* 78 */ [553, 104],
  /* 79 */ [555, 128],

  // ── Stem-B 3′ strand (80-88): vertical, going down ───────────────────
  /* 80 */ [555, 128],
  /* 81 */ [555, 146],
  /* 82 */ [555, 165],
  /* 83 */ [555, 183],
  /* 84 */ [555, 201],
  /* 85 */ [555, 220],
  /* 86 */ [555, 238],
  /* 87 */ [555, 257],
  /* 88 */ [555, 275],

  // ── SS-100 / j1_3p (89-107): large D-shaped arc, right side ──────────
  // Ellipse: center=(595,280), rx=40, ry=380, sweeping 180° → 0°
  /* 89  */ [555, 280],
  /* 90  */ [556, 346],
  /* 91  */ [557, 410],
  /* 92  */ [560, 470],
  /* 93  */ [564, 524],
  /* 94  */ [569, 571],
  /* 95  */ [575, 609],
  /* 96  */ [581, 637],
  /* 97  */ [588, 654],
  /* 98  */ [595, 660],
  /* 99  */ [602, 654],
  /* 100 */ [609, 637],
  /* 101 */ [615, 609],
  /* 102 */ [621, 571],
  /* 103 */ [626, 524],
  /* 104 */ [630, 470],
  /* 105 */ [633, 410],
  /* 106 */ [634, 346],
  /* 107 */ [635, 280],

  // ── Stem-A 3′ strand (108-115): going down-left, inner → outer ───────
  // Pairs with 5′ strand at identical y; dx=55 separating the two strands.
  /* 108 */ [636, 293],
  /* 109 */ [631, 315],
  /* 110 */ [626, 337],
  /* 111 */ [621, 359],
  /* 112 */ [616, 381],
  /* 113 */ [611, 403],
  /* 114 */ [606, 425],
  /* 115 */ [601, 447],

  // ── Stem-D 5′ strand (116-121): diagonal, inner → outer ──────────────
  // Direction (+40,+28) per step; 3′ strand offset (+29,−41) perpendicular.
  /* 116 */ [640, 473],
  /* 117 */ [680, 501],
  /* 118 */ [720, 529],
  /* 119 */ [760, 557],
  /* 120 */ [800, 585],
  /* 121 */ [840, 613],

  // ── Loop-D (122-126): small arc at outer end of Stem-D ───────────────
  /* 122 */ [849, 619],
  /* 123 */ [862, 627],
  /* 124 */ [875, 625],
  /* 125 */ [882, 613],
  /* 126 */ [879, 597],

  // ── Stem-D 3′ strand (127-132): diagonal, outer → inner ──────────────
  /* 127 */ [869, 572],
  /* 128 */ [829, 544],
  /* 129 */ [789, 516],
  /* 130 */ [749, 488],
  /* 131 */ [709, 460],
  /* 132 */ [669, 432],

  // ── SS4 (133-149): trailing single-stranded region ────────────────────
  /* 133 */ [698, 450],
  /* 134 */ [727, 469],
  /* 135 */ [756, 487],
  /* 136 */ [785, 505],
  /* 137 */ [814, 523],
  /* 138 */ [843, 541],
  /* 139 */ [872, 560],
  /* 140 */ [901, 578],
  /* 141 */ [930, 596],
  /* 142 */ [959, 614],
  /* 143 */ [988, 632],
  /* 144 */ [1017, 650],
  /* 145 */ [1046, 668],
  /* 146 */ [1075, 687],
  /* 147 */ [1104, 705],
  /* 148 */ [1133, 723],
  /* 149 */ [1162, 741],

  // ── SS5 (150-153): 3′ tail ────────────────────────────────────────────
  /* 150 */ [1191, 759],
  /* 151 */ [1210, 768],
  /* 152 */ [1229, 777],
  /* 153 */ [1248, 786],
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
