import type { ChangeEvent, RefObject } from "react";

import type { RnaProject, RnaTemplate } from "@/lib/types";

type RNAToolbarProps = {
  project: RnaProject;
  templates: RnaTemplate[];
  sequenceText: string;
  secondaryStructureText: string;
  transparentPng: boolean;
  projectInputRef: RefObject<HTMLInputElement | null>;
  templateInputRef: RefObject<HTMLInputElement | null>;
  onTitleChange: (value: string) => void;
  onTemplateChange: (value: string) => void;
  onMoleculeTypeChange: (value: RnaProject["moleculeType"]) => void;
  onSequenceChange: (value: string) => void;
  onSecondaryStructureChange: (value: string) => void;
  onApplySecondaryStructure: () => void;
  onReapplyLayout: () => void;
  onToggleSetting: (
    key:
      | "showPositionNumbers"
      | "showOnlyModifiedPositions"
      | "showSprinzlOverlay"
      | "runSprinzlValidation"
      | "showStemLines",
    value: boolean,
  ) => void;
  onThemeChange: (value: RnaProject["settings"]["theme"]) => void;
  onFontSettingChange: (
    key: "nucleotideFontSize" | "numberFontSize",
    value: number,
  ) => void;
  onExportProject: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onTransparentPngChange: (value: boolean) => void;
  onProjectFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onTemplateFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function RNAToolbar({
  project,
  templates,
  sequenceText,
  secondaryStructureText,
  transparentPng,
  projectInputRef,
  templateInputRef,
  onTitleChange,
  onTemplateChange,
  onMoleculeTypeChange,
  onSequenceChange,
  onSecondaryStructureChange,
  onApplySecondaryStructure,
  onReapplyLayout,
  onToggleSetting,
  onThemeChange,
  onFontSettingChange,
  onExportProject,
  onExportSvg,
  onExportPng,
  onTransparentPngChange,
  onProjectFileSelected,
  onTemplateFileSelected,
}: RNAToolbarProps) {
  return (
    <aside className="toolbar-panel">
      <section className="panel">
        <div className="section-heading">
          <h2>Project</h2>
        </div>

        <label className="field">
          <span>Title</span>
          <input value={project.title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>

        <label className="field">
          <span>Layout preset</span>
          <select
            value={project.templateId}
            onChange={(event) => onTemplateChange(event.target.value)}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-note">
          <span>Sequence length: {project.sequence.length}</span>
          <button type="button" className="ghost-button" onClick={onReapplyLayout}>
            Rebuild Scaffold
          </button>
        </div>

        {project.mappingWarnings && project.mappingWarnings.length > 0 ? (
          <div className="warning-list">
            {project.mappingWarnings.map((warning, index) => (
              <p key={`${warning}-${index}`}>{warning}</p>
            ))}
          </div>
        ) : null}

        <label className="field">
          <span>Molecule Type</span>
          <select
            value={project.moleculeType}
            onChange={(event) =>
              onMoleculeTypeChange(event.target.value as RnaProject["moleculeType"])
            }
          >
            <option value="tRNA">tRNA</option>
            <option value="mRNA">mRNA</option>
            <option value="rRNA">rRNA</option>
            <option value="custom">custom</option>
          </select>
        </label>

        <label className="field">
          <span>Sequence</span>
          <textarea
            value={sequenceText}
            onChange={(event) => onSequenceChange(event.target.value)}
            rows={8}
          />
          <small>
            Paste the explicit sequence you want to draw. The canvas does not infer missing
            Sprinzl positions by default; turn on position numbers only when you are checking a
            mapping.
          </small>
        </label>

        <label className="field">
          <span>tRNA secondary structure</span>
          <textarea
            value={secondaryStructureText}
            onChange={(event) => onSecondaryStructureChange(event.target.value)}
            rows={4}
            placeholder="((((....))))...."
          />
          <small>
            Optional tRNAscan-SE / gtRNAdb-style dot-bracket. Leave blank to use the standard
            Sprinzl stem pairs.
          </small>
          <button type="button" className="ghost-button" onClick={onApplySecondaryStructure}>
            Use secondary structure
          </button>
        </label>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Display</h2>
        </div>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={project.settings.showPositionNumbers}
            onChange={(event) =>
              onToggleSetting("showPositionNumbers", event.target.checked)
            }
          />
          <span>Show positions</span>
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={Boolean(project.settings.showOnlyModifiedPositions)}
            onChange={(event) =>
              onToggleSetting("showOnlyModifiedPositions", event.target.checked)
            }
          />
          <span>Show modified positions</span>
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={Boolean(project.settings.showSprinzlOverlay)}
            onChange={(event) =>
              onToggleSetting("showSprinzlOverlay", event.target.checked)
            }
          />
          <span>Reference positions</span>
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={project.settings.showStemLines}
            onChange={(event) => onToggleSetting("showStemLines", event.target.checked)}
          />
          <span>Show pairing</span>
        </label>

        <label className="field">
          <span>Theme</span>
          <select
            value={project.settings.theme}
            onChange={(event) =>
              onThemeChange(event.target.value as RnaProject["settings"]["theme"])
            }
          >
            <option value="light">Light</option>
            <option value="publication">Publication</option>
            <option value="slides">Slides</option>
            <option value="base_only">Minimal</option>
          </select>
        </label>

        <label className="field">
          <span>Nucleotide font size</span>
          <input
            type="range"
            min="12"
            max="30"
            value={project.settings.nucleotideFontSize}
            onChange={(event) =>
              onFontSettingChange("nucleotideFontSize", Number(event.target.value))
            }
          />
        </label>

        <label className="field">
          <span>Number font size</span>
          <input
            type="range"
            min="8"
            max="18"
            value={project.settings.numberFontSize}
            onChange={(event) =>
              onFontSettingChange("numberFontSize", Number(event.target.value))
            }
          />
        </label>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Import / Export</h2>
        </div>

        <div className="button-grid">
          <button type="button" onClick={() => projectInputRef.current?.click()}>
            Import Project JSON
          </button>
          <button type="button" onClick={onExportProject}>
            Export JSON
          </button>
          <button type="button" onClick={() => templateInputRef.current?.click()}>
            Import Template JSON
          </button>
          <button type="button" onClick={onExportSvg}>
            Export SVG
          </button>
          <button type="button" onClick={onExportPng}>
            Export PNG
          </button>
        </div>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={transparentPng}
            onChange={(event) => onTransparentPngChange(event.target.checked)}
          />
          <span>Transparent PNG background</span>
        </label>

        <input
          ref={projectInputRef}
          type="file"
          accept="application/json"
          className="hidden-input"
          onChange={onProjectFileSelected}
        />
        <input
          ref={templateInputRef}
          type="file"
          accept="application/json"
          className="hidden-input"
          onChange={onTemplateFileSelected}
        />
      </section>
    </aside>
  );
}
