"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { RNACanvas } from "@/components/RNACanvas";
import { RNAInspector } from "@/components/RNAInspector";
import { RNATable } from "@/components/RNATable";
import { RNAToolbar } from "@/components/RNAToolbar";
import { ValidationPanel } from "@/components/ValidationPanel";
import { getCatalogItem } from "@/lib/biology";
import { createDefaultProject } from "@/lib/defaultProject";
import { exportSvgMarkupToPng } from "@/lib/exportPng";
import { createStandaloneSvgMarkup, getSvgFilename } from "@/lib/exportSvg";
import {
  downloadText,
  parseProjectFile,
  parseTemplateFile,
  serializeProject,
  slugifyTitle,
} from "@/lib/projectIO";
import { projectReducer } from "@/lib/projectReducer";
import { formatSequenceTokens, parseSequenceInput, validateSequenceTokens } from "@/lib/sequence";
import {
  BUILTIN_TEMPLATES,
  getTemplateById,
  remapProjectToTemplate,
  syncProjectToSequence,
} from "@/lib/templates";
import { validateProject } from "@/lib/validation";
import { parseViennaDotBracket } from "@/lib/vienna";
import type {
  RnaLabel,
  RnaNucleotide,
  RnaProject,
  RnaStem,
  RnaTemplate,
  TableRow,
  ValidationMessage,
} from "@/lib/types";

const INITIAL_PROJECT = createDefaultProject();
type CanvasMode = "move-bases" | "move-labels" | "add-point";
type StemAlignmentGroup = {
  topOrLeft: number[];
  bottomOrRight: number[];
  orientation: "horizontal-arm" | "vertical-arm";
};

function areNeighboringStemPairs(left: RnaStem, right: RnaStem) {
  return Math.abs(left.from - right.from) === 1 && Math.abs(left.to - right.to) === 1;
}

function getStemAlignmentGroup(
  pos: number | null,
  stems: RnaStem[],
  nucleotides: RnaNucleotide[],
): StemAlignmentGroup | null {
  if (pos === null) {
    return null;
  }

  const orderedStems = [...stems].sort((left, right) => left.from - right.from);
  const selectedStemIndex = orderedStems.findIndex((stem) => stem.from === pos || stem.to === pos);

  if (selectedStemIndex === -1) {
    return null;
  }

  let start = selectedStemIndex;
  let end = selectedStemIndex;

  while (start > 0 && areNeighboringStemPairs(orderedStems[start - 1], orderedStems[start])) {
    start -= 1;
  }

  while (
    end < orderedStems.length - 1 &&
    areNeighboringStemPairs(orderedStems[end], orderedStems[end + 1])
  ) {
    end += 1;
  }

  const stemRun = orderedStems.slice(start, end + 1);
  const nucleotideMap = new Map(nucleotides.map((nucleotide) => [nucleotide.pos, nucleotide]));
  const pairedVectors = stemRun
    .map((stem) => {
      const from = nucleotideMap.get(stem.from);
      const to = nucleotideMap.get(stem.to);

      if (!from || !to) {
        return null;
      }

      return {
        dx: Math.abs(to.x - from.x),
        dy: Math.abs(to.y - from.y),
      };
    })
    .filter((vector): vector is { dx: number; dy: number } => Boolean(vector));
  const averageDx =
    pairedVectors.reduce((sum, vector) => sum + vector.dx, 0) / Math.max(1, pairedVectors.length);
  const averageDy =
    pairedVectors.reduce((sum, vector) => sum + vector.dy, 0) / Math.max(1, pairedVectors.length);

  return {
    topOrLeft: stemRun.map((stem) => stem.from),
    bottomOrRight: stemRun.map((stem) => stem.to),
    orientation: averageDx >= averageDy ? "vertical-arm" : "horizontal-arm",
  };
}

function getViewportForProject(project: RnaProject) {
  if (project.nucleotides.length === 0) {
    return {
      zoom: 1,
      center: {
        x: project.settings.canvasWidth / 2,
        y: project.settings.canvasHeight / 2,
      },
    };
  }

  const xs = project.nucleotides.map((nucleotide) => nucleotide.x);
  const ys = project.nucleotides.map((nucleotide) => nucleotide.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = project.moleculeType === "tRNA" ? 28 : 84;
  const width = Math.max(240, maxX - minX + padding * 2);
  const height = Math.max(240, maxY - minY + padding * 2);
  const zoom = Math.max(
    0.4,
    Math.min(
      3,
      Math.min(project.settings.canvasWidth / width, project.settings.canvasHeight / height),
    ),
  );

  return {
    zoom,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2 + (project.moleculeType === "tRNA" ? 10 : 0),
    },
  };
}

export function RNAEditor() {
  const [project, dispatch] = useReducer(projectReducer, INITIAL_PROJECT);
  const [templates, setTemplates] = useState<RnaTemplate[]>(BUILTIN_TEMPLATES);
  const [sequenceText, setSequenceText] = useState(() =>
    formatSequenceTokens(INITIAL_PROJECT.sequence),
  );
  const [secondaryStructureText, setSecondaryStructureText] = useState("");
  const [sequenceMessage, setSequenceMessage] = useState<ValidationMessage | null>(null);
  const [editorMessage, setEditorMessage] = useState<ValidationMessage | null>(null);
  const initialViewport = getViewportForProject(INITIAL_PROJECT);
  const [zoom, setZoom] = useState(initialViewport.zoom);
  const [viewportCenter, setViewportCenter] = useState(initialViewport.center);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("move-bases");
  const [selectedPos, setSelectedPos] = useState<number | null>(8);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>("label-8");
  const [showAdvancedTable, setShowAdvancedTable] = useState(false);
  const [transparentPng, setTransparentPng] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const validationMessages = useMemo(() => {
    const projectMessages = validateProject(project, templates);

    return [sequenceMessage, editorMessage, ...projectMessages].filter(
      Boolean,
    ) as ValidationMessage[];
  }, [editorMessage, project, sequenceMessage, templates]);

  const rows = useMemo<TableRow[]>(() => {
    return project.nucleotides.map((nucleotide) => {
      const label = project.labels.find((entry) => entry.pos === nucleotide.pos);

      return {
        pos: nucleotide.pos,
        base: nucleotide.base,
        x: nucleotide.x,
        y: nucleotide.y,
        labelId: label?.id,
        labelText: label?.text ?? "",
        labelColor: label?.color ?? "#b91c1c",
        labelDx: label?.dx ?? 14,
        labelDy: label?.dy ?? -16,
      };
    });
  }, [project.labels, project.nucleotides]);

  const selectedNucleotide = useMemo(
    () => project.nucleotides.find((nucleotide) => nucleotide.pos === selectedPos),
    [project.nucleotides, selectedPos],
  );
  const labelsAtPosition = useMemo(
    () => project.labels.filter((label) => label.pos === selectedPos),
    [project.labels, selectedPos],
  );
  const selectedLabel = useMemo(
    () => project.labels.find((label) => label.id === selectedLabelId) ?? labelsAtPosition[0],
    [labelsAtPosition, project.labels, selectedLabelId],
  );

  useEffect(() => {
    setSequenceText(formatSequenceTokens(project.sequence));
  }, [project.sequence]);

  useEffect(() => {
    if (labelsAtPosition.length === 0) {
      setSelectedLabelId(null);
      return;
    }

    if (!selectedLabelId || !labelsAtPosition.some((label) => label.id === selectedLabelId)) {
      setSelectedLabelId(labelsAtPosition[0].id);
    }
  }, [labelsAtPosition, selectedLabelId]);

  function getDefaultLabelOffset(pos: number) {
    const existingCount = project.labels.filter((label) => label.pos === pos).length;

    return {
      dx: 34 + existingCount * 28,
      dy: -24 + existingCount * 18,
    };
  }

  function createCanvasLabel(
    pos: number,
    kind: "modification" | "adduct" | "note",
    text: string,
    color?: string,
  ) {
    const offset = getDefaultLabelOffset(pos);
    const id = `${kind}-${pos}-${project.labels.length + 1}-${Date.now()}`;

    dispatch({
      type: "add_label",
      label: {
        id,
        pos,
        kind,
        text,
        color: color ?? getCatalogItem(text)?.color ?? "#334155",
        dx: offset.dx,
        dy: offset.dy,
        fontSize: kind === "note" ? 11 : 12,
        fontWeight: 700,
      },
    });
    setSelectedLabelId(id);
  }

  function replaceProject(nextProject: RnaProject) {
    const nextViewport = getViewportForProject(nextProject);
    dispatch({ type: "replace_project", project: nextProject });
    setSequenceText(formatSequenceTokens(nextProject.sequence));
    setSequenceMessage(null);
    setZoom(nextViewport.zoom);
    setViewportCenter(nextViewport.center);
    setSelectedPos((current) =>
      current === null ? nextProject.nucleotides[0]?.pos ?? null : Math.min(current, nextProject.nucleotides.length),
    );
    setSelectedLabelId(nextProject.labels[0]?.id ?? null);
  }

  function handleSequenceChange(value: string) {
    setSequenceText(value);
    const tokens = parseSequenceInput(value);
    const tokenErrors = validateSequenceTokens(tokens);

    if (tokenErrors.length > 0) {
      setSequenceMessage({
        id: "sequence-parse",
        level: "error",
        text: tokenErrors.join(" "),
      });
      return;
    }

    const currentTemplate = getTemplateById(project.templateId, templates);
    if (!currentTemplate) {
      setSequenceMessage({
        id: "sequence-template-missing",
        level: "error",
        text: `Current template "${project.templateId}" is missing.`,
      });
      return;
    }

    const nextProject = syncProjectToSequence(project, tokens, currentTemplate);

    replaceProject(nextProject);
    setSequenceMessage({
      id: "sequence-sync",
      level: "success",
      text: `Sequence updated to ${tokens.length} positions.`,
    });
  }

  function handleTemplateChange(templateId: string) {
    const template = getTemplateById(templateId, templates);

    if (!template) {
      setEditorMessage({
        id: "missing-template",
        level: "error",
        text: `Template "${templateId}" is not available.`,
      });
      return;
    }

    replaceProject(remapProjectToTemplate(project, template));
    setEditorMessage({
      id: "template-switch-success",
      level: "success",
      text: `Applied layout preset "${template.name}" to ${project.sequence.length} positions.`,
    });
  }

  async function handleProjectImport(file: File) {
    const text = await file.text();
    const result = parseProjectFile(text);

    if (result.errors.length > 0 || !result.project) {
      setEditorMessage({
        id: "project-import-failed",
        level: "error",
        text: result.errors.join(" "),
      });
      return;
    }

    if (
      result.embeddedTemplate &&
      !templates.some((template) => template.id === result.embeddedTemplate?.id)
    ) {
      setTemplates((current) => [...current, result.embeddedTemplate as RnaTemplate]);
    }

    replaceProject(result.project);
    setEditorMessage({
      id: "project-import-success",
      level: "success",
      text: `Imported project "${result.project.title}".`,
    });
  }

  async function handleTemplateImport(file: File) {
    const text = await file.text();
    const result = parseTemplateFile(text);

    if (result.errors.length > 0 || !result.template) {
      setEditorMessage({
        id: "template-import-failed",
        level: "error",
        text: result.errors.join(" "),
      });
      return;
    }

    setTemplates((current) => {
      const withoutOld = current.filter((template) => template.id !== result.template?.id);
      return [...withoutOld, result.template as RnaTemplate];
    });

    setEditorMessage({
      id: "template-import-success",
      level: "success",
      text: `Template "${result.template.name}" is available in the selector.`,
    });
  }

  function handleExportProject() {
    downloadText(
      serializeProject(project),
      `${slugifyTitle(project.title)}.json`,
      "application/json",
    );
  }

  function handleExportSvg() {
    if (!svgRef.current) {
      return;
    }

    const markup = createStandaloneSvgMarkup(svgRef.current, project.title);
    downloadText(markup, getSvgFilename(project.title), "image/svg+xml");
  }

  async function handleExportPng() {
    if (!svgRef.current) {
      return;
    }

    try {
      const markup = createStandaloneSvgMarkup(svgRef.current, project.title);
      await exportSvgMarkupToPng(
        markup,
        project.title,
        project.settings.canvasWidth,
        project.settings.canvasHeight,
        transparentPng,
      );
      setEditorMessage({
        id: "png-success",
        level: "success",
        text: "PNG export completed.",
      });
    } catch (error) {
      setEditorMessage({
        id: "png-failure",
        level: "error",
        text: error instanceof Error ? error.message : "PNG export failed.",
      });
    }
  }

  function handleLabelOffsetChange(label: RnaLabel, dx: number, dy: number) {
    dispatch({
      type: "update_label",
      id: label.id,
      patch: { dx, dy },
    });
  }

  function handleApplySecondaryStructure() {
    const result = parseViennaDotBracket(secondaryStructureText, project.sequence.length);

    if (result.error) {
      setEditorMessage({
        id: "vienna-error",
        level: "error",
        text: result.error,
      });
      return;
    }

    dispatch({ type: "replace_stems", stems: result.stems });
    setEditorMessage({
      id: "vienna-success",
      level: "success",
      text: `Applied ${result.stems.length} Vienna base pairs as visible stems.`,
    });
  }

  function handleAlignSelectedStem() {
    const group = getStemAlignmentGroup(selectedPos, project.stems, project.nucleotides);

    if (!group) {
      setEditorMessage({
        id: "stem-align-missing",
        level: "warning",
        text: "Select a nucleotide inside an acceptor, D, anticodon, or T stem before aligning.",
      });
      return;
    }

    const nucleotideMap = new Map(
      project.nucleotides.map((nucleotide) => [nucleotide.pos, nucleotide]),
    );
    const selectedGroup = [...group.topOrLeft, ...group.bottomOrRight]
      .map((pos) => nucleotideMap.get(pos))
      .filter((nucleotide): nucleotide is RnaNucleotide => Boolean(nucleotide));

    if (selectedGroup.length < 2) {
      setEditorMessage({
        id: "stem-align-empty",
        level: "warning",
        text: "The selected stem does not have enough visible positions to align.",
      });
      return;
    }

    const xs = selectedGroup.map((nucleotide) => nucleotide.x);
    const ys = selectedGroup.map((nucleotide) => nucleotide.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const step = 40;
    const gap = 80;
    const nextPositions: Array<{ pos: number; x: number; y: number }> = [];

    if (group.orientation === "vertical-arm") {
      const pairCount = Math.max(group.topOrLeft.length, group.bottomOrRight.length);
      const startY = centerY - ((pairCount - 1) * step) / 2;

      group.topOrLeft.forEach((pos, index) => {
        if (!nucleotideMap.has(pos)) {
          return;
        }
        nextPositions.push({
          pos,
          x: Math.round(centerX - gap / 2),
          y: Math.round(startY + index * step),
        });
      });
      group.bottomOrRight.forEach((pos, index) => {
        if (!nucleotideMap.has(pos)) {
          return;
        }
        nextPositions.push({
          pos,
          x: Math.round(centerX + gap / 2),
          y: Math.round(startY + index * step),
        });
      });
    } else {
      const pairCount = Math.max(group.topOrLeft.length, group.bottomOrRight.length);
      const startX = centerX - ((pairCount - 1) * step) / 2;

      group.topOrLeft.forEach((pos, index) => {
        if (!nucleotideMap.has(pos)) {
          return;
        }
        nextPositions.push({
          pos,
          x: Math.round(startX + index * step),
          y: Math.round(centerY - gap / 2),
        });
      });
      group.bottomOrRight.forEach((pos, index) => {
        if (!nucleotideMap.has(pos)) {
          return;
        }
        nextPositions.push({
          pos,
          x: Math.round(startX + index * step),
          y: Math.round(centerY + gap / 2),
        });
      });
    }

    dispatch({ type: "update_nucleotides", nucleotides: nextPositions });
    setEditorMessage({
      id: "stem-align-success",
      level: "success",
      text: "Aligned the selected ladder while keeping its local center in place.",
    });
  }

  return (
    <section className="editor-grid">
      <RNAToolbar
        project={project}
        templates={templates}
        sequenceText={sequenceText}
        secondaryStructureText={secondaryStructureText}
        transparentPng={transparentPng}
        projectInputRef={projectInputRef}
        templateInputRef={templateInputRef}
        onTitleChange={(value) => dispatch({ type: "update_title", title: value })}
        onTemplateChange={handleTemplateChange}
        onMoleculeTypeChange={(value) =>
          dispatch({ type: "update_molecule_type", moleculeType: value })
        }
        onSequenceChange={handleSequenceChange}
        onSecondaryStructureChange={setSecondaryStructureText}
        onApplySecondaryStructure={handleApplySecondaryStructure}
        onReapplyLayout={() => {
          const template = getTemplateById(project.templateId, templates);
          if (!template) {
            return;
          }
          replaceProject(remapProjectToTemplate(project, template));
          setEditorMessage({
            id: "layout-reset",
            level: "success",
            text: `Rebuilt the scaffold for ${project.sequence.length} positions.`,
          });
        }}
        onToggleSetting={(key, value) =>
          dispatch({ type: "update_setting", key, value })
        }
        onThemeChange={(value) =>
          dispatch({ type: "update_setting", key: "theme", value })
        }
        onFontSettingChange={(key, value) =>
          dispatch({ type: "update_setting", key, value })
        }
        onExportProject={handleExportProject}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onTransparentPngChange={setTransparentPng}
        onProjectFileSelected={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleProjectImport(file);
          }
          event.target.value = "";
        }}
        onTemplateFileSelected={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleTemplateImport(file);
          }
          event.target.value = "";
        }}
      />

      <div className="editor-main">
        <div className="main-top-grid">
          <ValidationPanel messages={validationMessages} />
          <RNAInspector
            nucleotide={selectedNucleotide}
            labelsAtPosition={labelsAtPosition}
            selectedLabelId={selectedLabel?.id ?? null}
            totalPositions={project.nucleotides.length}
            onSelectPos={setSelectedPos}
            onSelectLabel={setSelectedLabelId}
            onBaseChange={(value) => {
              if (!selectedPos) {
                return;
              }
              dispatch({ type: "update_nucleotide", pos: selectedPos, key: "base", value });
            }}
            onCoordinateChange={(key, value) => {
              if (!selectedPos || Number.isNaN(value)) {
                return;
              }
              dispatch({ type: "update_nucleotide", pos: selectedPos, key, value });
            }}
            onCreateMark={(kind, text, color) => {
              if (!selectedPos) {
                return;
              }
              createCanvasLabel(selectedPos, kind, text, color);
            }}
            onUpdateLabel={(id, key, value) => {
              dispatch({ type: "update_label", id, patch: { [key]: value } });
            }}
            onRemoveLabel={(id) => {
              dispatch({ type: "remove_label_by_id", id });
            }}
            onAlignSelectedStem={handleAlignSelectedStem}
            onInsertAfter={() => {
              const anchor = selectedNucleotide ?? project.nucleotides.at(-1);
              if (!anchor) {
                return;
              }
              dispatch({
                type: "insert_nucleotide",
                afterPos: anchor.pos,
                base: "N",
                x: anchor.x + 42,
                y: anchor.y,
              });
              setSelectedPos(anchor.pos + 1);
              setSelectedLabelId(null);
            }}
            onDeletePoint={() => {
              if (!selectedPos) {
                return;
              }
              dispatch({ type: "delete_nucleotide", pos: selectedPos });
              setSelectedPos((current) => {
                if (!current) {
                  return null;
                }
                return Math.max(1, current - 1);
              });
              setSelectedLabelId(null);
            }}
          />
        </div>
        <RNACanvas
          project={project}
          svgRef={svgRef}
          zoom={zoom}
          viewportCenter={viewportCenter}
          onZoomChange={setZoom}
          onFit={() => {
            const nextViewport = getViewportForProject(project);
            setZoom(nextViewport.zoom);
            setViewportCenter(nextViewport.center);
          }}
          mode={canvasMode}
          selectedPos={selectedPos}
          onModeChange={setCanvasMode}
          onSelectPos={(pos) => {
            setSelectedPos(pos);
            if (pos === null) {
              setSelectedLabelId(null);
            }
          }}
          onNucleotidePositionChange={(pos, x, y) => {
            dispatch({ type: "update_nucleotide", pos, key: "x", value: x });
            dispatch({ type: "update_nucleotide", pos, key: "y", value: y });
          }}
          onLabelOffsetChange={handleLabelOffsetChange}
          onRemoveLabel={(id) => {
            dispatch({ type: "remove_label_by_id", id });
          }}
          onCanvasInsert={(x, y) => {
            dispatch({
              type: "insert_nucleotide",
              afterPos: selectedPos ?? project.nucleotides.length,
              x,
              y,
              base: "N",
            });
            setSelectedPos((selectedPos ?? project.nucleotides.length) + 1);
            setSelectedLabelId(null);
            setCanvasMode("move-bases");
          }}
        />
        <section className="panel advanced-panel">
          <div className="section-heading">
            <h2>Advanced Table</h2>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowAdvancedTable((current) => !current)}
            >
              {showAdvancedTable ? "Hide" : "Show"}
            </button>
          </div>
          <p className="advanced-copy">
            Use this only for precise bulk tweaking. The main workflow is now direct dragging on
            the canvas.
          </p>
          {showAdvancedTable && (
            <RNATable
              rows={rows}
              onBaseChange={(pos, value) =>
                dispatch({ type: "update_nucleotide", pos, key: "base", value })
              }
              onCoordinateChange={(pos, key, value) => {
                if (Number.isNaN(value)) {
                  return;
                }

                dispatch({ type: "update_nucleotide", pos, key, value });
              }}
              onLabelChange={(pos, key, value) =>
                dispatch({ type: "upsert_label", pos, patch: { [key]: value } })
              }
              onRemoveLabel={(pos) => dispatch({ type: "remove_label", pos })}
            />
          )}
        </section>
      </div>
    </section>
  );
}
