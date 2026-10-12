import assert from "node:assert/strict";
import { createQuestionImage, getCaptureContent, getQuestionChatGPTPrompt, getQuestionImagePath, wrapCanvasText } from "../question-capture.js";

const question = {
  sourceId: 2352, image: "https://www.bomcondutor.pt/assets/images/questions/2352.jpg",
  sourceUrl: "https://www.bomcondutor.pt/questao/2352",
  text: { en: "Which arrow is shown?", ru: "Какая стрелка изображена?", pt: "Que seta é esta?" },
  answers: [{ key: "A", en: "First option", ru: "Первый вариант", pt: "Primeira opção" }, { key: "B", en: "Second option", ru: "Второй вариант", pt: "Segunda opção" }],
  correct: "B", explanation: { en: "SECRET_EXPLANATION" },
};
assert.equal(getQuestionImagePath(question), "public/images/questions/2352.jpg");
assert.equal(getQuestionImagePath({ ...question, image: "" }), "");
assert.throws(() => getQuestionImagePath({ ...question, sourceId: "../secret" }));
assert.equal(getCaptureContent(question, "ru").text, question.text.ru);
assert.equal(getCaptureContent(question, "pt").answers[0].text, question.answers[0].pt);
assert.equal(getCaptureContent(question, "missing").text, question.text.en);
assert.ok(!("correct" in getCaptureContent(question)));
for (const language of ["en", "ru", "pt"]) {
  const prompt = getQuestionChatGPTPrompt(question, language);
  assert.ok(prompt.includes(question.text[language]));
  assert.ok(prompt.includes(`1. ${question.answers[0][language]}`));
  assert.ok(prompt.includes(`2. ${question.answers[1][language]}`));
  assert.ok(prompt.includes(question.sourceUrl));
  assert.ok(!prompt.includes("SECRET_EXPLANATION"));
  assert.ok(!prompt.includes("correct: B"));
}
assert.ok(getQuestionChatGPTPrompt(question, "missing").includes("Answer in English"));
const measure = { measureText: text => ({ width: Array.from(text).length * 10 }) };
assert.deepEqual(wrapCanvasText(measure, "one two three", 70), ["one two", "three"]);
assert.deepEqual(wrapCanvasText(measure, "abcdefghij", 40), ["abcd", "efgh", "ij"]);
assert.deepEqual(wrapCanvasText(measure, "Первый\nВторой", 200), ["Первый", "Второй"]);
const textDraws = [], imageDraws = [];
const context = new Proxy({ ...measure,
  fillText: text => textDraws.push(text),
  drawImage: (...args) => imageDraws.push(args),
}, { get: (target, key) => key in target ? target[key] : () => {} });
const canvas = { getContext: () => context, toBlob: callback => callback(new Blob(["test"], { type: "image/png" })) };
const documentTarget = { createElement: tag => { assert.equal(tag, "canvas"); return canvas; } };
const image = { naturalWidth: 640, naturalHeight: 480 };
const imageLoader = async path => { assert.equal(path, "public/images/questions/2352.jpg"); return image; };
const blob = await createQuestionImage(question, "ru", { documentTarget, imageLoader });
assert.equal(blob.type, "image/png");
assert.equal(canvas.width, 1200);
assert.ok(canvas.height > 1000);
assert.equal(imageDraws.length, 1);
assert.equal(imageDraws[0].length, 5, "The whole image must be drawn without source cropping");
assert.equal(imageDraws[0][4] / imageDraws[0][3], 480 / 640, "The image aspect ratio must be preserved");
assert.ok(textDraws.includes(question.text.ru));
assert.ok(textDraws.includes(question.answers[0].ru));
assert.ok(!textDraws.includes("SECRET_EXPLANATION"));
assert.ok(!textDraws.includes("✓") && !textDraws.includes("×"), "The default capture must not mark answers");
const plainHeight = canvas.height;
for (const [pick, mark] of [["A", "×"], ["B", "✓"]]) {
  textDraws.length = 0;
  const strokes = [];
  context.strokeRect = (...args) => strokes.push({ ...args, color: context.strokeStyle });
  await createQuestionImage(question, "en", { documentTarget, imageLoader, result: { pick, summary: `SUMMARY_${pick}` } });
  assert.ok(textDraws.includes(`SUMMARY_${pick}`), "The solved capture must state the verdict");
  assert.ok(textDraws.includes("✓"), "The solved capture must mark the study key");
  assert.equal(textDraws.includes("×"), pick !== question.correct, "Only a wrong pick is crossed out");
  assert.ok(textDraws.includes(mark));
  assert.ok(strokes.some(stroke => stroke.color === "#2f8a57"), "The study key is outlined in green");
  assert.equal(strokes.some(stroke => stroke.color === "#c2463a"), pick !== question.correct);
  assert.ok(!textDraws.includes("SECRET_EXPLANATION"));
  assert.ok(canvas.height > plainHeight, "The verdict row must fit inside the canvas");
}
delete context.strokeRect;
imageDraws.length = 0;
await createQuestionImage({ ...question, image: "" }, "en", { documentTarget, imageLoader: () => { throw new Error("Unexpected image load"); } });
assert.equal(imageDraws.length, 0, "Text-only questions must also work");
console.log("Question capture checks passed: languages, wrapping, full image ratio, text-only questions, no answer spoilers by default, and solved captures with verdicts.");
