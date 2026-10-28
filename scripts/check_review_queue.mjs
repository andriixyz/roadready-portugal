import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TOPIC_HINTS, loadCorpus, packetMarkdown, validateResult } from "./review_queue.mjs";

const root = new URL("../", import.meta.url);
const corpus = await loadCorpus();
const item = corpus.find(({ question }) => question.id === "bc-1103");
const { question } = item;

// The worked example in the agent instructions must itself pass the checker.
const instructions = await readFile(new URL("review/AGENT.md", root), "utf8");
const example = JSON.parse(instructions.match(/```json\n([\s\S]*?)```/)[1]);
assert.deepEqual(validateResult(example, question), []);

const failsWith = (change, pattern) => {
  const result = { ...structuredClone(example), ...change };
  const errors = validateResult(result, question);
  assert.ok(errors.some((error) => pattern.test(error)), `expected ${pattern} in ${JSON.stringify(errors)}`);
};
failsWith({ id: "bc-1104" }, /^id must be/);
failsWith({ modelAnswer: "B" }, /"agree" but modelAnswer/);
failsWith({ modelAnswer: "D" }, /modelAnswer must be one of A, B/);
failsWith({ keyCheck: "maybe" }, /keyCheck must be one of/);
failsWith({ modelAnswer: "B", keyCheck: "disagree", keyCheckNote: "" }, /keyCheckNote is empty/);
failsWith({ source: "manual" }, /source must be one of/);
failsWith({ en: example.en.replace(/ Código da Estrada.*$/, "") }, /en must end with its legal citation/);
failsWith({ pt: example.pt.replace(/ Código da Estrada.*$/, "") }, /pt must end with its legal citation/);
failsWith({ ru: example.ru.replace(/ Código da Estrada.*$/, "") }, /ru must end with its legal citation/);
failsWith({ source: "general" }, /cites an article/);
failsWith({ ru: example.en }, /ru must be written in Russian/);
failsWith({ pt: example.en }, /pt must be written in Portuguese/);
failsWith({ en: `${example.en}\nSecond paragraph.` }, /without line breaks/);
failsWith({ en: "x".repeat(701) }, /en must be 40–700 characters/);
failsWith({ imageNote: "" }, /imageNote is empty/);
failsWith({ sourceUrl: "https://example.com/law" }, /official https link/);
failsWith({ en: "Study key answer: “I must give way.” Código da Estrada, Article 65(1)." }, /not the study-key placeholder/);
assert.deepEqual(validateResult(["not", "an", "object"], question), ["the file must contain one JSON object"]);

// A general-knowledge answer needs no citation, and a disagreement only needs its note.
const general = {
  ...example,
  source: "general",
  en: "Someone who properly signals an urgent mission needs a clear road, so other drivers let it pass.",
  pt: "Quem assinala adequadamente uma marcha de urgência precisa de via livre, pelo que os outros condutores o deixam passar.",
  ru: "Тому, кто надлежащим образом обозначает срочную поездку, нужна свободная дорога, поэтому другие водители его пропускают.",
};
assert.deepEqual(validateResult(general, question), []);
assert.deepEqual(validateResult({ ...example, modelAnswer: "B", keyCheck: "disagree", keyCheckNote: "The picture shows no lights or siren, so the premise looks wrong." }, question), []);
assert.deepEqual(validateResult({ ...example, sourceUrl: "https://diariodarepublica.pt/dr/detalhe/lei/18-2007-520799" }, question), []);

// Packets carry the original wording, both translations, the key, the image and a template for this id.
const packet = packetMarkdown(item, corpus.length);
for (const text of [question.text.pt, question.text.en, item.overlay.text.ru, ...question.answers.map((answer) => answer.pt)]) assert.ok(packet.includes(text));
assert.ok(packet.includes("public/images/questions/1103.jpg"));
assert.ok(packet.includes(`**${question.correct}** — `));
assert.ok(packet.includes(`"id": "${question.id}"`));
assert.ok(packet.includes("review/results/bc-1103.json"));
for (const { question: other } of corpus) assert.ok(TOPIC_HINTS[other.topicSlug], `${other.topicSlug} needs a "where to look first" hint`);

console.log("Review queue checks passed: the agent example is valid, malformed results are rejected with actionable errors, and packets carry the original wording, translations, key and image.");
