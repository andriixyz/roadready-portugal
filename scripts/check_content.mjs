import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { addExplanations } from "./explanations.mjs";
import {
  CITATION, EXPLANATION_SOURCES, GENERAL_SOURCE, OFFICIAL_SOURCE, PLACEHOLDER_EXPLANATION, REVIEWED_EXPLANATIONS,
  REVIEWED_TRANSLATIONS, applyReviewedTranslations, explanationFingerprint,
} from "./reviewed-content.mjs";

const root = new URL("../", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(`public/data/${name}.json`, root), "utf8"));

// Reviewed explanations describe one exact picture. The build calls this after
// preparing images, so a replaced image cannot ship with reasoning for the old one.
export async function checkReviewedExplanationImages({ required = true } = {}) {
  const { questions } = await read("questions-en");
  const reviewed = questions.filter((question) => REVIEWED_EXPLANATIONS.questions[question.id]);
  const hashes = await Promise.all(reviewed.map((question) => readFile(new URL(`public/images/questions/${question.sourceId}.jpg`, root))
    .then((bytes) => createHash("sha256").update(bytes).digest("hex"), () => null)));
  const missing = hashes.filter((hash) => hash === null).length;
  if (missing && !required) return { checked: 0, missing };
  reviewed.forEach((question, index) => {
    assert.ok(hashes[index], `Missing image for reviewed explanation ${question.id}; run npm run images`);
    assert.equal(hashes[index], REVIEWED_EXPLANATIONS.questions[question.id].imageSha256,
      `Image changed since its explanation was reviewed: ${question.id}`);
  });
  return { checked: reviewed.length, missing: 0 };
}

async function runChecks() {
  const [base, portuguese, russian] = await Promise.all([read("questions-en"), read("questions-pt"), read("questions-ru")]);
  const byId = new Map(base.questions.map((question) => [question.id, question]));
  const sourceById = new Map(portuguese.questions.map((question) => [question.id, question]));
  const seenCorrections = new Set();
  let reviewedCount = 0, cautionCount = 0, generalCount = 0;

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
        if (reviewed.en) assert.equal(en, reviewed.en);
        if (reviewed.ru) assert.equal(ru, reviewed.ru);
      }
    }
    const entry = REVIEWED_EXPLANATIONS.questions[question.id];
    if (question.explanationReviewed) {
      assert.ok(entry, `${question.id}: marked reviewed without a reviewed explanation`);
      assert.equal(entry.fingerprint, explanationFingerprint(question), `${question.id}: reviewed explanation is bound to different wording, options, key or image`);
      assert.equal(entry.fingerprint, explanationFingerprint(source), `${question.id}: the Portuguese corpus differs from the reviewed question`);
      assert.equal(question.explanation.en, entry.en);
      assert.equal(question.explanation.pt, entry.pt);
      assert.equal(overlay.explanation.ru, entry.ru);
      const general = entry.source === GENERAL_SOURCE;
      if (general) {
        assert.ok(!entry.sourceUrl && !question.explanationSource, `${question.id}: general-knowledge reasoning must not link a rule`);
        generalCount++;
      } else {
        assert.equal(question.explanationSource, entry.sourceUrl || EXPLANATION_SOURCES[entry.source]);
        assert.match(question.explanationSource, OFFICIAL_SOURCE, `${question.id}: the rule link must be an official source`);
      }
      for (const language of ["en", "pt", "ru"]) {
        if (!general) assert.match(entry[language], CITATION[language], `${question.id}: ${language} explanation must end with its legal citation`);
        assert.ok(!PLACEHOLDER_EXPLANATION.test(entry[language]), `${question.id}: reviewed text must not be the placeholder`);
      }
      assert.ok(["reviewed", "caution"].includes(entry.status), `${question.id}: unknown review status`);
      assert.equal(question.explanationCaution === true, entry.status === "caution", `${question.id}: caution label must follow the review status`);
      assert.ok(entry.imageNote?.trim(), `${question.id}: the review must record what its image shows`);
      reviewedCount++;
      if (entry.status === "caution") cautionCount++;
    } else {
      assert.ok(!entry || entry.fingerprint !== explanationFingerprint(question), `${question.id}: a matching reviewed explanation was not applied`);
      assert.ok(question.explanation.en.startsWith("Study key answer:"));
      assert.ok(question.explanation.en.includes("not yet been reviewed"));
      assert.ok(question.explanation.pt.startsWith("Resposta do material de estudo:"));
      assert.ok(overlay.explanation.ru.startsWith("Ответ по учебному ключу:"));
      assert.ok(!question.explanationSource, "Unreviewed feedback must not pretend to cite a rule");
      assert.ok(!question.explanationCaution, "Unreviewed feedback has no caution label");
    }
  }
  assert.equal(seenCorrections.size, REVIEWED_TRANSLATIONS.size, "Every correction must target an existing source phrase");
  // A stored explanation for a question that no longer exists, or whose wording
  // changed, must be reviewed again or removed rather than kept silently.
  assert.equal(reviewedCount, Object.keys(REVIEWED_EXPLANATIONS.questions).length, "Every reviewed explanation must match a current question");

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

  // A later scrape that changes the Portuguese answer, the key or the picture
  // must invalidate the old reasoning instead of asserting it for another question.
  for (const mutate of [
    (question) => { question.answers[1].pt = "A different Portuguese answer."; },
    (question) => { question.correct = question.correct === "A" ? "B" : "A"; },
    (question) => { question.text.pt += " não"; },
    (question) => { question.image = "https://example.test/a-different-road.jpg"; },
  ]) {
    const changed = structuredClone(turn);
    mutate(changed);
    const regenerated = addExplanations([changed])[0];
    assert.equal(regenerated.explanationReviewed, false);
    assert.ok(!regenerated.explanationSource);
    assert.ok(regenerated.explanation.en.startsWith("Study key answer:"));
  }
  const changedTranslation = structuredClone(turn);
  changedTranslation.text.pt = "A different Portuguese question.";
  changedTranslation.text.en = "Keep this new translation.";
  applyReviewedTranslations(changedTranslation, "en");
  assert.equal(changedTranslation.text.en, "Keep this new translation.");

  const images = await checkReviewedExplanationImages({ required: false });
  const imageNote = images.missing ? `image binding skipped until question images are prepared (${images.missing} missing)` : `${images.checked} reviewed images unchanged`;
  console.log(`Content checks passed: ${reviewedCount} reviewed explanations (${cautionCount} marked caution, ${generalCount} general knowledge) bound to wording, key and image; ${imageNote}; EN/RU corrections; unchanged Portuguese/answer keys.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runChecks();
