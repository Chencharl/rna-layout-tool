const STEP = 40;
const GAP = 80;

type Coordinate = {
  id: string;
  x: number;
  y: number;
};

export const SPRINZL_SLOT_ORDER = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
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
  "44",
  "45",
  "v1",
  "v2",
  "v3",
  "v4",
  "v5",
  "e11",
  "e12",
  "e13",
  "e14",
  "e15",
  "e16",
  "e17",
  "e1",
  "e2",
  "e3",
  "e4",
  "e5",
  "e27",
  "e26",
  "e25",
  "e24",
  "e23",
  "e22",
  "e21",
  "46",
  "47",
  "48",
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
  "66",
  "67",
  "68",
  "69",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "76",
];

export const SPRINZL_SLOT_ORDER_INDEX = new Map(
  SPRINZL_SLOT_ORDER.map((slotId, index) => [slotId, index]),
);

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

export function buildSprinzlGeometry() {
  const coordinates: Coordinate[] = [
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
    { id: "v1", x: 760, y: 540 },
    { id: "v2", x: 790, y: 570 },
    { id: "v3", x: 825, y: 560 },
    { id: "v4", x: 840, y: 525 },
    { id: "v5", x: 807, y: 505 },
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

  return new Map(coordinates.map((coordinate) => [coordinate.id, coordinate]));
}
