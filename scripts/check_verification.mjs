import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { prepareVerificationAudit, getQuestionVerification, verificationPdfUrl } from "../question-verification.js";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

export async function checkVerificationAssets() {
  const [english, portuguese, payload] = await Promise.all([
    readJson("public/data/questions-en.json"), readJson("public/data/questions-pt.json"), readJson("public/data/imt-verification.json"),
  ]);
  const audit = await prepareVerificationAudit(english.questions, payload);
  await prepareVerificationAudit(portuguese.questions, payload);
  for (let offset = 0; offset < english.questions.length; offset += 64) {
    await Promise.all(english.questions.slice(offset, offset + 64).map(async (question) => {
      const bytes = await readFile(new URL(`public/images/questions/${question.sourceId}.jpg`, root));
      const hash = createHash("sha256").update(bytes).digest("hex");
      assert.equal(hash, getQuestionVerification(question, audit).imageSha256,
        `Image changed since IMT comparison: ${question.id}; rerun the audit before claiming a match`);
    }));
  }
  for (const name of ["imt-app-comparison.csv", "imt-pdf-comparison.csv"]) {
    const csv = await readFile(new URL(`documentation/data/${name}`, root), "utf8");
    assert.ok(csv.length > 100, `Missing downloadable comparison: ${name}`);
  }
  return { audit, payload, questions: english.questions };
}

async function runChecks() {
  const { audit, payload, questions } = await checkVerificationAssets();
  const matched = questions.find((question) => getQuestionVerification(question, audit).status === "matched");
  assert.ok(matched, "The fixture corpus must include a confirmed match");
  const proof = getQuestionVerification(matched, audit);
  assert.match(verificationPdfUrl(audit, proof.locations[0]), /^https:\/\/www\.imt-ip\.pt\/.*\.pdf#page=\d+$/);

  // Changing a negative, an option order or the scene invalidates old proof.
  for (const mutate of [
    (question) => { question.text.pt += " não"; },
    (question) => { question.answers.reverse(); },
    (question) => { question.image = "https://example.test/a-different-road.jpg"; },
  ]) {
    const changed = structuredClone(matched);
    mutate(changed);
    assert.equal(getQuestionVerification(changed, audit), null);
    const changedCorpus = questions.map((question) => question.id === changed.id ? changed : question);
    await assert.rejects(prepareVerificationAudit(changedCorpus, payload), /different Portuguese corpus/);
  }
  // A source-question match never validates a translated word or answer key.
  const translated = structuredClone(matched);
  translated.text.en = "Unreviewed translation";
  translated.text.ru = "Непроверенный перевод";
  translated.correct = "unreviewed-key";
  assert.equal(getQuestionVerification(translated, audit).status, "matched");
  assert.equal(payload.method.answerKeyVerified, false);
  assert.equal(payload.method.translationsVerified, false);

  const forgedImage = structuredClone(payload);
  forgedImage.questions[matched.id].locations[0].image.tileMean = 100;
  await assert.rejects(prepareVerificationAudit(questions, forgedImage), /comparison location/);
  const unsafeSource = structuredClone(payload);
  unsafeSource.sources[0].url = "https://example.test/rel_1_condutores.pdf";
  await assert.rejects(prepareVerificationAudit(questions, unsafeSource), /PDF source/);
  const wrongSummary = structuredClone(payload);
  wrongSummary.summary.matched++;
  await assert.rejects(prepareVerificationAudit(questions, wrongSummary), /summary mismatch/);
  const missingProof = structuredClone(payload);
  delete missingProof.questions[matched.id];
  await assert.rejects(prepareVerificationAudit(questions, missingProof), /proof count mismatch/);
  console.log(`IMT verification checks passed: ${questions.length} bound question/image records, all 14 sources, conservative image gates, stale-proof rejection and separate answer/translation claims.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runChecks();
