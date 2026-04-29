import type { AnnotationSource, MarkCatalogItem, PositionMarkRule, RnaLabel, RnaNucleotide } from "./types";

export const MODIFICATION_CATALOG: MarkCatalogItem[] = [
  { symbol: "Y", name: "pseudouridine", color: "#475569", kind: "modification", source: "mod_bank" },
  { symbol: "D", name: "dihydrouridine", color: "#7c3aed", kind: "modification", source: "mod_bank" },
  { symbol: "ac4C", name: "N4-acetylcytidine", color: "#ea580c", kind: "modification", source: "symbol_mapping" },
  { symbol: "m1A", name: "1-methyladenosine", color: "#0f766e", kind: "modification", source: "mod_bank" },
  { symbol: "m1G", name: "1-methylguanosine", color: "#0369a1", kind: "modification", source: "mod_bank" },
  { symbol: "m2G", name: "N2-methylguanosine", color: "#1d4ed8", kind: "modification", source: "mod_bank" },
  { symbol: "m22G", name: "N2,N2-dimethylguanosine", color: "#1e40af", kind: "modification", source: "symbol_mapping" },
  { symbol: "Gm", name: "2'-O-methylguanosine", color: "#0f766e", kind: "modification", source: "mod_bank" },
  { symbol: "Cm", name: "2'-O-methylcytidine", color: "#15803d", kind: "modification", source: "mod_bank" },
  { symbol: "Um", name: "2'-O-methyluridine", color: "#16a34a", kind: "modification", source: "mod_bank" },
  { symbol: "m5C", name: "5-methylcytidine", color: "#be123c", kind: "modification", source: "mod_bank" },
  { symbol: "m3C", name: "3-methylcytidine", color: "#e11d48", kind: "modification", source: "mod_bank" },
  { symbol: "m7G", name: "7-methylguanosine", color: "#2563eb", kind: "modification", source: "mod_bank" },
  { symbol: "m5U", name: "5-methyluridine", color: "#dc2626", kind: "modification", source: "mod_bank" },
  { symbol: "m5Um", name: "5,2'-O-dimethyluridine", color: "#b91c1c", kind: "modification", source: "symbol_mapping" },
  { symbol: "acp3U", name: "3-(3-amino-3-carboxypropyl)uridine", color: "#c2410c", kind: "adduct", source: "symbol_mapping" },
  { symbol: "Q", name: "queuosine", color: "#7c2d12", kind: "modification", source: "symbol_mapping" },
  { symbol: "manQ", name: "mannosyl-queuosine", color: "#9a3412", kind: "adduct", source: "symbol_mapping" },
  { symbol: "galQ", name: "galactosyl-queuosine", color: "#b45309", kind: "adduct", source: "manual" },
  { symbol: "I", name: "inosine", color: "#4f46e5", kind: "modification", source: "symbol_mapping" },
  { symbol: "m1I", name: "1-methylinosine", color: "#4338ca", kind: "modification", source: "symbol_mapping" },
  { symbol: "t6A", name: "N6-threonylcarbamoyladenosine", color: "#0891b2", kind: "adduct", source: "symbol_mapping" },
  { symbol: "i6A", name: "N6-isopentenyladenosine", color: "#0284c7", kind: "adduct", source: "symbol_mapping" },
  { symbol: "m6t6A", name: "N6-methyl-N6-threonylcarbamoyladenosine", color: "#0ea5e9", kind: "adduct", source: "symbol_mapping" },
  { symbol: "ms2t6A", name: "2-methylthio-N6-threonylcarbamoyladenosine", color: "#06b6d4", kind: "adduct", source: "symbol_mapping" },
  { symbol: "ms2i6A", name: "2-methylthio-N6-isopentenyladenosine", color: "#0f766e", kind: "adduct", source: "symbol_mapping" },
  { symbol: "OHyW", name: "hydroxywybutosine", color: "#334155", kind: "adduct", source: "manual" },
  { symbol: "o2yW", name: "peroxywybutosine", color: "#475569", kind: "adduct", source: "manual" },
  { symbol: "yW", name: "wybutosine", color: "#64748b", kind: "adduct", source: "symbol_mapping" },
  { symbol: "hm5C", name: "5-hydroxymethylcytidine", color: "#9333ea", kind: "adduct", source: "symbol_mapping" },
  { symbol: "hm5Cm", name: "2'-O-methyl-5-hydroxymethylcytidine", color: "#7e22ce", kind: "adduct", source: "symbol_mapping" },
  { symbol: "f5Cm", name: "5-formyl-2'-O-methylcytidine", color: "#a21caf", kind: "adduct", source: "symbol_mapping" },
  { symbol: "ncm5U", name: "5-carbamoylmethyluridine", color: "#ca8a04", kind: "adduct", source: "symbol_mapping" },
  { symbol: "mcm5U", name: "5-methoxycarbonylmethyluridine", color: "#d97706", kind: "adduct", source: "symbol_mapping" },
  { symbol: "mcm5s2U", name: "5-methoxycarbonylmethyl-2-thiouridine", color: "#f59e0b", kind: "adduct", source: "symbol_mapping" },
];

export const COMMON_ADDUCT_OPTIONS: MarkCatalogItem[] = [
  { symbol: "methyl", name: "generic methyl adduct", color: "#b91c1c", kind: "adduct", source: "manual" },
  { symbol: "methylthio", name: "generic methylthio adduct", color: "#0f766e", kind: "adduct", source: "manual" },
  { symbol: "acetyl", name: "generic acetyl adduct", color: "#ea580c", kind: "adduct", source: "manual" },
  { symbol: "amino-carboxypropyl", name: "aminocarboxypropyl side chain", color: "#c2410c", kind: "adduct", source: "manual" },
  { symbol: "threonylcarbamoyl", name: "threonylcarbamoyl side chain", color: "#0891b2", kind: "adduct", source: "manual" },
  { symbol: "isopentenyl", name: "isopentenyl side chain", color: "#0284c7", kind: "adduct", source: "manual" },
];

export const POSITION_MARK_RULES: PositionMarkRule[] = [
  { pos: "4", recommendedSymbols: ["Um", "Cm"], note: "From structure_numbering_modifications.xlsx: position 4 commonly carries 2'-O-methyl U or C.", confidence: "known" },
  { pos: "6", recommendedSymbols: ["m2G"], note: "Common methylguanosine hot spot.", confidence: "known" },
  { pos: "7", recommendedSymbols: ["m2G"], note: "Common methylguanosine hot spot.", confidence: "known" },
  { pos: "9", recommendedSymbols: ["m1A", "m1G"], note: "Position 9 often carries N1 methylation in tRNA.", confidence: "known" },
  { pos: "10", recommendedSymbols: ["m2G"], note: "Position 10 frequently carries m2G.", confidence: "known" },
  { pos: "12", recommendedSymbols: ["ac4C"], note: "Position 12 is a classic ac4C site.", confidence: "known" },
  { pos: "16", recommendedSymbols: ["D"], note: "D-loop enrichment site.", confidence: "known" },
  { pos: "17", recommendedSymbols: ["D"], note: "D-loop enrichment site.", confidence: "known" },
  { pos: "18", recommendedSymbols: ["Gm"], note: "Common ribose methylation site in the D-loop.", confidence: "known" },
  { pos: "20", recommendedSymbols: ["acp3U", "D"], note: "Position 20/20A often hosts acp3U or D in classic tRNA maps.", confidence: "known" },
  { pos: "26", recommendedSymbols: ["m2G", "m22G"], note: "Junction site between D arm and anticodon arm.", confidence: "known" },
  { pos: "27", recommendedSymbols: ["m22G", "m5C"], note: "Potentially methylated in the anticodon stem entry.", confidence: "potential" },
  { pos: "32", recommendedSymbols: ["Cm", "Um", "Y"], note: "Anticodon loop position with common ribose methylation or pseudouridine chemistry.", confidence: "potential" },
  { pos: "34", recommendedSymbols: ["Q", "manQ", "galQ", "I", "ncm5U", "mcm5U", "mcm5s2U", "hm5C", "hm5Cm", "f5Cm"], note: "Wobble position 34 is a major modification hot spot in tRNA biology.", confidence: "known" },
  { pos: "37", recommendedSymbols: ["t6A", "i6A", "m6t6A", "ms2t6A", "ms2i6A", "m1I", "OHyW", "o2yW", "yW"], note: "Position 37 is one of the strongest anticodon-adjacent modification hot spots.", confidence: "known" },
  { pos: "38", recommendedSymbols: ["m5C"], note: "Frequently methylated near the anticodon loop.", confidence: "potential" },
  { pos: "39", recommendedSymbols: ["Um", "Gm", "Y"], note: "Anticodon stem exit position with common methylation/pseudouridine chemistry.", confidence: "potential" },
  { pos: "44", recommendedSymbols: ["Um"], note: "Variable loop/T-arm junction site.", confidence: "known" },
  { pos: "46", recommendedSymbols: ["m7G"], note: "Variable region methylguanosine site.", confidence: "known" },
  { pos: "47", recommendedSymbols: ["D"], note: "Occasional D in the variable region.", confidence: "known" },
  { pos: "48", recommendedSymbols: ["m5C"], note: "T-stem entry cytidine methylation site.", confidence: "known" },
  { pos: "49", recommendedSymbols: ["m5C"], note: "T-stem cytidine methylation site.", confidence: "known" },
  { pos: "50", recommendedSymbols: ["m5C"], note: "Potential T-stem cytidine methylation site.", confidence: "potential" },
  { pos: "54", recommendedSymbols: ["m5U", "m5Um"], note: "T-loop 54 frequently carries thymidine-like chemistry.", confidence: "known" },
  { pos: "55", recommendedSymbols: ["Y"], note: "Position 55 is the canonical pseudouridine-rich T-loop position.", confidence: "known" },
  { pos: "58", recommendedSymbols: ["m1A"], note: "T-loop position 58 often carries m1A.", confidence: "known" },
  { pos: "72", recommendedSymbols: ["m5C"], note: "Acceptor stem 3' side can carry m5C.", confidence: "potential" },
];

export function getCatalogItem(symbol: string): MarkCatalogItem | undefined {
  return MODIFICATION_CATALOG.find((item) => item.symbol === symbol) ??
    COMMON_ADDUCT_OPTIONS.find((item) => item.symbol === symbol);
}

const AUTO_LABEL_TEXT: Record<string, string> = {
  "*": "ms2i6A",
  D: "D",
  Y: "Y",
  Q: "Q",
  I: "I",
  X: "X",
};

const AUTO_LABEL_COLOR: Record<string, string> = {
  X: "#be123c",
};

export function getDisplayBaseForToken(token: string): string {
  const normalized = token.trim();

  if (!normalized) {
    return "";
  }

  if (/^[ACGUTN]$/i.test(normalized)) {
    return normalized.toUpperCase().replace("T", "U");
  }

  if (/^[acgu]$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  const mappedText = AUTO_LABEL_TEXT[normalized] ?? normalized;
  const mappedCatalog = getCatalogItem(mappedText);

  if (mappedCatalog) {
    const tailBase = mappedText.match(/[ACGUT](?!.*[ACGUT])/i)?.[0];
    if (tailBase) {
      return tailBase.toUpperCase().replace("T", "U");
    }
  }

  const trailingBase = normalized.match(/[ACGUT](?!.*[ACGUT])/i)?.[0];
  if (trailingBase) {
    return trailingBase.toUpperCase().replace("T", "U");
  }

  if (normalized === "D" || normalized === "Y") {
    return "U";
  }

  if (normalized === "Q") {
    return "G";
  }

  if (normalized === "I" || normalized === "*") {
    return "A";
  }

  return normalized.toUpperCase();
}

function shouldAutoLabelToken(token: string) {
  const normalized = token.trim();

  if (!normalized) {
    return false;
  }

  if (/^[ACGUTN]$/i.test(normalized) || /^[acgu]$/.test(normalized)) {
    return false;
  }

  return Boolean(AUTO_LABEL_TEXT[normalized] || getCatalogItem(normalized) || normalized.length > 1);
}

export function buildAutoSequenceLabels(
  sequence: string[],
  existingLabels: RnaLabel[],
): RnaLabel[] {
  return sequence.flatMap((token, index) => {
    if (!shouldAutoLabelToken(token)) {
      return [];
    }

    const normalized = token.trim();
    const labelText = AUTO_LABEL_TEXT[normalized] ?? normalized;
    const pos = index + 1;
    const hasExisting = existingLabels.some(
      (label) => label.pos === pos && label.text.trim() === labelText,
    );

    if (hasExisting) {
      return [];
    }

    const catalogItem = getCatalogItem(labelText);

    return [
      {
        id: `auto-seq-${pos}-${labelText}`,
        pos,
        kind: catalogItem?.kind ?? "modification",
        source: "previous_render",
        text: labelText,
        color: catalogItem?.color ?? AUTO_LABEL_COLOR[labelText] ?? "#334155",
        dx: 26,
        dy: -18,
        fontSize: 12,
        fontWeight: 700,
      },
    ];
  });
}

export function buildAutoLabelsForNucleotides(
  sequence: string[],
  nucleotides: RnaNucleotide[],
  existingLabels: RnaLabel[],
): RnaLabel[] {
  return nucleotides.flatMap((nucleotide) => {
    if (!nucleotide.sequenceIndex) {
      return [];
    }

    const token = sequence[nucleotide.sequenceIndex - 1];
    if (!token || !shouldAutoLabelToken(token)) {
      return [];
    }

    const normalized = token.trim();
    const labelText = AUTO_LABEL_TEXT[normalized] ?? normalized;
    const hasExisting = existingLabels.some(
      (label) => label.pos === nucleotide.pos && label.text.trim() === labelText,
    );

    if (hasExisting) {
      return [];
    }

    const catalogItem = getCatalogItem(labelText);

    return [
      {
        id: `auto-seq-${nucleotide.pos}-${labelText}`,
        pos: nucleotide.pos,
        kind: catalogItem?.kind ?? "modification",
        source: "previous_render",
        text: labelText,
        color: catalogItem?.color ?? AUTO_LABEL_COLOR[labelText] ?? "#334155",
        dx: 26,
        dy: -18,
        fontSize: 12,
        fontWeight: 700,
      },
    ];
  });
}

const CURRENT_ANNOTATION_SOURCES = new Set<AnnotationSource>([
  "current_user_input",
  "current_project_annotation",
  "imported_current_project",
]);

export function normalizeAnnotationSource(source: AnnotationSource | undefined): AnnotationSource {
  return source ?? "unknown";
}

export function filterCurrentAnnotations(labels: RnaLabel[], maxPosition: number): RnaLabel[] {
  return labels
    .map((label) => ({
      ...label,
      source: normalizeAnnotationSource(label.source),
    }))
    .filter((label) => CURRENT_ANNOTATION_SOURCES.has(label.source))
    .filter((label) => label.pos >= 1 && label.pos <= maxPosition);
}

export function getPositionRule(pos: number): PositionMarkRule | undefined {
  return POSITION_MARK_RULES.find((rule) => rule.pos === String(pos));
}

export function getRecommendedCatalogItems(pos: number): MarkCatalogItem[] {
  const rule = getPositionRule(pos);

  if (!rule) {
    return [];
  }

  return rule.recommendedSymbols
    .map((symbol) => getCatalogItem(symbol))
    .filter((item): item is MarkCatalogItem => Boolean(item));
}
