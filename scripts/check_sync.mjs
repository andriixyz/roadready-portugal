import assert from "node:assert/strict";
import { mergeProfiles } from "../sync.js";

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

process.stdout.write("Sync merge checks passed.\n");
