import { getTemplateById, materializeTemplate } from "./templates";
import type { RnaProject, RnaTemplate, ValidationMessage } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateProject(
  project: RnaProject,
  templates: RnaTemplate[],
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const isStructureConstrained =
    project.renderMode === "structure_constrained_mode" ||
    project.renderMode === "atypical_mode";
  const template = getTemplateById(project.templateId, templates);
  const resolvedTemplate = template
    ? materializeTemplate(template, project.sequence.length)
    : undefined;

  if (!template) {
    messages.push({
      id: "missing-template",
      level: "warning",
      text: `Template "${project.templateId}" is not currently in the registry. The project still renders because coordinates are stored in the project JSON.`,
    });
  }

  if (!isStructureConstrained && resolvedTemplate?.length && resolvedTemplate.length !== project.sequence.length) {
    messages.push({
      id: "template-length-mismatch",
      level: "warning",
      text: `Layout preset "${resolvedTemplate.name}" was adapted to ${project.sequence.length} positions. You can drag points to refine the structure manually.`,
    });
  }

  project.mappingWarnings?.forEach((warning, index) => {
    messages.push({
      id: `mapping-warning-${index}`,
      level: "warning",
      text: warning,
    });
  });

  if (project.renderMode === "structure_constrained_mode" || project.renderMode === "atypical_mode") {
    messages.push({
      id: "render-mode-structure",
      level: "success",
      text: "Structure-constrained render: dot-bracket controls pairs and layout; Sprinzl labels are annotation only.",
    });
  } else if (project.renderMode === "sprinzl_validation") {
    messages.push({
      id: "render-mode-sprinzl-validation",
      level: "warning",
      text: "Optional Sprinzl validation is enabled; canonical tRNA warnings may be shown.",
    });
  } else if (project.renderMode === "sprinzl_template") {
    messages.push({
      id: "render-mode-sprinzl-template",
      level: "success",
      text: "Sprinzl template render: reference geometry is heuristic and validation is off.",
    });
  }

  const positions = new Set<number>();
  for (const nucleotide of project.nucleotides) {
    if (positions.has(nucleotide.pos)) {
      messages.push({
        id: `duplicate-pos-${nucleotide.pos}`,
        level: "error",
        text: `Nucleotide position ${nucleotide.pos} is duplicated.`,
      });
    }
    positions.add(nucleotide.pos);
  }

  for (const label of project.labels) {
    if (!positions.has(label.pos)) {
      messages.push({
        id: `bad-label-${label.id}`,
        level: "error",
        text: `Label "${label.text || label.id}" points to position ${label.pos}, which does not exist in the nucleotide table.`,
      });
    }
  }

  project.sequence.forEach((token, index) => {
    if (!token.trim()) {
      messages.push({
        id: `empty-token-${index + 1}`,
        level: "error",
        text: `Sequence token ${index + 1} is empty.`,
      });
    }
  });

  if (!isStructureConstrained && project.templateId !== "trna_classic" && project.nucleotides.length !== project.sequence.length) {
    messages.push({
      id: "sequence-sync",
      level: "error",
      text: "Sequence and nucleotide rows are out of sync. Re-import the project or reapply the template.",
    });
  }

  if (messages.length === 0) {
    messages.push({
      id: "project-valid",
      level: "success",
      text: "Project is valid and ready for export.",
    });
  }

  return messages;
}

export function validateTemplateJson(candidate: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return ["Template JSON must be an object."];
  }

  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    errors.push("Template id must be a non-empty string.");
  }

  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    errors.push("Template name must be a non-empty string.");
  }

  if (
    candidate.moleculeType !== "tRNA" &&
    candidate.moleculeType !== "mRNA" &&
    candidate.moleculeType !== "rRNA" &&
    candidate.moleculeType !== "custom"
  ) {
    errors.push("Template moleculeType must be tRNA, mRNA, rRNA, or custom.");
  }

  if (candidate.length !== undefined && typeof candidate.length !== "number") {
    errors.push("Template length must be a number when provided.");
  }

  if (!Array.isArray(candidate.nucleotides)) {
    errors.push("Template nucleotides must be an array.");
  } else {
    candidate.nucleotides.forEach((entry, index) => {
      if (!isRecord(entry)) {
        errors.push(`Template nucleotide ${index + 1} must be an object.`);
        return;
      }

      if (
        typeof entry.pos !== "number" ||
        typeof entry.x !== "number" ||
        typeof entry.y !== "number"
      ) {
        errors.push(`Template nucleotide ${index + 1} must include numeric pos, x, and y fields.`);
      }
    });
  }

  if (candidate.stems !== undefined) {
    if (!Array.isArray(candidate.stems)) {
      errors.push("Template stems must be an array when provided.");
    } else {
      candidate.stems.forEach((entry, index) => {
        if (!isRecord(entry)) {
          errors.push(`Template stem ${index + 1} must be an object.`);
          return;
        }

        if (typeof entry.from !== "number" || typeof entry.to !== "number") {
          errors.push(`Template stem ${index + 1} must include numeric from and to fields.`);
        }
      });
    }
  }

  return errors;
}

export function validateProjectJson(candidate: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return ["Project JSON must be an object."];
  }

  const requiredStringFields = ["id", "title", "templateId"];
  for (const field of requiredStringFields) {
    if (typeof candidate[field] !== "string") {
      errors.push(`Project field "${field}" must be a string.`);
    }
  }

  if (!Array.isArray(candidate.sequence)) {
    errors.push("Project sequence must be an array of tokens.");
  }

  if (!Array.isArray(candidate.nucleotides)) {
    errors.push("Project nucleotides must be an array.");
  }

  if (!Array.isArray(candidate.labels)) {
    errors.push("Project labels must be an array.");
  }

  if (!Array.isArray(candidate.annotations)) {
    errors.push("Project annotations must be an array.");
  }

  if (!isRecord(candidate.settings)) {
    errors.push("Project settings must be an object.");
  }

  return errors;
}
