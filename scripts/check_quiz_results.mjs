import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as quiz from "../quiz-session.js";
import * as planning from "../exam-plan.js";
import { localeFor, normalizeLanguage, russianPluralKey, translate } from "../i18n.js";
import { incrementAnswerCounts } from "../sync.js";
import { MAX_BACKUP_BYTES, InvalidStudyProfileError, normaliseStudyProfile, recoverStudyProfile } from "../profile-data.js";
import { recordStudyActivity, answersOnDay, studyStreak } from "../study-activity.js";
import { prepareVerificationAudit, getQuestionVerification, verificationPdfUrl } from "../question-verification.js";

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
  ...quiz, ...planning, localeFor, normalizeLanguage, russianPluralKey, translate, incrementAnswerCounts,
  MAX_BACKUP_BYTES, InvalidStudyProfileError, normaliseStudyProfile, recoverStudyProfile,
  recordStudyActivity, answersOnDay, studyStreak,
  prepareVerificationAudit, getQuestionVerification, verificationPdfUrl,
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
  navigator: {},
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

for (const mode of ["quick", "review", "mistakes", "exam", "learn", "repair"]) {
  run(`profile = defaultProfile(); questions = fixtureQuestions;
    session = createQuizSession("${mode}", questions, "en"); location.hash = "#quiz"; renderQuestion(); chooseAnswer("B");`);
  assert.equal(run("session.index"), 0, "A wrong answer stays on the question until explicit navigation");
  assert.equal(run("session.checked"), true, "Selecting an answer immediately checks it in every mode");
  assert.ok(main.innerHTML.includes('class="feedback incorrect"'), "The mistake must be visible immediately");
  assert.ok(main.innerHTML.includes('class="answer-option correct" data-answer="A"'), "Show the study-key choice");
  assert.ok(main.innerHTML.includes('class="answer-option wrong" data-answer="B"'), "Show the chosen wrong choice");
  assert.equal(run("profile.sessions.length"), 0, "Showing feedback must not submit the session");
  assert.equal(run("profile.savedQuestions['test-0'].mistake"), true, "Every checked mistake saves immediately, including unfinished mocks");
  assert.ok(main.innerHTML.includes(translate("saved.answerSaved", "en")));
  run("chooseAnswer('A'); navigateQuestion(1); navigateQuestion(0); applySyncedProfile(profile); renderQuestion()");
  assert.equal(run("session.answers[0].pick"), "B", "Revealing the key must not allow correcting the recorded attempt");
  assert.ok(main.innerHTML.includes('class="feedback incorrect"'), "Navigation and sync must preserve mistake feedback");
  assert.equal(run("profile.questionProgress['test-0']?.wrong || 0"), mode === "exam" ? 0 : 1, "Practice saves once; mocks wait for submission");
  run("navigateQuestion(2); chooseAnswer('B')");
  assert.equal(run("session.index"), 2, "The final wrong answer also stays available for review");
  assert.equal(run("profile.sessions.length"), 0, "The final answer must not automatically submit or return to skipped questions");
  node("#quizPrimary").listeners.click();
  assert.equal(run("session.index"), 1, "Returning to skipped questions requires the user's continue action");

  run(`profile = defaultProfile(); questions = fixtureQuestions;
    session = createQuizSession("${mode}", questions, "en"); location.hash = "#quiz";`);
  // Answer out of order and then return to the last question for results.
  for (const index of [2, 0, 1]) {
    run(`moveToQuestion(session, ${index}); renderQuestion(); chooseAnswer("A");`);
    assert.equal(run("session.index"), index, "Correct answers also wait for explicit navigation");
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

for (const mode of ["quick", "review", "mistakes", "exam", "learn", "repair"]) {
  run(`profile = defaultProfile(); questions = fixtureQuestions;
    session = createQuizSession("${mode}", questions, "en"); location.hash = "#quiz"; renderQuestion();`);
  node("#notSure").listeners.change({ target: { checked: true } });
  assert.equal(run("Object.keys(profile.savedQuestions).length"), 0, "Checking alone must not save an unanswered question");
  run("navigateQuestion(1); navigateQuestion(0); applySyncedProfile(profile)");
  assert.ok(main.innerHTML.includes('id="notSure" type="checkbox" aria-describedby="notSureHelp" checked'));
  run("chooseAnswer('A')");
  assert.equal(run("session.answers[0].notSure"), true);
  assert.equal(run("profile.savedQuestions['test-0'].notSure"), true, "An uncertain correct answer belongs in the collection");
  assert.equal(run("profile.savedQuestions['test-0'].mistake"), undefined, "Uncertainty must not change the answer outcome");
  assert.equal(run("profile.questionProgress['test-0']?.correct || 0"), mode === "exam" ? 0 : 1);
  const before = run("JSON.stringify(profile.savedQuestions)");
  node("#notSure").listeners.change({ target: { checked: false } });
  run("chooseAnswer('B'); navigateQuestion(1); navigateQuestion(0); renderQuestion()");
  assert.equal(run("session.answers[0].notSure"), true, "A checked uncertainty mark cannot be rewritten after feedback");
  assert.equal(run("JSON.stringify(profile.savedQuestions)"), before, "Repeated answers/renders cannot duplicate saved questions");
  run("session = null; profile = loadProfile(); location.hash = '#saved-questions'; render()");
  assert.equal(run("savedQuestionCollection().length"), 1, "Saved questions survive abandoning a set and reloading the profile");
  assert.ok(main.innerHTML.includes('class="card saved-question"'));
  assert.ok(main.innerHTML.includes('Correct option'), "The collection retains the question and all its choices");
  run("session = createQuizSession('quick', questions, 'en'); location.hash = '#quiz'; chooseAnswer('B'); session = createQuizSession('quick', questions, 'en'); chooseAnswer('A')");
  assert.equal(run("profile.savedQuestions['test-0'].notSure && profile.savedQuestions['test-0'].mistake"), true, "Both reasons persist after later confident correct answers");
}

run("profile = defaultProfile(); questions = fixtureQuestions; session = createQuizSession('exam', questions, 'en'); location.hash = '#quiz'; finishSession()");
assert.equal(run("Object.keys(profile.savedQuestions).length"), 3, "Unanswered submitted mock questions count as mistakes in the collection");
run("profile = normaliseProfile({ questionProgress: { 'test-0': {correct: 10, wrong: 1} }, sessions: [] }); session = null; renderSavedQuestions()");
assert.equal(run("savedQuestionCollection().length"), 1, "Historical mistakes remain saved even with high lifetime accuracy");
assert.equal(run("mistakeQuestions().length"), 0, "The collection must preserve the existing mistake clinic's selection rules");
run("profile = defaultProfile(); renderSavedQuestions()");
assert.ok(main.innerHTML.includes(translate("saved.emptyTitle", "en")));

run(`questions = fixtureQuestions; questions[0].image = 'https://example.test/road.jpg';
  questions[0].sourceUrl = 'https://example.test/question/1';
  session = createQuizSession('exam', questions, 'en'); chooseAnswer('B'); finishSession();`);
assert.ok(main.innerHTML.includes('class="review-image"'), "Missed image questions need the image in results");
assert.ok(main.innerHTML.includes('Source question #1'));
assert.ok(main.innerHTML.includes('<dt>Your answer</dt><dd>B · Wrong option</dd>'));
assert.ok(main.innerHTML.includes('<dt>Study-key answer</dt><dd>A · Correct option</dd>'));
assert.ok(main.innerHTML.includes('<dt>Your answer</dt><dd>Not answered</dd>'), "Unanswered mock items must be explicit");

// Verification and answer reasoning appear only after the first answer is selected.
const bank = JSON.parse(await readFile(new URL("../public/data/questions-en.json", import.meta.url), "utf8"));
const proofPayload = JSON.parse(await readFile(new URL("../public/data/imt-verification.json", import.meta.url), "utf8"));
context.auditFixture = await prepareVerificationAudit(bank.questions, proofPayload);
context.auditedQuestion = bank.questions.find((question) => question.explanationReviewed);
const actualProof = getQuestionVerification(context.auditedQuestion, context.auditFixture);
run("profile = defaultProfile(); verificationAudit = auditFixture; questions = [auditedQuestion]; session = createQuizSession('exam', questions, 'en'); renderQuestion();");
assert.ok(main.innerHTML.includes(`verification-${actualProof.status}`), "The source comparison belongs on the question");
assert.ok(main.innerHTML.includes("#page="), "The verification links to a specific PDF page");
assert.ok(!main.innerHTML.includes("Answer reasoning reviewed"));
assert.ok(!main.innerHTML.includes("rule-source-link"));
assert.ok(!main.innerHTML.includes("Article 43(1)"), "Do not disclose the reviewed rule before answering");
run("chooseAnswer('A')");
assert.ok(main.innerHTML.includes("Answer reasoning reviewed"));
assert.ok(main.innerHTML.includes("rule-source-link"));
assert.equal(run("session.result"), undefined, "Mock reasoning is available before explicit submission");
run("session = createQuizSession('quick', questions, 'en'); profile.uiLanguage = 'ru'; renderQuestion();");
assert.ok(main.innerHTML.includes(translate(`verification.${actualProof.status}.label`, "ru")));
assert.ok(!main.innerHTML.includes("Обоснование ответа проверено"));
run("chooseAnswer('B')");
assert.ok(main.innerHTML.includes("Обоснование ответа проверено"));

// Failed Russian switches preserve a checked English question and its timer.
context.fetch = async () => { throw new Error("Translation unavailable"); };
run("profile = defaultProfile(); questions = fixtureQuestions; session = createQuizSession('exam', questions, 'en'); renderQuestion(); chooseAnswer('B')");
const checkedSession = run("JSON.stringify(session)");
const checkedProfile = run("JSON.stringify(profile)");
const checkedMarkup = main.innerHTML;
await run("setQuestionLanguage('ru')");
assert.equal(run("JSON.stringify(session)"), checkedSession);
assert.equal(run("JSON.stringify(profile)"), checkedProfile);
assert.equal(main.innerHTML, checkedMarkup, "A failed switch must retain wording, picks and feedback");
await run("setUILanguage('ru')");
assert.equal(run("JSON.stringify(session)"), checkedSession);
assert.equal(run("profile.language"), "en");
assert.ok(main.innerHTML.includes('class="feedback incorrect"'));

for (const language of ["en", "pt"]) {
  run(`profile = defaultProfile(); profile.language = 'ru'; session = null;
    questions = fixtureQuestions.map(question => ({ ...question,
      text: { ${language}: question.text.en },
      answers: question.answers.map(answer => ({ key: answer.key, ${language}: answer.en })) }));`);
  await run("startSession('quick')");
  assert.equal(run("session.questionLanguage"), language, "An unavailable Russian overlay must allow studying from the base bank");
  assert.equal(run("profile.language"), "ru", "A fallback session must retain the saved Russian preference");
  assert.ok(main.innerHTML.includes(translate("quiz.russianUnavailable", "en")));
}
console.log("Quiz results checks passed: immediate feedback without navigation/submission, preserved first attempts, late renders/language/sync, single recording, review details and PDF verification.");
