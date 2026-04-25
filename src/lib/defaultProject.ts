import { remapProjectToTemplate, materializeTemplate, BUILTIN_TEMPLATES } from "./templates";
import type { RnaProject } from "./types";

const DEFAULT_SEQUENCE =
  "GCCCGGAUAGCUCAGDCGGDAGAGCAGGGGAUUGAA*AUCCCCGUgXCCUUGGuUCGAUUCCGAGUCCGGGCACCA";

export function createDefaultProject(): RnaProject {
  const template = materializeTemplate(BUILTIN_TEMPLATES[0], DEFAULT_SEQUENCE.length);

  return remapProjectToTemplate(
    {
      id: "phe-trna-working-layout",
      title: "Phe tRNA working layout",
      moleculeType: "tRNA",
      sequence: DEFAULT_SEQUENCE.split(""),
      numberingMode: "trna_standard",
      templateId: template.id,
      nucleotides: template.nucleotides.map((position, index) => ({
        pos: position.pos,
        base: DEFAULT_SEQUENCE[index] ?? "",
        x: position.x,
        y: position.y,
        visible: true,
      })),
      stems: template.stems ?? [],
      labels: [
        {
          id: "label-8",
          pos: 8,
          kind: "modification",
          text: "s4U",
          color: "#d97706",
          dx: -46,
          dy: -26,
          fontWeight: 600,
        },
        {
          id: "label-16",
          pos: 16,
          kind: "modification",
          text: "D",
          color: "#8b5cf6",
          dx: -52,
          dy: 0,
          fontWeight: 600,
        },
        {
          id: "label-20",
          pos: 20,
          kind: "modification",
          text: "D",
          color: "#8b5cf6",
          dx: -22,
          dy: 34,
          fontWeight: 600,
        },
        {
          id: "label-37",
          pos: 37,
          kind: "adduct",
          text: "ms2i6A",
          color: "#0f766e",
          dx: 44,
          dy: 28,
          fontWeight: 700,
        },
        {
          id: "label-47",
          pos: 47,
          kind: "modification",
          text: "X",
          color: "#be123c",
          dx: 42,
          dy: 12,
          fontWeight: 700,
        },
        {
          id: "label-54",
          pos: 54,
          kind: "modification",
          text: "mU",
          color: "#1d4ed8",
          dx: 42,
          dy: 28,
          fontWeight: 700,
        },
      ],
      annotations: [],
      settings: {
        showPositionNumbers: false,
        showStemLines: true,
        canvasWidth: 1280,
        canvasHeight: 980,
        nucleotideFontSize: 17,
        numberFontSize: 10,
        theme: "publication",
      },
    },
    template,
  );
}
