import { resolveModificationToken } from "./modificationMapping";

export type ParsedSequenceToken = {
  token: string;
  base: "A" | "C" | "G" | "U";
  modification: string | null;
  sequenceIndex: number;
};

function normalizeToken(token: string) {
  return token.trim();
}

function getBaseFromToken(token: string): ParsedSequenceToken["base"] | null {
  const normalized = normalizeToken(token);
  const mapped = resolveModificationToken(normalized);

  if (mapped) {
    return mapped.base;
  }

  if (/^[ACGU]$/i.test(normalized)) {
    return normalized.toUpperCase() as ParsedSequenceToken["base"];
  }

  if (/^t$/i.test(normalized)) {
    return "U";
  }

  if (normalized === "D" || normalized === "Ψ" || normalized === "Y") {
    return "U";
  }

  const baseMatches = normalized.match(/[ACGU]/gi);
  const base = baseMatches?.at(-1)?.toUpperCase();

  return base && /^[ACGU]$/.test(base) ? (base as ParsedSequenceToken["base"]) : null;
}

export function parseSequenceWithModifications(sequence: string[]): ParsedSequenceToken[] {
  return sequence.flatMap((token, index) => {
    const normalized = normalizeToken(token);
    const mapped = resolveModificationToken(normalized);
    const base = mapped?.base ?? getBaseFromToken(normalized);

    if (!base) {
      return [];
    }

    return {
      token,
      base,
      modification:
        mapped?.modification ??
        (normalized.length === 1 && /^[ACGUT]$/i.test(normalized) ? null : normalized),
      sequenceIndex: index + 1,
    };
  });
}

export function getRenderableBase(token: string) {
  return getBaseFromToken(token) ?? "";
}
