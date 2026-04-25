"use client";

import { useState } from "react";

import { getDisplayPosition } from "@/lib/numbering";
import type { RnaLabel, RnaProject } from "@/lib/types";

type CanvasMode = "move-bases" | "move-labels" | "add-point";

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
  onCanvasInsert: (x: number, y: number) => void;
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
    stroke: "#6b7280",
    base: "#111827",
    number: "#475569",
    accent: "#1d4ed8",
    circleFill: "#ffffff",
    selectedFill: "#dbeafe",
  },
  slides: {
    background: "#f7fcff",
    stroke: "#4b5563",
    base: "#082f49",
    number: "#4b5563",
    accent: "#ea580c",
    circleFill: "#ffffff",
    selectedFill: "#ffedd5",
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

function getMarkFill(kind: RnaLabel["kind"]) {
  if (kind === "adduct") {
    return "#ecfdf5";
  }

  if (kind === "modification") {
    return "#fff7ed";
  }

  return "#f8fafc";
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
  onCanvasInsert,
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
  const tRnaNodeRadius = 17;
  const backbonePath = buildSmoothPath(
    orderedNucleotides.map((nucleotide) => ({ x: nucleotide.x, y: nucleotide.y })),
  );
  const tRnaBackbonePath = buildLinearPath(
    orderedNucleotides.map((nucleotide) => ({ x: nucleotide.x, y: nucleotide.y })),
  );
  const canvasCenter = {
    x: project.settings.canvasWidth / 2,
    y: project.settings.canvasHeight / 2,
  };
  const firstNucleotide = orderedNucleotides[0];
  const secondNucleotide = orderedNucleotides[1];
  const lastNucleotide = orderedNucleotides.at(-1);
  const previousNucleotide =
    orderedNucleotides.length > 1 ? orderedNucleotides[orderedNucleotides.length - 2] : undefined;
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
    const point = clientToSvg(event.clientX, event.clientY);

    if (mode === "add-point") {
      onCanvasInsert(Math.round(point.x), Math.round(point.y));
      return;
    }

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
              : `${project.title} with a continuous 5&apos;&rarr;3&apos; RNA backbone and publication-style secondary-structure scaffold. Drag bases, drag marks, or click to add a point.`}
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
            className={mode === "add-point" ? "active-button" : ""}
            onClick={() => onModeChange("add-point")}
          >
            Add Point
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
          {isConventionalTRna ? (
            <g pointerEvents="none" opacity="0.42">
              <line
                x1="0"
                y1={canvasCenter.y}
                x2={project.settings.canvasWidth}
                y2={canvasCenter.y}
                stroke="#cbd5e1"
                strokeDasharray="8 10"
                strokeWidth="1"
              />
              <line
                x1={canvasCenter.x}
                y1="0"
                x2={canvasCenter.x}
                y2={project.settings.canvasHeight}
                stroke="#cbd5e1"
                strokeDasharray="8 10"
                strokeWidth="1"
              />
              <text
                x={canvasCenter.x + 10}
                y="34"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="'IBM Plex Mono', 'SFMono-Regular', monospace"
              >
                Y
              </text>
              <text
                x={project.settings.canvasWidth - 34}
                y={canvasCenter.y - 10}
                fill="#94a3b8"
                fontSize="11"
                fontFamily="'IBM Plex Mono', 'SFMono-Regular', monospace"
              >
                X
              </text>
            </g>
          ) : null}
          {isConventionalTRna && tRnaBackbonePath ? (
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
          {!isConventionalTRna && backbonePath ? (
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
                  {...trimLine(from, to, isConventionalTRna ? tRnaNodeRadius : 18)}
                  stroke={isConventionalTRna ? theme.accent : theme.accent}
                  strokeDasharray={stem.style === "dashed" ? "5 5" : undefined}
                  strokeWidth={isConventionalTRna ? "2.8" : "4"}
                  strokeLinecap="round"
                  opacity="0.92"
                  pointerEvents="none"
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
              {isConventionalTRna ? (
                <circle
                  cx={nucleotide.x}
                  cy={nucleotide.y}
                  r={tRnaNodeRadius}
                  fill={selectedPos === nucleotide.pos ? theme.selectedFill : "#ffffff"}
                  stroke={selectedPos === nucleotide.pos ? theme.base : theme.accent}
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
                fontSize={
                  nucleotide.fontSize ??
                  (isConventionalTRna
                    ? Math.max(project.settings.nucleotideFontSize - 2, 13)
                    : project.settings.nucleotideFontSize)
                }
                fill={nucleotide.color ?? theme.base}
                fontFamily={
                  isConventionalTRna
                    ? "'Helvetica Neue', 'Arial', sans-serif"
                    : "'Avenir Next', 'Segoe UI', sans-serif"
                }
                fontWeight="700"
              >
                {nucleotide.base}
              </text>
              <circle
                cx={nucleotide.x}
                cy={nucleotide.y}
                r={isConventionalTRna ? tRnaNodeRadius : 18}
                fill="transparent"
                stroke="transparent"
              />
              {project.settings.showPositionNumbers && (
                (() => {
                  const numberPosition = isConventionalTRna
                    ? getRadialLabelPosition(nucleotide, canvasCenter, tRnaNodeRadius + 9)
                    : {
                        x: nucleotide.x + 22,
                        y: nucleotide.y - 18,
                      };

                  return (
                    <text
                      x={numberPosition.x}
                      y={numberPosition.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={
                        isConventionalTRna
                          ? Math.max(project.settings.numberFontSize - 1, 8)
                          : project.settings.numberFontSize
                      }
                      fill={isConventionalTRna ? "#dc2626" : theme.number}
                      fontFamily="'IBM Plex Mono', 'SFMono-Regular', monospace"
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {getDisplayPosition(nucleotide.pos, project.numberingMode)}
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
                {isConventionalTRna ? (
                  <rect
                    x={labelX - labelWidth / 2}
                    y={labelY - labelHeight / 2}
                    width={labelWidth}
                    height={labelHeight}
                    rx="7"
                    fill={getMarkFill(label.kind)}
                    stroke={label.color}
                    strokeOpacity="0.45"
                    strokeWidth="1"
                  />
                ) : null}
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
                  {label.text}
                </text>
                {isConventionalTRna ? (
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
          {project.annotations.map((annotation) => (
            <text
              key={annotation.id}
              x={annotation.x}
              y={annotation.y}
              fontSize="12"
              fill={annotation.color ?? theme.number}
            >
              {annotation.text}
            </text>
          ))}
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
