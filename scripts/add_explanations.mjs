import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { addExplanations } from "./explanations.mjs";
import { applyReviewedTranslations, studyExplanation } from "./reviewed-content.mjs";

const PATH = new URL("../public/data/questions-en.json", import.meta.url);
const RUSSIAN_PATH = new URL("../public/data/questions-ru.json", import.meta.url);
const sourceText = await readFile(PATH, "utf8");
const payload = JSON.parse(sourceText);
const russian = JSON.parse(await readFile(RUSSIAN_PATH, "utf8"));
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
if (russian.metadata?.sourceSha256 !== sha256(sourceText)) {
  throw new Error("Russian source hash mismatch. Regenerate the Russian overlay before refreshing study content.");
}
// Check identities and keys before updating the hash of the existing overlay.
// This refresh changes only reviewed wording and explanation presentation.
if (Object.keys(russian.questions).length !== payload.questions.length) throw new Error("Russian question count mismatch.");
for (const question of payload.questions) {
  const overlay = russian.questions[question.id];
  if (!overlay || overlay.answers.map((a) => a.key).join("|") !== question.answers.map((a) => a.key).join("|")) {
    throw new Error(`Russian answer keys mismatch: ${question.id}`);
  }
  applyReviewedTranslations(question, "en");
  applyReviewedTranslations(question, "ru", overlay);
  overlay.explanation.ru = studyExplanation(question, "ru", overlay.answers);
}
payload.questions = addExplanations(payload.questions);
payload.explanationsGeneratedAt = new Date().toISOString();
payload.contentReviewedAt = payload.explanationsGeneratedAt;
const refreshedText = JSON.stringify(payload);
russian.metadata.sourceSha256 = sha256(refreshedText);
russian.metadata.contentReviewedAt = payload.contentReviewedAt;
russian.metadata.explanationSourceLanguage = "study key or reviewed question-specific explanation";
russian.metadata.explanations = { version: 2, method: "Study key answer only unless a question-specific explanation has been reviewed" };
await writeFile(PATH, refreshedText);
await writeFile(RUSSIAN_PATH, `${JSON.stringify(russian)}\n`);
process.stdout.write(`Refreshed translations and study feedback for ${payload.questions.length} questions in EN/PT/RU.\n`);
