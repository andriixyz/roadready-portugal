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

const runtimeSources = await Promise.all(["app.js", "sync.js", "index.html"].map(async (file) => ({
  file,
  text: await readFile(new URL(file, root), "utf8"),
})));
const keyPattern = /["']((?:aria|nav|chrome|language|settings|dashboard|unit|practice|quiz|result|progress|topic|sources|storage|sync|meta|plan)\.[A-Za-z0-9.-]+)["']/g;
const pluralKeyBases = new Set(["storage.question", "storage.session", "unit.day", "unit.attempt"]);
for (const source of runtimeSources) {
  for (const match of source.text.matchAll(keyPattern)) {
    if (!(match[1] in TRANSLATIONS.en) && !pluralKeyBases.has(match[1])) errors.push(`${source.file}: unknown UI translation key ${match[1]}`);
  }
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
