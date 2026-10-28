import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { getQuestionImagePath } from "../question-capture.js";
import {
  CITATION, EXPLANATION_SOURCES, GENERAL_SOURCE, OFFICIAL_SOURCE, PLACEHOLDER_EXPLANATION, REVIEWED_EXPLANATIONS, explanationFingerprint,
} from "./reviewed-content.mjs";

// Question-by-question review workbench for external agents (review/ZCODE.md).
// An agent reads one packet, looks at its image and writes one result file;
// nothing here edits the corpus. `import` folds checked results into
// reviewed-explanations.json, binding each one to the question and image it saw.

const root = new URL("../", import.meta.url);
const QUEUE = new URL("review/queue/", root);
const RESULTS = new URL("review/results/", root);
const REVIEWED_PATH = new URL("scripts/reviewed-explanations.json", root);
const REPORT_PATH = new URL("review/import-report.md", root);
const KEY_CHECKS = ["agree", "disagree", "unsure"];
const LANGUAGES = ["en", "pt", "ru"];
const TEXT_LIMITS = { imageNote: [10, 400], explanation: [40, 700], note: [10, 600] };
const SOURCE_KEYS = [...Object.keys(EXPLANATION_SOURCES), GENERAL_SOURCE];
const LAW = {
  ce: "review/law/codigo-da-estrada.md",
  rst: "review/law/regulamento-sinalizacao-transito.md",
  signs: "review/law/sign-codes.md",
  rhlc: "review/law/regulamento-habilitacao-legal-conduzir.md",
  alcohol: "review/law/lei-18-2007-alcool-substancias.md",
  cp: "review/law/codigo-penal-excertos.md",
};

// Starting points only: an answer may rest on any article, or on none.
export const TOPIC_HINTS = {
  "circulacao-seguranca-veiculos-missao-urgente-socorro": `CE articles 3, 11–23 (general traffic rules, position, distance, signalling manoeuvres) and 64–65 (emergency vehicles) in ${LAW.ce}.`,
  "sinais-perigo": `RST article 19 (danger signs A…) in ${LAW.rst}; codes in ${LAW.signs}.`,
  "sinais-proibicao": `RST articles 24–26 (prohibition signs C…) in ${LAW.rst}; codes in ${LAW.signs}.`,
  "sinais-prescricao-especifica-sinais-cedencia-passagem": `RST articles 21–22 (give-way signs B…) and 30–33 (lane selection, lane assignment and zone signs) in ${LAW.rst}; codes in ${LAW.signs}.`,
  "sinais-indicacao": `RST articles 34–47 (information, direction, locality and additional signs H…, I…, J…, L…, N…, O…, T…) in ${LAW.rst}; codes in ${LAW.signs}.`,
  "sinalizacao-luminosa-marcas-pavimento-outra-sinalizacao": `RST articles 58–67 (road markings M…), 68–76 (traffic lights) and 103–105 (police signals) in ${LAW.rst}; CE articles 5–7 (sign hierarchy) in ${LAW.ce}.`,
  "ultrapassagem": `CE articles 35–41 (overtaking) in ${LAW.ce}; RST article 60 (lines M1–M3) and 24 (C14a/C14b) in ${LAW.rst}.`,
  "paragem-estacionamento-cruzamento-veiculos": `CE articles 33 (passing oncoming vehicles), 48–52 (stopping and parking) and 163–164 in ${LAW.ce}; RST article 62 (parking markings) in ${LAW.rst}.`,
  "outras-manobras": `CE articles 12 and 21 (starting off, signalling) and 43–48 (turning, U-turns, reversing) in ${LAW.ce}.`,
  "velocidade": `CE articles 24–28 (speed rules and the article 27 table) and 145–146 in ${LAW.ce}; RST C13/C20/D8/G4/H6 in ${LAW.signs}.`,
  "cedencia-passagem": `CE articles 14-A (roundabouts) and 29–34 (priority) in ${LAW.ce}; RST articles 21–22 (B signs) and 68–69 (lights) in ${LAW.rst}.`,
  "estado-fisico-condutor-alcool-drogas-medicamentos-sinais-obrigacao": `CE articles 81, 145–146 and 153–158 (alcohol and drugs) in ${LAW.ce}; ${LAW.alcohol}; Código Penal article 292 in ${LAW.cp}; RST articles 27–29 (obligation signs D…) in ${LAW.rst}. Physiology questions are often "general".`,
  "classificacao-constituintes-inspeccoes-pesos-dimensoes-proteccao-ambiente-equipamentos-seguranca-acidente": `CE articles 79–80 (pollution), 82 (safety devices), 87–89 (breakdown, warning triangle, accidents) and 105–120 (vehicle classes, inspections, registration) in ${LAW.ce}. Vehicle-component questions are often "general".`,
  "iluminacao-passageiros-carga-conducao-defensiva-peoes": `CE articles 53–58 (passengers and cargo), 59–63 (lights), 82 (belts, child seats) and 99–104 (pedestrians) in ${LAW.ce}. Defensive-driving questions may be "general".`,
  "vias-transito-condicoes-ambientais-adversas": `CE articles 13–15, 19, 24–25, 60–61 and 72–78-A (lanes, visibility, motorways, reserved lanes) in ${LAW.ce}; RST articles 30–33 in ${LAW.rst}.`,
  "titulos-conducao-obtencao-revalidacao-responsabilidade-civil-criminal-ordenacoes-cassacao": `CE articles 85, 121–130 (licences), 131–149 (offences, points) and 150 (insurance) in ${LAW.ce}; ${LAW.rhlc}; Código Penal articles 69, 291–292 in ${LAW.cp}.`,
};

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

export async function loadCorpus() {
  const [base, russian] = await Promise.all([
    readJson(new URL("public/data/questions-en.json", root)),
    readJson(new URL("public/data/questions-ru.json", root)),
  ]);
  return base.questions.map((question, index) => ({ question, overlay: russian.questions[question.id], index }));
}

function hasCurrentReview(question) {
  return REVIEWED_EXPLANATIONS.questions[question.id]?.fingerprint === explanationFingerprint(question);
}

export function packetMarkdown({ question, overlay, index }, total) {
  const image = getQuestionImagePath(question);
  const options = (language) => question.answers.map((answer) => {
    const text = language === "ru" ? overlay.answers.find((item) => item.key === answer.key)?.ru : answer[language];
    return `- **${answer.key})** ${text}`;
  }).join("\n");
  const key = question.answers.find((answer) => answer.key === question.correct);
  const template = {
    id: question.id, imageNote: "", modelAnswer: "", keyCheck: "", keyCheckNote: "", source: "", en: "", pt: "", ru: "", translationNotes: "",
  };
  return `# Review packet ${question.id} (question ${index + 1} of ${total})

Follow review/AGENT.md. Write only \`review/results/${question.id}.json\`.

- Image: \`${image}\` — open it and look at it before answering.
- Topic: ${question.topic}
- Where to look first: ${TOPIC_HINTS[question.topicSlug] || `${LAW.ce}`}

## Portuguese — official wording, the source of truth

**Question:** ${question.text.pt}

${options("pt")}

## English (machine translation, may be wrong)

**Question:** ${question.text.en}

${options("en")}

## Russian (machine translation, may be wrong)

**Question:** ${overlay.text.ru}

${options("ru")}

## Study key

**${question.correct}** — ${key.pt}

## Result to write

Fill every field as review/AGENT.md describes, then run \`node scripts/review_queue.mjs check ${question.id}\`.

\`\`\`json
${JSON.stringify(template, null, 2)}
\`\`\`
`;
}

const isText = (value) => typeof value === "string" && value.trim().length > 0;

export function validateResult(result, question) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["the file must contain one JSON object"];
  const keys = question.answers.map((answer) => answer.key);
  const length = (field, value, [min, max]) => {
    if (!isText(value)) errors.push(`${field} is empty`);
    else if (value.trim().length < min || value.trim().length > max) errors.push(`${field} must be ${min}–${max} characters (now ${value.trim().length})`);
  };
  if (result.id !== question.id) errors.push(`id must be "${question.id}"`);
  length("imageNote", result.imageNote, TEXT_LIMITS.imageNote);
  if (!keys.includes(result.modelAnswer)) errors.push(`modelAnswer must be one of ${keys.join(", ")}`);
  if (!KEY_CHECKS.includes(result.keyCheck)) errors.push(`keyCheck must be one of ${KEY_CHECKS.join(", ")}`);
  if (result.keyCheck === "agree" && result.modelAnswer !== question.correct) errors.push(`keyCheck is "agree" but modelAnswer is not the study key ${question.correct}`);
  if (result.keyCheck !== "agree") length("keyCheckNote", result.keyCheckNote, TEXT_LIMITS.note);
  if (!SOURCE_KEYS.includes(result.source)) errors.push(`source must be one of ${SOURCE_KEYS.join(", ")}`);
  if (result.sourceUrl !== undefined && result.sourceUrl !== "") {
    if (result.source === GENERAL_SOURCE) errors.push("sourceUrl cannot be used with source \"general\"");
    if (!OFFICIAL_SOURCE.test(String(result.sourceUrl))) errors.push("sourceUrl must be an official https link (diariodarepublica.pt, dre.pt, imt-ip.pt, ansr.pt, inem.pt, gov.pt, eur-lex.europa.eu)");
  }
  for (const language of LANGUAGES) {
    const text = result[language];
    length(language, text, TEXT_LIMITS.explanation);
    if (!isText(text)) continue;
    if (/[\r\n]/.test(text)) errors.push(`${language} must be one paragraph without line breaks`);
    if (PLACEHOLDER_EXPLANATION.test(text.trim())) errors.push(`${language} must be a real explanation, not the study-key placeholder`);
    if (result.source !== GENERAL_SOURCE && SOURCE_KEYS.includes(result.source) && !CITATION[language].test(text)) {
      errors.push(`${language} must end with its legal citation (${language === "en" ? "e.g. \"Código da Estrada, Article 43(1).\"" : language === "pt" ? "e.g. \"Código da Estrada, artigo 43.º, n.º 1.\"" : "e.g. \"Código da Estrada, статья 43(1).\""})`);
    }
    if (result.source === GENERAL_SOURCE && CITATION[language].test(text)) errors.push(`${language} cites an article, so source must name that law instead of "general"`);
  }
  if (isText(result.ru) && !/[А-Яа-яЁё]/.test(result.ru)) errors.push("ru must be written in Russian");
  if (isText(result.en) && isText(result.pt) && result.en.trim() === result.pt.trim()) errors.push("pt must be written in Portuguese, not copied from en");
  if (result.translationNotes !== undefined && typeof result.translationNotes !== "string") errors.push("translationNotes must be a string");
  return errors;
}

async function resultIds() {
  const names = await readdir(RESULTS).catch(() => []);
  return names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
}

async function readResult(id) {
  const url = new URL(`${id}.json`, RESULTS);
  const text = await readFile(url, "utf8");
  const { mtime } = await stat(url);
  try {
    return { result: JSON.parse(text.replace(/^﻿/, "")), mtime };
  } catch (error) {
    return { parseError: `not valid JSON: ${error.message}`, mtime };
  }
}

async function checkResults(corpus, ids) {
  const byId = new Map(corpus.map((item) => [item.question.id, item]));
  const checked = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) { checked.push({ id, errors: [`${id} is not a question in the corpus`] }); continue; }
    const { result, parseError, mtime } = await readResult(id).catch(() => ({ parseError: "result file is missing" }));
    checked.push({ id, item, result, mtime, errors: parseError ? [parseError] : validateResult(result, item.question) });
  }
  return checked;
}

function parseOptions(args) {
  const options = { positional: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const [name, inline] = args[i].slice(2).split("=");
      options[name] = inline ?? (args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true);
    } else options.positional.push(args[i]);
  }
  return options;
}

async function writePackets(items, total) {
  await mkdir(QUEUE, { recursive: true });
  await Promise.all(items.map((item) => writeFile(new URL(`${item.question.id}.md`, QUEUE), packetMarkdown(item, total))));
}

async function pending(corpus) {
  const done = new Set(await resultIds());
  return corpus.filter(({ question }) => !done.has(question.id) && !hasCurrentReview(question));
}

async function commandNext(corpus, options) {
  const count = Number(options.positional[0] || 10);
  if (!Number.isInteger(count) || count < 1) throw new Error("Usage: next [count] [--shard i/n]");
  let queue = await pending(corpus);
  if (options.shard) {
    const [part, parts] = String(options.shard).split("/").map(Number);
    if (!(part >= 1 && part <= parts)) throw new Error("--shard must look like 2/4");
    queue = queue.filter(({ index }) => index % parts === part - 1);
  }
  const batch = queue.slice(0, count);
  await writePackets(batch, corpus.length);
  console.log(`# ${queue.length} questions pending${options.shard ? ` in shard ${options.shard}` : ""}; ${batch.length} packets below. ${batch.length ? "Give each one to a subagent." : "Nothing left to review."}`);
  for (const { question } of batch) console.log(`review/queue/${question.id}.md`);
}

async function commandPrepare(corpus) {
  const queue = await pending(corpus);
  await writePackets(queue, corpus.length);
  console.log(`Wrote ${queue.length} packets to review/queue/ (${corpus.length - queue.length} questions already have a result or reviewed explanation).`);
}

async function commandCheck(corpus, options) {
  const ids = options.positional.length ? options.positional.map((id) => id.replace(/^.*\//, "").replace(/\.(json|md)$/, "")) : await resultIds();
  const checked = await checkResults(corpus, ids);
  const invalid = checked.filter((entry) => entry.errors.length);
  for (const entry of checked) {
    if (entry.errors.length) console.log(`INVALID ${entry.id}: ${entry.errors.join("; ")}`);
    else if (options.positional.length) console.log(`OK ${entry.id}`);
  }
  console.log(`# ${checked.length - invalid.length} valid, ${invalid.length} invalid result files.`);
  if (invalid.length) process.exitCode = 1;
}

async function commandStatus(corpus) {
  const checked = await checkResults(corpus, await resultIds());
  const valid = checked.filter((entry) => !entry.errors.length);
  const count = (predicate) => valid.filter(predicate).length;
  const reviewed = corpus.filter(({ question }) => hasCurrentReview(question)).length;
  const queue = await pending(corpus);
  console.log(`Questions: ${corpus.length}`);
  console.log(`Result files: ${checked.length} (${valid.length} valid, ${checked.length - valid.length} invalid)`);
  console.log(`  key check: ${KEY_CHECKS.map((check) => `${check} ${count(({ result }) => result.keyCheck === check)}`).join(", ")}`);
  console.log(`  sources: ${SOURCE_KEYS.map((key) => `${key} ${count(({ result }) => result.source === key)}`).join(", ")}`);
  console.log(`Already imported into reviewed-explanations.json: ${reviewed}`);
  console.log(`Pending (no result yet): ${queue.length}`);
  const topics = new Map();
  for (const { question } of corpus) topics.set(question.topic, { total: 0, done: 0, general: 0 });
  for (const { question } of corpus) topics.get(question.topic).total++;
  for (const { item, result } of valid) {
    const topic = topics.get(item.question.topic);
    topic.done++;
    if (result.source === GENERAL_SOURCE) topic.general++;
  }
  console.log("\nBy topic (valid results / questions, general knowledge):");
  for (const [topic, { total, done, general }] of topics) console.log(`  ${String(done).padStart(4)} / ${String(total).padEnd(4)} general ${String(general).padStart(3)}  ${topic}`);
}

async function imageHash(question) {
  const bytes = await readFile(new URL(getQuestionImagePath(question), root));
  return createHash("sha256").update(bytes).digest("hex");
}

async function commandImport(corpus, options) {
  const reviewer = typeof options.reviewer === "string" ? options.reviewer : "zcode";
  const includeCaution = options.caution === true;
  const checked = await checkResults(corpus, await resultIds());
  const stored = REVIEWED_EXPLANATIONS;
  // Entries without a reviewer were written by hand; results never replace them.
  const manual = Object.fromEntries(Object.entries(stored.questions).filter(([, entry]) => !entry.reviewer));
  const imported = {}, held = [], invalid = [], keptManual = [], notes = [], customLinks = [];
  for (const { id, item, result, mtime, errors } of checked) {
    if (errors.length) { invalid.push({ id, errors }); continue; }
    if (manual[id]) { keptManual.push(id); continue; }
    if (result.translationNotes?.trim()) notes.push({ id, note: result.translationNotes.trim() });
    if (result.keyCheck !== "agree" && !includeCaution) { held.push({ id, item, result }); continue; }
    const image = await imageHash(item.question).catch(() => null);
    if (!image) { invalid.push({ id, errors: [`missing image ${getQuestionImagePath(item.question)}; run npm run images`] }); continue; }
    if (result.sourceUrl) customLinks.push({ id, url: result.sourceUrl });
    imported[id] = {
      fingerprint: explanationFingerprint(item.question),
      imageSha256: image,
      status: result.keyCheck === "agree" ? "reviewed" : "caution",
      source: result.source,
      ...(result.sourceUrl ? { sourceUrl: result.sourceUrl } : {}),
      en: result.en.trim(),
      pt: result.pt.trim(),
      ru: result.ru.trim(),
      imageNote: result.imageNote.trim(),
      reviewer,
      reviewedAt: mtime.toISOString().slice(0, 10),
    };
  }
  const order = new Map(corpus.map(({ question }, index) => [question.id, index]));
  const entries = { ...manual, ...imported };
  const questions = Object.fromEntries(Object.keys(entries).sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity)).map((id) => [id, entries[id]]));
  await writeFile(REVIEWED_PATH, `${JSON.stringify({ ...stored, questions }, null, 1)}\n`);
  await writeFile(REPORT_PATH, importReport({ imported, held, invalid, keptManual, notes, customLinks, includeCaution }));
  console.log(`Imported ${Object.keys(imported).length} explanations (${Object.values(imported).filter((entry) => entry.status === "caution").length} caution); kept ${Object.keys(manual).length} hand-written entries.`);
  console.log(`Held for a second opinion: ${held.length}. Invalid: ${invalid.length}. Translation notes: ${notes.length}. Details: review/import-report.md`);
  console.log("Next: npm run explain, then the content/data checks (documentation/md/PROJECT.md).");
}

function importReport({ imported, held, invalid, keptManual, notes, customLinks, includeCaution }) {
  const lines = ["# Review import report", "", `Generated ${new Date().toISOString()}. Imported ${Object.keys(imported).length} explanations.`, ""];
  lines.push(`## Held: the reviewer disagreed with or was unsure about the study key (${held.length})`, "",
    includeCaution ? "Imported as caution." : "Not imported. Re-check these with a stronger model or by hand, then run `import --caution` to publish the remaining disagreements as caution.", "");
  for (const { id, item, result } of held) lines.push(`- **${id}** (${result.keyCheck}; key ${item.question.correct}, reviewer ${result.modelAnswer}): ${result.keyCheckNote.trim()}`);
  lines.push("", `## Invalid result files (${invalid.length})`, "");
  for (const { id, errors } of invalid) lines.push(`- **${id}**: ${errors.join("; ")}`);
  lines.push("", `## Custom source links to verify (${customLinks.length})`, "");
  for (const { id, url } of customLinks) lines.push(`- **${id}**: ${url}`);
  lines.push("", `## Translation notes (${notes.length})`, "", "Not applied automatically. Confirmed fixes go in scripts/reviewed-translations.json, keyed by the exact Portuguese phrase.", "");
  for (const { id, note } of notes) lines.push(`- **${id}**: ${note}`);
  if (keptManual.length) lines.push("", `## Results ignored because a hand-written entry exists (${keptManual.length})`, "", keptManual.map((id) => `- ${id}`).join("\n"));
  return `${lines.join("\n")}\n`;
}

const COMMANDS = { next: commandNext, prepare: commandPrepare, check: commandCheck, status: commandStatus, import: commandImport };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (!COMMANDS[command]) {
    console.log("Usage: node scripts/review_queue.mjs <next [count] [--shard i/n] | prepare | check [id...] | status | import [--caution] [--reviewer name]>");
    process.exitCode = 1;
  } else {
    await COMMANDS[command](await loadCorpus(), parseOptions(args));
  }
}
