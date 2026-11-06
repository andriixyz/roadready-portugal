import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TRANSLATIONS } from "../i18n.js";

const root = new URL("../", import.meta.url);
const baseText = await readFile(new URL("public/data/questions-en.json", root), "utf8");
const base = JSON.parse(baseText);
const russian = JSON.parse(await readFile(new URL("public/data/questions-ru.json", root), "utf8"));
const ids = new Set();
const errors = [];
const baseHash = createHash("sha256").update(baseText).digest("hex");
if (russian.metadata?.sourceSha256 !== baseHash) errors.push("Russian corpus source hash does not match the English/Portuguese corpus");
if (!russian.metadata?.complete) errors.push("Russian corpus is not marked complete");
if (russian.count !== base.questions.length) errors.push(`Russian metadata count ${russian.count} does not match base count ${base.questions.length}`);

for (const question of base.questions) {
  if (ids.has(question.id)) errors.push(`${question.id}: duplicate id`);
  ids.add(question.id);
  if (!question.text?.pt || !question.text?.en) errors.push(`${question.id}: missing Portuguese/English question text`);
  if (!Array.isArray(question.answers) || question.answers.length < 2) errors.push(`${question.id}: too few answers`);
  if (!question.answers.every((answer) => answer.pt && answer.en)) errors.push(`${question.id}: missing Portuguese/English answer`);
  if (!question.answers.some((answer) => answer.key === question.correct)) errors.push(`${question.id}: invalid answer key ${question.correct}`);
  if (!question.explanation?.en || !question.explanation?.pt) errors.push(`${question.id}: missing Portuguese/English explanation`);
  if (question.category !== "B") errors.push(`${question.id}: unexpected category`);
}

const russianEntries = Array.isArray(russian.questions)
  ? russian.questions.map((question) => [question.id, question])
  : Object.entries(russian.questions || {});
if (russianEntries.length !== base.questions.length) errors.push(`Russian corpus count ${russianEntries.length} does not match base count ${base.questions.length}`);

const baseById = new Map(base.questions.map((question) => [question.id, question]));
const russianIds = new Set();
for (const [overlayId, overlay] of russianEntries) {
  const question = baseById.get(overlayId);
  if (!question) { errors.push(`${overlayId}: Russian entry is not in the base corpus`); continue; }
  if (russianIds.has(overlayId)) errors.push(`${overlayId}: duplicate Russian id`);
  russianIds.add(overlayId);
  if (!overlay.text?.ru?.trim()) errors.push(`${overlayId}: missing Russian question text`);
  if (!overlay.explanation?.ru?.trim()) errors.push(`${overlayId}: missing Russian explanation`);
  if (!Array.isArray(overlay.answers) || overlay.answers.length !== question.answers.length) {
    errors.push(`${overlayId}: Russian answer count mismatch`);
    continue;
  }
  const expectedKeys = question.answers.map((answer) => answer.key).sort().join("|");
  const actualKeys = overlay.answers.map((answer) => answer.key).sort().join("|");
  if (actualKeys !== expectedKeys) errors.push(`${overlayId}: Russian answer keys do not match`);
  if (!overlay.answers.every((answer) => answer.ru?.trim())) errors.push(`${overlayId}: missing Russian answer`);
}

const englishKeys = Object.keys(TRANSLATIONS.en);
const russianKeys = Object.keys(TRANSLATIONS.ru);
for (const key of englishKeys) if (!(key in TRANSLATIONS.ru)) errors.push(`${key}: missing Russian UI translation`);
for (const key of russianKeys) if (!(key in TRANSLATIONS.en)) errors.push(`${key}: missing English UI translation`);

const runtimeSources = await Promise.all(["app.js", "sync.js", "speed-limits.js", "rule-drill.js", "offences.js", "distances.js", "index.html"].map(async (file) => ({
  file,
  text: await readFile(new URL(file, root), "utf8"),
})));
const keyPattern = /["']((?:aria|nav|chrome|language|settings|dashboard|unit|practice|quiz|result|progress|topic|sources|storage|sync|meta|plan|speed|atlas|offence|distance)\.[A-Za-z0-9.-]+)["']/g;
const pluralKeyBases = new Set(["storage.question", "storage.session", "unit.day", "unit.attempt"]);
for (const source of runtimeSources) {
  for (const match of source.text.matchAll(keyPattern)) {
    if (!(match[1] in TRANSLATIONS.en) && !pluralKeyBases.has(match[1])) errors.push(`${source.file}: unknown UI translation key ${match[1]}`);
  }
}

// Speed atlas content is addressed through derived keys, so check each one in both dictionaries.
const { SPEED_ATLAS } = await import("../speed-limits.js");
const speedKeys = [
  ...SPEED_ATLAS.roads.flatMap((road) => [`speed.road.${road}`, `speed.cue.${road}`]),
  ...SPEED_ATLAS.vehicles.flatMap((vehicle) => [`speed.vehicle.${vehicle.id}`, ...vehicle.variants.map(({ variant }) => `speed.memory.${vehicle.id}.${variant}`)]),
  ...SPEED_ATLAS.signs.flatMap((sign) => ["name", "meaning", "trap"].map((part) => `speed.sign.${sign}.${part}`)),
  ...SPEED_ATLAS.places.map((place) => `speed.place.${place}`),
  ...SPEED_ATLAS.flash.flatMap((item) => [`speed.flash.${item}.q`, `speed.flash.${item}.a`]),
  ...SPEED_ATLAS.facts.flatMap((fact) => [`speed.fact.${fact}.title`, `speed.fact.${fact}.body`]),
  ...SPEED_ATLAS.levels.map((level) => `speed.level.${level}`),
  ...SPEED_ATLAS.exceptions.flatMap((item) => [`speed.except.${item}.title`, `speed.except.${item}.body`]),
  ...SPEED_ATLAS.decks.map((deck) => `speed.deck.${deck}`),
  ...SPEED_ATLAS.drills.flatMap((drill) => [`speed.drill.${drill.id}.question`, `speed.drill.${drill.id}.why`, ...drill.choices.filter((choice) => typeof choice === "string").map((choice) => `speed.drill.${drill.id}.${choice}`)]),
];
for (const key of speedKeys) for (const language of ["en", "ru"]) if (!(key in TRANSLATIONS[language])) errors.push(`${key}: missing ${language === "en" ? "English" : "Russian"} speed-atlas translation`);
for (const drill of SPEED_ATLAS.drills) {
  if (!drill.choices.includes(drill.correct)) errors.push(`speed drill ${drill.id}: correct answer is not among the choices`);
  if (!SPEED_ATLAS.decks.includes(drill.deck) || drill.deck === "all") errors.push(`speed drill ${drill.id}: unknown deck ${drill.deck}`);
}
for (const vehicle of SPEED_ATLAS.vehicles) for (const { variant, values } of vehicle.variants) {
  if (values.length !== SPEED_ATLAS.roads.length) errors.push(`speed row ${vehicle.id}.${variant}: expected ${SPEED_ATLAS.roads.length} road values`);
  for (const value of values) if (value !== null && (!Number.isInteger(value) || value < SPEED_ATLAS.sharedZone || value > 120 || value % 5 !== 0)) errors.push(`speed row ${vehicle.id}.${variant}: implausible limit ${value}`);
}

// Offence and distance atlases list every derived key they render; check both dictionaries and the drills.
const { OFFENCE_ATLAS, alcoholBand, applyPointEvent, pointsStatus } = await import("../offences.js");
const { DISTANCE_ATLAS } = await import("../distances.js");
for (const [name, atlas] of [["offence", OFFENCE_ATLAS], ["distance", DISTANCE_ATLAS]]) {
  for (const key of new Set(atlas.keys)) for (const language of ["en", "ru"]) if (!(key in TRANSLATIONS[language])) errors.push(`${key}: missing ${language === "en" ? "English" : "Russian"} ${name}-atlas translation`);
  const ids = new Set();
  for (const drill of atlas.drills) {
    if (ids.has(drill.id)) errors.push(`${name} drill ${drill.id}: duplicate id`);
    ids.add(drill.id);
    if (!drill.choices.includes(drill.correct)) errors.push(`${name} drill ${drill.id}: correct answer is not among the choices`);
    if (new Set(drill.choices).size !== drill.choices.length) errors.push(`${name} drill ${drill.id}: repeated choice`);
    if (!atlas.decks.includes(drill.deck) || drill.deck === "all") errors.push(`${name} drill ${drill.id}: unknown deck ${drill.deck}`);
  }
}
for (const item of OFFENCE_ATLAS.items) {
  if (!OFFENCE_ATLAS.levels.includes(item.level)) errors.push(`offence item ${item.id}: unknown level ${item.level}`);
  if (!OFFENCE_ATLAS.themes.includes(item.theme) || item.theme === "all") errors.push(`offence item ${item.id}: unknown theme ${item.theme}`);
  if (item.upgrade && item.level !== "serious") errors.push(`offence item ${item.id}: only serious offences can be upgraded on motorways`);
  if (item.points && (item.level === "minor" || !Number.isInteger(item.points) || item.points < 2 || item.points > 6)) errors.push(`offence item ${item.id}: implausible points ${item.points}`);
}
// Art. 81, 145 l), 146 j) and Código Penal art. 292: thresholds are inclusive at the lower bound.
const alcoholCases = [[0.49, false, "none"], [0.5, false, "serious"], [0.79, false, "serious"], [0.8, false, "verySerious"], [1.19, false, "verySerious"], [1.2, false, "crime"], [0.19, true, "none"], [0.2, true, "serious"], [0.5, true, "verySerious"], [1.2, true, "crime"]];
for (const [tas, strict, expected] of alcoholCases) if (alcoholBand(tas, strict) !== expected) errors.push(`alcoholBand(${tas}, ${strict}) should be ${expected}`);
// Art. 121-A and 148: subtraction floors at 0, bonuses cap at 15 and 16, and nothing changes after cassação.
const pointCases = [[12, "serious", 10], [12, "verySeriousPlus", 7], [4, "crime", 0], [0, "clean", 0], [14, "clean", 15], [15, "training", 16], [16, "clean", 16]];
for (const [points, event, expected] of pointCases) if (applyPointEvent(points, event) !== expected) errors.push(`applyPointEvent(${points}, ${event}) should be ${expected}`);
for (const [points, expected] of [[6, "fine"], [5, "training"], [4, "training"], [3, "exam"], [1, "exam"], [0, "revoked"]]) if (pointsStatus(points) !== expected) errors.push(`pointsStatus(${points}) should be ${expected}`);
for (const item of DISTANCE_ATLAS.landmarks) {
  if (!["stopPark", "park"].includes(item.scope)) errors.push(`distance landmark ${item.id}: unknown scope ${item.scope}`);
  const values = item.lateral ? [item.lateral] : [item.before, item.after];
  if (!values.some((value) => value > 0) || values.some((value) => !(value >= 0 && value <= 50))) errors.push(`distance landmark ${item.id}: implausible distances ${values.join("/")}`);
}
for (const item of [...DISTANCE_ATLAS.beams, ...DISTANCE_ATLAS.countdowns]) {
  const value = item.metres ?? item.step;
  if (!(value > 0 && value <= 250)) errors.push(`distance value ${item.id}: implausible ${value}`);
}

console.log(JSON.stringify({
  questions: base.questions.length,
  russianQuestions: russianEntries.length,
  russianStrings: russianEntries.reduce((sum, [, question]) => sum + 2 + (question.answers?.length || 0), 0),
  topics: new Set(base.questions.map((question) => question.topic)).size,
  uiKeys: englishKeys.length,
  errors: errors.length,
}, null, 2));
if (errors.length) {
  console.error(errors.slice(0, 60).join("\n"));
  process.exitCode = 1;
}
