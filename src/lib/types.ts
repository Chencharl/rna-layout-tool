export type MoleculeType = "tRNA" | "mRNA" | "rRNA" | "custom";
export type NumberingMode = "raw" | "trna_standard";
export type StemStyle = "line" | "dashed";
export type EditorTheme = "light" | "publication" | "slides";
export type LabelKind = "modification" | "adduct" | "note";

export type RnaNucleotide = {
  pos: number;
  base: string;
  x: number;
  y: number;
  visible?: boolean;
  fontSize?: number;
  color?: string;
};

export type RnaStem = {
  from: number;
  to: number;
  style?: StemStyle;
};

export type RnaLabel = {
  id: string;
  pos: number;
  kind: LabelKind;
  text: string;
  color: string;
  dx: number;
  dy: number;
  fontSize?: number;
  fontWeight?: number | string;
};

export type RnaAnnotation = {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
};

export type RnaSettings = {
  showPositionNumbers: boolean;
  showStemLines: boolean;
  canvasWidth: number;
  canvasHeight: number;
  nucleotideFontSize: number;
  numberFontSize: number;
  theme: EditorTheme;
};

export type RnaProject = {
  id: string;
  title: string;
  moleculeType: MoleculeType;
  sequence: string[];
  numberingMode: NumberingMode;
  templateId: string;
  nucleotides: RnaNucleotide[];
  stems: RnaStem[];
  labels: RnaLabel[];
  annotations: RnaAnnotation[];
  settings: RnaSettings;
};

export type RnaTemplate = {
  id: string;
  name: string;
  moleculeType: MoleculeType;
  length?: number;
  numberingMode?: NumberingMode;
  nucleotides: Array<{ pos: number; x: number; y: number }>;
  stems?: RnaStem[];
};

export type ValidationLevel = "error" | "warning" | "success";

export type ValidationMessage = {
  id: string;
  level: ValidationLevel;
  text: string;
};

export type TableRow = {
  pos: number;
  base: string;
  x: number;
  y: number;
  labelId?: string;
  labelText: string;
  labelColor: string;
  labelDx: number;
  labelDy: number;
};

export type MarkCatalogItem = {
  symbol: string;
  name: string;
  color: string;
  kind: Exclude<LabelKind, "note">;
  source: "symbol_mapping" | "mod_bank" | "manual";
};

export type PositionMarkRule = {
  pos: string;
  recommendedSymbols: string[];
  note?: string;
  confidence: "known" | "potential";
};
