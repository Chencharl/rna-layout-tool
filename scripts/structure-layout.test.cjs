const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".tmp-structure-tests");

fs.rmSync(outDir, { force: true, recursive: true });
execFileSync(
  path.join(root, "node_modules/.bin/tsc"),
  [
    "src/lib/structureLayout.ts",
    "src/lib/annotations.ts",
    "src/lib/modificationMapping.ts",
    "src/lib/geometry.ts",
    "src/lib/rrna5s.ts",
    "src/lib/biology.ts",
    "src/lib/sequence.ts",
    "src/lib/types.ts",
    "src/lib/sprinzl.ts",
    "src/lib/templates.ts",
    "src/lib/projectReducer.ts",
    "src/lib/defaultProject.ts",
    "src/lib/validation.ts",
    "--outDir",
    outDir,
    "--module",
    "commonjs",
    "--target",
    "ES2022",
    "--esModuleInterop",
    "--skipLibCheck",
  ],
  { cwd: root, stdio: "inherit" },
);

const { buildStructureConstrainedLayout, parseDotBracketStructure } = require(path.join(
  outDir,
  "structureLayout.js",
));
const { buildSprinzlTRnaLayout } = require(path.join(outDir, "sprinzl.js"));
const { parseSequenceInput } = require(path.join(outDir, "sequence.js"));
const { parseSequenceWithModifications } = require(path.join(outDir, "annotations.js"));
const { createDefaultProject } = require(path.join(outDir, "defaultProject.js"));
const {
  BUILTIN_TEMPLATES,
  getTemplateById,
  remapProjectToTemplate,
  syncProjectToSequence,
} = require(path.join(outDir, "templates.js"));
const { buildRrna5SLayout, RRNA_5S_TEMPLATE_ROWS } = require(path.join(outDir, "rrna5s.js"));

const cases = [
  {
    name: "Case A",
    sequence:
      "GGGCCCGUAGCUCAGCCCGGCAGAGCGGCGGGCUUUUACCCCGCGGAAGGUCCCGGGUUCAAAUCCCGGCGGGCCCGCCA",
    dotBracket:
      "(((((((..((((.........)))).(((((.......)))))........(((((.......))))))))))))....",
  },
  {
    name: "Case B",
    sequence:
      "GGGGCCGUCGUCUAGCCUGGCUAGGAUGCCAGCCUGGGGCGCUGGUGGUCCCGGGUUCAAAUCCCGGCGGCCCCACCA",
    dotBracket:
      "(((((((..((((..........)))).(((((.......))))).....(((((.......))))))))))))....",
  },
  {
    name: "Case C",
    sequence: "GACAAAUGUUUUCAGGUCUUCUAAAUCUGUUUUGGAGAAAUCCGUUUGUUUCCA",
    dotBracket: "(((((((............((((((.....)))))).......)))))))....",
  },
];

for (const testCase of cases) {
  const tokens = testCase.sequence.split("");
  const parsed = parseDotBracketStructure(testCase.dotBracket, tokens.length);
  const result = buildStructureConstrainedLayout(tokens, testCase.dotBracket);

  assert.equal(testCase.sequence.length, testCase.dotBracket.length, `${testCase.name} length`);
  assert.equal(parsed.error, null, `${testCase.name} parser error`);
  assert.equal(result.nodes.length, tokens.length, `${testCase.name} node count`);
  assert.equal(result.pairEdges.length, parsed.pairs.length, `${testCase.name} pair count`);
  assert.deepEqual(
    result.pairEdges.map((edge) => [edge.sourceIndex, edge.targetIndex]),
    parsed.pairs.map((pair) => [pair.i, pair.j]),
    `${testCase.name} exact pair edges`,
  );
  assert.equal(
    result.backboneEdges.every((edge, index) => edge.sourceIndex === index + 1 && edge.targetIndex === index + 2),
    true,
    `${testCase.name} adjacent backbone edges`,
  );
  assert.equal(
    result.stems.every((stem) => parsed.pairs.some((pair) => pair.i === stem.from && pair.j === stem.to)),
    true,
    `${testCase.name} no canonical extra pair lines`,
  );
  assert.equal(result.nodes.at(-1).sequenceIndex, tokens.length, `${testCase.name} 3 prime end`);
  assert.ok(result.ccaStatus === "full" || result.ccaStatus === "partial" || result.ccaStatus === "missing");
  assert.equal(
    result.domains.every((domain) => domain.type === "unknown" || domain.type.endsWith("_candidate")),
    true,
    `${testCase.name} tentative candidate/unknown domains`,
  );
  assert.equal(
    result.domains.every((domain) => !domain.stem || domain.score),
    true,
    `${testCase.name} scored stem domains`,
  );
  assert.equal(
    result.warnings.some((warning) => /stem mismatch \d+-\d+/.test(warning)),
    false,
    `${testCase.name} structure mode must not emit Sprinzl mismatch warnings`,
  );
}

const shortCase = buildStructureConstrainedLayout(
  cases[2].sequence.split(""),
  cases[2].dotBracket,
);
assert.equal(shortCase.renderMode, "atypical_mode", "Case C should stay compact/atypical");
assert.equal(
  shortCase.nodes.some((node) => node.positionLabel === "76" && node.sequenceIndex !== shortCase.nodes.length),
  false,
  "Case C should not force a fake full Sprinzl 1-76 template",
);
assert.equal(shortCase.domains.some((domain) => domain.type === "D_arm_candidate"), false);
assert.equal(shortCase.domains.some((domain) => domain.type === "T_arm_candidate"), false);

const cloverCase = buildStructureConstrainedLayout(cases[0].sequence.split(""), cases[0].dotBracket);
const acceptor = cloverCase.domains.find((domain) => domain.type === "acceptor_candidate");
const anticodon = cloverCase.domains.find((domain) => domain.type === "anticodon_arm_candidate");
const variable = cloverCase.domains.find((domain) => domain.type === "variable_region_candidate");
assert.equal(acceptor?.anchorPosition, "top", "acceptor should anchor top");
assert.equal(anticodon?.anchorPosition, "bottom", "anticodon should anchor bottom");
assert.equal(variable?.anchorPosition, "center-right", "variable region should stay localized");
assert.notEqual(cloverCase.anticodon.confidence, "unknown", "anticodon should be inferred from loop");
assert.equal(cloverCase.ccaStatus, "full", "Case A should detect full CCA");

const currentSources = new Set([
  "current_user_input",
  "current_project_annotation",
  "imported_current_project",
]);

const freeTemplate = getTemplateById("free_canvas", BUILTIN_TEMPLATES);
assert.ok(freeTemplate, "free canvas template should exist");
const rrna5sTemplate = getTemplateById("rrna_5s_secondary_structure", BUILTIN_TEMPLATES);
assert.ok(rrna5sTemplate, "5S rRNA secondary-structure template should exist");
assert.equal(rrna5sTemplate.name, "rRNA 5S Secondary Structure", "rRNA preset is literature-style 5S template");
assert.equal(getTemplateById("rrna_compact", BUILTIN_TEMPLATES)?.id, "rrna_5s_secondary_structure", "old compact preset id maps to 5S template");
assert.equal(RRNA_5S_TEMPLATE_ROWS.length, 120, "5S rRNA template has 120 fixed coordinate rows");
assert.equal(
  RRNA_5S_TEMPLATE_ROWS.every((row) => typeof row.x === "number" && typeof row.y === "number" && "paired_with" in row),
  true,
  "5S rRNA template rows expose position/base/x/y/paired_with/region fields",
);
const rrna5sLayout = buildRrna5SLayout(`${"A".repeat(120)}`.split(""));
assert.equal(rrna5sLayout.nucleotides.length, 120, "5S rRNA layout maps exact 120 nt sequence to template positions");
assert.ok(rrna5sLayout.stems.length > 25, "5S rRNA layout draws template-defined pairing lines");
assert.deepEqual(
  rrna5sLayout.stems.slice(0, 3).map((stem) => [stem.from, stem.to]),
  [
    [1, 120],
    [2, 119],
    [3, 118],
  ],
  "5S rRNA terminal stem keeps 5 prime and 3 prime ends paired near the template stem",
);
assert.deepEqual(
  rrna5sLayout.nucleotides
    .filter((node) => node.positionLabel)
    .slice(0, 5)
    .map((node) => node.positionLabel),
  ["1", "10", "20", "30", "40"],
  "5S rRNA uses sparse publication-style position labels",
);
const rrna5sMismatch = buildRrna5SLayout("ACGU".split(""));
assert.equal(rrna5sMismatch.nucleotides.length, 120, "5S rRNA length mismatch still shows the fixed template instead of a broken partial fold");
assert.ok(rrna5sMismatch.warnings.some((warning) => warning.includes("expects 120 positions")), "5S rRNA length mismatch reports a clear warning");

const plainSequence = "ACGUACGU".split("");
const contaminatedProject = {
  ...createDefaultProject(),
  templateId: "free_canvas",
  labels: [
    {
      id: "demo-leftover",
      pos: 2,
      kind: "modification",
      source: "demo",
      text: "m1A",
      color: "#be123c",
      dx: 0,
      dy: 0,
    },
    {
      id: "previous-leftover",
      pos: 3,
      kind: "adduct",
      source: "previous_render",
      text: "ms2i6A",
      color: "#0f766e",
      dx: 0,
      dy: 0,
    },
  ],
  mappingWarnings: ["stem mismatch 10-25"],
};
const plainRebuild = syncProjectToSequence(contaminatedProject, plainSequence, freeTemplate);
assert.equal(plainRebuild.nucleotides.length, plainSequence.length, "plain rebuild node count");
assert.deepEqual(
  plainRebuild.nucleotides.map((node) => node.base),
  plainSequence,
  "plain rebuild bases come only from current sequence",
);
assert.equal(
  plainRebuild.nucleotides.every((node, index) => node.sequenceIndex === index + 1),
  true,
  "plain rebuild keeps one node per sequence index",
);
assert.equal(plainRebuild.labels.length, 0, "demo/previous annotations are removed");
assert.deepEqual(plainRebuild.mappingWarnings, [], "old mapping warnings are removed");

const currentAnnotationProject = {
  ...plainRebuild,
  labels: [
    {
      id: "current-mark",
      pos: 4,
      kind: "note",
      source: "current_user_input",
      text: "manual",
      color: "#334155",
      dx: 4,
      dy: -4,
    },
    {
      id: "out-of-range-current-mark",
      pos: 99,
      kind: "note",
      source: "current_user_input",
      text: "bad",
      color: "#334155",
      dx: 4,
      dy: -4,
    },
  ],
};
const currentAnnotationRebuild = syncProjectToSequence(
  currentAnnotationProject,
  plainSequence,
  freeTemplate,
);
assert.deepEqual(
  currentAnnotationRebuild.labels.map((label) => label.id),
  ["current-mark"],
  "only explicit in-range current annotations survive rebuild",
);
assert.equal(
  currentAnnotationRebuild.labels.every((label) => currentSources.has(label.source)),
  true,
  "surviving labels must have current provenance",
);

const defaultProject = createDefaultProject();
assert.equal(defaultProject.labels.length, 0, "default demo labels must not enter render state");
assert.equal(
  defaultProject.settings.runSprinzlValidation,
  false,
  "Sprinzl validation is opt-in by default",
);
assert.equal(
  defaultProject.settings.showSprinzlOverlay,
  false,
  "Sprinzl overlay is off by default",
);
assert.equal(
  defaultProject.nucleotides.some((node) => node.status === "missing"),
  false,
  "Sprinzl missing placeholders stay out of actual nodes when overlay is off",
);

const trnaTemplate = getTemplateById("trna_classic", BUILTIN_TEMPLATES);
assert.ok(trnaTemplate, "tRNA template should exist");
const shortTemplateProject = syncProjectToSequence(
  {
    ...createDefaultProject(),
    settings: {
      ...createDefaultProject().settings,
      showSprinzlOverlay: false,
      runSprinzlValidation: false,
    },
  },
  plainSequence,
  trnaTemplate,
);
assert.equal(
  shortTemplateProject.nucleotides.length,
  plainSequence.length,
  "Sprinzl template without overlay renders only current sequence nodes",
);
assert.equal(
  shortTemplateProject.nucleotides.some((node) => node.status === "missing"),
  false,
  "Sprinzl overlay-off render has no ghost placeholders",
);

const overlayTemplateProject = syncProjectToSequence(
  {
    ...shortTemplateProject,
    settings: {
      ...shortTemplateProject.settings,
      showSprinzlOverlay: true,
    },
  },
  plainSequence,
  trnaTemplate,
);
assert.ok(
  overlayTemplateProject.nucleotides.length === plainSequence.length,
  "Sprinzl overlay does not convert empty reference slots into layout nodes",
);
assert.equal(
  overlayTemplateProject.nucleotides.some((node) => node.status === "missing"),
  false,
  "Sprinzl overlay keeps layout occupied-only",
);

function occupiedNodes(layout) {
  return layout.mappedPositions;
}

function nodeByLabel(layout, label) {
  return layout.mappedPositions.find((node) => node.positionLabel === label);
}

function occupiedSlotOrderLabels(layout) {
  return occupiedNodes(layout)
    .filter((node) => node.slotOrder !== undefined)
    .sort(
      (left, right) =>
        (left.slotOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.slotOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.pos - right.pos,
    )
    .map((node) => node.positionLabel);
}

function biologicalBackbonePairs(layout) {
  const labels = occupiedSlotOrderLabels(layout);

  return labels.slice(0, -1).map((label, index) => [label, labels[index + 1]]);
}

function minDistanceBetween(nodes) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex];
      const right = nodes[rightIndex];
      minDistance = Math.min(minDistance, Math.hypot(right.x - left.x, right.y - left.y));
    }
  }

  return minDistance;
}

const standardSequence = `${"A".repeat(73)}CCA`.split("");
const standardSlotLayout = buildSprinzlTRnaLayout(standardSequence);
assert.equal(occupiedNodes(standardSlotLayout).length, standardSequence.length, "76 nt slot render has one occupied slot per base");
assert.equal(nodeByLabel(standardSlotLayout, "73").sequenceIndex, 73, "discriminator base remains separate from CCA");
assert.equal(nodeByLabel(standardSlotLayout, "74").base, "C", "CCA slot 74");
assert.equal(nodeByLabel(standardSlotLayout, "75").base, "C", "CCA slot 75");
assert.equal(nodeByLabel(standardSlotLayout, "76").base, "A", "CCA slot 76");
assert.equal(nodeByLabel(standardSlotLayout, "76").sequenceIndex, standardSequence.length, "76 is the 3 prime terminal slot");
assert.equal(
  standardSlotLayout.stems.length,
  21,
  "standard slot layout draws canonical Sprinzl secondary-structure pairs by default",
);
assert.deepEqual(
  standardSlotLayout.stems.slice(0, 4).map((stem) => [stem.from, stem.to]),
  [
    [1, 72],
    [2, 71],
    [3, 70],
    [4, 69],
  ],
  "canonical Sprinzl acceptor stem pairs are emitted in gtRNAdb-style slot coordinates",
);

const shortSlotSequence = "ACGUACGUACGUACGUACGUACGUACGUACGUACGUACGUACGUACGUACGUACGUCCA".split("");
const shortSlotLayout = buildSprinzlTRnaLayout(shortSlotSequence);
assert.equal(shortSlotLayout.renderMode, "short_atypical", "short sequence is short/atypical, not compressed");
assert.equal(occupiedNodes(shortSlotLayout).length, shortSlotSequence.length, "short slot render keeps only current bases occupied");
assert.ok(
  occupiedNodes(shortSlotLayout).some((node) => node.region === "t-loop"),
  "short slot mapping preserves the downstream T loop from the 3 prime side",
);
assert.equal(
  shortSlotLayout.mappedPositions.some((node) => node.status === "missing"),
  false,
  "short slot layout does not emit missing placeholder nodes",
);
assert.equal(
  shortSlotLayout.stems.every((stem) =>
    shortSlotLayout.mappedPositions.some((node) => node.pos === stem.from) &&
    shortSlotLayout.mappedPositions.some((node) => node.pos === stem.to),
  ),
  true,
  "short slot layout skips pair lines when either slot is missing",
);
assert.equal(
  shortSlotLayout.mappedPositions.every(
    (node) => !node.pairingPartner || shortSlotLayout.stems.some(
      (stem) => stem.from === node.pos || stem.to === node.pos,
    ),
  ),
  true,
  "pairingPartner exists only for actually rendered pairs",
);
assert.equal(
  nodeByLabel(shortSlotLayout, "1").x,
  nodeByLabel(standardSlotLayout, "1").x,
  "short sequence keeps fixed slot coordinates",
);
assert.equal(
  nodeByLabel(shortSlotLayout, "72").x,
  nodeByLabel(standardSlotLayout, "72").x,
  "short sequence does not globally shrink acceptor slots",
);

const longSlotSequence = `${"A".repeat(82)}CCA`.split("");
const longSlotLayout = buildSprinzlTRnaLayout(longSlotSequence);
assert.equal(longSlotLayout.renderMode, "long_variable_arm", "long sequence expands variable region locally");
assert.ok(occupiedNodes(longSlotLayout).some((node) => node.positionLabel === "e11"), "long sequence occupies variable stem slot e11");
assert.ok(occupiedNodes(longSlotLayout).some((node) => node.positionLabel === "e1"), "long sequence occupies variable loop slot e1");
assert.equal(
  nodeByLabel(longSlotLayout, "1").x,
  nodeByLabel(standardSlotLayout, "1").x,
  "long sequence keeps acceptor coordinates fixed",
);
assert.equal(
  nodeByLabel(longSlotLayout, "72").x,
  nodeByLabel(standardSlotLayout, "72").x,
  "long sequence does not stretch canonical slots",
);
assert.equal(nodeByLabel(longSlotLayout, "76").sequenceIndex, longSlotSequence.length, "long sequence keeps 3 prime CCA at slot 76");
assert.equal(longSlotLayout.unassignedExtraBases.length, 0, "85 nt sequence fits by local variable expansion");
assert.ok(nodeByLabel(longSlotLayout, "e21").sequenceIndex, "long sequence fills paired e21 slot");
assert.ok(nodeByLabel(longSlotLayout, "e22").sequenceIndex, "long sequence fills paired e22 slot");
assert.equal(nodeByLabel(longSlotLayout, "e13"), undefined, "85 nt sequence does not create a missing third variable stem pair");
assert.deepEqual(
  occupiedSlotOrderLabels(longSlotLayout).filter((label) => label?.startsWith("e")),
  ["e11", "e12", "e1", "e2", "e3", "e4", "e5", "e22", "e21"],
  "85 nt variable arm follows biological e-order, not numeric or interleaved order",
);
assert.equal(
  minDistanceBetween(occupiedNodes(longSlotLayout).filter((node) => node.positionLabel?.startsWith("e"))) >= 36,
  true,
  "85 nt variable arm enforces occupied-only minimum spacing",
);
assert.equal(
  biologicalBackbonePairs(longSlotLayout).some(([from, to]) => from === "45" && to === "46"),
  false,
  "long variable arm inserts e slots between 45 and 46",
);
assert.equal(
  biologicalBackbonePairs(longSlotLayout).some(
    ([from, to]) => from?.startsWith("e") && ["74", "75", "76"].includes(to),
  ),
  false,
  "variable arm never connects directly to CCA tail",
);
assert.equal(occupiedSlotOrderLabels(longSlotLayout).at(-1), "76", "position 76 is terminal in biological slot order");

const fullVariableArmLayout = buildSprinzlTRnaLayout(`${"A".repeat(92)}CCA`.split(""));
assert.deepEqual(
  occupiedSlotOrderLabels(fullVariableArmLayout).filter((label) => label?.startsWith("e")),
  [
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
  ],
  "full variable arm follows strict 45 -> e11..e17 -> e1..e5 -> e27..e21 -> 46 topology",
);
assert.deepEqual(
  biologicalBackbonePairs(fullVariableArmLayout).filter(
    ([from, to]) => from === "45" || to === "46" || from?.startsWith("e") || to?.startsWith("e"),
  ),
  [
    ["45", "e11"],
    ["e11", "e12"],
    ["e12", "e13"],
    ["e13", "e14"],
    ["e14", "e15"],
    ["e15", "e16"],
    ["e16", "e17"],
    ["e17", "e1"],
    ["e1", "e2"],
    ["e2", "e3"],
    ["e3", "e4"],
    ["e4", "e5"],
    ["e5", "e27"],
    ["e27", "e26"],
    ["e26", "e25"],
    ["e25", "e24"],
    ["e24", "e23"],
    ["e23", "e22"],
    ["e22", "e21"],
    ["e21", "46"],
  ],
  "backbone edges around variable arm use strict biological topology",
);
assert.equal(occupiedSlotOrderLabels(fullVariableArmLayout).at(-1), "76", "full variable layout still terminates at 76");
assert.equal(
  ["e11", "e12", "e13", "e14", "e15", "e16", "e17"].every((label, index, labels) => {
    if (index === 0) {
      return true;
    }

    const previous = nodeByLabel(fullVariableArmLayout, labels[index - 1]);
    const current = nodeByLabel(fullVariableArmLayout, label);

    return current.x > previous.x && current.y > previous.y;
  }),
  true,
  "variable 5-prime stem is anchored as a diagonal down-right path",
);
assert.equal(
  ["e27", "e26", "e25", "e24", "e23", "e22", "e21"].every((label, index, labels) => {
    if (index === 0) {
      return true;
    }

    const previous = nodeByLabel(fullVariableArmLayout, labels[index - 1]);
    const current = nodeByLabel(fullVariableArmLayout, label);

    return current.x < previous.x && current.y < previous.y;
  }),
  true,
  "variable 3-prime return path is anchored up-left back toward 46",
);
assert.ok(
  nodeByLabel(fullVariableArmLayout, "e11").x > nodeByLabel(fullVariableArmLayout, "43").x &&
    nodeByLabel(fullVariableArmLayout, "e21").y > nodeByLabel(fullVariableArmLayout, "53").y,
  "variable arm stays right of anticodon and below T arm",
);
assert.ok(
  Math.hypot(
    nodeByLabel(fullVariableArmLayout, "e1").x - nodeByLabel(fullVariableArmLayout, "e17").x,
    nodeByLabel(fullVariableArmLayout, "e1").y - nodeByLabel(fullVariableArmLayout, "e17").y,
  ) < 65 &&
    Math.hypot(
      nodeByLabel(fullVariableArmLayout, "e5").x - nodeByLabel(fullVariableArmLayout, "e27").x,
      nodeByLabel(fullVariableArmLayout, "e5").y - nodeByLabel(fullVariableArmLayout, "e27").y,
    ) < 85,
  "variable distal loop remains locally connected",
);
assert.equal(
  minDistanceBetween(occupiedNodes(fullVariableArmLayout).filter((node) => node.positionLabel?.startsWith("e"))) >= 36,
  true,
  "full variable arm keeps all occupied e nodes separated",
);

const overflowBeyondCapacityLayout = buildSprinzlTRnaLayout(`${"A".repeat(100)}CCA`.split(""));
assert.ok(
  overflowBeyondCapacityLayout.unassignedExtraBases.length > 0,
  "bases beyond finite Sprinzl slot capacity are recorded as overflow metadata",
);
assert.equal(
  overflowBeyondCapacityLayout.mappedPositions.some((node) => node.positionLabel?.startsWith("unassigned")),
  false,
  "overflow beyond capacity does not create nodes",
);
assert.equal(
  occupiedSlotOrderLabels(overflowBeyondCapacityLayout).filter((label) => label?.startsWith("e")).length,
  19,
  "overflow beyond capacity fills only defined e slots",
);
assert.equal(occupiedSlotOrderLabels(overflowBeyondCapacityLayout).at(-1), "76", "overflow metadata cannot create a node after 76");

const occupiedOnlyProject = syncProjectToSequence(
  {
    ...createDefaultProject(),
    settings: {
      ...createDefaultProject().settings,
      showSprinzlOverlay: false,
      runSprinzlValidation: false,
    },
  },
  longSlotSequence,
  trnaTemplate,
);
assert.equal(
  occupiedOnlyProject.nucleotides.some((node) => node.status === "missing"),
  false,
  "overlay OFF removes empty slots from the rendered layout",
);
assert.equal(
  occupiedOnlyProject.nucleotides.some((node) => node.positionLabel === "e13"),
  false,
  "overlay OFF does not retain coordinates for unused variable slots",
);
assert.deepEqual(
  occupiedOnlyProject.nucleotides
    .filter((node) => node.positionLabel?.startsWith("e"))
    .sort(
      (left, right) =>
        (left.slotOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.slotOrder ?? Number.MAX_SAFE_INTEGER),
    )
    .map((node) => node.positionLabel),
  ["e11", "e12", "e1", "e2", "e3", "e4", "e5", "e22", "e21"],
  "overlay OFF variable arm is built from occupied slots only",
);

const userLongSeqA =
  "GCGGGUGUGCGGGAAUUGGUAGACCGGCUAGAUUCAGGAUCUAGGGUCUUUAUGGACCUGAGGGUUCAAGUCCCUUCACCCGCACCA".split("");
const userLongSeqB =
  "GGGCCCGUAGCUCAGCCUGGUAGAGCGGCGGGCUCUUAACCCGCGAGGGAGGAAGUCCCGGGUUCAAAUCCCGGCGGGCCCGCCA".split("");
for (const [index, userSequence] of [userLongSeqA, userLongSeqB].entries()) {
  const userLayout = buildSprinzlTRnaLayout(userSequence);
  const bySequence = occupiedNodes(userLayout).sort((left, right) => (left.sequenceIndex ?? 0) - (right.sequenceIndex ?? 0));
  assert.equal(nodeByLabel(userLayout, "74").base, "C", `user long sequence ${index + 1} maps CCA slot 74`);
  assert.equal(nodeByLabel(userLayout, "75").base, "C", `user long sequence ${index + 1} maps CCA slot 75`);
  assert.equal(nodeByLabel(userLayout, "76").base, "A", `user long sequence ${index + 1} maps CCA slot 76`);
  assert.equal(nodeByLabel(userLayout, "76").sequenceIndex, userSequence.length, `user long sequence ${index + 1} keeps 3 prime end at slot 76`);
  assert.equal(bySequence.at(-1)?.positionLabel, "76", `user long sequence ${index + 1} sequence-order terminal node is slot 76`);
  assert.equal(userLayout.unassignedExtraBases.length, 0, `user long sequence ${index + 1} does not push 3 prime bases into unassigned/variable`);
  assert.ok(occupiedNodes(userLayout).some((node) => node.region === "t-loop"), `user long sequence ${index + 1} preserves T loop`);
}

const overflowStressSequence =
  "GGAGAGCUGUCCGAGUGGUCGAAGGAGCACGAUUGGAAAUCGUGUAGGCGGUCAACUCCGUCUCAAGGGUUCGAAUCCCUUGCUCUCCGCCA".split("");
const overflowStressLayout = buildSprinzlTRnaLayout(overflowStressSequence);
const overflowStressOccupied = occupiedNodes(overflowStressLayout);
assert.equal(nodeByLabel(overflowStressLayout, "74").base, "C", "overflow stress maps CCA slot 74");
assert.equal(nodeByLabel(overflowStressLayout, "75").base, "C", "overflow stress maps CCA slot 75");
assert.equal(nodeByLabel(overflowStressLayout, "76").base, "A", "overflow stress maps CCA slot 76");
assert.equal(
  nodeByLabel(overflowStressLayout, "76").sequenceIndex,
  overflowStressSequence.length,
  "overflow stress keeps 3 prime end at slot 76",
);
assert.equal(
  overflowStressLayout.mappedPositions.some((node) => node.positionLabel?.startsWith("unassigned")),
  false,
  "overflow stress does not draw overflow as cloverleaf nodes",
);
assert.equal(
  overflowStressLayout.unassignedExtraBases.length,
  0,
  "overflow stress fits inside finite e-slot capacity",
);
assert.ok(nodeByLabel(overflowStressLayout, "e16").sequenceIndex, "overflow stress can occupy sixth variable stem pair");
assert.ok(nodeByLabel(overflowStressLayout, "e26").sequenceIndex, "overflow stress can occupy sixth variable stem partner");
assert.equal(nodeByLabel(overflowStressLayout, "e17"), undefined, "overflow stress does not invent unused e17");
assert.equal(
  overflowStressOccupied
    .filter((node) => node.slotOrder !== undefined)
    .every((node, index, nodes) => index === 0 || nodes[index - 1].slotOrder <= node.slotOrder),
  true,
  "overflow stress occupied nodes follow biological slot order",
);

const classIExtraLayout = buildSprinzlTRnaLayout(`${"A".repeat(76)}CCA`.split(""));
assert.equal(classIExtraLayout.renderMode, "expanded_variable", "class I excess is local but not a long variable arm");
assert.equal(
  occupiedNodes(classIExtraLayout).some((node) => node.positionLabel?.startsWith("e")),
  false,
  "class I variable handling keeps e slots disabled",
);
assert.equal(
  occupiedNodes(classIExtraLayout).some((node) => node.positionLabel?.startsWith("v")),
  true,
  "class I variable handling uses dedicated short-loop v slots",
);
assert.deepEqual(
  occupiedSlotOrderLabels(classIExtraLayout).filter((label) => label?.startsWith("v")),
  ["v1", "v2", "v3"],
  "Class I maps variable bases into v slots in backbone order",
);
assert.equal(
  classIExtraLayout.stems.some((stem) => {
    const from = classIExtraLayout.mappedPositions.find((node) => node.pos === stem.from);
    const to = classIExtraLayout.mappedPositions.find((node) => node.pos === stem.to);
    return from?.positionLabel?.startsWith("v") || to?.positionLabel?.startsWith("v");
  }),
  false,
  "Class I variable loop has no pairing",
);
assert.deepEqual(
  biologicalBackbonePairs(classIExtraLayout).filter(
    ([from, to]) => from === "45" || to === "46" || from?.startsWith("v") || to?.startsWith("v"),
  ),
  [
    ["45", "v1"],
    ["v1", "v2"],
    ["v2", "v3"],
    ["v3", "46"],
  ],
  "Class I backbone is 45 -> short loop -> 46",
);
assert.equal(
  occupiedNodes(longSlotLayout).some((node) => node.positionLabel?.startsWith("v")),
  false,
  "Class II variable arm never mixes in Class I v slots",
);

const noCcaLayout = buildSprinzlTRnaLayout("ACGUACGUACGU".split(""));
assert.equal(nodeByLabel(noCcaLayout, "74").base, "C", "3 prime anchor maps last third base to slot 74");
assert.equal(nodeByLabel(noCcaLayout, "75").base, "G", "3 prime anchor maps penultimate base to slot 75");
assert.equal(nodeByLabel(noCcaLayout, "76").base, "U", "3 prime anchor maps terminal base to slot 76");
assert.ok(noCcaLayout.warnings.includes("missing CCA tail"), "missing CCA is reported as warning only");

const modifiedSequence = [...standardSequence];
modifiedSequence[7] = "s4U";
modifiedSequence[15] = "D";
modifiedSequence[53] = "mU";
modifiedSequence[60] = "X";
const modifiedLayout = buildSprinzlTRnaLayout(modifiedSequence);
assert.equal(nodeByLabel(modifiedLayout, "8").modification, "s4U", "controlled parser separates s4U modification from base");
assert.equal(nodeByLabel(modifiedLayout, "16").modification, "D", "controlled parser separates D modification from base");
assert.equal(
  modifiedLayout.mappedPositions.find((node) => node.sequenceIndex === 54)?.modification,
  "mU",
  "controlled parser separates mU modification from base",
);
assert.equal(nodeByLabel(modifiedLayout, "8").base, "U", "modified-looking token renders its base");
assert.equal(
  modifiedLayout.mappedPositions.some((node) => node.base === "N" || node.base === "X"),
  false,
  "unknown sequence tokens do not create N or X nodes",
);

const mappedCodeTokens = parseSequenceInput('AKBJPT*,');
assert.deepEqual(
  mappedCodeTokens,
  ["A", "K", "B", "J", "P", "T", "*", ","],
  "raw sequence tokenizer preserves symbol_mapping code tokens as individual positions",
);
assert.deepEqual(
  parseSequenceWithModifications(mappedCodeTokens).map((token) => [token.base, token.modification]),
  [
    ["A", null],
    ["G", "m1G"],
    ["C", "Cm"],
    ["U", "Um"],
    ["U", "psi"],
    ["U", "m5U"],
    ["A", "ms2i6A"],
    ["U", "mchm5U"],
  ],
  "symbol_mapping code tokens resolve to the correct displayed modification and base",
);

const mappedSymbolTokens = parseSequenceInput("m1Ams2i6AGmm5Umm3Ctm5U");
assert.deepEqual(
  mappedSymbolTokens,
  ["m1A", "ms2i6A", "Gm", "m5Um", "m3C", "tm5U"],
  "raw sequence tokenizer uses longest known modification symbols before single bases",
);
assert.deepEqual(
  parseSequenceWithModifications(mappedSymbolTokens).map((token) => [token.base, token.modification]),
  [
    ["A", "m1A"],
    ["A", "ms2i6A"],
    ["G", "Gm"],
    ["U", "m5Um"],
    ["C", "m3C"],
    ["U", "tm5U"],
  ],
  "symbol_mapping symbols resolve without requiring spaces or brackets",
);

const modifiedProject = syncProjectToSequence(
  {
    ...createDefaultProject(),
    settings: {
      ...createDefaultProject().settings,
      showSprinzlOverlay: false,
      runSprinzlValidation: false,
    },
  },
  modifiedSequence,
  trnaTemplate,
);
const switchedBackToPlain = syncProjectToSequence(modifiedProject, standardSequence, trnaTemplate);
assert.equal(
  switchedBackToPlain.nucleotides.some((node) => node.modification),
  false,
  "switching sequences rebuilds nodes and removes previous parsed modifications",
);

const dotBracketPairs = ".".repeat(standardSequence.length).split("");
dotBracketPairs[0] = "(";
dotBracketPairs[standardSequence.length - 1] = ")";
const dotBracketSlotLayout = buildSprinzlTRnaLayout(standardSequence, {
  dotBracket: dotBracketPairs.join(""),
});
assert.deepEqual(
  dotBracketSlotLayout.stems.map((stem) => [stem.from, stem.to]),
  [[1, 76]],
  "Sprinzl slot renderer maps dot-bracket sequence-index pairs onto current slots",
);
assert.equal(
  nodeByLabel(dotBracketSlotLayout, "1").x,
  nodeByLabel(standardSlotLayout, "1").x,
  "dot-bracket does not move biological slots",
);

const mismatchSequence = Array.from({ length: 76 }, () => "A");
const noValidation = buildSprinzlTRnaLayout(mismatchSequence, { runValidation: false });
assert.notEqual(noValidation.renderMode, "sprinzl_validation", "validation off render mode");
assert.equal(
  noValidation.warnings.some((warning) => warning.startsWith("stem mismatch")),
  false,
  "Sprinzl mismatch warnings stay hidden when validation is off",
);

const withValidation = buildSprinzlTRnaLayout(mismatchSequence, { runValidation: true });
assert.equal(
  withValidation.warnings.some((warning) => warning.startsWith("stem mismatch")),
  false,
  "runValidation no longer creates canonical mismatch warnings in renderer mode",
);

const deterministicSnapshots = Array.from({ length: 10 }, () =>
  buildSprinzlTRnaLayout(overflowStressSequence).mappedPositions.map((node) => ({
    slot: node.positionLabel,
    x: node.x,
    y: node.y,
  })),
);
deterministicSnapshots.slice(1).forEach((snapshot, index) => {
  assert.deepEqual(
    snapshot,
    deterministicSnapshots[0],
    `Sprinzl slot layout is deterministic on rebuild ${index + 2}`,
  );
});

console.log("structure layout tests passed");
