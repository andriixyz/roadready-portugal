import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as planning from "../exam-plan.js";
import { localeFor, normalizeLanguage, russianPluralKey, translate } from "../i18n.js";
import { isValidSyncKey } from "../sync.js";
import { MAX_BACKUP_BYTES, InvalidStudyProfileError, normaliseStudyProfile, recoverStudyProfile } from "../profile-data.js";
import { recordStudyActivity, answersOnDay, studyStreak } from "../study-activity.js";
import { prepareVerificationAudit, getQuestionVerification, verificationPdfUrl } from "../question-verification.js";

// Exercise the real import/load handlers, including their storage commits.
const source = (await readFile(new URL("../app.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .split('main.innerHTML = `<div class="page"><div class="skeleton"')[0];
const good = {
  language: "en", uiLanguage: "en", dailyGoal: 20,
  questionProgress: { "bc-1165": { correct: 2, wrong: 1, streak: 1, nextReview: "2026-10-03T10:00:00Z" } },
  sessions: [{ mode: "quick", total: 10, correct: 8, completedAt: "2026-10-01T10:00:00Z" }],
};
const copy = (value) => JSON.parse(JSON.stringify(value));
function harness(initial = good) {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: "", hidden: true, textContent: "", dataset: {}, listeners: {},
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setAttribute() {}, focus() {}, classList: { toggle() {}, add() {}, remove() {} },
    });
    return nodes.get(selector);
  };
  const storage = new Map([["roadready-profile", typeof initial === "string" ? initial : JSON.stringify(initial)]]);
  const control = { rejectWrite: false, scheduled: 0, connected: 0, failConnect: false };
  const context = vm.createContext({
    ...planning,
    localeFor, normalizeLanguage, russianPluralKey, translate, isValidSyncKey,
    MAX_BACKUP_BYTES, InvalidStudyProfileError, normaliseStudyProfile, recoverStudyProfile,
    recordStudyActivity, answersOnDay, studyStreak,
    prepareVerificationAudit, getQuestionVerification, verificationPdfUrl,
    getDeviceId: () => "test-device",
    document: { querySelector: node, querySelectorAll: () => [], documentElement: node("html"), body: node("body"), addEventListener() {} },
    window: { addEventListener() {} }, location: { hash: "#dashboard" }, history: { replaceState() {} },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem(key, value) { if (control.rejectWrite) throw new Error("Quota exceeded"); storage.set(key, value); },
    },
    clearInterval() {}, setTimeout() {},
    navigator: {},
    fetch: async (...args) => {
      if (control.fetch) return control.fetch(...args);
      throw new Error("Translation unavailable");
    },
    control,
  });
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  run('questions = [{id: "bc-1165", topic: "Velocidade", text: {en: "Fixture"}, answers: []}]');
  run(`syncController = {
    schedule() { control.scheduled++; },
    async connect() { control.connected++; if (control.failConnect) throw new Error("Sync unavailable"); },
  }`);
  const importText = async (text, size = Buffer.byteLength(text)) => {
    const target = { value: "selected.json", files: [{ size, text: async () => text }] };
    await node("#importFile").listeners.change({ target });
    assert.equal(target.value, "", "The same file must remain selectable after an import");
    return node("#storageStatus").textContent;
  };
  return { run, storage, node, control, importText };
}

for (const damage of [
  (p) => { p.questionProgress["bad-entry"] = null; },
  (p) => { p.questionProgress = []; },
  (p) => { p.questionProgress["bc-1165"].wrong = "NaN"; },
  (p) => { p.questionProgress["bc-1165"].nextReview = "never"; },
  (p) => { p.questionProgress["bc-1165"].countsByDevice = { phone: null }; },
  (p) => { p.questionProgress["bc-1165"].correct = -1; },
  (p) => { p.sessions = [null]; },
  (p) => { p.sessions[0].completedAt = "invalid"; },
  (p) => { p.sessions[0].total = 0; },
  (p) => { p.sessions[0].correct = 11; },
  (p) => { p.sessions[0].percent = "80"; },
  (p) => { p.dailyGoal = 0; },
  (p) => { p.language = "unknown"; },
  (p) => { p.answerActivity = { "2026-02-30": { phone: 1 } }; },
  (p) => { p.answerActivity = { "2026-10-02": { phone: -1 } }; },
  (p) => { p.answerActivity = { "2026-10-02": null }; },
  (p) => { p.sessions[0].activityRecorded = "yes"; },
  (p) => { p.examPlan = { startedOn: "2026-10-07", examDate: "2026-02-30", language: "en" }; },
  (p) => { p.examPlan = { startedOn: "2026-10-07", examDate: "2026-10-27", language: "unknown" }; },
  (p) => { p.questionProgress["bc-1165"].firstSeenAt = "yesterday"; },
  (p) => { p.sessions[0].languageChanged = "yes"; },
]) {
  const app = harness();
  const originalMemory = app.run("JSON.stringify(profile)");
  const originalStorage = app.storage.get("roadready-profile");
  const damaged = copy(good);
  damage(damaged);
  assert.equal(await app.importText(JSON.stringify({ profile: damaged })), translate("storage.invalidBackup", "en"));
  assert.equal(app.storage.get("roadready-profile"), originalStorage, "Rejected imports must not replace saved progress");
  assert.equal(app.run("JSON.stringify(profile)"), originalMemory, "Rejected imports must not change the active profile");
  assert.equal(app.control.scheduled + app.control.connected, 0, "Rejected imports must not sync");
  app.run("render(); openSettings()");
  assert.equal(app.node("#settingsModal").hidden, false, "Settings must remain usable");
}

for (const text of ["{ broken JSON", "null", "[]", JSON.stringify({ profile: good, syncKey: "bad" })]) {
  const app = harness();
  const saved = app.storage.get("roadready-profile");
  await app.importText(text);
  assert.equal(app.storage.get("roadready-profile"), saved);
}
for (const failure of ["quota", "russian", "size"]) {
  const app = harness();
  const before = app.run("JSON.stringify(profile)");
  const saved = app.storage.get("roadready-profile");
  const incoming = copy(good);
  if (failure === "quota") app.control.rejectWrite = true;
  if (failure === "russian") incoming.language = incoming.uiLanguage = "ru";
  await app.importText(JSON.stringify({ profile: incoming }), failure === "size" ? MAX_BACKUP_BYTES + 1 : undefined);
  assert.equal(app.storage.get("roadready-profile"), saved);
  assert.equal(app.run("JSON.stringify(profile)"), before);
  assert.equal(app.control.scheduled + app.control.connected, 0);
}

for (const envelope of [good, { app: "RoadReady Portugal", version: 2, profile: good }]) {
  const app = harness();
  assert.equal(await app.importText(JSON.stringify(envelope)), translate("storage.restoreSuccess", "en"));
  assert.equal(app.run("profile.sessions[0].percent"), 80, "Legacy sessions without percent must not poison mock statistics");
  assert.equal(app.control.scheduled, 1);
  const reloaded = harness(app.storage.get("roadready-profile"));
  reloaded.run("render(); openSettings()");
  assert.equal(reloaded.run("getStats().seen"), 1);
  assert.equal(reloaded.node("#settingsModal").hidden, false);
}

for (const failConnect of [false, true]) {
  const app = harness();
  app.control.failConnect = failConnect;
  const incoming = copy(good);
  incoming.questionProgress["bc-1165"].correct = 5;
  const status = await app.importText(JSON.stringify({ profile: incoming, syncKey: "x".repeat(43) }));
  assert.equal(status, translate(failConnect ? "storage.restoreLocal" : "storage.restoreSuccess", "en"));
  assert.equal(app.control.connected, 1);
  assert.equal(app.control.scheduled, 0);
  assert.equal(app.run('profile.questionProgress["bc-1165"].correct'), 5);
  assert.equal(JSON.parse(app.storage.get("roadready-profile")).questionProgress["bc-1165"].correct, 5,
    "A cloud connection failure must not undo a successful local restore");
}

const damaged = copy(good);
damaged.questionProgress.broken = null;
damaged.sessions.push(null);
damaged.answerActivity = { "2026-10-02": { phone: 2 }, "not-a-day": { phone: 3 }, "2026-10-03": null };
const recovered = harness(damaged);
recovered.run("render(); openSettings()");
assert.equal(recovered.run("getStats().seen"), 1);
assert.equal(recovered.run("profile.sessions.length"), 1);
assert.equal(recovered.node("#settingsModal").hidden, false);
assert.equal(recovered.storage.get("roadready-profile-recovery"), JSON.stringify(damaged));
assert.equal(recovered.run('JSON.stringify(profile.answerActivity)'), JSON.stringify({ "2026-10-02": { phone: 2 } }));
assert.equal(harness("{broken").run("getStats().seen"), 0);

// Startup must retain an available bank when the optional overlay is offline.
const english = JSON.parse(await readFile(new URL("../public/data/questions-en.json", import.meta.url), "utf8"));
const portuguese = JSON.parse(await readFile(new URL("../public/data/questions-pt.json", import.meta.url), "utf8"));
const russian = JSON.parse(await readFile(new URL("../public/data/questions-ru.json", import.meta.url), "utf8"));
const response = (payload) => ({ ok: true, json: async () => copy(payload) });
const unavailable = { ok: false, status: 503 };
for (const baseLanguage of ["en", "pt"]) {
  for (const preferences of [{ uiLanguage: "ru", language: "en" }, { uiLanguage: "en", language: "ru" }]) {
    const saved = { ...copy(good), ...preferences, questionProgress: {
      [english.questions[0].id]: { correct: 3, wrong: 1 },
      [english.questions[1].id]: { correct: 1, wrong: 1 },
    } };
    const app = harness(saved);
    const memory = app.run("JSON.stringify(profile)");
    const storage = app.storage.get("roadready-profile");
    const requests = [];
    let offline = true;
    app.control.fetch = async (url) => {
      requests.push(url);
      if (url.includes("questions-en")) return baseLanguage === "en" ? response(english) : unavailable;
      if (url.includes("questions-pt")) return response(portuguese);
      if (url.includes("questions-ru")) return offline ? unavailable : response(russian);
      return unavailable;
    };
    await app.run("loadCorpus()");
    assert.equal(app.run("questions.length"), 3910);
    assert.ok(!app.run("corpusMeta.sample"));
    assert.equal(app.run("getStats().seen"), 2);
    assert.equal(app.run("getStats().correct + getStats().wrong"), 6);
    assert.equal(requests.filter(url => url.includes("questions-ru")).length, 1);
    assert.equal(requests.some(url => url.includes("questions-pt")), baseLanguage === "pt");
    assert.ok(requests.some(url => url.includes("imt-verification")), "A translation failure must not skip the source audit");
    app.run("renderPractice()");
    assert.ok(app.node("#mainContent").innerHTML.includes(translate("quiz.russianUnavailable", preferences.uiLanguage)));
    assert.equal(app.run("JSON.stringify(profile)"), memory);
    assert.equal(app.storage.get("roadready-profile"), storage);
    await assert.rejects(app.run("ensureRussianCorpus()"));
    offline = false;
    await app.run("ensureRussianCorpus();");
    assert.equal(app.run("russianCorpusUnavailable"), false);
    assert.equal(app.run("questions.every(q => q.text.ru && q.explanation.ru && q.answers.every(a => a.ru))"), true);
    assert.equal(app.run("JSON.stringify(profile)"), memory, "Retry must not reset progress or language preferences");
    assert.equal(app.storage.get("roadready-profile"), storage);
    app.run("renderPractice()");
    assert.ok(!app.node("#mainContent").innerHTML.includes(translate("quiz.russianUnavailable", preferences.uiLanguage)));
  }
}

for (const damage of [
  overlay => { delete overlay.questions[english.questions.at(-1).id]; },
  overlay => { overlay.questions[english.questions.at(-1).id].text.ru = ""; },
  overlay => { overlay.questions[english.questions.at(-1).id].answers[0].key = "unknown"; },
  overlay => { const answers = overlay.questions[english.questions.at(-1).id].answers; answers[1].key = answers[0].key; },
]) {
  const app = harness();
  app.run("questions = []");
  let overlay = copy(russian);
  damage(overlay);
  app.control.fetch = async url => url.includes("questions-en") ? response(english) : url.includes("questions-ru") ? response(overlay) : unavailable;
  await app.run("loadCorpus()");
  const base = app.run("JSON.stringify(questions)");
  await assert.rejects(app.run("ensureRussianCorpus()"));
  assert.equal(app.run("JSON.stringify(questions)"), base, "Rejected overlays must not partially translate the bank");
  assert.equal(app.run("questions.some(q => q.text.ru)"), false);
  overlay = copy(russian);
  // Overlay ordering is independent; retain base question and choice order.
  overlay.questions = Object.fromEntries(Object.entries(overlay.questions).reverse());
  Object.values(overlay.questions).forEach(question => question.answers.reverse());
  await app.run("ensureRussianCorpus()");
  assert.equal(app.run("JSON.stringify(questions.map(q => [q.id, q.answers.map(a => a.key)]))"),
    JSON.stringify(english.questions.map(q => [q.id, q.answers.map(a => a.key)])));
}

const samples = harness({ ...copy(good), uiLanguage: "ru", language: "ru" });
samples.control.fetch = async () => unavailable;
await samples.run("loadCorpus()");
assert.equal(samples.run("questions.length"), 6);
assert.equal(samples.run("corpusMeta.sample"), true);
samples.run("renderDashboard()");
assert.ok(samples.node("#mainContent").innerHTML.includes(translate("plan.sample", "ru")));
console.log("Backup/startup checks passed: atomic rejection, recovery, optional Russian failure with either base bank, progress preservation, retry, overlay integrity/order and labelled samples.");
