import { readFile, writeFile } from "node:fs/promises";
import { addExplanations } from "./explanations.mjs";

const PATH = new URL("../public/data/questions-en.json", import.meta.url);
const payload = JSON.parse(await readFile(PATH, "utf8"));
payload.questions = addExplanations(payload.questions);
payload.explanationsGeneratedAt = new Date().toISOString();
await writeFile(PATH, JSON.stringify(payload));
process.stdout.write(`Added explanations to ${payload.questions.length} questions.\n`);
