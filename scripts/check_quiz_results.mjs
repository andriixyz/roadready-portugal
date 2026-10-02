import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as quiz from "../quiz-session.js";
import { localeFor, normalizeLanguage, russianPluralKey, translate } from "../i18n.js";
import { incrementAnswerCounts } from "../sync.js";
import { MAX_BACKUP_BYTES, InvalidStudyProfileError, normaliseStudyProfile, recoverStudyProfile } from "../profile-data.js";
import { recordStudyActivity, answersOnDay, studyStreak } from "../study-activity.js";

// Run the app's real handlers with an in-memory DOM and storage, without
// loading the corpus or connecting a study profile to the network.
const source = (await readFile(new URL("../app.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .split('main.innerHTML = `<div class="page"><div class="skeleton"')[0];
const nodes = new Map();
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, {
    innerHTML: "", hidden: true, dataset: {}, listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute() {}, focus() {}, scrollIntoView() {},
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {} },
  });
  return nodes.get(selector);
}
const storage = new Map();
const context = vm.createContext({
  ...quiz, localeFor, normalizeLanguage, russianPluralKey, translate, incrementAnswerCounts,
  MAX_BACKUP_BYTES, InvalidStudyProfileError, normaliseStudyProfile, recoverStudyProfile,
  recordStudyActivity, answersOnDay, studyStreak,
  getDeviceId: () => "test-device",
  document: {
    querySelector: node, querySelectorAll: () => [],
    body: node("body"), documentElement: node("html"), addEventListener() {},
  },
  window: { addEventListener() {} },
  location: { hash: "#quiz" }, history: { replaceState() {} },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  },
  clearInterval() {}, setInterval() {}, setTimeout() {},
  getQuestionChatGPTPrompt: () => "test prompt", getQuestionImagePath: () => "",
  fixtureQuestions: Array.from({ length: 3 }, (_, index) => ({
    id: `test-${index}`, sourceId: index + 1, text: { en: `Question ${index + 1}` },
    answers: [{ key: "A", en: "Correct option" }, { key: "B", en: "Wrong option" }],
    correct: "A", image: "", sourceUrl: "", explanation: { en: "Test explanation" },
  })),
});
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
const main = node("#mainContent");

for (const mode of ["quick", "review", "mistakes", "exam"]) {
  run(`profile = defaultProfile(); questions = fixtureQuestions;
    session = createQuizSession("${mode}", questions, "en"); location.hash = "#quiz";`);
  // Answer out of order and then return to the last question for results.
  for (const index of [2, 0, 1]) {
    run(`moveToQuestion(session, ${index}); renderQuestion(); chooseAnswer("A");`);
    if (mode !== "exam") node("#quizPrimary").listeners.click();
  }
  run("navigateQuestion(2)");
  assert.ok(main.innerHTML.includes(mode === "exam" ? "Finish exam" : "See results"));
  node("#quizPrimary").listeners.click();
  assert.ok(main.innerHTML.includes('class="card result-card"'), "Finishing must show results");
  assert.ok(main.innerHTML.includes('class="result-orb">3/3'));
  assert.equal(run("profile.sessions.length"), 1);

  run("render()");
  assert.ok(main.innerHTML.includes('class="card result-card"'), "Route renders must preserve results");
  run("renderQuestion()");
  assert.ok(main.innerHTML.includes('class="card result-card"'), "Late question renders must preserve results");
  await run('setQuestionLanguage("en")');
  assert.ok(main.innerHTML.includes('class="card result-card"'), "Language callbacks must preserve results");
  run("applySyncedProfile(profile); advanceQuiz(); finishSession()");
  assert.ok(main.innerHTML.includes('class="card result-card"'), "Sync must preserve results");
  assert.equal(run("profile.sessions.length"), 1, "Repeated events must not record another session");
  assert.equal(run("Object.values(profile.questionProgress).reduce((sum, item) => sum + item.correct + item.wrong, 0)"), 3);
}

run(`questions = fixtureQuestions; questions[0].image = 'https://example.test/road.jpg';
  questions[0].sourceUrl = 'https://example.test/question/1';
  session = createQuizSession('exam', questions, 'en'); chooseAnswer('B'); finishSession();`);
assert.ok(main.innerHTML.includes('class="review-image"'), "Missed image questions need the image in results");
assert.ok(main.innerHTML.includes('Source question #1'));
assert.ok(main.innerHTML.includes('<dt>Your answer</dt><dd>B · Wrong option</dd>'));
assert.ok(main.innerHTML.includes('<dt>Study-key answer</dt><dd>A · Correct option</dd>'));
assert.ok(main.innerHTML.includes('<dt>Your answer</dt><dd>Not answered</dd>'), "Unanswered mock items must be explicit");
console.log("Quiz results checks passed: submission, late renders/language/sync, single recording, and image/source/chosen/unanswered review details.");
