import { useMemo, useState } from "react";

import type { RnaLabel, RnaNucleotide } from "@/lib/types";

type RNAInspectorProps = {
  nucleotide?: RnaNucleotide;
  labelsAtPosition: RnaLabel[];
  selectedLabelId: string | null;
  totalPositions: number;
  onSelectPos: (pos: number) => void;
  onSelectLabel: (id: string | null) => void;
  onBaseChange: (value: string) => void;
  onPositionLabelChange: (value: string) => void;
  onCoordinateChange: (key: "x" | "y", value: number) => void;
  onCreateMark: (kind: "modification" | "adduct" | "note", text: string, color?: string) => void;
  onUpdateLabel: (id: string, key: "text" | "color" | "dx" | "dy", value: string | number) => void;
  onRemoveLabel: (id: string) => void;
  onAlignSelectedStem: () => void;
  onInsertAfter: () => void;
  onDeletePoint: () => void;
};

export function RNAInspector({
  nucleotide,
  labelsAtPosition,
  selectedLabelId,
  totalPositions,
  onSelectPos,
  onSelectLabel,
  onBaseChange,
  onPositionLabelChange,
  onCoordinateChange,
  onCreateMark,
  onUpdateLabel,
  onRemoveLabel,
  onAlignSelectedStem,
  onInsertAfter,
  onDeletePoint,
}: RNAInspectorProps) {
  const [noteDraft, setNoteDraft] = useState("");
  const [modificationDraft, setModificationDraft] = useState("");
  const [adductDraft, setAdductDraft] = useState("");

  const activeLabel = useMemo(
    () => labelsAtPosition.find((label) => label.id === selectedLabelId) ?? labelsAtPosition[0],
    [labelsAtPosition, selectedLabelId],
  );

  return (
    <section className="panel inspector-panel">
      <div className="section-heading">
        <h2>Position Editor</h2>
        <span className="pill">
          {nucleotide
            ? `Pos ${nucleotide.positionLabel ?? nucleotide.pos}`
            : "Choose a position"}
        </span>
      </div>

      <div className="inspector-grid">
        <label className="field">
          <span>Position</span>
          <select
            value={nucleotide?.pos ?? ""}
            onChange={(event) => onSelectPos(Number(event.target.value))}
          >
            {Array.from({ length: totalPositions }, (_, index) => index + 1).map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Display position label</span>
          <input
            value={nucleotide?.positionLabel ?? ""}
            placeholder="Manual label, e.g. 17A or 20B"
            onChange={(event) => onPositionLabelChange(event.target.value)}
            disabled={!nucleotide}
          />
          {nucleotide?.sprinzlLabel ? (
            <small>Reference slot: {nucleotide.sprinzlLabel}</small>
          ) : null}
        </label>

        <label className="field">
          <span>Base / token</span>
          <input
            value={nucleotide?.originalToken ?? nucleotide?.modification ?? nucleotide?.base ?? ""}
            onChange={(event) => onBaseChange(event.target.value)}
            disabled={!nucleotide}
          />
        </label>

        <label className="field">
          <span>X</span>
          <input
            type="number"
            value={nucleotide?.x ?? 0}
            onChange={(event) => onCoordinateChange("x", Number(event.target.value))}
            disabled={!nucleotide}
          />
        </label>

        <label className="field">
          <span>Y</span>
          <input
            type="number"
            value={nucleotide?.y ?? 0}
            onChange={(event) => onCoordinateChange("y", Number(event.target.value))}
            disabled={!nucleotide}
          />
        </label>
      </div>

      <div className="inspector-subsection">
        <h3>Add mark to this position</h3>
        <div className="custom-mark-row">
          <input
            value={modificationDraft}
            placeholder="Add custom modification"
            onChange={(event) => setModificationDraft(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (!modificationDraft.trim()) {
                return;
              }
              onCreateMark("modification", modificationDraft.trim(), "#b91c1c");
              setModificationDraft("");
            }}
          >
            Add Modification
          </button>
        </div>
        <div className="custom-mark-row">
          <input
            value={adductDraft}
            placeholder="Add adduct"
            onChange={(event) => setAdductDraft(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (!adductDraft.trim()) {
                return;
              }
              onCreateMark("adduct", adductDraft.trim(), "#9a3412");
              setAdductDraft("");
            }}
          >
            Add Adduct
          </button>
        </div>
        <div className="custom-mark-row">
          <input
            value={noteDraft}
            placeholder="Add free-text note"
            onChange={(event) => setNoteDraft(event.target.value)}
          />
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              if (!noteDraft.trim()) {
                return;
              }
              onCreateMark("note", noteDraft.trim(), "#475569");
              setNoteDraft("");
            }}
          >
            Add Note
          </button>
        </div>
      </div>

      <div className="inspector-subsection">
        <h3>Marks on this position</h3>
        <div className="mark-pill-row">
          {labelsAtPosition.length > 0 ? (
            labelsAtPosition.map((label) => (
              <button
                key={label.id}
                type="button"
                className={label.id === activeLabel?.id ? "mark-pill active" : "mark-pill"}
                onClick={() => onSelectLabel(label.id)}
              >
                {label.kind}: {label.text}
              </button>
            ))
          ) : (
            <p className="empty-state">No mark is attached to this position yet.</p>
          )}
        </div>

        {activeLabel && (
          <div className="inspector-grid">
            <label className="field full-span">
              <span>Selected mark text</span>
              <input
                value={activeLabel.text}
                onChange={(event) => onUpdateLabel(activeLabel.id, "text", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Color</span>
              <input
                value={activeLabel.color}
                onChange={(event) => onUpdateLabel(activeLabel.id, "color", event.target.value)}
              />
            </label>

            <label className="field">
              <span>dx</span>
              <input
                type="number"
                value={activeLabel.dx}
                onChange={(event) => onUpdateLabel(activeLabel.id, "dx", Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>dy</span>
              <input
                type="number"
                value={activeLabel.dy}
                onChange={(event) => onUpdateLabel(activeLabel.id, "dy", Number(event.target.value))}
              />
            </label>
          </div>
        )}
      </div>

      <div className="button-grid inspector-actions">
        <button type="button" className="ghost-button" onClick={onAlignSelectedStem} disabled={!nucleotide}>
          Align Selected Ladder
        </button>
        <button type="button" onClick={onInsertAfter}>
          Add After Selected
        </button>
        {activeLabel ? (
          <button type="button" className="ghost-button" onClick={() => onRemoveLabel(activeLabel.id)}>
            Remove Mark
          </button>
        ) : (
          <button type="button" className="ghost-button" disabled>
            Remove Mark
          </button>
        )}
        <button type="button" className="danger-button" onClick={onDeletePoint}>
          Delete Point
        </button>
      </div>
    </section>
  );
}
