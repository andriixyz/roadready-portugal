import { readFile } from "node:fs/promises";

const path = new URL("../public/data/questions-en.json", import.meta.url);
const data = JSON.parse(await readFile(path, "utf8"));
const ids = new Set();
const errors = [];
for (const question of data.questions) {
  if (ids.has(question.id)) errors.push(`${question.id}: duplicate id`);
  ids.add(question.id);
  if (!question.text?.pt || !question.text?.en) errors.push(`${question.id}: missing bilingual question text`);
  if (!Array.isArray(question.answers) || question.answers.length < 2) errors.push(`${question.id}: too few answers`);
  if (!question.answers.every((answer) => answer.pt && answer.en)) errors.push(`${question.id}: missing bilingual answer`);
  if (!question.answers.some((answer) => answer.key === question.correct)) errors.push(`${question.id}: invalid answer key ${question.correct}`);
  if (!question.explanation?.en || !question.explanation?.pt) errors.push(`${question.id}: missing bilingual explanation`);
  if (question.category !== "B") errors.push(`${question.id}: unexpected category`);
}
console.log(JSON.stringify({ questions: data.questions.length, topics: new Set(data.questions.map((q) => q.topic)).size, errors: errors.length }, null, 2));
if (errors.length) { console.error(errors.slice(0, 30).join("\n")); process.exitCode = 1; }
