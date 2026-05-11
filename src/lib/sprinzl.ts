import { parseSequenceWithModifications, type ParsedSequenceToken } from "./annotations";
import { buildSprinzlGeometry, SPRINZL_SLOT_ORDER_INDEX } from "./geometry";
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
  enabled: boolean;
  occupied: boolean;
  base: string | null;
  modification: string | null;
  token?: string;
  sequenceIndex?: number;
};

type CcaTailMap = {
  startIndex: number;
  assignments: Array<{ slotId: "74" | "75" | "76"; parsedIndex: number }>;
  status: "full" | "partial" | "missing";
};

export type SprinzlLayoutResult = {
  mappedPositions: RnaNucleotide[];
  warnings: string[];
  unassignedExtraBases: string[];
  renderMode: RnaRenderMode;
  stems: RnaStem[];
};

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

function placeArc(
  slots: Map<string, Slot>,
  slotIds: string[],
  center: { x: number; y: number },
  radius: { x: number; y: number },
  startDegrees: number,
  endDegrees: number,
) {
  const occupiedIds = slotIds.filter((slotId) => slots.get(slotId)?.occupied);

  occupiedIds.forEach((slotId, index) => {
    const slot = slots.get(slotId);
    if (!slot) {
      return;
    }

    const fraction = occupiedIds.length <= 1 ? 0 : index / (occupiedIds.length - 1);
    const degrees = startDegrees + (endDegrees - startDegrees) * fraction;
    const radians = (degrees * Math.PI) / 180;

    slot.x = Math.round(center.x + Math.cos(radians) * radius.x);
    slot.y = Math.round(center.y + Math.sin(radians) * radius.y);
  });
}

function placeDynamicDLoop(slots: Map<string, Slot>) {
  placeArc(
    slots,
    ["14", "15", "16", "17", "17a", "17b", "18", "19", "20", "20a", "20b", "21"],
    { x: 270, y: 445 },
    { x: 96, y: 80 },
    -58,
    -302,
  );
}

function occupiedSlotIds(slots: Map<string, Slot>, slotIds: string[]) {
  return slotIds.filter((slotId) => slots.get(slotId)?.occupied);
}

function setSlotPoint(slots: Map<string, Slot>, slotId: string, point: { x: number; y: number }) {
  const slot = slots.get(slotId);
  if (!slot) {
    return;
  }

  slot.x = Math.round(point.x);
  slot.y = Math.round(point.y);
}

function placeClassIVariableLoop(slots: Map<string, Slot>) {
  placeArc(
    slots,
    VARIABLE_CLASS_I_LOOP,
    { x: 800, y: 536 },
    { x: 48, y: 42 },
    170,
    -10,
  );
}

function placeClassIIVariableArm(slots: Map<string, Slot>) {
  const fivePrimeStem = occupiedSlotIds(slots, VARIABLE_STEM_5);
  const loop = occupiedSlotIds(slots, VARIABLE_E_LOOP);
  const threePrimeStem = occupiedSlotIds(slots, VARIABLE_STEM_3);
  const pairCount = Math.min(fivePrimeStem.length, threePrimeStem.length);

  if (pairCount === 0) {
    return;
  }

  const stemStart = { x: 790, y: 548 };
  const stemStep = { x: 40, y: 34 };
  const pairOffset = { x: 80, y: -52 };

  fivePrimeStem.forEach((slotId, index) => {
    setSlotPoint(slots, slotId, {
      x: stemStart.x + stemStep.x * index,
      y: stemStart.y + stemStep.y * index,
    });
  });

  threePrimeStem.forEach((slotId, index) => {
    const reverseIndex = pairCount - 1 - index;
    setSlotPoint(slots, slotId, {
      x: stemStart.x + stemStep.x * reverseIndex + pairOffset.x,
      y: stemStart.y + stemStep.y * reverseIndex + pairOffset.y,
    });
  });

  if (loop.length === 0) {
    return;
  }

  const distalFivePrime = {
    x: stemStart.x + stemStep.x * (pairCount - 1),
    y: stemStart.y + stemStep.y * (pairCount - 1),
  };
  const loopTemplate = [
    { x: 48, y: 42 },
    { x: 86, y: 58 },
    { x: 122, y: 50 },
    { x: 145, y: 8 },
    { x: 122, y: -30 },
  ];

  loop.forEach((slotId, index) => {
    const templateIndex =
      loop.length === 1
        ? Math.floor(loopTemplate.length / 2)
        : Math.round((index / (loop.length - 1)) * (loopTemplate.length - 1));
    const offset = loopTemplate[templateIndex];

    setSlotPoint(slots, slotId, {
      x: distalFivePrime.x + offset.x,
      y: distalFivePrime.y + offset.y,
    });
  });
}

function compactOccupiedLoops(slots: Map<string, Slot>, variableMode: "none" | "classI" | "classII") {
  placeDynamicDLoop(slots);

  if (variableMode === "classI") {
    placeClassIVariableLoop(slots);
  } else if (variableMode === "classII") {
    placeClassIIVariableArm(slots);
  }
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
  const rawCoordinates = [...buildSprinzlGeometry().values()];
  const slots = new Map<string, Slot>();

  rawCoordinates.forEach((coordinate, index) => {
    slots.set(coordinate.id, createSlot(coordinate.id, coordinate.x, coordinate.y, index));
  });

  return slots;
}

function getCcaTailMap(tokens: ParsedSequenceToken[]): CcaTailMap {
  const bases = tokens.map((token) => token.base.toUpperCase());
  const joined = bases.join("");

  if (tokens.length >= 3) {
    const status = joined.endsWith("CCA")
      ? "full"
      : joined.endsWith("CA") || joined.endsWith("A")
        ? "partial"
        : "missing";

    return {
      startIndex: tokens.length - 3,
      assignments: [
        { slotId: "74", parsedIndex: tokens.length - 3 },
        { slotId: "75", parsedIndex: tokens.length - 2 },
        { slotId: "76", parsedIndex: tokens.length - 1 },
      ],
      status,
    };
  }

  if (tokens.length === 2) {
    return {
      startIndex: 0,
      assignments: [
        { slotId: "75", parsedIndex: 0 },
        { slotId: "76", parsedIndex: 1 },
      ],
      status: joined === "CA" ? "partial" : "missing",
    };
  }

  if (tokens.length === 1) {
    return {
      startIndex: 0,
      assignments: [{ slotId: "76", parsedIndex: 0 }],
      status: joined === "A" ? "partial" : "missing",
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
  parsedToken: ParsedSequenceToken,
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
  entries: Array<{ parsedToken: ParsedSequenceToken; sequenceIndex: number }>,
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
  entries: Array<{ parsedToken: ParsedSequenceToken; sequenceIndex: number }>,
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

function getRenderMode(sequenceLength: number, variableMode: "none" | "classI" | "classII"): RnaRenderMode {
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

function getPairStatus(left: string | null, right: string | null): RnaPairStatus {
  const pair = `${left?.toUpperCase() ?? ""}-${right?.toUpperCase() ?? ""}`;

  if (["A-U", "U-A", "G-C", "C-G"].includes(pair)) {
    return "normal";
  }

  if (pair === "G-U" || pair === "U-G") {
    return "wobble";
  }

  return "mismatch";
}

function makeStem(left: Slot, right: Slot): RnaStem {
  const pairStatus = getPairStatus(left.base, right.base);

  return {
    from: left.pos,
    to: right.pos,
    pairStatus,
    style: pairStatus === "mismatch" ? "dashed" : undefined,
  };
}

function buildCanonicalStems(slots: Map<string, Slot>) {
  return CANONICAL_PAIR_IDS.flatMap(([leftId, rightId]) => {
    const left = slots.get(leftId);
    const right = slots.get(rightId);

    if (!left?.occupied || !right?.occupied) {
      return [];
    }

    return [makeStem(left, right)];
  });
}

function buildDotBracketStems(
  dotBracket: string,
  sequenceLength: number,
  nodes: RnaNucleotide[],
): { stems: RnaStem[]; warnings: string[] } {
  const parsed = parseDotBracketStructure(dotBracket, sequenceLength);
  if (parsed.error) {
    return { stems: [], warnings: [parsed.error] };
  }

  const nodeBySequenceIndex = new Map(
    nodes
      .filter((node) => node.sequenceIndex !== undefined)
      .map((node) => [node.sequenceIndex as number, node]),
  );

  const stems = parsed.pairs.flatMap((pair) => {
    const left = nodeBySequenceIndex.get(pair.i);
    const right = nodeBySequenceIndex.get(pair.j);

    if (!left || !right) {
      return [];
    }

    const pairStatus = getPairStatus(left.base, right.base);
    return [
      {
        from: left.pos,
        to: right.pos,
        pairStatus,
        style: pairStatus === "mismatch" ? ("dashed" as const) : undefined,
      },
    ];
  });

  return { stems, warnings: [] };
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

export function buildSprinzlTRnaLayout(
  sequence: string[],
  options: { runValidation?: boolean; dotBracket?: string } = {},
): SprinzlLayoutResult {
  const warnings: string[] = [];
  const parsedTokens = parseSequenceWithModifications(sequence);
  const slots = initializeSlots();
  const tailMap = getCcaTailMap(parsedTokens);

  tailMap.assignments.forEach((assignment) => {
    const parsedToken = parsedTokens[assignment.parsedIndex];
    if (parsedToken) {
      occupySlot(slots, assignment.slotId, parsedToken, parsedToken.sequenceIndex);
    }
  });

  let remaining = parsedTokens
    .slice(0, tailMap.startIndex)
    .map((parsedToken) => ({
      parsedToken,
      sequenceIndex: parsedToken.sequenceIndex,
    }));

  remaining = occupySlotsFromStart(slots, ACCEPTOR_5, remaining);

  remaining = occupySlotsFromEnd(slots, ACCEPTOR_RIGHT_TO_LEFT, remaining);

  remaining = occupySlotsFromEnd(slots, T_CORE, remaining);

  remaining = occupySlotsFromStart(slots, D_CORE, remaining);

  remaining = occupySlotsFromStart(slots, ANTICODON_CORE, remaining);

  remaining = occupySlotsFromStart(slots, VARIABLE_BRIDGE_5, remaining);

  const variableCount = Math.max(0, remaining.length - VARIABLE_BRIDGE_3.length);
  const variableMode =
    variableCount === 0 ? "none" : variableCount <= VARIABLE_LOOP_CAPACITY ? "classI" : "classII";
  const variableSlots =
    variableMode === "classII"
      ? buildVariableSlotIds(variableCount)
      : variableMode === "classI"
        ? buildClassIVariableSlotIds(variableCount)
        : [];
  const unassignedEntries: Array<{ parsedToken: ParsedSequenceToken; sequenceIndex: number }> = [];

  if (variableMode === "classII" || variableMode === "classI") {
    for (const slotId of [...variableSlots, ...VARIABLE_BRIDGE_3]) {
      const entry = remaining.shift();
      if (!entry) {
        break;
      }

      occupySlot(slots, slotId, entry.parsedToken, entry.sequenceIndex);
    }
  } else {
    remaining = occupySlotsFromEnd(slots, VARIABLE_BRIDGE_3, remaining);
  }

  remaining.forEach((entry) => unassignedEntries.push(entry));
  applyDependencyRules(slots, variableMode);
  compactOccupiedLoops(slots, variableMode);

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
  const dotBracketResult = options.dotBracket?.trim()
    ? buildDotBracketStems(options.dotBracket, sequence.length, allNodes)
    : null;
  const stems = dotBracketResult?.stems ?? buildCanonicalStems(slots);

  return {
    mappedPositions: allNodes,
    warnings: Array.from(new Set([...warnings, ...(dotBracketResult?.warnings ?? [])])),
    unassignedExtraBases: unassignedEntries.map((entry) => entry.parsedToken.token),
    renderMode: getRenderMode(sequence.length, variableMode),
    stems,
  };
}
