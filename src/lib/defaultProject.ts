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
      labels: [],
      annotations: [],
      settings: {
        showPositionNumbers: false,
        showOnlyModifiedPositions: false,
        showSprinzlOverlay: false,
        runSprinzlValidation: false,
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
