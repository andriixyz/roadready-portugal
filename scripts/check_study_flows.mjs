import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as quiz from "../quiz-session.js";
import * as activity from "../study-activity.js";
import * as profiles from "../profile-data.js";
import { localeFor, normalizeLanguage, russianPluralKey, translate } from "../i18n.js";
import { incrementAnswerCounts, mergeProfiles } from "../sync.js";

const source = (await readFile(new URL("../app.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .split('main.innerHTML = `<div class="page"><div class="skeleton"')[0];
function harness(saved = null) {
  const nodes = new Map(), listeners = new Map(), storage = new Map();
  if (saved) storage.set("roadready-profile", saved);
  const control = { allowLeave: false, prompts: [], now: new Date(2026, 9, 2, 12).getTime() };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [control.now])); }
    static now() { return control.now; }
  }
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: "", textContent: "", hidden: true, dataset: {}, listeners: {},
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setAttribute() {}, focus() {}, scrollIntoView() {}, classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} },
    });
    return nodes.get(selector);
  };
  const location = { hash: "#dashboard" };
  const context = vm.createContext({
    ...quiz, ...activity, ...profiles, localeFor, normalizeLanguage, russianPluralKey, translate, incrementAnswerCounts,
    createQuizSession: (mode, selected, language, now = control.now) => quiz.createQuizSession(mode, selected, language, now),
    answersOnDay: (profile, date = new Date(control.now)) => activity.answersOnDay(profile, date),
    Date: ClockDate, getDeviceId: () => "test-device",
    confirm(message) { control.prompts.push(message); return control.allowLeave; },
    document: { querySelector: node, querySelectorAll: () => [], body: node("body"), documentElement: node("html"), addEventListener() {} },
    window: { addEventListener(type, callback) { listeners.set(type, callback); } },
    location, history: { replaceState(_state, _title, url) { location.hash = url.slice(url.indexOf("#")); } },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    clearInterval() {}, setInterval() {}, setTimeout() {},
    getQuestionChatGPTPrompt: () => "test prompt", getQuestionImagePath: () => "",
    fixtureQuestions: Array.from({ length: 3 }, (_, index) => ({
      id: `test-${index}`, sourceId: index + 1, text: { en: `Question ${index + 1}` },
      answers: [{ key: "A", en: "Correct" }, { key: "B", en: "Wrong" }], correct: "A",
      image: "", sourceUrl: "", explanation: { en: "Test explanation" },
    })),
  });
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  run("questions = fixtureQuestions");
  return { run, node, control, location, listeners, storage };
}

for (const mode of ["quick", "exam"]) {
  const app = harness();
  app.run(`session = createQuizSession("${mode}", questions, "en"); location.hash = "#quiz"; render(); chooseAnswer("A");`);
  if (mode === "quick") app.run('advanceQuiz(); navigateQuestion(1); chooseAnswer("B")');
  const original = app.run("JSON.stringify(session)");
  const endsAt = app.run("session.endsAt");
  for (const route of ["dashboard", "practice", "progress", "sources"]) {
    app.location.hash = `#${route}`;
    app.listeners.get("hashchange")();
    assert.equal(app.location.hash, "#quiz", "Cancel must return the route to the quiz");
    assert.equal(app.run("JSON.stringify(session)"), original, "Cancel must retain draft picks, checked answers, index and question order");
  }
  const reloadEvent = { prevented: false, preventDefault() { this.prevented = true; } };
  app.listeners.get("beforeunload")(reloadEvent);
  assert.ok(reloadEvent.prevented, "Reload and closing an unfinished session need a browser warning");
  if (mode === "exam") {
    app.control.now += 65000;
    app.location.hash = "#dashboard";
    app.listeners.get("hashchange")();
    assert.equal(app.run("session.endsAt"), endsAt);
    assert.equal(app.run("session.remaining"), 1735, "Canceled navigation must not restart the mock deadline");
    assert.ok(app.control.prompts.at(-1).includes("not been submitted"));
  }
  app.control.allowLeave = true;
  app.location.hash = "#dashboard";
  app.listeners.get("hashchange")();
  assert.equal(app.run("session"), null);
  assert.equal(app.run("getStats().todayAnswered"), mode === "quick" ? 1 : 0);
  if (mode === "quick") {
    assert.ok(app.node("#mainContent").innerHTML.includes("<strong>1/20</strong>"));
    const reloaded = harness(app.storage.get("roadready-profile"));
    assert.equal(reloaded.run("getStats().todayAnswered"), 1, "An abandoned practice answer must still count after reload");
  }
  const exited = { preventDefault() { assert.fail("There is no active session to lose"); } };
  app.listeners.get("beforeunload")(exited);
}

const midnight = harness();
midnight.control.now = new Date(2026, 9, 2, 23, 59).getTime();
midnight.run('session = createQuizSession("quick", questions.slice(0, 2), "en"); location.hash = "#quiz"; render(); chooseAnswer("A"); advanceQuiz();');
assert.equal(midnight.run("getStats().todayAnswered"), 1);
midnight.run("navigateQuestion(0); advanceQuiz()");
assert.equal(midnight.run("getStats().todayAnswered"), 1, "Revisiting checked feedback must not count the answer twice");
midnight.control.now = new Date(2026, 9, 3, 0, 1).getTime();
assert.equal(midnight.run("getStats().todayAnswered"), 0, "The day changes at local midnight");
midnight.run('navigateQuestion(1); chooseAnswer("B"); advanceQuiz(); advanceQuiz(); finishSession()');
assert.equal(midnight.run("getStats().todayAnswered"), 1, "Completing the set must not move yesterday's answer to today or double-count");
assert.equal(midnight.run("answersOnDay(profile, new Date(2026, 9, 2))"), 1);
assert.equal(midnight.run("profile.sessions.length"), 1);
midnight.run('location.hash = "#progress"; render()');
assert.ok(midnight.node("#mainContent").innerHTML.includes('--height:5%'), "The activity chart must include the checked answers");

const exam = harness();
exam.run('session = createQuizSession("exam", questions, "en"); location.hash = "#quiz"; render(); chooseAnswer("A")');
assert.equal(exam.run("getStats().todayAnswered"), 0, "Draft mock answers do not count before submission");
exam.run("finishSession(); finishSession(); render()");
assert.equal(exam.run("getStats().todayAnswered"), 3, "Mock submission counts once, including unanswered questions recorded as mistakes");
assert.equal(exam.run("profile.sessions.length"), 1);

const review = harness();
review.run(`profile.questionProgress = {
  "test-0": { correct: 1, nextReview: "2099-01-01T00:00:00Z" },
  "deleted-question": { wrong: 1, nextReview: null }
}; location.hash = "#practice"; render(); startSession("review")`);
assert.equal(review.run("getStats().due"), 0, "Unknown stored questions must not inflate availability");
assert.equal(review.run("selectForMode('review').length"), 0);
assert.equal(review.run("session"), null);
assert.equal(review.location.hash, "#practice");
assert.equal(review.node("#toast").textContent, translate("practice.nothingDue", "en"));
review.run(`profile.questionProgress["test-0"].nextReview = new Date(Date.now()).toISOString();
  profile.questionProgress["test-1"] = { wrong: 1, nextReview: new Date(Date.now() + 1).toISOString() };
  profile.questionProgress["test-2"] = { correct: 1 };`);
assert.deepEqual(JSON.parse(review.run("JSON.stringify(selectForMode('review').map(q => q.id).sort())")), ["test-0", "test-2"]);
assert.equal(review.run("getStats().due"), 2);

const day = "2026-10-02", date = new Date(2026, 9, 2, 12);
const local = { questionProgress: {}, sessions: [], answerActivity: { [day]: { mac: 2 } } };
const cloud = { questionProgress: {}, sessions: [], answerActivity: { [day]: { mac: 1, phone: 3 } } };
const merged = mergeProfiles(local, cloud);
assert.equal(activity.answersOnDay(merged, date), 5);
assert.equal(activity.answersOnDay(mergeProfiles(merged, merged), date), 5, "Repeated sync must not duplicate daily activity");
assert.equal(activity.answersOnDay(mergeProfiles(cloud, local), date), 5, "Activity merge must work in either direction");
const reset = { questionProgress: {}, sessions: [], answerActivity: {}, resetAt: "2026-10-02T14:00:00Z" };
assert.equal(activity.answersOnDay(mergeProfiles(merged, reset), date), 0, "A reset must clear synced daily activity");
assert.equal(activity.answersOnDay(mergeProfiles(reset, merged), date), 0);
const completedAt = date.toISOString();
const legacy = { ...local, sessions: [{ id: "legacy", total: 10, completedAt }] };
assert.equal(activity.answersOnDay(legacy, date), 12, "Keep completed-session totals from older profiles");
const counted = { ...legacy, sessions: [{ id: "legacy", total: 10, completedAt, activityRecorded: true }] };
assert.equal(activity.answersOnDay(mergeProfiles(legacy, counted), date), 2, "A stale session copy must not undo the counted marker");
assert.equal(activity.answersOnDay(mergeProfiles(counted, legacy), date), 2);

// Consecutive local study dates determine the streak, including older backups.
const streakProfile = { sessions: [], answerActivity: {}, streak: 99 };
assert.equal(activity.studyStreak(streakProfile, date), 0, "A saved counter must not manufacture a streak");
for (const offset of [2, 1, 0]) activity.recordStudyActivity(streakProfile, "mac", new Date(2026, 9, 2 - offset, 23, 59));
assert.equal(activity.studyStreak(streakProfile, date), 3);
assert.equal(activity.studyStreak(streakProfile, new Date(2026, 9, 3, 0, 1)), 3, "Yesterday's streak remains available while today is unfinished");
assert.equal(activity.studyStreak(streakProfile, new Date(2026, 9, 4, 0, 1)), 0, "A missed whole day breaks the streak");
activity.recordStudyActivity(streakProfile, "phone", new Date(2026, 9, 4, 12));
assert.equal(streakProfile.streak, 1);
assert.equal(activity.studyStreak({ sessions: [{ total: 5, completedAt: date.toISOString() }] }, date), 1);
const dst = { answerActivity: {}, sessions: [] };
for (const day of [24, 25, 26]) activity.recordStudyActivity(dst, "mac", new Date(2026, 9, day, 12));
assert.equal(activity.studyStreak(dst, new Date(2026, 9, 26, 12)), 3, "Calendar stepping must handle a daylight-saving boundary");

const sizes = harness();
sizes.run(`questions = Array.from({length: 40}, (_, index) => ({...fixtureQuestions[0], id: 'size-' + index}));
  profile.questionProgress = Object.fromEntries(questions.map(q => [q.id, {wrong: 1, correct: 0}]));`);
for (const [mode, count] of [["quick", 10], ["exam", 30], ["review", 20], ["mistakes", 20]]) {
  assert.equal(sizes.run(`sessionSize('${mode}')`), count);
  assert.equal(sizes.run(`selectForMode('${mode}').length`), count);
}
sizes.run(`questions = questions.slice(0, 1); location.hash = '#practice'; render();`);
assert.equal(sizes.run("sessionSize('quick')"), 1);
assert.ok(sizes.node("#mainContent").innerHTML.includes("1 question"));
sizes.run(`profile.questionProgress[questions[0].id] = {wrong: 1, correct: 1}; startSession('mistakes');`);
assert.equal(sizes.run("session"), null, "Balanced answer counts must not fall back to unrelated questions");
assert.equal(sizes.run("getStats().mistakes"), 0);
assert.equal(sizes.node("#toast").textContent, translate("practice.noMistakes", "en"));

const topics = harness();
topics.run(`const topicKeys = Object.keys(TOPIC_NAMES); questions = topicKeys.flatMap((topic, index) =>
  Array.from({length: index === 0 ? 335 : 2}, (_, n) => ({...fixtureQuestions[0], id: 'topic-' + index + '-' + n, topic})));
  profile.questionProgress = {'topic-0-0': {correct: 0, wrong: 1}};
  location.hash = '#progress'; render();`);
const topicRows = () => [...topics.node("#mainContent").innerHTML.matchAll(/class="topic-row"><strong>(.*?)<\/strong>/g)].map(match => match[1]);
assert.equal(topicRows().length, 16, "Show the complete syllabus");
assert.equal(topicRows().at(-1), topics.run("TOPIC_NAMES[Object.keys(TOPIC_NAMES)[0]].en"), "Tiny nonzero coverage must sort after uncovered topics");
topics.node("#topicOrder").listeners.change({target: {value: "coverage"}});
assert.equal(topicRows()[0], topics.run("TOPIC_NAMES[Object.keys(TOPIC_NAMES)[0]].en"), "Coverage sorting must use the unrounded ratio");
topics.run(`profile.questionProgress = Object.fromEntries(questions.map(q => [q.id, {correct: 1, wrong: 0}]));
  profile.questionProgress['topic-1-0'] = {correct: 0, wrong: 1}; topicOrder = 'weakest'; renderProgress();`);
assert.equal(topicRows()[0], topics.run("escapeHtml(TOPIC_NAMES[Object.keys(TOPIC_NAMES)[1]].en)"), "Equal coverage breaks ties by answer accuracy");

console.log("Study flow checks passed: leave guards, dated activity, streak gaps/DST/legacy totals, sync/reset, strict review/mistakes, session limits, and all 16 topic rankings.");
