import { getCatalogItem, getDisplayBaseForToken } from "./biology";
import { parseDotBracketStructure } from "./structureLayout";
import type { RnaNucleotide, RnaPairStatus, RnaRenderMode, RnaStem } from "./types";

type SlotRegion =
  | "acceptor"
  | "d-loop"
  | "anticodon"
  | "variable"
  | "t-loop"
  | "tail"
  | "extra";

type Slot = {
  id: string;
  pos: number;
  region: SlotRegion;
  x: number;
  y: number;
  pairingPartner?: string;
  enabled: boolean;
  occupied: boolean;
  base: string | null;
  modification: string | null;
  token?: string;
  sequenceIndex?: number;
};

type ParsedToken = {
  token: string;
  base: string;
  modification: string | null;
  isUnknownModification: boolean;
};

type CcaTailMap = {
  startIndex: number;
  assignments: Array<{ slotId: "74" | "75" | "76"; sequenceIndex: number }>;
  status: "full" | "partial" | "missing";
};

export type SprinzlLayoutResult = {
  mappedPositions: RnaNucleotide[];
  warnings: string[];
  unassignedExtraBases: string[];
  renderMode: RnaRenderMode;
  stems: RnaStem[];
};

const STEP = 40;
const GAP = 80;
const VARIABLE_STEM_CAPACITY = 7;
const VARIABLE_LOOP_CAPACITY = 5;

const ACCEPTOR_5 = ["1", "2", "3", "4", "5", "6", "7"];
const ACCEPTOR_3 = ["66", "67", "68", "69", "70", "71", "72"];
const ACCEPTOR_RIGHT_TO_LEFT = ["66", "67", "68", "69", "70", "71", "72", "73"];
const D_CORE = [
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
];
const D_INSERTIONS = ["17a", "17b", "20a", "20b"];
const ANTICODON_CORE = [
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
];
const VARIABLE_BRIDGE_5 = ["44", "45"];
const VARIABLE_CLASS_I_LOOP = ["v1", "v2", "v3", "v4", "v5"];
const VARIABLE_E_LOOP = ["e1", "e2", "e3", "e4", "e5"];
const VARIABLE_STEM_5 = ["e11", "e12", "e13", "e14", "e15", "e16", "e17"];
const VARIABLE_STEM_3 = ["e27", "e26", "e25", "e24", "e23", "e22", "e21"];
const VARIABLE_BRIDGE_3 = ["46", "47", "48"];
const T_CORE = [
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
];
const TAIL = ["74", "75", "76"];

const CANONICAL_PAIR_IDS: Array<[string, string]> = [
  ["1", "72"],
  ["2", "71"],
  ["3", "70"],
  ["4", "69"],
  ["5", "68"],
  ["6", "67"],
  ["7", "66"],
  ["10", "25"],
  ["11", "24"],
  ["12", "23"],
  ["13", "22"],
  ["27", "43"],
  ["28", "42"],
  ["29", "41"],
  ["30", "40"],
  ["31", "39"],
  ["49", "65"],
  ["50", "64"],
  ["51", "63"],
  ["52", "62"],
  ["53", "61"],
  ["e11", "e21"],
  ["e12", "e22"],
  ["e13", "e23"],
  ["e14", "e24"],
  ["e15", "e25"],
  ["e16", "e26"],
  ["e17", "e27"],
];

const SPRINZL_SLOT_ORDER = [
  ...ACCEPTOR_5,
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "17a",
  "17b",
  "18",
  "19",
  "20",
  "20a",
  "20b",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  ...ANTICODON_CORE,
  ...VARIABLE_BRIDGE_5,
  ...VARIABLE_CLASS_I_LOOP,
  ...VARIABLE_STEM_5,
  ...VARIABLE_E_LOOP,
  ...VARIABLE_STEM_3,
  ...VARIABLE_BRIDGE_3,
  ...T_CORE,
  ...ACCEPTOR_3,
  "73",
  ...TAIL,
];

const SPRINZL_SLOT_ORDER_INDEX = new Map(
  SPRINZL_SLOT_ORDER.map((slotId, index) => [slotId, index]),
);

const VARIABLE_ARM_COORDINATES = [
  { id: "e11", x: 790, y: 548 },
  { id: "e12", x: 830, y: 575 },
  { id: "e13", x: 870, y: 602 },
  { id: "e14", x: 910, y: 629 },
  { id: "e15", x: 950, y: 656 },
  { id: "e16", x: 990, y: 683 },
  { id: "e17", x: 1030, y: 710 },
  { id: "e1", x: 1050, y: 748 },
  { id: "e2", x: 1085, y: 772 },
  { id: "e3", x: 1127, y: 760 },
  { id: "e4", x: 1150, y: 722 },
  { id: "e5", x: 1128, y: 684 },
  { id: "e27", x: 1052, y: 672 },
  { id: "e26", x: 1012, y: 645 },
  { id: "e25", x: 972, y: 618 },
  { id: "e24", x: 932, y: 591 },
  { id: "e23", x: 892, y: 564 },
  { id: "e22", x: 852, y: 537 },
  { id: "e21", x: 812, y: 510 },
];
const CLASS_I_VARIABLE_COORDINATES = [
  { id: "v1", x: 760, y: 540 },
  { id: "v2", x: 790, y: 570 },
  { id: "v3", x: 825, y: 560 },
  { id: "v4", x: 840, y: 525 },
  { id: "v5", x: 807, y: 505 },
];

function arcSlots(
  labels: string[],
  center: { x: number; y: number },
  radius: { x: number; y: number },
  startDegrees: number,
  endDegrees: number,
) {
  return labels.map((id, index) => {
    const fraction = labels.length <= 1 ? 0 : index / (labels.length - 1);
    const degrees = startDegrees + (endDegrees - startDegrees) * fraction;
    const radians = (degrees * Math.PI) / 180;

    return {
      id,
      x: Math.round(center.x + Math.cos(radians) * radius.x),
      y: Math.round(center.y + Math.sin(radians) * radius.y),
    };
  });
}

function horizontalStemSlots(leftLabels: string[], rightLabels: string[], x: number, y: number) {
  return [
    ...leftLabels.map((id, index) => ({ id, x, y: y + index * STEP })),
    ...rightLabels.map((id, index) => ({ id, x: x + GAP, y: y + index * STEP })),
  ];
}

function verticalStemSlots(
  topLabels: string[],
  bottomLabels: string[],
  x: number,
  y: number,
  pitch = STEP,
  gap = GAP,
) {
  return [
    ...topLabels.map((id, index) => ({ id, x: x + index * pitch, y })),
    ...bottomLabels.map((id, index) => ({ id, x: x + index * pitch, y: y + gap })),
  ];
}

function getSlotRegion(id: string): SlotRegion {
  const numeric = Number(id);

  if (id.startsWith("unassigned")) {
    return "extra";
  }

  if (id.startsWith("e")) {
    return "variable";
  }

  if (id.startsWith("v")) {
    return "variable";
  }

  if (numeric <= 9 || numeric >= 66) {
    return numeric >= 73 ? "tail" : "acceptor";
  }

  if (numeric <= 26 || id.startsWith("17") || id.startsWith("20")) {
    return "d-loop";
  }

  if (numeric <= 43) {
    return "anticodon";
  }

  if (numeric <= 48) {
    return "variable";
  }

  if (numeric <= 65) {
    return "t-loop";
  }

  return "extra";
}

function getSlotPos(id: string, index: number) {
  if (/^\d+$/.test(id)) {
    return Number(id);
  }

  if (id === "17a") {
    return 1701;
  }

  if (id === "17b") {
    return 1702;
  }

  if (id === "20a") {
    return 2001;
  }

  if (id === "20b") {
    return 2002;
  }

  if (id === "e1") {
    return 8001;
  }

  if (id === "e2") {
    return 8002;
  }

  if (id === "e3") {
    return 8003;
  }

  if (id === "e4") {
    return 8004;
  }

  if (id === "e5") {
    return 8005;
  }

  const variableStem = id.match(/^e([12])(\d+)$/);
  if (variableStem) {
    return Number(`8${variableStem[1]}${variableStem[2].padStart(2, "0")}`);
  }

  const classILoop = id.match(/^v(\d+)$/);
  if (classILoop) {
    return Number(`45${classILoop[1].padStart(2, "0")}`);
  }

  return 9000 + index;
}

function createSlot(id: string, x: number, y: number, index: number): Slot {
  return {
    id,
    pos: getSlotPos(id, index),
    region: getSlotRegion(id),
    x,
    y,
    enabled: true,
    occupied: false,
    base: null,
    modification: null,
  };
}

function initializeSlots() {
  const rawCoordinates = [
    ...horizontalStemSlots(["1", "2", "3", "4", "5", "6", "7"], ["72", "71", "70", "69", "68", "67", "66"], 600, 100),
    { id: "8", x: 555, y: 360 },
    { id: "9", x: 520, y: 385 },
    ...verticalStemSlots(["13", "12", "11", "10"], ["22", "23", "24", "25"], 365, 405),
    ...arcSlots(["14", "15", "16", "17", "17a", "17b", "18", "19", "20", "20a", "20b", "21"], { x: 270, y: 445 }, { x: 106, y: 82 }, -58, -302),
    { id: "26", x: 535, y: 505 },
    ...horizontalStemSlots(["27", "28", "29", "30", "31"], ["43", "42", "41", "40", "39"], 580, 560),
    ...arcSlots(["32", "33", "34", "35", "36", "37", "38"], { x: 620, y: 730 }, { x: 80, y: 82 }, 160, 20),
    { id: "44", x: 700, y: 535 },
    { id: "45", x: 735, y: 510 },
    ...CLASS_I_VARIABLE_COORDINATES,
    ...VARIABLE_ARM_COORDINATES,
    { id: "46", x: 770, y: 530 },
    { id: "47", x: 790, y: 570 },
    { id: "48", x: 800, y: 500 },
    ...verticalStemSlots(["65", "64", "63", "62", "61"], ["49", "50", "51", "52", "53"], 760, 370),
    ...arcSlots(["54", "55", "56", "57", "58", "59", "60"], { x: 960, y: 410 }, { x: 90, y: 78 }, 100, -100),
    { id: "73", x: 720, y: 80 },
    { id: "74", x: 760, y: 62 },
    { id: "75", x: 800, y: 54 },
    { id: "76", x: 840, y: 54 },
  ];
  const slots = new Map<string, Slot>();

  rawCoordinates.forEach((coordinate, index) => {
    slots.set(coordinate.id, createSlot(coordinate.id, coordinate.x, coordinate.y, index));
  });

  CANONICAL_PAIR_IDS.forEach(([leftId, rightId]) => {
    const left = slots.get(leftId);
    const right = slots.get(rightId);
    if (left && right) {
      left.pairingPartner = rightId;
      right.pairingPartner = leftId;
    }
  });

  return slots;
}

function parseToken(token: string): ParsedToken {
  const normalized = token.trim();
  const isPlainBase = /^[ACGUTN]$/i.test(normalized);
  const base = getDisplayBaseForToken(normalized);
  const modification = isPlainBase || !normalized ? null : normalized;

  return {
    token,
    base,
    modification,
    isUnknownModification:
      typeof modification === "string" &&
      !["D", "Y", "Q", "I", "X", "*"].includes(modification) &&
      !getCatalogItem(modification),
  };
}

function getCcaTailMap(tokens: ParsedToken[]): CcaTailMap {
  const bases = tokens.map((token) => token.base.toUpperCase());
  const joined = bases.join("");

  if (joined.endsWith("CCA")) {
    return {
      startIndex: tokens.length - 3,
      assignments: [
        { slotId: "74", sequenceIndex: tokens.length - 2 },
        { slotId: "75", sequenceIndex: tokens.length - 1 },
        { slotId: "76", sequenceIndex: tokens.length },
      ],
      status: "full",
    };
  }

  if (joined.endsWith("CA")) {
    return {
      startIndex: tokens.length - 2,
      assignments: [
        { slotId: "75", sequenceIndex: tokens.length - 1 },
        { slotId: "76", sequenceIndex: tokens.length },
      ],
      status: "partial",
    };
  }

  if (joined.endsWith("A")) {
    return {
      startIndex: tokens.length - 1,
      assignments: [{ slotId: "76", sequenceIndex: tokens.length }],
      status: "partial",
    };
  }

  return {
    startIndex: tokens.length,
    assignments: [],
    status: "missing",
  };
}

function occupySlot(
  slots: Map<string, Slot>,
  id: string,
  parsedToken: ParsedToken,
  sequenceIndex: number,
) {
  const slot = slots.get(id);
  if (!slot || !slot.enabled || slot.occupied) {
    return false;
  }

  slot.occupied = true;
  slot.base = parsedToken.base;
  slot.modification = parsedToken.modification;
  slot.token = parsedToken.token;
  slot.sequenceIndex = sequenceIndex;
  return true;
}

function occupySlotsFromStart(
  slots: Map<string, Slot>,
  slotIds: string[],
  entries: Array<{ parsedToken: ParsedToken; sequenceIndex: number }>,
) {
  const remaining = [...entries];

  for (const slotId of slotIds) {
    const entry = remaining.shift();
    if (!entry) {
      break;
    }

    occupySlot(slots, slotId, entry.parsedToken, entry.sequenceIndex);
  }

  return remaining;
}

function occupySlotsFromEnd(
  slots: Map<string, Slot>,
  slotIds: string[],
  entries: Array<{ parsedToken: ParsedToken; sequenceIndex: number }>,
) {
  const remaining = [...entries];

  for (const slotId of [...slotIds].reverse()) {
    const entry = remaining.pop();
    if (!entry) {
      break;
    }

    occupySlot(slots, slotId, entry.parsedToken, entry.sequenceIndex);
  }

  return remaining;
}

function applyDependencyRules(slots: Map<string, Slot>, variableMode: "none" | "classI" | "classII") {
  if (!slots.get("17")?.occupied) {
    ["17a", "17b"].forEach((slotId) => {
      const slot = slots.get(slotId);
      if (slot) {
        slot.enabled = false;
      }
    });
  }

  if (!slots.get("20")?.occupied) {
    ["20a", "20b"].forEach((slotId) => {
      const slot = slots.get(slotId);
      if (slot) {
        slot.enabled = false;
      }
    });
  }

  if (variableMode !== "classII") {
    [...VARIABLE_STEM_5, ...VARIABLE_E_LOOP, ...VARIABLE_STEM_3].forEach((slotId) => {
      const slot = slots.get(slotId);
      if (slot && !slot.occupied) {
        slot.enabled = false;
      }
    });
  }

  if (variableMode !== "classI") {
    VARIABLE_CLASS_I_LOOP.forEach((slotId) => {
      const slot = slots.get(slotId);
      if (slot && !slot.occupied) {
        slot.enabled = false;
      }
    });
  }
}

function getPairStatus(left: string, right: string): RnaPairStatus {
  const pair = `${left.toUpperCase()}-${right.toUpperCase()}`;

  if (["A-U", "U-A", "G-C", "C-G"].includes(pair)) {
    return "normal";
  }

  if (pair === "G-U" || pair === "U-G") {
    return "wobble";
  }

  return "mismatch";
}

function getRenderMode(sequenceLength: number, variableMode: "none" | "classI" | "classII", runValidation?: boolean): RnaRenderMode {
  if (runValidation) {
    return "sprinzl_validation";
  }

  if (sequenceLength < 71) {
    return "short_atypical";
  }

  if (variableMode === "classII") {
    return "long_variable_arm";
  }

  if (variableMode === "classI") {
    return "expanded_variable";
  }

  return "sprinzl_template";
}

function buildVariableSlotIds(variableCount: number) {
  if (variableCount <= VARIABLE_LOOP_CAPACITY) {
    return [];
  }

  const usableCount = Math.min(
    variableCount,
    VARIABLE_STEM_CAPACITY * 2 + VARIABLE_LOOP_CAPACITY,
  );
  let loopCount = Math.min(VARIABLE_LOOP_CAPACITY, Math.max(1, usableCount - 2));

  while ((usableCount - loopCount) % 2 !== 0 && loopCount > 1) {
    loopCount -= 1;
  }

  const pairCount = Math.min(
    VARIABLE_STEM_CAPACITY,
    Math.max(1, Math.floor((usableCount - loopCount) / 2)),
  );
  const usedLoopCount = Math.min(
    VARIABLE_LOOP_CAPACITY,
    Math.max(1, usableCount - pairCount * 2),
  );

  return [
    ...VARIABLE_STEM_5.slice(0, pairCount),
    ...VARIABLE_E_LOOP.slice(0, usedLoopCount),
    ...VARIABLE_STEM_3.slice(-pairCount),
  ];
}

function buildClassIVariableSlotIds(variableCount: number) {
  return VARIABLE_CLASS_I_LOOP.slice(0, Math.min(variableCount, VARIABLE_LOOP_CAPACITY));
}

function setSlotPoint(slots: Map<string, Slot>, slotId: string, point: { x: number; y: number }) {
  const slot = slots.get(slotId);

  if (!slot) {
    return;
  }

  slot.x = Math.round(point.x);
  slot.y = Math.round(point.y);
}

function repositionOccupiedVariableArm(slots: Map<string, Slot>) {
  const fivePrimeStem = VARIABLE_STEM_5.filter((slotId) => slots.get(slotId)?.occupied);
  const loopSlots = VARIABLE_E_LOOP.filter((slotId) => slots.get(slotId)?.occupied);
  const pairCount = fivePrimeStem.length;

  if (pairCount === 0) {
    return;
  }

  const start = { x: 790, y: 548 };
  const delta = { x: 52, y: 38 };
  const partnerOffset = { x: 26, y: -42 };

  fivePrimeStem.forEach((slotId, index) => {
    setSlotPoint(slots, slotId, {
      x: start.x + delta.x * index,
      y: start.y + delta.y * index,
    });
  });

  const partnerIds = Array.from({ length: pairCount }, (_, index) => `e2${index + 1}`);
  partnerIds.forEach((slotId, index) => {
    setSlotPoint(slots, slotId, {
      x: start.x + partnerOffset.x + delta.x * index,
      y: start.y + partnerOffset.y + delta.y * index,
    });
  });

  const distalFivePrime = slots.get(fivePrimeStem.at(-1) ?? "");
  const distalThreePrime = slots.get(partnerIds.at(-1) ?? "");

  if (distalFivePrime && distalThreePrime && loopSlots.length > 0) {
    const center = {
      x: (distalFivePrime.x + distalThreePrime.x) / 2 + 88,
      y: (distalFivePrime.y + distalThreePrime.y) / 2,
    };
    const radius = { x: 72, y: 54 };
    const angles = loopSlots.length === 1
      ? [0]
      : loopSlots.map((_, index) => 125 + (-250 * index) / (loopSlots.length - 1));

    loopSlots.forEach((slotId, index) => {
      const radians = (angles[index] * Math.PI) / 180;
      setSlotPoint(slots, slotId, {
        x: center.x + Math.cos(radians) * radius.x,
        y: center.y + Math.sin(radians) * radius.y,
      });
    });
  }
}

function repositionClassIVariableLoop(slots: Map<string, Slot>) {
  const loopSlots = VARIABLE_CLASS_I_LOOP.filter((slotId) => slots.get(slotId)?.occupied);

  if (loopSlots.length === 0) {
    return;
  }

  const center = { x: 800, y: 542 };
  const radius = { x: 58, y: 44 };
  const angles = loopSlots.length === 1
    ? [0]
    : loopSlots.map((_, index) => 150 + (-300 * index) / (loopSlots.length - 1));

  loopSlots.forEach((slotId, index) => {
    const radians = (angles[index] * Math.PI) / 180;
    setSlotPoint(slots, slotId, {
      x: center.x + Math.cos(radians) * radius.x,
      y: center.y + Math.sin(radians) * radius.y,
    });
  });
}

function slotToNode(slot: Slot): RnaNucleotide {
  return {
    pos: slot.pos,
    base: slot.base ?? "",
    x: slot.x,
    y: slot.y,
    sequenceIndex: slot.sequenceIndex,
    slotOrder: SPRINZL_SLOT_ORDER_INDEX.get(slot.id),
    originalToken: slot.token,
    positionLabel: slot.id,
    sprinzlLabel: slot.id,
    region: slot.region,
    status: slot.occupied
      ? (slot.id.startsWith("e") || slot.id.startsWith("v") || /[ab]$/.test(slot.id)
          ? "inserted"
          : "present")
      : "missing",
    modification: slot.modification ?? undefined,
    visible: true,
  };
}

function buildSlotPairs(
  slots: Map<string, Slot>,
  nodesBySlotId: Map<string, RnaNucleotide>,
  sequenceIndexToSlotId: Map<number, string>,
  sequenceLength: number,
  runValidation?: boolean,
  dotBracket?: string,
) {
  const warnings: string[] = [];
  const stems: RnaStem[] = [];
  const addPair = (leftSlotId: string, rightSlotId: string) => {
    const leftSlot = slots.get(leftSlotId);
    const rightSlot = slots.get(rightSlotId);
    const left = nodesBySlotId.get(leftSlotId);
    const right = nodesBySlotId.get(rightSlotId);

    if (!leftSlot?.occupied || !rightSlot?.occupied || !left || !right) {
      return;
    }

    const pairStatus = getPairStatus(leftSlot.base ?? "", rightSlot.base ?? "");
    left.pairingPartner = rightSlotId;
    right.pairingPartner = leftSlotId;
    left.pairStatus = pairStatus;
    right.pairStatus = pairStatus;
    if (runValidation && pairStatus === "mismatch") {
      left.status = "mismatch";
      right.status = "mismatch";
      warnings.push(`stem mismatch ${leftSlotId}-${rightSlotId}`);
    }
    stems.push({
      from: left.pos,
      to: right.pos,
      pairStatus,
      style: pairStatus === "mismatch" ? "dashed" : undefined,
    });
  };

  if (dotBracket?.trim()) {
    const parsed = parseDotBracketStructure(dotBracket, sequenceLength);

    if (parsed.error) {
      warnings.push(parsed.error);
      return { stems, warnings };
    }

    parsed.pairs.forEach((pair) => {
      const leftSlotId = sequenceIndexToSlotId.get(pair.i);
      const rightSlotId = sequenceIndexToSlotId.get(pair.j);

      if (!leftSlotId || !rightSlotId) {
        return;
      }

      addPair(leftSlotId, rightSlotId);
    });

    return { stems, warnings };
  }

  CANONICAL_PAIR_IDS.forEach(([leftId, rightId]) => addPair(leftId, rightId));
  return { stems, warnings };
}

export function buildSprinzlTRnaLayout(
  sequence: string[],
  options: { runValidation?: boolean; dotBracket?: string } = {},
): SprinzlLayoutResult {
  const warnings: string[] = [];
  const parsedTokens = sequence.map(parseToken);
  const slots = initializeSlots();
  const tailMap = getCcaTailMap(parsedTokens);
  const sequenceIndexToSlotId = new Map<number, string>();

  parsedTokens.forEach((parsedToken, index) => {
    if (parsedToken.isUnknownModification) {
      warnings.push(`unknown modified base ${parsedToken.token.trim()}`);
    }
  });

  tailMap.assignments.forEach((assignment) => {
    const parsedToken = parsedTokens[assignment.sequenceIndex - 1];
    if (parsedToken && occupySlot(slots, assignment.slotId, parsedToken, assignment.sequenceIndex)) {
      sequenceIndexToSlotId.set(assignment.sequenceIndex, assignment.slotId);
    }
  });

  let remaining = parsedTokens
    .slice(0, tailMap.startIndex)
    .map((parsedToken, index) => ({
      parsedToken,
      sequenceIndex: index + 1,
    }));

  remaining = occupySlotsFromStart(slots, ACCEPTOR_5, remaining);
  ACCEPTOR_5.forEach((slotId) => {
    const sequenceIndex = slots.get(slotId)?.sequenceIndex;
    if (sequenceIndex !== undefined) {
      sequenceIndexToSlotId.set(sequenceIndex, slotId);
    }
  });

  remaining = occupySlotsFromEnd(slots, ACCEPTOR_RIGHT_TO_LEFT, remaining);
  ACCEPTOR_RIGHT_TO_LEFT.forEach((slotId) => {
    const sequenceIndex = slots.get(slotId)?.sequenceIndex;
    if (sequenceIndex !== undefined) {
      sequenceIndexToSlotId.set(sequenceIndex, slotId);
    }
  });

  remaining = occupySlotsFromEnd(slots, T_CORE, remaining);
  T_CORE.forEach((slotId) => {
    const sequenceIndex = slots.get(slotId)?.sequenceIndex;
    if (sequenceIndex !== undefined) {
      sequenceIndexToSlotId.set(sequenceIndex, slotId);
    }
  });

  remaining = occupySlotsFromStart(slots, D_CORE, remaining);
  D_CORE.forEach((slotId) => {
    const sequenceIndex = slots.get(slotId)?.sequenceIndex;
    if (sequenceIndex !== undefined) {
      sequenceIndexToSlotId.set(sequenceIndex, slotId);
    }
  });

  remaining = occupySlotsFromStart(slots, ANTICODON_CORE, remaining);
  ANTICODON_CORE.forEach((slotId) => {
    const sequenceIndex = slots.get(slotId)?.sequenceIndex;
    if (sequenceIndex !== undefined) {
      sequenceIndexToSlotId.set(sequenceIndex, slotId);
    }
  });

  remaining = occupySlotsFromStart(slots, VARIABLE_BRIDGE_5, remaining);
  VARIABLE_BRIDGE_5.forEach((slotId) => {
    const sequenceIndex = slots.get(slotId)?.sequenceIndex;
    if (sequenceIndex !== undefined) {
      sequenceIndexToSlotId.set(sequenceIndex, slotId);
    }
  });

  const variableCount = Math.max(0, remaining.length - VARIABLE_BRIDGE_3.length);
  const variableMode =
    variableCount === 0 ? "none" : variableCount <= VARIABLE_LOOP_CAPACITY ? "classI" : "classII";
  const variableSlots =
    variableMode === "classII"
      ? buildVariableSlotIds(variableCount)
      : variableMode === "classI"
        ? buildClassIVariableSlotIds(variableCount)
        : [];
  const unassignedEntries: Array<{ parsedToken: ParsedToken; sequenceIndex: number }> = [];

  if (variableMode === "classII" || variableMode === "classI") {
    for (const slotId of [...variableSlots, ...VARIABLE_BRIDGE_3]) {
      const entry = remaining.shift();
      if (!entry) {
        break;
      }

      if (occupySlot(slots, slotId, entry.parsedToken, entry.sequenceIndex)) {
        sequenceIndexToSlotId.set(entry.sequenceIndex, slotId);
      }
    }
  } else {
    remaining = occupySlotsFromEnd(slots, VARIABLE_BRIDGE_3, remaining);
    VARIABLE_BRIDGE_3.forEach((slotId) => {
      const sequenceIndex = slots.get(slotId)?.sequenceIndex;
      if (sequenceIndex !== undefined) {
        sequenceIndexToSlotId.set(sequenceIndex, slotId);
      }
    });
  }

  remaining.forEach((entry) => unassignedEntries.push(entry));
  applyDependencyRules(slots, variableMode);
  repositionClassIVariableLoop(slots);
  repositionOccupiedVariableArm(slots);

  if (tailMap.status === "missing") {
    warnings.push("missing CCA tail");
  } else if (tailMap.status === "partial") {
    warnings.push("partial CCA tail");
  }

  if (sequence.length < 71) {
    warnings.push("short atypical sequence");
  }

  if (variableMode === "classII") {
    warnings.push("long variable arm");
  }

  if (unassignedEntries.length > 0) {
    warnings.push("unassigned extra bases");
  }

  const allNodes = [...slots.values()]
    .filter((slot) => slot.enabled && slot.occupied)
    .map(slotToNode)
    .sort((left, right) => {
      const leftOrder = left.slotOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.slotOrder ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.pos - right.pos;
    });
  const nodesBySlotId = new Map(allNodes.map((node) => [node.positionLabel ?? String(node.pos), node]));
  const pairResult = buildSlotPairs(
    slots,
    nodesBySlotId,
    sequenceIndexToSlotId,
    sequence.length,
    options.runValidation,
    options.dotBracket,
  );
  return {
    mappedPositions: allNodes,
    warnings: Array.from(new Set([...warnings, ...pairResult.warnings])),
    unassignedExtraBases: unassignedEntries.map((entry) => entry.parsedToken.token),
    renderMode: getRenderMode(sequence.length, variableMode, options.runValidation),
    stems: pairResult.stems,
  };
}
