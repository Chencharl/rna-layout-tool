export type ModificationMappingEntry = {
  code: string;
  symbol: string;
};

export type ResolvedModificationToken = {
  token: string;
  base: "A" | "C" | "G" | "U";
  modification: string | null;
};

export const MODIFICATION_MAPPING_ENTRIES: ModificationMappingEntry[] = [
  { code: "U", symbol: "U" },
  { code: "C", symbol: "C" },
  { code: "A", symbol: "A" },
  { code: "G", symbol: "G" },
  { code: "H", symbol: "?A" },
  { code: "\"", symbol: "m1A" },
  { code: "/", symbol: "m2A" },
  { code: "+", symbol: "i6A" },
  { code: "*", symbol: "ms2i6A" },
  { code: "#ERROR!", symbol: "m6A" },
  { code: "6", symbol: "t6A" },
  { code: "E", symbol: "m6t6A" },
  { code: "[", symbol: "ms2t6A" },
  { code: ":", symbol: "Am" },
  { code: "I", symbol: "I" },
  { code: "O", symbol: "m1I" },
  { code: "^", symbol: "Ar(p)" },
  { code: "`", symbol: "io6A" },
  { code: "<", symbol: "?C" },
  { code: "%", symbol: "s2C" },
  { code: "B", symbol: "Cm" },
  { code: "M", symbol: "ac4C" },
  { code: "?", symbol: "m5C" },
  { code: "", symbol: "m3C" },
  { code: "}", symbol: "k2C" },
  { code: ">", symbol: "f5C" },
  { code: "\ufffd", symbol: "f5Cm" },
  { code: ";", symbol: "?G" },
  { code: "0", symbol: "G'" },
  { code: "K", symbol: "m1G" },
  { code: "L", symbol: "m2G" },
  { code: "#", symbol: "Gm" },
  { code: "R", symbol: "m22G" },
  { code: "|", symbol: "m22Gm" },
  { code: "7", symbol: "m7G" },
  { code: "(", symbol: "fa7d7G" },
  { code: "Q", symbol: "Q" },
  { code: "8", symbol: "manQ" },
  { code: "9", symbol: "galQ" },
  { code: "Y", symbol: "yW" },
  { code: "W", symbol: "o2yW" },
  { code: "N", symbol: "?U" },
  { code: "{", symbol: "mnm5U" },
  { code: "2", symbol: "s2U" },
  { code: "J", symbol: "Um" },
  { code: "4", symbol: "s4U" },
  { code: "&", symbol: "ncm5U" },
  { code: "1", symbol: "mcm5U" },
  { code: "S", symbol: "mnm5s2U" },
  { code: "3", symbol: "mcm5s2U" },
  { code: "V", symbol: "cmo5U" },
  { code: "5", symbol: "mo5U" },
  { code: "!", symbol: "cmnm5U" },
  { code: "$", symbol: "cmnm5s2U" },
  { code: "X", symbol: "acp3U" },
  { code: "x", symbol: "acp3U+Cy3B" },
  { code: ",", symbol: "mchm5U" },
  { code: ")", symbol: "cmnm5Um" },
  { code: "~", symbol: "ncm5Um" },
  { code: "D", symbol: "D" },
  { code: "@", symbol: "@" },
  { code: "P", symbol: "psi" },
  { code: "]", symbol: "m1psi" },
  { code: "Z", symbol: "psim" },
  { code: "T", symbol: "m5U" },
  { code: "F", symbol: "m5s2U" },
  { code: "r", symbol: "m5Um" },
  { code: "_", symbol: "tm5s2U" },
  { code: "", symbol: "tm5U" },
  { code: ".", symbol: "mcm5Um" },
  { code: "h", symbol: "hm5C" },
  { code: "m", symbol: "hm5Cm" },
  { code: "f", symbol: "f5Cm" },
  { code: "o", symbol: "OHyW" },
];

const PLAIN_BASES = new Set(["A", "C", "G", "U"]);
const SPECIAL_BASE_BY_SYMBOL = new Map<string, "A" | "C" | "G" | "U">([
  ["D", "U"],
  ["@", "U"],
  ["psi", "U"],
  ["psim", "U"],
  ["m1psi", "U"],
  ["Q", "G"],
  ["manQ", "G"],
  ["galQ", "G"],
  ["yW", "G"],
  ["o2yW", "G"],
  ["OHyW", "G"],
  ["I", "A"],
  ["m1I", "A"],
]);

const ENTRY_BY_CODE = new Map(MODIFICATION_MAPPING_ENTRIES.map((entry) => [entry.code, entry]));
const ENTRY_BY_SYMBOL = new Map(
  MODIFICATION_MAPPING_ENTRIES.map((entry) => [entry.symbol, entry]),
);

export function getBaseForModificationSymbol(symbol: string): "A" | "C" | "G" | "U" | null {
  const special = SPECIAL_BASE_BY_SYMBOL.get(symbol);
  if (special) {
    return special;
  }

  const base = symbol.match(/[ACGUT](?!.*[ACGUT])/i)?.[0]?.toUpperCase().replace("T", "U");
  return base && PLAIN_BASES.has(base) ? (base as "A" | "C" | "G" | "U") : null;
}

export function resolveModificationToken(token: string): ResolvedModificationToken | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const directCode = ENTRY_BY_CODE.get(trimmed);
  const directSymbol = ENTRY_BY_SYMBOL.get(trimmed);
  const symbol = directCode?.symbol ?? directSymbol?.symbol ?? null;

  if (symbol) {
    const base = getBaseForModificationSymbol(symbol);
    if (!base) {
      return null;
    }

    return {
      token,
      base,
      modification: PLAIN_BASES.has(symbol) ? null : symbol,
    };
  }

  if (/^[ACGU]$/i.test(trimmed)) {
    return {
      token,
      base: trimmed.toUpperCase() as "A" | "C" | "G" | "U",
      modification: null,
    };
  }

  if (/^t$/i.test(trimmed)) {
    return {
      token,
      base: "U",
      modification: null,
    };
  }

  return null;
}

export function getKnownSequenceTokenPatterns() {
  const patterns = new Set<string>();

  MODIFICATION_MAPPING_ENTRIES.forEach((entry) => {
    if (resolveModificationToken(entry.code)) {
      patterns.add(entry.code);
    }
    if (resolveModificationToken(entry.symbol)) {
      patterns.add(entry.symbol);
    }
  });

  ["A", "C", "G", "U", "T"].forEach((base) => patterns.add(base));

  return [...patterns].sort((left, right) => right.length - left.length || left.localeCompare(right));
}
