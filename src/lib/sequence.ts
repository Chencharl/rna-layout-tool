import { getKnownSequenceTokenPatterns } from "./modificationMapping";

const BRACKETED_TOKEN_PATTERN = /\[([^\]]+)\]/g;

export function parseSequenceInput(input: string): string[] {
  const trimmed = input.trim();

  if (!trimmed) {
    return [];
  }

  if (BRACKETED_TOKEN_PATTERN.test(trimmed)) {
    BRACKETED_TOKEN_PATTERN.lastIndex = 0;
    return parseDelimitedSequence(trimmed);
  }

  if (/\s/.test(trimmed)) {
    return parseDelimitedSequence(trimmed);
  }

  return tokenizeKnownSequenceString(trimmed);
}

function parseDelimitedSequence(input: string): string[] {
  const prepared = input.replace(BRACKETED_TOKEN_PATTERN, (_, token: string) => {
    return ` ${token.trim()} `;
  });

  return prepared
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function tokenizeKnownSequenceString(input: string): string[] {
  const patterns = getKnownSequenceTokenPatterns();
  const tokens: string[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const match = patterns.find((pattern) => input.startsWith(pattern, cursor));

    if (match) {
      tokens.push(match);
      cursor += match.length;
      continue;
    }

    tokens.push(input[cursor]);
    cursor += 1;
  }

  return tokens;
}

export function formatSequenceTokens(tokens: string[]): string {
  if (tokens.every((token) => token.length <= 1)) {
    return tokens.join("");
  }

  return tokens.join(" ");
}

export function validateSequenceTokens(tokens: string[]): string[] {
  const errors: string[] = [];

  if (tokens.length === 0) {
    errors.push("Sequence is empty.");
  }

  tokens.forEach((token, index) => {
    if (!token.trim()) {
      errors.push(`Position ${index + 1} is empty.`);
      return;
    }

    if (/\s/.test(token)) {
      errors.push(`Position ${index + 1} contains whitespace inside a token.`);
    }
  });

  return errors;
}
