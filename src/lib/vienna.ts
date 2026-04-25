import type { RnaStem } from "./types";

const OPEN_TO_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "<": ">",
};

const CLOSE_TO_OPEN = Object.fromEntries(
  Object.entries(OPEN_TO_CLOSE).map(([open, close]) => [close, open]),
);

export function parseViennaDotBracket(structure: string, sequenceLength: number) {
  const compact = structure.replace(/\s+/g, "");
  const stacks = new Map<string, number[]>();
  const stems: RnaStem[] = [];

  for (const open of Object.keys(OPEN_TO_CLOSE)) {
    stacks.set(open, []);
  }

  if (compact.length !== sequenceLength) {
    return {
      stems: [],
      error: `Vienna structure length is ${compact.length}, but the sequence has ${sequenceLength} positions.`,
    };
  }

  for (let index = 0; index < compact.length; index += 1) {
    const char = compact[index];

    if (char === "." || char === "-" || char === "_") {
      continue;
    }

    if (OPEN_TO_CLOSE[char]) {
      stacks.get(char)?.push(index + 1);
      continue;
    }

    const open = CLOSE_TO_OPEN[char];

    if (!open) {
      return {
        stems: [],
        error: `Unsupported Vienna character "${char}" at position ${index + 1}.`,
      };
    }

    const stack = stacks.get(open);
    const from = stack?.pop();

    if (!from) {
      return {
        stems: [],
        error: `Unmatched "${char}" at position ${index + 1}.`,
      };
    }

    stems.push({ from, to: index + 1 });
  }

  for (const [open, stack] of stacks.entries()) {
    if (stack.length > 0) {
      return {
        stems: [],
        error: `Unmatched "${open}" at position ${stack.at(-1)}.`,
      };
    }
  }

  return {
    stems: stems.sort((left, right) => left.from - right.from),
    error: null,
  };
}
