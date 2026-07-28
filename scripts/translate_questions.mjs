import { readFile, writeFile } from "node:fs/promises";
import { addExplanations } from "./explanations.mjs";

const INPUT = new URL("../public/data/questions-pt.json", import.meta.url);
const OUTPUT = new URL("../public/data/questions-en.json", import.meta.url);
const MAX_CHARS = 3200;
const CONCURRENCY = 8;
const TERM_FIXES = new Map([
  ["Lomba.", "Speed hump."],
  ["Rotunda.", "Roundabout."],
  ["Tara.", "Unladen weight."],
]);

async function translate(text, attempt = 1) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    return data[0].map((segment) => segment[0]).join("");
  } catch (error) {
    if (attempt >= 5) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    return translate(text, attempt + 1);
  }
}

function makeChunks(records) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const record of records) {
    const addition = record.text.length + 32;
    if (current.length && size + addition > MAX_CHARS) { chunks.push(current); current = []; size = 0; }
    current.push(record); size += addition;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
      if ((index + 1) % 20 === 0) process.stdout.write(`Translated ${index + 1}/${items.length} batches\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

const payload = JSON.parse(await readFile(INPUT, "utf8"));
const records = [];
payload.questions.forEach((question, qi) => {
  records.push({ qi, ai: null, text: question.text.pt });
  question.answers.forEach((answer, ai) => records.push({ qi, ai, text: answer.pt }));
});
const chunks = makeChunks(records);
process.stdout.write(`Translating ${records.length} strings in ${chunks.length} batches.\n`);

await pool(chunks, async (chunk) => {
  const source = chunk.map((record, index) => `${record.text}\n[[[RRSEP_${index}]]]`).join("\n");
  const translated = await translate(source);
  const parts = translated.split(/\s*\[\[\[RRSEP_\d+\]\]\]\s*/).filter((part) => part.trim());
  if (parts.length !== chunk.length) throw new Error(`Translation boundary mismatch: expected ${chunk.length}, received ${parts.length}`);
  chunk.forEach((record, index) => {
    const value = TERM_FIXES.get(record.text.trim()) || parts[index].trim();
    if (record.ai === null) payload.questions[record.qi].text.en = value;
    else payload.questions[record.qi].answers[record.ai].en = value;
  });
});

payload.translatedAt = new Date().toISOString();
payload.translation = "Google machine translation, Portuguese to English; Portuguese source preserved";
payload.questions = addExplanations(payload.questions);
payload.explanationsGeneratedAt = new Date().toISOString();
await writeFile(OUTPUT, JSON.stringify(payload));
process.stdout.write(`Wrote English corpus to ${OUTPUT.pathname}\n`);
