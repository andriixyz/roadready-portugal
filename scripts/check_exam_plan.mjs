import assert from "node:assert/strict";
import { createExamPlan, validExamPlan, getExamPlan, examReadiness, selectNewQuestions, unresolvedQuestions } from "../exam-plan.js";
import { normaliseStudyProfile, recoverStudyProfile, validateStudyProfile } from "../profile-data.js";
import { mergeProfiles } from "../sync.js";

const today = new Date(2026, 9, 7, 12);
const config = createExamPlan(today);
const bank = Array.from({ length: 3910 }, (_, index) => ({ id: `q-${index}`, topic: `Topic ${index % 16}` }));
const empty = () => ({ questionProgress: {}, sessions: [], answerActivity: {}, examPlan: config });
const progress = (correct = true, firstSeenAt = today.toISOString()) => ({ correct: correct ? 1 : 0, wrong: correct ? 0 : 1,
  streak: correct ? 1 : 0, firstSeenAt, lastAnswer: today.toISOString(), nextReview: "2026-10-08T12:00:00Z" });
assert.equal(config.examDate, "2026-10-27");
assert.ok(validExamPlan(config));
for (const damaged of [{ ...config, examDate: "2026-02-30" }, { ...config, startedOn: "yesterday" },
  { ...config, language: "xx" }, { ...config, examDate: config.startedOn }, { ...config, injected: true }, []]) {
  assert.equal(validExamPlan(damaged), false);
}
const start = getExamPlan(bank, empty(), config, today);
assert.equal(start.daysLeft, 20);
assert.equal(start.newTarget, 245, "Cover 3,910 questions in the first 16 days, reserving the final four days");
assert.equal(start.mockTarget, 1);
assert.equal(start.reviewTarget, 0);
assert.equal(start.readiness.met, 0, "No progress must not appear prepared");

const studying = empty();
for (const question of bank.slice(0, 245)) studying.questionProgress[question.id] = progress();
studying.answerActivity["2026-10-07"] = { mac: 245 };
const done = getExamPlan(bank, studying, config, today);
assert.equal(done.newToday, 245);
assert.equal(done.newTarget, 245, "Today's quota must stay stable while completing it");
assert.ok(done.tasks.find((task) => task.key === "new").met);
const afterMissedDay = getExamPlan(bank, studying, config, new Date(2026, 9, 9, 12));
assert.equal(afterMissedDay.newTarget, 262, "The daily pace must catch up after a missed study day");
assert.equal(afterMissedDay.newToday, 0);
assert.equal(afterMissedDay.reviewTarget, 105);
assert.equal(getExamPlan(bank, empty(), config, new Date(2026, 9, 23, 12)).phase, "rehearse");
assert.equal(getExamPlan(bank, empty(), config, new Date(2026, 9, 23, 12)).mockTarget, 2);
assert.equal(getExamPlan(bank, empty(), config, new Date(2026, 9, 26, 12)).mockTarget, 0);
assert.equal(getExamPlan(bank, empty(), config, new Date(2026, 9, 27, 12)).newTarget, 0);
assert.equal(getExamPlan(bank, empty(), config, new Date(2026, 9, 28, 12)).daysLeft, -1, "An expired date must not roll forward");
const short = createExamPlan(today, "2026-10-10");
assert.equal(getExamPlan(bank, empty(), short, today).newTarget, 1955);
const dst = createExamPlan(new Date(2026, 9, 20, 12));
assert.equal(getExamPlan(bank, empty(), dst, new Date(2026, 9, 26, 12)).daysLeft, 14, "Count calendar days across DST");

const known = empty();
known.questionProgress = Object.fromEntries(bank.map((question) => [question.id, progress(true, "2026-10-01T12:00:00Z")]));
assert.equal(examReadiness(bank, known, "en", today).ready, false, "Coverage alone must never imply readiness");
known.questionProgress[bank[0].id] = { ...progress(false), correct: 50, wrong: 1 };
assert.equal(unresolvedQuestions(bank, known).length, 1, "A latest mistake cannot be hidden by an old high average");
known.questionProgress[bank[0].id].streak = 1;
assert.equal(unresolvedQuestions(bank, known).length, 0);
const mock = (index, correct = 28, completedAt = new Date(2026, 9, 5 + Math.floor(index / 2), 12).toISOString()) => ({
  id: `mock-${index}`, mode: "exam", language: "en", languageChanged: false, total: 30, correct,
  completedAt, durationSeconds: 1500, percent: Math.round(correct / 30 * 100),
});
known.sessions = Array.from({ length: 5 }, (_, index) => mock(index));
assert.ok(examReadiness(bank, known, "en", today).ready);
assert.equal(examReadiness(bank, known, "en", today, true).ready, false, "Demo questions cannot satisfy readiness");
assert.equal(examReadiness(bank, known, "pt", today).ready, false, "Readiness needs mocks in the configured exam language");
for (const change of [{ language: undefined }, { languageChanged: true }, { total: 6, correct: 6 },
  { durationSeconds: undefined }, { durationSeconds: 1801 }, { correct: 27 },
  { completedAt: "2026-09-29T12:00:00Z" }, { completedAt: "2026-10-09T12:00:00Z" }]) {
  const candidate = { ...known, sessions: known.sessions.map((session, index) => index === 4 ? { ...session, ...change } : session) };
  assert.equal(examReadiness(bank, candidate, "en", today).ready, false, JSON.stringify(change));
}
const failed = { ...known, sessions: [...known.sessions, mock(5, 26, today.toISOString())] };
assert.equal(examReadiness(bank, failed, "en", today).ready, false, "A newer failure must replace an older passing mock");
const crammed = { ...known, sessions: known.sessions.map((session) => ({ ...session, completedAt: today.toISOString() })) };
assert.equal(examReadiness(bank, crammed, "en", today).ready, false, "One day's mocks cannot establish consistency across days");

const selection = selectNewQuestions(bank, empty(), 20, () => 0);
assert.equal(new Set(selection.map((question) => question.topic)).size, 16, "Cover every available topic before repeating large topics");
assert.equal(new Set(selection.map((question) => question.id)).size, 20);
assert.ok(selectNewQuestions(bank, studying, 20).every((question) => !studying.questionProgress[question.id]));
assert.equal(selectNewQuestions(bank, known).length, 0, "An empty new-question queue must not fall back to seen questions");

const local = { ...empty(), updatedAt: "2026-10-07T12:00:00Z", questionProgress: { "q-0": progress() } };
const cloud = { ...empty(), updatedAt: "2026-10-07T13:00:00Z", examPlan: { ...config, examDate: "2026-10-25" },
  questionProgress: { "q-0": progress(true, "2026-10-06T12:00:00Z") } };
for (const [a, b] of [[local, cloud], [cloud, local]]) {
  const merged = mergeProfiles(a, b);
  assert.equal(merged.examPlan.examDate, "2026-10-25");
  assert.equal(merged.questionProgress["q-0"].firstSeenAt, "2026-10-06T12:00:00Z", "First-seen dates merge using the earliest observation");
  assert.equal(getExamPlan(bank, merged, merged.examPlan, today).newToday, 0);
  assert.deepEqual(mergeProfiles(merged, merged), merged);
}
const oldDevice = { ...empty(), examPlan: null, updatedAt: "2026-10-08T12:00:00Z" };
assert.deepEqual(mergeProfiles(cloud, oldDevice).examPlan, cloud.examPlan, "An older client without plan support must preserve the configured target");
const reset = { ...empty(), resetAt: "2026-10-08T12:00:00Z", updatedAt: "2026-10-08T12:00:00Z" };
assert.deepEqual(mergeProfiles(cloud, reset).questionProgress, {}, "Reset must not resurrect first-seen observations");
assert.deepEqual(normaliseStudyProfile(known, empty()).examPlan, config);
assert.deepEqual(normaliseStudyProfile(known, empty()).sessions, known.sessions);
assert.throws(() => validateStudyProfile({ ...known, examPlan: { ...config, language: "xx" } }));
assert.equal(recoverStudyProfile({ ...known, examPlan: { ...config, language: "xx" } }, { ...empty(), examPlan: null }).examPlan, null);
assert.equal(recoverStudyProfile(known, empty()).questionProgress["q-0"].firstSeenAt, known.questionProgress["q-0"].firstSeenAt);
console.log("Exam plan checks passed: daily pacing, calendar deadlines, balanced coverage, latest mistakes, language-aware timed mocks, sync and backup preservation.");
