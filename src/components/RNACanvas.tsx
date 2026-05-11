"use client";

import { useState } from "react";

import { getDisplayPosition } from "@/lib/numbering";
import type { RnaLabel, RnaProject, RnaStem } from "@/lib/types";

type CanvasMode = "move-bases" | "move-labels" | "edit-bonds";

type RNACanvasProps = {
  project: RnaProject;
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoom: number;
  viewportCenter: { x: number; y: number };
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
  mode: CanvasMode;
  selectedPos: number | null;
  onModeChange: (mode: CanvasMode) => void;
  onSelectPos: (pos: number | null) => void;
  onNucleotidePositionChange: (pos: number, x: number, y: number) => void;
  onLabelOffsetChange: (label: RnaLabel, dx: number, dy: number) => void;
  onRemoveLabel: (id: string) => void;
  onBondNodeClick: (pos: number) => void;
  onRemoveStem: (stem: RnaStem) => void;
};

type DragState =
  | {
      kind: "label";
      label: RnaLabel;
      startX: number;
      startY: number;
      originDx: number;
      originDy: number;
    }
  | {
      kind: "nucleotide";
      pos: number;
      offsetX: number;
      offsetY: number;
    };

const THEME_STYLES = {
  light: {
    background: "#fffdf7",
    stroke: "#94a3b8",
    base: "#111827",
    number: "#475569",
    accent: "#0284c7",
    circleFill: "#ffffff",
    selectedFill: "#dcfce7",
  },
  publication: {
    background: "#ffffff",
    stroke: "#111827",
    base: "#050505",
    number: "#111827",
    accent: "#111827",
    circleFill: "transparent",
    selectedFill: "rgba(250, 204, 21, 0.24)",
  },
} as const;

function trimLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const unitX = dx / distance;
  const unitY = dy / distance;

  return {
    x1: from.x + unitX * radius,
    y1: from.y + unitY * radius,
    x2: to.x - unitX * radius,
    y2: to.y - unitY * radius,
  };
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }

  const last = points.at(-1);
  if (!last) {
    return path;
  }

  path += ` T ${last.x} ${last.y}`;
  return path;
}

function buildLinearPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
    )
    .join(" ");
}

function getTerminalLabelPosition(
  end: { x: number; y: number },
  neighbor?: { x: number; y: number },
  distance = 28,
) {
  if (!neighbor) {
    return { x: end.x, y: end.y - distance };
  }

  const dx = end.x - neighbor.x;
  const dy = end.y - neighbor.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: end.x + (dx / length) * distance,
    y: end.y + (dy / length) * distance,
  };
}

function getRadialLabelPosition(
  point: { x: number; y: number },
  center: { x: number; y: number },
  distance: number,
) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: point.x + (dx / length) * distance,
    y: point.y + (dy / length) * distance,
  };
}

function getStemStroke(pairStatus?: string) {
  if (pairStatus === "wobble") {
    return "#0f766e";
  }

  if (pairStatus === "mismatch") {
    return "#dc2626";
  }

  return undefined;
}

function getNucleotideDisplayText(nucleotide: RnaProject["nucleotides"][number]) {
  return nucleotide.modification && nucleotide.status !== "missing"
    ? nucleotide.modification
    : nucleotide.base;
}

function getNucleotideTextFill(
  nucleotide: RnaProject["nucleotides"][number],
  defaultFill: string,
) {
  if (nucleotide.status === "missing") {
    return "#94a3b8";
  }

  if (nucleotide.modification) {
    return "#ff0000";
  }

  return nucleotide.color ?? defaultFill;
}

function getNucleotideTextSize(
  nucleotide: RnaProject["nucleotides"][number],
  baseFontSize: number,
) {
  const displayText = getNucleotideDisplayText(nucleotide);

  if (!nucleotide.modification) {
    return baseFontSize;
  }

  return Math.max(10, baseFontSize - Math.max(0, displayText.length - 2) * 1.4);
}

function renderSymbolWithSuperscriptDigits(text: string, enabled: boolean) {
  if (!enabled) {
    return text;
  }

  return text.split(/(\d+)/).map((part, index) =>
    /^\d+$/.test(part) ? (
      <tspan key={`${part}-${index}`} baselineShift="super" fontSize="70%">
        {part}
      </tspan>
    ) : (
      <tspan key={`${part}-${index}`}>{part}</tspan>
    ),
  );
}

function getAnnotationColor(annotation: RnaProject["annotations"][number]) {
  if (annotation.color) {
    return annotation.color;
  }

  if (annotation.annotation_type === "bisulfite_shift") {
    return "#7c3aed";
  }

  if (annotation.annotation_type === "modification") {
    return "#dc2626";
  }

  if (
    annotation.annotation_type === "five_prime_chemistry" ||
    annotation.annotation_type === "three_prime_heterogeneity"
  ) {
    return "#2563eb";
  }

  return "#475569";
}

export function RNACanvas({
  project,
  svgRef,
  zoom,
  viewportCenter,
  onZoomChange,
  onFit,
  mode,
  selectedPos,
  onModeChange,
  onSelectPos,
  onNucleotidePositionChange,
  onLabelOffsetChange,
  onRemoveLabel,
  onBondNodeClick,
  onRemoveStem,
}: RNACanvasProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const theme = THEME_STYLES[project.settings.theme];
  const viewWidth = project.settings.canvasWidth / zoom;
  const viewHeight = project.settings.canvasHeight / zoom;
  const viewX = Math.max(
    0,
    Math.min(project.settings.canvasWidth - viewWidth, viewportCenter.x - viewWidth / 2),
  );
  const viewY = Math.max(
    0,
    Math.min(project.settings.canvasHeight - viewHeight, viewportCenter.y - viewHeight / 2),
  );
  const orderedNucleotides = [...project.nucleotides].sort((left, right) => left.pos - right.pos);
  const isConventionalTRna =
    project.moleculeType === "tRNA" && project.templateId === "trna_classic";
  const isFiveSRrna = project.templateId === "rrna_5s_secondary_structure";
  const sequenceOrderedNucleotides = [...project.nucleotides]
    .filter((nucleotide) => nucleotide.sequenceIndex !== undefined)
    .sort(
      (left, right) =>
        (left.sequenceIndex ?? Number.MAX_SAFE_INTEGER) -
          (right.sequenceIndex ?? Number.MAX_SAFE_INTEGER) ||
        left.pos - right.pos,
    );
  const slotOrderedNucleotides = [...project.nucleotides]
    .filter(
      (nucleotide) =>
        nucleotide.sequenceIndex !== undefined &&
        nucleotide.slotOrder !== undefined &&
        nucleotide.status !== "missing" &&
        nucleotide.status !== "unassigned_extra",
    )
    .sort(
      (left, right) =>
        (left.slotOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.slotOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.pos - right.pos,
    );
  const isBaseOnly = project.settings.theme === "publication";
  const isPlainTextStructure = isBaseOnly || isFiveSRrna;
  const isStructureConstrained =
    project.renderMode === "structure_constrained_mode" ||
    project.renderMode === "atypical_mode";
  const tRnaNodeRadius = isBaseOnly ? 11 : 17;
  const backboneSourceNodes =
    isConventionalTRna && slotOrderedNucleotides.length > 0
      ? slotOrderedNucleotides
      : sequenceOrderedNucleotides.length > 0
        ? sequenceOrderedNucleotides
        : orderedNucleotides;
  const backbonePath = buildSmoothPath(
    backboneSourceNodes.map((nucleotide) => ({ x: nucleotide.x, y: nucleotide.y })),
  );
  const tRnaBackbonePath = buildLinearPath(
    backboneSourceNodes.map((nucleotide) => ({ x: nucleotide.x, y: nucleotide.y })),
  );
  const backboneSegments = backboneSourceNodes
    .slice(0, -1)
    .map((nucleotide, index) => ({
      from: nucleotide,
      to: backboneSourceNodes[index + 1],
    }))
    .filter((segment) => {
      if (!isStructureConstrained) {
        return true;
      }

      return (
        segment.from.sequenceIndex !== undefined &&
        segment.to.sequenceIndex !== undefined &&
        segment.to.sequenceIndex === segment.from.sequenceIndex + 1
      );
    });
  const canvasCenter = {
    x: project.settings.canvasWidth / 2,
    y: project.settings.canvasHeight / 2,
  };
  const firstNucleotide = backboneSourceNodes[0];
  const secondNucleotide = backboneSourceNodes[1];
  const lastNucleotide = backboneSourceNodes.at(-1);
  const previousNucleotide = backboneSourceNodes.at(-2);
  const fivePrimeLabel = firstNucleotide
    ? getTerminalLabelPosition(firstNucleotide, secondNucleotide)
    : null;
  const threePrimeLabel = lastNucleotide
    ? getTerminalLabelPosition(lastNucleotide, previousNucleotide)
    : null;

  function clientToSvg(clientX: number, clientY: number) {
    if (!svgRef.current) {
      return { x: 0, y: 0 };
    }

    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: viewX + ((clientX - rect.left) / rect.width) * viewWidth,
      y: viewY + ((clientY - rect.top) / rect.height) * viewHeight,
    };
  }

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!dragState) {
      return;
    }

    const point = clientToSvg(event.clientX, event.clientY);

    if (dragState.kind === "label") {
      const dx = dragState.originDx + (point.x - dragState.startX);
      const dy = dragState.originDy + (point.y - dragState.startY);
      onLabelOffsetChange(dragState.label, Math.round(dx), Math.round(dy));
      return;
    }

    onNucleotidePositionChange(
      dragState.pos,
      Math.round(point.x + dragState.offsetX),
      Math.round(point.y + dragState.offsetY),
    );
  }

  function handleMouseUp() {
    setDragState(null);
  }

  function handleLabelMouseDown(
    event: React.MouseEvent<SVGElement>,
    label: RnaLabel,
  ) {
    event.stopPropagation();
    onSelectPos(label.pos);

    if (mode !== "move-labels") {
      return;
    }

    const point = clientToSvg(event.clientX, event.clientY);
    setDragState({
      kind: "label",
      label,
      startX: point.x,
      startY: point.y,
      originDx: label.dx,
      originDy: label.dy,
    });
  }

  function handleNucleotideMouseDown(
    event: React.MouseEvent<SVGGElement>,
    pos: number,
    x: number,
    y: number,
  ) {
    event.stopPropagation();
    onSelectPos(pos);

    if (mode === "edit-bonds") {
      onBondNodeClick(pos);
      return;
    }

    if (mode !== "move-bases") {
      return;
    }

    const point = clientToSvg(event.clientX, event.clientY);
    setDragState({
      kind: "nucleotide",
      pos,
      offsetX: x - point.x,
      offsetY: y - point.y,
    });
  }

  function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    onSelectPos(null);
  }

  return (
    <section className="canvas-panel">
      <div className="section-heading canvas-heading">
        <div>
          <h2>Canvas</h2>
          <p>
            {isConventionalTRna
              ? `${project.title} as a connected tRNA cloverleaf map. Each nucleotide stays on one continuous RNA chain while stem pairings remain visible.`
              : isFiveSRrna
                ? `${project.title} on a fixed 5S rRNA secondary-structure template. Pairing lines and coordinates come from the template, not from structure prediction.`
              : `${project.title} with a continuous 5&apos;&rarr;3&apos; RNA backbone and publication-style secondary-structure scaffold. Drag bases, drag marks, or edit pair bonds directly.`}
          </p>
        </div>
        <div className="canvas-actions">
          <button
            type="button"
            className={mode === "move-bases" ? "active-button" : ""}
            onClick={() => onModeChange("move-bases")}
          >
            Move Bases
          </button>
          <button
            type="button"
            className={mode === "move-labels" ? "active-button" : ""}
            onClick={() => onModeChange("move-labels")}
          >
            Move Labels
          </button>
          <button
            type="button"
            className={mode === "edit-bonds" ? "active-button" : ""}
            onClick={() => onModeChange("edit-bonds")}
          >
            Edit Bonds
          </button>
          <button type="button" onClick={() => onZoomChange(Math.min(zoom + 0.2, 3))}>
            Zoom In
          </button>
          <button type="button" onClick={() => onZoomChange(Math.max(zoom - 0.2, 0.4))}>
            Zoom Out
          </button>
          <button type="button" onClick={onFit}>
            Fit
          </button>
        </div>
      </div>
      <div className="canvas-shell">
        <svg
          ref={svgRef}
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          width="100%"
          height="100%"
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          role="img"
          aria-label={`${project.title} RNA layout`}
        >
          <rect
            x="0"
            y="0"
            width={project.settings.canvasWidth}
            height={project.settings.canvasHeight}
            fill={theme.background}
            rx="24"
          />
          {isStructureConstrained && !isPlainTextStructure ? (
            <g pointerEvents="none">
              {backboneSegments.map((segment) => (
                <line
                  key={`backbone-${segment.from.pos}-${segment.to.pos}`}
                  x1={segment.from.x}
                  y1={segment.from.y}
                  x2={segment.to.x}
                  y2={segment.to.y}
                  stroke={theme.accent}
                  strokeOpacity="0.3"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
              ))}
            </g>
          ) : null}
          {isConventionalTRna && tRnaBackbonePath && !isPlainTextStructure && !isStructureConstrained ? (
            <path
              d={tRnaBackbonePath}
              fill="none"
              stroke={theme.accent}
              strokeOpacity={0.34}
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ) : null}
          {!isConventionalTRna && backbonePath && !isPlainTextStructure && !isStructureConstrained ? (
            <path
              d={backbonePath}
              fill="none"
              stroke={theme.accent}
              strokeOpacity={0.28}
              strokeWidth={project.moleculeType === "mRNA" ? 10 : 14}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ) : null}
          {project.settings.showStemLines &&
            project.stems.map((stem) => {
              const from = project.nucleotides.find((nucleotide) => nucleotide.pos === stem.from);
              const to = project.nucleotides.find((nucleotide) => nucleotide.pos === stem.to);

              if (!from || !to) {
                return null;
              }

              return (
                <line
                  key={`${stem.from}-${stem.to}`}
                  {...trimLine(
                    from,
                    to,
                    isPlainTextStructure ? 13 : isConventionalTRna ? tRnaNodeRadius : 18,
                  )}
                  stroke={getStemStroke(stem.pairStatus) ?? theme.accent}
                  strokeDasharray={stem.style === "dashed" ? "5 5" : undefined}
                  strokeWidth={isPlainTextStructure ? "2.2" : isConventionalTRna ? "2.8" : "4"}
                  strokeLinecap="round"
                  opacity={isPlainTextStructure ? "0.95" : "0.92"}
                  pointerEvents={mode === "edit-bonds" ? "visibleStroke" : "none"}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemoveStem(stem);
                  }}
                />
              );
            })}
          {project.nucleotides.map((nucleotide) => (
            <g
              key={nucleotide.pos}
              onMouseDown={(event) =>
                handleNucleotideMouseDown(event, nucleotide.pos, nucleotide.x, nucleotide.y)
              }
            >
              {isPlainTextStructure ? (
                <circle
                  cx={nucleotide.x}
                  cy={nucleotide.y}
                  r="16"
                  fill={selectedPos === nucleotide.pos ? theme.selectedFill : "transparent"}
                  stroke={
                    selectedPos === nucleotide.pos
                      ? "#f59e0b"
                      : nucleotide.status === "missing"
                        ? "#d1d5db"
                        : "transparent"
                  }
                  strokeDasharray={nucleotide.status === "missing" ? "3 5" : undefined}
                  strokeWidth={nucleotide.status === "missing" ? "1.4" : "2"}
                />
              ) : isConventionalTRna ? (
                <circle
                  cx={nucleotide.x}
                  cy={nucleotide.y}
                  r={tRnaNodeRadius}
                  fill={
                    selectedPos === nucleotide.pos
                      ? theme.selectedFill
                      : nucleotide.status === "missing"
                        ? "#f8fafc"
                        : "#ffffff"
                  }
                  stroke={
                    selectedPos === nucleotide.pos
                      ? theme.base
                      : nucleotide.status === "missing"
                        ? "#cbd5e1"
                        : nucleotide.status === "mismatch"
                          ? "#dc2626"
                          : theme.accent
                  }
                  strokeDasharray={nucleotide.status === "missing" ? "4 4" : undefined}
                  strokeWidth={selectedPos === nucleotide.pos ? "3.2" : "2.6"}
                />
              ) : (
                <circle
                  cx={nucleotide.x}
                  cy={nucleotide.y}
                  r="18"
                  fill={selectedPos === nucleotide.pos ? theme.selectedFill : theme.circleFill}
                  stroke={selectedPos === nucleotide.pos ? theme.base : theme.accent}
                  strokeWidth={selectedPos === nucleotide.pos ? 3.5 : 2.8}
                />
              )}
              <text
                x={nucleotide.x}
                y={nucleotide.y}
                textAnchor="middle"
                dominantBaseline="middle"
                  fontSize={getNucleotideTextSize(
                  nucleotide,
                  nucleotide.fontSize ??
                    (isConventionalTRna
                      ? isPlainTextStructure
                        ? Math.max(project.settings.nucleotideFontSize + 1, 15)
                        : Math.max(project.settings.nucleotideFontSize - 2, 13)
                      : project.settings.nucleotideFontSize),
                )}
                fill={getNucleotideTextFill(nucleotide, theme.base)}
                fontFamily={
                  isConventionalTRna
                    ? "'Helvetica Neue', 'Arial', sans-serif"
                    : "'Avenir Next', 'Segoe UI', sans-serif"
                }
                fontWeight="700"
              >
                {nucleotide.status === "missing"
                  ? ""
                  : renderSymbolWithSuperscriptDigits(
                      getNucleotideDisplayText(nucleotide),
                      Boolean(nucleotide.modification),
                    )}
              </text>
              <circle
                cx={nucleotide.x}
                cy={nucleotide.y}
                r={isConventionalTRna ? tRnaNodeRadius : 18}
                fill="transparent"
                stroke="transparent"
              />
              {(project.settings.showPositionNumbers ||
                isFiveSRrna ||
                (project.settings.showOnlyModifiedPositions && nucleotide.modification)) && (
                (() => {
                  const displayLabel =
                    nucleotide.positionLabel ??
                    nucleotide.sprinzlLabel ??
                    nucleotide.sequenceIndex?.toString() ??
                    getDisplayPosition(nucleotide.pos, project.numberingMode);

                  if (!displayLabel) {
                    return null;
                  }

                  const numberPosition = isConventionalTRna
                    ? getRadialLabelPosition(nucleotide, canvasCenter, tRnaNodeRadius + 9)
                    : {
                        x: nucleotide.x + (isFiveSRrna ? 20 : 22),
                        y: nucleotide.y - (isFiveSRrna ? 14 : 18),
                      };

                  return (
                    <text
                      x={numberPosition.x}
                      y={numberPosition.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={
                        isConventionalTRna
                          ? isPlainTextStructure
                            ? Math.max(project.settings.numberFontSize, 9)
                            : Math.max(project.settings.numberFontSize - 1, 8)
                          : isFiveSRrna
                            ? Math.max(project.settings.numberFontSize - 1, 8)
                            : project.settings.numberFontSize
                      }
                      fill={isFiveSRrna ? "#9ca3af" : isPlainTextStructure ? theme.number : isConventionalTRna ? "#dc2626" : theme.number}
                      fontFamily="'IBM Plex Mono', 'SFMono-Regular', monospace"
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {displayLabel}
                    </text>
                  );
                })()
              )}
            </g>
          ))}
          {project.labels.map((label) => {
            const target = project.nucleotides.find((nucleotide) => nucleotide.pos === label.pos);

            if (!target) {
              return null;
            }

            const labelX = target.x + label.dx;
            const labelY = target.y + label.dy;
            const labelFontSize = label.fontSize ?? (isConventionalTRna ? 13 : 12);
            const labelWidth = Math.max(28, label.text.length * labelFontSize * 0.62 + 14);
            const labelHeight = labelFontSize + 9;

            return (
              <g
                key={label.id}
                cursor={mode === "move-labels" ? "grab" : "pointer"}
                onMouseDown={(event) => handleLabelMouseDown(event, label)}
              >
                <line
                  x1={target.x}
                  y1={target.y}
                  x2={labelX}
                  y2={labelY}
                  stroke={label.color}
                  strokeOpacity="0.42"
                  strokeWidth={isConventionalTRna ? "1" : "1.5"}
                  pointerEvents="none"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={isConventionalTRna ? "middle" : undefined}
                  dominantBaseline={isConventionalTRna ? "middle" : undefined}
                  fontSize={labelFontSize}
                  fontWeight={label.fontWeight ?? 700}
                  fill={label.color}
                  fontFamily={
                    isConventionalTRna
                      ? "'Helvetica Neue', 'Avenir Next', 'Segoe UI', sans-serif"
                      : "'Avenir Next', 'Segoe UI', sans-serif"
                  }
                >
                  {renderSymbolWithSuperscriptDigits(label.text, label.kind !== "note")}
                </text>
                {isConventionalTRna && !isBaseOnly ? (
                  <g
                    role="button"
                    aria-label={`Remove ${label.text}`}
                    cursor="pointer"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveLabel(label.id);
                    }}
                  >
                    <circle
                      cx={labelX + labelWidth / 2 + 8}
                      cy={labelY - labelHeight / 2 - 2}
                      r="7"
                      fill="#fee2e2"
                      stroke="#ef4444"
                      strokeWidth="1"
                    />
                    <text
                      x={labelX + labelWidth / 2 + 8}
                      y={labelY - labelHeight / 2 - 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="10"
                      fill="#991b1b"
                      fontWeight="800"
                      pointerEvents="none"
                    >
                      ×
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
          {project.annotations.map((annotation) => {
            const target =
              annotation.position !== undefined
                ? project.nucleotides.find((nucleotide) => nucleotide.pos === annotation.position)
                : undefined;
            const x = target ? target.x + 18 : annotation.x;
            const y = target ? target.y - 18 : annotation.y;
            const label = annotation.label ?? annotation.text;

            if (x === undefined || y === undefined || !label) {
              return null;
            }

            const color = getAnnotationColor(annotation);
            const showDot =
              annotation.annotation_type === "modification" ||
              annotation.annotation_type === "bisulfite_shift";

            return (
              <g key={annotation.id} pointerEvents="none">
                {showDot && target ? (
                  <circle
                    cx={target.x + 10}
                    cy={target.y - 10}
                    r="4"
                    fill={color}
                    opacity="0.86"
                  />
                ) : null}
                <text
                  x={x}
                  y={y}
                  fontSize="12"
                  fill={color}
                  fontWeight={showDot ? "700" : "600"}
                >
                  {label}
                </text>
              </g>
            );
          })}
          {fivePrimeLabel ? (
            <text
              x={fivePrimeLabel.x}
              y={fivePrimeLabel.y}
              fontSize="18"
              fill={theme.base}
              fontWeight="700"
              fontFamily={
                isConventionalTRna
                  ? "'Helvetica Neue', 'Avenir Next', 'Segoe UI', sans-serif"
                  : "'Avenir Next', 'Segoe UI', sans-serif"
              }
              pointerEvents="none"
            >
              5&apos;
            </text>
          ) : null}
          {threePrimeLabel ? (
            <text
              x={threePrimeLabel.x}
              y={threePrimeLabel.y}
              fontSize="18"
              fill={theme.base}
              fontWeight="700"
              fontFamily={
                isConventionalTRna
                  ? "'Helvetica Neue', 'Avenir Next', 'Segoe UI', sans-serif"
                  : "'Avenir Next', 'Segoe UI', sans-serif"
              }
              pointerEvents="none"
            >
              3&apos;
            </text>
          ) : null}
          {isConventionalTRna && threePrimeLabel ? (
            <text
              x={threePrimeLabel.x + 20}
              y={threePrimeLabel.y + 10}
              fontSize="12"
              fill={theme.base}
              fontWeight="600"
              fontFamily="'Helvetica Neue', 'Avenir Next', 'Segoe UI', sans-serif"
              pointerEvents="none"
            >
              OH
            </text>
          ) : null}
        </svg>
      </div>
    </section>
  );
}
