import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addExplanations } from "./explanations.mjs";
import { REVIEWED_TRANSLATIONS, applyReviewedTranslations } from "./reviewed-content.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), "utf8"));
const [base, portuguese, russian] = await Promise.all([read("questions-en"), read("questions-pt"), read("questions-ru")]);
const byId = new Map(base.questions.map((question) => [question.id, question]));
const sourceById = new Map(portuguese.questions.map((question) => [question.id, question]));
const seenCorrections = new Set();

for (const question of base.questions) {
  const source = sourceById.get(question.id);
  assert.equal(question.text.pt, source.text.pt, "The Portuguese original must not change");
  assert.equal(question.correct, source.correct, "Reviewing wording must not change the study key");
  assert.deepEqual(question.answers.map(({ key, pt }) => ({ key, pt })), source.answers.map(({ key, pt }) => ({ key, pt })));
  const overlay = russian.questions[question.id];
  const fields = [[question.text.pt, question.text.en, overlay.text.ru], ...question.answers.map((answer) =>
    [answer.pt, answer.en, overlay.answers.find((a) => a.key === answer.key).ru])];
  for (const [pt, en, ru] of fields) {
    const reviewed = REVIEWED_TRANSLATIONS.get(pt);
    if (reviewed) {
      seenCorrections.add(pt);
      assert.equal(en, reviewed.en);
      assert.equal(ru, reviewed.ru);
    }
  }
  if (!question.explanationReviewed) {
    assert.ok(question.explanation.en.startsWith("Study key answer:"));
    assert.ok(question.explanation.en.includes("not yet been reviewed"));
    assert.ok(question.explanation.pt.startsWith("Resposta do material de estudo:"));
    assert.ok(overlay.explanation.ru.startsWith("Ответ по учебному ключу:"));
    assert.ok(!question.explanationSource, "Unreviewed feedback must not pretend to cite a rule");
  }
}
assert.equal(seenCorrections.size, REVIEWED_TRANSLATIONS.size, "Every correction must target an existing source phrase");

assert.equal(byId.get("bc-3755").text.en, "In this situation, when turning left, I give way to:");
assert.ok(russian.questions["bc-3755"].text.ru.includes("уступаю дорогу"));
assert.equal(byId.get("bc-1184").text.en, "I give way to the ambulance because:");
assert.ok(!byId.get("bc-1184").answers[0].en.includes("gear"));
const turn = byId.get("bc-1165");
assert.ok(turn.explanationReviewed);
assert.ok(turn.explanation.en.includes("right edge"));
assert.ok(turn.explanation.en.includes("Article 43(1)"));
assert.ok(!turn.explanation.en.includes("Emergency"));
assert.ok(russian.questions[turn.id].explanation.ru.includes("правому краю"));
assert.ok(!russian.questions[turn.id].explanation.ru.includes("экстренного"));

// A later scrape that changes the Portuguese answer must invalidate the old
// reasoning, rather than continuing to assert a rule for different wording.
const changed = structuredClone(turn);
changed.answers[1].pt = "A different Portuguese answer.";
const regenerated = addExplanations([changed])[0];
assert.equal(regenerated.explanationReviewed, false);
assert.ok(!regenerated.explanationSource);
const changedTranslation = structuredClone(turn);
changedTranslation.text.pt = "A different Portuguese question.";
changedTranslation.text.en = "Keep this new translation.";
applyReviewedTranslations(changedTranslation, "en");
assert.equal(changedTranslation.text.en, "Keep this new translation.");

console.log("Content checks passed: give-way meaning, EN/RU corrections, relevant sourced feedback, no topic boilerplate, and unchanged Portuguese/answer keys.");
