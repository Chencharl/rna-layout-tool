import type { NumberingMode } from "./types";

export function getDisplayPosition(pos: number, mode: NumberingMode): string {
  if (mode === "trna_standard") {
    return String(pos);
  }

  return String(pos);
}
