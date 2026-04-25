import type { RnaProject, RnaTemplate } from "./types";
import { validateProjectJson, validateTemplateJson } from "./validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeJsonParse(text: string): unknown {
  return JSON.parse(text);
}

export function serializeProject(project: RnaProject): string {
  return JSON.stringify(project, null, 2);
}

export function serializeTemplate(template: RnaTemplate): string {
  return JSON.stringify(template, null, 2);
}

export function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "rna-project";
}

export function parseProjectFile(text: string): {
  errors: string[];
  project?: RnaProject;
  embeddedTemplate?: RnaTemplate;
} {
  try {
    const parsed = safeJsonParse(text);
    const errors = validateProjectJson(parsed);

    if (errors.length > 0) {
      return { errors };
    }

    const project = parsed as RnaProject;
    project.labels = project.labels.map((label) => ({
      ...label,
      kind: label.kind ?? "modification",
    }));
    const embeddedTemplate: RnaTemplate | undefined =
      project.nucleotides.length > 0 && isRecord(parsed)
        ? {
            id: project.templateId,
            name: `${project.title} template snapshot`,
            moleculeType: project.moleculeType,
            length: project.sequence.length,
            numberingMode: project.numberingMode,
            nucleotides: project.nucleotides.map(({ pos, x, y }) => ({ pos, x, y })),
            stems: project.stems,
          }
        : undefined;

    return {
      errors: [],
      project,
      embeddedTemplate,
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : "Could not parse project JSON."],
    };
  }
}

export function parseTemplateFile(text: string): { errors: string[]; template?: RnaTemplate } {
  try {
    const parsed = safeJsonParse(text);
    const errors = validateTemplateJson(parsed);

    if (errors.length > 0) {
      return { errors };
    }

    return {
      errors: [],
      template: parsed as RnaTemplate,
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : "Could not parse template JSON."],
    };
  }
}
