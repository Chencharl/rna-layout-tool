import { parseSequenceWithModifications } from "./annotations";
import type { RnaLabel, RnaProject, RnaSettings } from "./types";

export type ProjectAction =
  | { type: "replace_project"; project: RnaProject }
  | { type: "update_title"; title: string }
  | { type: "update_molecule_type"; moleculeType: RnaProject["moleculeType"] }
  | { type: "update_setting"; key: keyof RnaSettings; value: RnaSettings[keyof RnaSettings] }
  | { type: "update_nucleotide"; pos: number; key: "base" | "x" | "y" | "color" | "fontSize" | "visible"; value: string | number | boolean | undefined }
  | { type: "update_nucleotides"; nucleotides: Array<{ pos: number; x: number; y: number }> }
  | { type: "replace_stems"; stems: RnaProject["stems"] }
  | { type: "add_stem"; stem: RnaProject["stems"][number] }
  | { type: "remove_stem"; from: number; to: number }
  | { type: "insert_nucleotide"; afterPos?: number; x: number; y: number; base?: string }
  | { type: "delete_nucleotide"; pos: number }
  | { type: "add_label"; label: RnaLabel }
  | { type: "update_label"; id: string; patch: Partial<RnaLabel> }
  | { type: "remove_label_by_id"; id: string }
  | { type: "upsert_label"; pos: number; patch: Partial<RnaLabel> & { text?: string } }
  | { type: "remove_label"; pos: number };

function shiftStemIndex(index: number, pivot: number, delta: number): number {
  return index >= pivot ? index + delta : index;
}

export function projectReducer(project: RnaProject, action: ProjectAction): RnaProject {
  switch (action.type) {
    case "replace_project":
      return action.project;
    case "update_title":
      return {
        ...project,
        title: action.title,
      };
    case "update_molecule_type":
      return {
        ...project,
        moleculeType: action.moleculeType,
      };
    case "update_setting":
      return {
        ...project,
        settings: {
          ...project.settings,
          [action.key]: action.value,
        },
      };
    case "update_nucleotide": {
      const sequence = [...project.sequence];
      const nucleotides = project.nucleotides.map((nucleotide) => {
        if (nucleotide.pos !== action.pos) {
          return nucleotide;
        }

        if (action.key === "base" && typeof action.value === "string") {
          const parsed = parseSequenceWithModifications([action.value])[0];
          const sequenceIndex = nucleotide.sequenceIndex ?? action.pos;

          if (sequenceIndex >= 1 && sequenceIndex <= sequence.length) {
            sequence[sequenceIndex - 1] = action.value;
          }

          return {
            ...nucleotide,
            base: parsed?.base ?? action.value,
            originalToken: action.value,
            modification: parsed?.modification ?? undefined,
          };
        }

        const next = {
          ...nucleotide,
          [action.key]: action.value,
        };

        return next;
      });

      return {
        ...project,
        sequence,
        nucleotides,
      };
    }
    case "update_nucleotides": {
      const positions = new Map(action.nucleotides.map((nucleotide) => [nucleotide.pos, nucleotide]));

      return {
        ...project,
        nucleotides: project.nucleotides.map((nucleotide) => {
          const next = positions.get(nucleotide.pos);

          if (!next) {
            return nucleotide;
          }

          return {
            ...nucleotide,
            x: next.x,
            y: next.y,
          };
        }),
      };
    }
    case "replace_stems":
      return {
        ...project,
        stems: action.stems,
      };
    case "add_stem": {
      const exists = project.stems.some(
        (stem) =>
          (stem.from === action.stem.from && stem.to === action.stem.to) ||
          (stem.from === action.stem.to && stem.to === action.stem.from),
      );

      if (exists) {
        return project;
      }

      return {
        ...project,
        stems: [...project.stems, action.stem],
      };
    }
    case "remove_stem":
      return {
        ...project,
        stems: project.stems.filter(
          (stem) =>
            !(
              (stem.from === action.from && stem.to === action.to) ||
              (stem.from === action.to && stem.to === action.from)
            ),
        ),
      };
    case "insert_nucleotide": {
      const insertionIndex =
        action.afterPos === undefined
          ? project.nucleotides.length
          : Math.max(0, Math.min(action.afterPos, project.nucleotides.length));
      const newNucleotide = {
        pos: insertionIndex + 1,
        base: action.base ?? "A",
        x: action.x,
        y: action.y,
        visible: true,
      };
      const nextNucleotides = project.nucleotides.map((nucleotide) => ({ ...nucleotide }));
      nextNucleotides.splice(insertionIndex, 0, newNucleotide);
      nextNucleotides.forEach((nucleotide, index) => {
        nucleotide.pos = index + 1;
      });

      return {
        ...project,
        sequence: nextNucleotides.map((nucleotide) => nucleotide.base),
        nucleotides: nextNucleotides,
        labels: project.labels.map((label) => ({
          ...label,
          pos: shiftStemIndex(label.pos, insertionIndex + 1, 1),
        })),
        stems: project.stems.map((stem) => ({
          ...stem,
          from: shiftStemIndex(stem.from, insertionIndex + 1, 1),
          to: shiftStemIndex(stem.to, insertionIndex + 1, 1),
        })),
      };
    }
    case "delete_nucleotide": {
      const nextNucleotides = project.nucleotides
        .filter((nucleotide) => nucleotide.pos !== action.pos)
        .map((nucleotide) => ({ ...nucleotide }));
      nextNucleotides.forEach((nucleotide, index) => {
        nucleotide.pos = index + 1;
      });

      return {
        ...project,
        sequence: nextNucleotides.map((nucleotide) => nucleotide.base),
        nucleotides: nextNucleotides,
        labels: project.labels
          .filter((label) => label.pos !== action.pos)
          .map((label) => ({
            ...label,
            pos: label.pos > action.pos ? label.pos - 1 : label.pos,
          })),
        stems: project.stems
          .filter((stem) => stem.from !== action.pos && stem.to !== action.pos)
          .map((stem) => ({
            ...stem,
            from: stem.from > action.pos ? stem.from - 1 : stem.from,
            to: stem.to > action.pos ? stem.to - 1 : stem.to,
          })),
      };
    }
    case "add_label":
      return {
        ...project,
        labels: [
          ...project.labels,
          {
            ...action.label,
            source: action.label.source ?? "current_user_input",
          },
        ],
      };
    case "update_label":
      return {
        ...project,
        labels: project.labels.map((label) =>
          label.id === action.id
            ? {
                ...label,
                ...action.patch,
              }
            : label,
        ),
      };
    case "remove_label_by_id":
      return {
        ...project,
        labels: project.labels.filter((label) => label.id !== action.id),
      };
    case "upsert_label": {
      const existing = project.labels.find((label) => label.pos === action.pos);
      const nextLabels = existing
        ? project.labels.map((label) =>
            label.pos === action.pos
              ? {
                  ...label,
                  ...action.patch,
                  pos: action.pos,
                }
              : label,
          )
        : [
            ...project.labels,
            {
              id: `label-${action.pos}`,
              pos: action.pos,
              kind: "modification" as const,
              source: "current_user_input" as const,
              text: "",
              color: "#b91c1c",
              dx: 14,
              dy: -16,
              fontSize: 12,
              fontWeight: 700,
              ...action.patch,
            },
          ];

      return {
        ...project,
        labels: nextLabels.filter((label) => label.text.trim().length > 0),
      };
    }
    case "remove_label":
      return {
        ...project,
        labels: project.labels.filter((label) => label.pos !== action.pos),
      };
    default:
      return project;
  }
}
