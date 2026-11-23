/**
 * 5.8S rRNA secondary-structure layout.
 *
 * The template is a pairing map over 153 canonical positions. Coordinates are
 * generated from that pairing (stacked pairs as ladders, loops as circles, the
 * long unpaired exterior on an open ring), so every theme gets a layout without
 * overlapping positions. Nothing is predicted: the pairs are fixed below.
 *
 * Input is first aligned to the 153-nt reference sequence by identity, so the
 * mature 157-nt human 5.8S maps with 1 extra 5′ and 3 extra 3′ positions.
 * When the input does not resemble the reference, the 3′ ends are aligned:
 *   short 5.8S  (≤153 nt)  → 5′-truncated; canonical numbering is kept
 *   canonical   (153 nt)   → direct 1-to-1 mapping
 *   long  5.8S  (>153 nt)  → extra 5′ positions, drawn unpaired
 *
 * Canonical pairing map (1-based positions):
 *   Stem-A (8 bp):  52↔115, 53↔114, 54↔113, 55↔112, 56↔111, 57↔110, 58↔109, 59↔108
 *   Stem-B (9 bp):  61↔88,  62↔87,  63↔86,  64↔85,  65↔84,  66↔83,  67↔82,  68↔81,  69↔80
 *   Stem-D (6 bp):  116↔132, 117↔131, 118↔130, 119↔129, 120↔128, 121↔127
 */

import { getRenderableBase } from "./annotations";
import { buildRadialLayout } from "./radialLayout";
import type { RnaNucleotide, RnaPairStatus, RnaStem } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RRNA_5_8S_CANONICAL_LENGTH = 153;

/**
 * Sequence that the 153 canonical positions correspond to: human 5.8S rRNA,
 * GenBank U13369.1 positions 6624-6776 (the human entry in the Rfam RF00002
 * seed alignment). The mature 157-nt human 5.8S has one more base at the 5′ end
 * and three more (CUU) at the 3′ end. Every template pair is Watson-Crick or
 * G-U on this sequence. Input sequences are aligned to it by identity so that
 * extra bases at either end do not shift the template.
 */
export const RRNA_5_8S_REFERENCE_SEQUENCE =
  "GACUCUUAGCGGUGGAUCACUCGGCUCGUGCGUCGAUGAAGAACGCAGCUAGCUGCGAGAAUUAAUGUGAAUUGCAGGACACAUUGAUCAUCGACACUUCGAACGCACUUGCGGCCCCGGGUUCCUCCCGGGGCUACGCCUGUCUGAGCGUCG";

/** Minimum identity over the overlap for sequence-based alignment to be trusted. */
const ALIGNMENT_MIN_IDENTITY = 0.8;

/** Minimum length before a "truncation" warning fires (5′ tail 11-12 nt short). */
const TRUNCATION_THRESHOLD = 141;

// Spacing for the text themes; the Bubble theme re-arranges from the same pairs.
const TEMPLATE_SPACING = 25;
const TEMPLATE_PAIR_WIDTH = 56;
const TEMPLATE_CANVAS = { width: 1280, height: 980 };

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

/**
 * Canonical position aligned to the first input base.
 *
 * Tries every offset with a large enough overlap and keeps the one with the
 * most identical bases, provided identity over the overlap is high. Otherwise
 * the 3′ ends are aligned (the rule this template used before).
 */
function findCanonicalStart(sequence: string[]): number {
  const seqLen = sequence.length;
  const threePrimeAligned = 1 - (seqLen - RRNA_5_8S_CANONICAL_LENGTH);
  const bases = sequence.map((token) => (getRenderableBase(token) || token).toUpperCase());
  const minimumOverlap = Math.ceil(Math.min(seqLen, RRNA_5_8S_CANONICAL_LENGTH) * 0.8);
  const score = (start: number) => {
    let overlap = 0;
    let matches = 0;
    for (let idx = 0; idx < seqLen; idx += 1) {
      const canPos = start + idx;
      if (canPos < 1 || canPos > RRNA_5_8S_CANONICAL_LENGTH) {
        continue;
      }
      overlap += 1;
      if (bases[idx] === RRNA_5_8S_REFERENCE_SEQUENCE[canPos - 1]) {
        matches += 1;
      }
    }
    return { overlap, matches };
  };

  let best = threePrimeAligned;
  let bestMatches = -1;
  const fallbackScore = score(threePrimeAligned);
  if (
    fallbackScore.overlap >= minimumOverlap &&
    fallbackScore.matches / fallbackScore.overlap >= ALIGNMENT_MIN_IDENTITY
  ) {
    bestMatches = fallbackScore.matches;
  }

  for (let start = 2 - seqLen; start <= RRNA_5_8S_CANONICAL_LENGTH; start += 1) {
    const { overlap, matches } = score(start);
    if (overlap < minimumOverlap || matches / overlap < ALIGNMENT_MIN_IDENTITY) {
      continue;
    }
    // Strictly better only, so the 3′-aligned offset wins ties.
    if (matches > bestMatches) {
      best = start;
      bestMatches = matches;
    }
  }

  return best;
}

/**
 * Build the nucleotide + stem layout for a 5.8S rRNA sequence.
 *
 * Coordinates come from the pairing map, not from a hand-entered table, so the
 * same routine serves the canonical form, 5′-extended and 5′-truncated forms and
 * the mature form with a 3′ extension. Extra positions outside the 153 canonical
 * ones are drawn unpaired.
 *
 * Modifications arrive via the annotation layer only.
 *
 * Returns the canvas size needed to show the whole figure.
 */
export function buildRrna5_8sLayout(sequence: string[]): {
  nucleotides: RnaNucleotide[];
  stems: RnaStem[];
  warnings: string[];
  recommendedCanvasHeight: number;
  recommendedCanvasWidth: number;
} {
  const seqLen = sequence.length;
  const warnings: string[] = [];

  // ── Warning thresholds ──────────────────────────────────────────────────
  if (seqLen > RRNA_5_8S_CANONICAL_LENGTH + 40) {
    warnings.push(
      `Sequence is ${seqLen} nt — ${seqLen - RRNA_5_8S_CANONICAL_LENGTH} nt longer than the ` +
      `${RRNA_5_8S_CANONICAL_LENGTH}-nt canonical 5.8S template. ` +
      `Extra positions are drawn unpaired.`,
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
  // canonicalStart is the canonical position that aligns to sequence index 0.
  // Preferred: slide the input along the reference sequence and take the offset
  // with the most identical bases. Fallback (unrelated or heavily edited input):
  // align the 3′ ends, so a longer input gains extra 5′ positions and a shorter
  // one is treated as 5′-truncated.
  const canonicalStart = findCanonicalStart(sequence);
  const extraFivePrime = Math.max(0, 1 - canonicalStart);
  const extraThreePrime = Math.max(0, canonicalStart + seqLen - 1 - RRNA_5_8S_CANONICAL_LENGTH);

  if (extraThreePrime > 0) {
    warnings.push(
      `Aligned to the ${RRNA_5_8S_CANONICAL_LENGTH}-nt reference by sequence: ` +
      `${extraFivePrime} extra 5′ and ${extraThreePrime} extra 3′ position${extraThreePrime === 1 ? "" : "s"} are drawn unpaired.`,
    );
  }

  // ── Nucleotides (coordinates filled in below) ────────────────────────────
  const drafts = sequence.map((token, idx) => {
    const canPos = canonicalStart + idx; // 1-based canonical position
    const insideTemplate = canPos >= 1 && canPos <= RRNA_5_8S_CANONICAL_LENGTH;
    // Canonical ticks inside the template; every 10th sequence position on a 5′ extension.
    const posLabel = insideTemplate
      ? shouldLabel(canPos)
        ? String(canPos)
        : undefined
      : canPos < 1 && (idx + 1) % 10 === 0
        ? String(idx + 1)
        : undefined;

    return {
      pos: idx + 1,
      base: getRenderableBase(token) || token,
      x: 0,
      y: 0,
      sequenceIndex: idx + 1,
      originalToken: token,
      positionLabel: posLabel,
      status: "present" as const,
      visible: true,
      canPos,
    };
  });

  // ── Stems ─────────────────────────────────────────────────────────────────
  // Remap canonical pair positions to sequence positions via the same offset.
  const seqPosByCanonical = new Map<number, number>();
  drafts.forEach((draft) => {
    if (draft.canPos >= 1 && draft.canPos <= RRNA_5_8S_CANONICAL_LENGTH) {
      seqPosByCanonical.set(draft.canPos, draft.pos);
    }
  });

  const draftBySeqPos = new Map(drafts.map((draft) => [draft.pos, draft]));
  const stems: RnaStem[] = [];
  for (const [canA, canB] of CANONICAL_PAIRS) {
    const seqA = seqPosByCanonical.get(canA);
    const seqB = seqPosByCanonical.get(canB);
    if (seqA === undefined || seqB === undefined) continue;

    const nA = draftBySeqPos.get(seqA);
    const nB = draftBySeqPos.get(seqB);
    if (!nA || !nB) continue;

    stems.push({
      from: seqA,
      to: seqB,
      pairStatus: getPairStatus(nA.base, nB.base),
    });
  }

  // ── Coordinates from the pairing ─────────────────────────────────────────
  const layout = buildRadialLayout(drafts, stems, TEMPLATE_SPACING, TEMPLATE_PAIR_WIDTH);
  const recommendedCanvasWidth = Math.max(TEMPLATE_CANVAS.width, layout?.width ?? 0);
  const recommendedCanvasHeight = Math.max(TEMPLATE_CANVAS.height, layout?.height ?? 0);
  const offsetX = layout ? (recommendedCanvasWidth - layout.width) / 2 : 0;
  const offsetY = layout ? (recommendedCanvasHeight - layout.height) / 2 : 0;

  const nucleotides: RnaNucleotide[] = drafts.map((draft, idx) => {
    const point = layout?.positions.get(draft.pos);
    const { canPos: _canPos, ...nucleotide } = draft;
    void _canPos;

    return {
      ...nucleotide,
      // Without any pair in range (very short fragments) fall back to a straight line.
      x: point ? Math.round(point.x + offsetX) : 80 + idx * TEMPLATE_SPACING,
      y: point ? Math.round(point.y + offsetY) : TEMPLATE_CANVAS.height / 2,
    };
  });

  return { nucleotides, stems, warnings, recommendedCanvasHeight, recommendedCanvasWidth };
}
