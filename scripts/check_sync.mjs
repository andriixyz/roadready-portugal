import assert from "node:assert/strict";
import { createSyncController, generateSyncKey, incrementAnswerCounts, isValidSyncKey, mergeProfiles } from "../sync.js";
import { answersOnDay, recordStudyActivity } from "../study-activity.js";

const local = {
  startedAt: "2026-07-01T08:00:00.000Z",
  updatedAt: "2026-07-28T10:00:00.000Z",
  dailyGoal: 30,
  language: "en",
  uiLanguage: "ru",
  streak: 3,
  questionProgress: {
    q1: { correct: 2, wrong: 0, streak: 2, lastAnswer: "2026-07-28T09:00:00.000Z", nextReview: "2026-07-31T09:00:00.000Z" },
  },
  sessions: [
    { id: "local-session", mode: "quick", correct: 9, total: 10, completedAt: "2026-07-28T09:30:00.000Z" },
  ],
};

const cloud = {
  startedAt: "2026-06-25T08:00:00.000Z",
  updatedAt: "2026-07-27T10:00:00.000Z",
  dailyGoal: 20,
  language: "pt",
  uiLanguage: "en",
  streak: 5,
  questionProgress: {
    q1: { correct: 1, wrong: 1, streak: 0, lastAnswer: "2026-07-27T09:00:00.000Z", nextReview: "2026-07-27T09:00:00.000Z" },
    q2: { correct: 1, wrong: 0, streak: 1, lastAnswer: "2026-07-27T09:15:00.000Z", nextReview: "2026-07-28T09:15:00.000Z" },
  },
  sessions: [
    { id: "cloud-session", mode: "exam", correct: 28, total: 30, completedAt: "2026-07-27T09:30:00.000Z" },
  ],
};

const merged = mergeProfiles(local, cloud);
assert.equal(merged.startedAt, cloud.startedAt);
assert.equal(merged.updatedAt, local.updatedAt);
assert.equal(merged.dailyGoal, local.dailyGoal);
assert.equal(merged.language, local.language);
assert.equal(merged.uiLanguage, local.uiLanguage);
assert.equal(merged.streak, 5);
assert.equal(merged.questionProgress.q1.correct, 2);
assert.equal(merged.questionProgress.q1.wrong, 1);
assert.equal(merged.questionProgress.q1.nextReview, local.questionProgress.q1.nextReview);
assert.deepEqual(Object.keys(merged.questionProgress).sort(), ["q1", "q2"]);
assert.deepEqual(merged.sessions.map((item) => item.id), ["cloud-session", "local-session"]);

const legacyNewer = { ...local, updatedAt: "2026-07-29T10:00:00.000Z" };
delete legacyNewer.uiLanguage;
const olderRussian = { ...cloud, uiLanguage: "ru" };
const migrated = mergeProfiles(legacyNewer, olderRussian);
assert.equal(migrated.uiLanguage, "ru");

const mac = incrementAnswerCounts(local.questionProgress.q1, true, "mac");
const phone = incrementAnswerCounts(local.questionProgress.q1, true, "phone");
const combined = mergeProfiles({ ...local, questionProgress: { q1: mac } }, { ...local, questionProgress: { q1: phone } });
assert.equal(combined.questionProgress.q1.correct, 4, "Independent offline answers must both count");
assert.equal(mergeProfiles(combined, combined).questionProgress.q1.correct, 4, "Repeated sync must not double-count");
const reset = { ...local, resetAt: "2026-09-30T10:00:00.000Z", updatedAt: "2026-09-30T10:00:00.000Z", questionProgress: {}, sessions: [] };
assert.deepEqual(mergeProfiles(local, reset).questionProgress, {});
assert.deepEqual(mergeProfiles(reset, local).sessions, []);

const copy = value => JSON.parse(JSON.stringify(value));
class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
class TestBrowser extends EventTarget {
  constructor(url) {
    super();
    this.location = new URL(url);
    this.history = { replaceState: (_state, _title, next) => { this.location = new URL(next, this.location); } };
  }
}
const server = new Map();
let injectConflict = false;
let duringRead = null, duringWrite = null;
const fetcher = async (url, options) => {
  assert.ok(!url.includes("auth/"), "No authentication requests are allowed");
  assert.equal(options.credentials, "omit");
  const { p_sync_key: key, p_profile: profile, p_expected_revision: revision } = JSON.parse(options.body);
  assert.ok(isValidSyncKey(key));
  assert.ok(!url.includes(key), "The private key must never appear in a request URL");
  let row = server.get(key) || { profile: null, revision: 0 };
  if (url.endsWith("roadready_read_progress")) {
    const response = Response.json(copy(row));
    const update = duringRead;
    duringRead = null;
    update?.();
    return response;
  }
  if (injectConflict) {
    injectConflict = false;
    row = { profile: { ...copy(row.profile), sessions: [...row.profile.sessions, { id: "race-session", mode: "quick", correct: 1, total: 1, completedAt: "2026-09-30T11:00:00.000Z" }] }, revision: row.revision + 1 };
    server.set(key, row);
  }
  if (revision !== row.revision) return Response.json({ saved: false, ...copy(row) });
  row = { profile: copy(profile), revision: revision + 1 };
  server.set(key, row);
  const update = duringWrite;
  duringWrite = null;
  update?.();
  return Response.json({ saved: true, ...copy(row) });
};
const config = { url: "https://test.supabase.co", publishableKey: "public-test-key" };
const createDevice = (profile, url = "https://example.com/roadready/#dashboard") => {
  const browser = new TestBrowser(url), storage = new MemoryStorage(), documentTarget = new EventTarget();
  documentTarget.visibilityState = "visible";
  let current = copy(profile), online = true;
  const controller = createSyncController({ config, storage, browser, documentTarget, fetcher,
    isOnline: () => online, getProfile: () => current, applyProfile: incoming => { current = copy(incoming); } });
  return { browser, storage, controller, get: () => current, set: incoming => { current = incoming; }, setOnline: value => { online = value; } };
};
const a = createDevice({ ...copy(local), uiLanguage: "ru" });
assert.ok(isValidSyncKey(generateSyncKey()));
assert.equal(isValidSyncKey("guessable"), false);
await a.controller.initialize();
const key = a.controller.getSyncKey();
const b = createDevice({ startedAt: "2026-09-30T10:00:00.000Z", updatedAt: null, language: "en", uiLanguage: "en", dailyGoal: 20, questionProgress: {}, sessions: [] }, a.controller.getDeviceLink());
assert.equal(b.controller.getSyncKey(), key);
assert.equal(b.browser.location.hash, "#dashboard", "The device key must leave the address bar immediately");
await b.controller.initialize();
assert.equal(b.get().uiLanguage, "ru", "A fresh device must inherit cloud preferences");
assert.deepEqual(b.get().questionProgress, a.get().questionProgress);
const activityDate = new Date("2026-09-30T12:00:00.000Z");
const macProfile = { ...a.get(), updatedAt: "2026-09-30T12:00:00.000Z", questionProgress: { q1: incrementAnswerCounts(a.get().questionProgress.q1, true, "mac") } };
const phoneProfile = { ...b.get(), updatedAt: "2026-09-30T12:00:00.000Z", questionProgress: { q1: incrementAnswerCounts(b.get().questionProgress.q1, false, "phone") } };
recordStudyActivity(macProfile, "mac", activityDate);
recordStudyActivity(phoneProfile, "phone", activityDate);
a.set(macProfile);
b.set(phoneProfile);
await a.controller.syncNow();
await b.controller.syncNow();
await a.controller.syncNow();
assert.equal(a.get().questionProgress.q1.correct, 3);
assert.equal(a.get().questionProgress.q1.wrong, 1);
assert.deepEqual(a.get(), b.get());
assert.equal(answersOnDay(a.get(), activityDate), 2, "Offline daily activity from both devices must reach the same profile");

a.set({ ...a.get(), dailyGoal: 40, updatedAt: "2026-09-30T13:00:00.000Z" });
injectConflict = true;
assert.equal(await a.controller.syncNow(), true);
assert.ok(a.get().sessions.some(item => item.id === "race-session"), "A concurrent cloud update must be merged before retrying");
assert.equal(server.get(key).profile.dailyGoal, 40);
a.setOnline(false);
a.controller.schedule();
assert.equal(a.controller.getState().status, "offline");
a.setOnline(true);
await a.controller.syncNow();
assert.equal(a.controller.getState().status, "synced");
const c = createDevice({ ...copy(local), questionProgress: {}, sessions: [] });
await c.controller.initialize();
assert.notEqual(c.controller.getSyncKey(), key);
assert.deepEqual(c.get().questionProgress, {}, "Different private keys must not see another profile");
const activityBeforeFlight = answersOnDay(a.get(), activityDate);
const answerWhileFetching = () => {
  const current = { ...a.get(), updatedAt: "2026-09-30T14:00:00.000Z", questionProgress: { ...a.get().questionProgress, q1: incrementAnswerCounts(a.get().questionProgress.q1, true, "mac") } };
  recordStudyActivity(current, "mac", activityDate);
  a.set(current);
  a.controller.schedule();
};
duringRead = answerWhileFetching;
await a.controller.syncNow();
assert.equal(a.get().questionProgress.q1.correct, 4, "An answer made during a read must stay local");
assert.equal(server.get(key).profile.questionProgress.q1.correct, 4, "An answer made during a read must reach the cloud");
assert.equal(answersOnDay(server.get(key).profile, activityDate), activityBeforeFlight + 1, "Daily activity made during a read must reach the cloud");
a.set({ ...a.get(), dailyGoal: 50, updatedAt: "2026-09-30T14:00:00.000Z" });
duringWrite = answerWhileFetching;
await a.controller.syncNow();
assert.equal(a.get().questionProgress.q1.correct, 5, "An answer made during a write must stay local");
assert.equal(a.controller.getState().status, "pending");
await a.controller.syncNow();
assert.equal(server.get(key).profile.questionProgress.q1.correct, 5, "Queued in-flight answers must reach the cloud");
assert.equal(answersOnDay(server.get(key).profile, activityDate), activityBeforeFlight + 2, "Queued in-flight daily activity must reach the cloud once");
a.set({ ...reset, resetAt: "2026-09-30T15:00:00.000Z", updatedAt: "2026-09-30T15:00:00.000Z" });
await a.controller.syncNow();
await b.controller.syncNow();
assert.deepEqual(b.get().questionProgress, {}, "A stale linked device must accept a synced reset");
assert.deepEqual(server.get(key).profile.sessions, [], "A stale linked device must not restore reset sessions");
assert.equal(answersOnDay(b.get(), activityDate), 0, "A stale linked device must not restore reset daily activity");
[a, b, c].forEach(device => device.controller.destroy());
process.stdout.write("Personal sync checks passed: pairing, offline counters, conflicts, in-flight answers, reset, isolation, and migration.\n");
