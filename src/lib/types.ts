export type MoleculeType = "tRNA" | "mRNA" | "rRNA" | "custom";
export type NumberingMode = "raw" | "trna_standard";
export type StemStyle = "line" | "dashed";
export type EditorTheme = "light" | "publication";
export type LabelKind = "modification" | "adduct" | "note";
export type AnnotationSource =
  | "current_user_input"
  | "current_project_annotation"
  | "imported_current_project"
  | "demo"
  | "default_template"
  | "previous_render"
  | "unknown";
export type RnaRegion =
  | "acceptor"
  | "d-loop"
  | "anticodon"
  | "variable"
  | "t-loop"
  | "tail"
  | "extra"
  | "terminal_stem"
  | "internal_stem"
  | "hairpin_loop"
  | "internal_loop"
  | "bulge"
  | "junction";
export type RnaDomainType =
  | "acceptor_candidate"
  | "D_arm_candidate"
  | "anticodon_arm_candidate"
  | "variable_region_candidate"
  | "T_arm_candidate"
  | "tail_candidate"
  | "unassigned_candidate"
  | "unknown";
export type RnaNodeStatus =
  | "present"
  | "missing"
  | "inserted"
  | "inferred"
  | "mismatch"
  | "unassigned_extra";
export type RnaPairStatus = "normal" | "wobble" | "mismatch" | "missing" | "custom";
export type RnaRenderMode =
  | "standard"
  | "sprinzl_template"
  | "sprinzl_validation"
  | "short_atypical"
  | "expanded_variable"
  | "long_variable_arm"
  | "rrna_5s_template"
  | "structure_constrained_mode"
  | "atypical_mode";

export type RnaNucleotide = {
  pos: number;
  base: string;
  x: number;
  y: number;
  sequenceIndex?: number;
  slotOrder?: number;
  originalToken?: string;
  positionLabel?: string;
  region?: RnaRegion;
  status?: RnaNodeStatus;
  modification?: string;
  pairingPartner?: string;
  pairStatus?: RnaPairStatus;
  dotBracketChar?: string;
  pairedIndex?: number;
  structuralDomain?: RnaDomainType;
  sprinzlLabel?: string;
  visible?: boolean;
  fontSize?: number;
  color?: string;
};

export type RnaStem = {
  from: number;
  to: number;
  style?: StemStyle;
  pairStatus?: RnaPairStatus;
};

export type RnaLabel = {
  id: string;
  pos: number;
  kind: LabelKind;
  source: AnnotationSource;
  text: string;
  color: string;
  dx: number;
  dy: number;
  fontSize?: number;
  fontWeight?: number | string;
};

export type RnaAnnotation = {
  id: string;
  text?: string;
  x?: number;
  y?: number;
  color?: string;
  position?: number;
  annotation_type?:
    | "modification"
    | "bisulfite_shift"
    | "five_prime_chemistry"
    | "three_prime_heterogeneity"
    | "isoform"
    | "truncation"
    | "extension";
  label?: string;
  color_group?: string;
  note?: string;
};

export type RnaSettings = {
  showPositionNumbers: boolean;
  showOnlyModifiedPositions: boolean;
  showSprinzlOverlay: boolean;
  runSprinzlValidation: boolean;
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
  mappingWarnings?: string[];
  renderMode?: RnaRenderMode;
  unassignedExtraBases?: string[];
  domains?: RnaDomain[];
  anticodon?: RnaAnticodonSummary;
  ccaStatus?: RnaCcaStatus;
};

export type RnaDomain = {
  id: string;
  type: RnaDomainType;
  range: { start: number; end: number };
  score?: RnaDomainScore;
  anchorPosition?: "top" | "bottom" | "left" | "right" | "center-right" | "top-right" | "unknown";
  stem?: {
    fivePrimeStart: number;
    fivePrimeEnd: number;
    threePrimeStart: number;
    threePrimeEnd: number;
    length: number;
  };
  tentative: boolean;
};

export type RnaDomainScore = {
  stemLength: number;
  loopSizeFitness: number;
  centrality: number;
  symmetry: number;
  total: number;
};

export type RnaCcaStatus = "full" | "partial" | "missing";

export type RnaAnticodonSummary = {
  sequence: string;
  confidence: "high" | "medium" | "low" | "unknown";
};

export type RnaTemplate = {
  id: string;
  name: string;
  moleculeType: MoleculeType;
  length?: number;
  numberingMode?: NumberingMode;
  nucleotides: Array<Partial<RnaNucleotide> & { pos: number; x: number; y: number }>;
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
  positionLabel?: string;
  sprinzlLabel?: string;
  sequenceIndex?: number;
  status?: RnaNodeStatus;
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
