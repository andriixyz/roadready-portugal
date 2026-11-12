import assert from "node:assert/strict";
import {
  ROAD_TRIP, TRIP_DESTINATION, TRIP_MAX_QUESTIONS, createRoadTrip, answerRoadTrip, advanceRoadTrip, endRoadTrip, roadTripSummary,
  selectRoadTripQuestions, tripMultiplier, tripPaceBonus, tripStopIndex, emptyTripRecords, normaliseTripRecords, recordRoadTrip,
  roadTripActive, handleRoadTripKey,
} from "../road-trip.js";
import { OFFICIAL_EXAM } from "../exam-plan.js";

const bank = (count) => Array.from({ length: count }, (_, index) => ({
  id: `q${index}`, answers: [{ key: "A" }, { key: "B" }, { key: "C" }], correct: "A",
}));
// Answer the current question and drive on. Returns the checked answer.
const play = (trip, key, now = trip.shownAt) => {
  const answer = answerRoadTrip(trip, key, now);
  advanceRoadTrip(trip, now);
  return answer;
};

// The game borrows the exam's own numbers rather than inventing a tolerance.
assert.equal(ROAD_TRIP.spareMistakes, OFFICIAL_EXAM.maxErrors);
assert.equal(ROAD_TRIP.examLength, OFFICIAL_EXAM.questions);
assert.equal(ROAD_TRIP.paceSeconds, 60);
assert.equal(TRIP_DESTINATION, 50);
assert.equal(TRIP_MAX_QUESTIONS, 53, "A trip can never need more questions than the destination plus the spare mistakes");
assert.equal(ROAD_TRIP.stops.at(0), "faro");
assert.equal(ROAD_TRIP.stops.at(-1), "porto");

// Scoring helpers.
assert.deepEqual([0, 4, 5, 9, 10, 15, 40].map(tripMultiplier), [1, 1, 2, 2, 3, 4, 4]);
assert.equal(tripPaceBonus(0), 50);
assert.equal(tripPaceBonus(30000), 25);
assert.equal(tripPaceBonus(60000), 0);
assert.equal(tripPaceBonus(3600000), 0, "A slow answer earns no bonus and no penalty");
assert.equal(tripPaceBonus(-5000), 50, "A clock that moved backwards must not inflate the bonus");
assert.deepEqual([0, 4, 5, 49, 50, 80].map(tripStopIndex), [0, 0, 1, 9, 10, 10]);

// The first pick is checked at once and locked; nothing advances without the player.
{
  const trip = createRoadTrip(bank(10), 1000);
  assert.equal(advanceRoadTrip(trip, 1000), false, "An unanswered question cannot be skipped");
  assert.equal(answerRoadTrip(trip, "Z", 1000), null, "Unknown options are ignored");
  const first = answerRoadTrip(trip, "A", 1000);
  assert.deepEqual({ correct: first.correct, points: first.points, pace: first.pace, multiplier: first.multiplier }, { correct: true, points: 150, pace: 50, multiplier: 1 });
  assert.equal(trip.checked, true);
  assert.equal(trip.index, 0, "Checking must not advance");
  assert.equal(answerRoadTrip(trip, "B", 1000), null, "The first attempt is locked");
  assert.equal(trip.answers[0].pick, "A");
  assert.equal(trip.score, 150);
  assert.equal(advanceRoadTrip(trip, 5000), true);
  assert.equal(trip.index, 1);
  assert.equal(trip.checked, false);
  assert.equal(trip.selected, null, "Selections must not leak to the next question");
  assert.equal(trip.shownAt, 5000, "The pace clock restarts for each question");
  const slow = answerRoadTrip(trip, "A", 5000 + 90000);
  assert.equal(slow.points, 100, "Running out of pace time only loses the bonus");
  assert.equal(trip.mistakes, 0);
}

// Streaks multiply, a mistake resets them, and every fifth right answer reaches a city.
{
  const trip = createRoadTrip(bank(20), 0);
  for (let i = 0; i < 4; i++) play(trip, "A");
  const fifth = play(trip, "A");
  assert.equal(fifth.multiplier, 2);
  assert.equal(fifth.points, 300);
  assert.equal(fifth.stop, 1, "Five right answers reach the first city");
  assert.equal(fifth.stopBonus, ROAD_TRIP.stopBonus);
  assert.equal(trip.score, 4 * 150 + 300 + 250);
  const wrong = play(trip, "B");
  assert.equal(wrong.correct, false);
  assert.equal(wrong.points, 0);
  assert.equal(trip.streak, 0);
  assert.equal(trip.bestStreak, 5);
  assert.equal(trip.mistakes, 1);
  assert.equal(trip.score, 4 * 150 + 300 + 250, "A mistake costs no points");
  assert.equal(play(trip, "A").multiplier, 1, "The multiplier starts again after a mistake");
  assert.equal(trip.correct, 6);
}

// Three mistakes are forgiven; the fourth ends the trip only after the player has seen the feedback.
{
  const trip = createRoadTrip(bank(20), 0);
  for (let i = 0; i < 3; i++) play(trip, "B");
  assert.equal(trip.mistakes, 3);
  assert.equal(trip.outcome, null);
  assert.equal(trip.finished, false);
  answerRoadTrip(trip, "C", 0);
  assert.equal(trip.outcome, "crashed");
  assert.equal(trip.finished, false, "The fatal answer still shows its feedback");
  assert.equal(advanceRoadTrip(trip, 7000), true);
  assert.equal(trip.finished, true);
  assert.equal(trip.index, 3, "A finished trip stays on its last question");
  assert.equal(answerRoadTrip(trip, "A", 7000), null);
  assert.equal(advanceRoadTrip(trip, 7000), false);
  assert.deepEqual(roadTripSummary(trip), {
    outcome: "crashed", score: 0, correct: 0, mistakes: 4, answered: 4, bestStreak: 0, stop: 0,
    examPassed: false, examMistakes: null, durationSeconds: 7,
  });
}

// Surviving the first 30 questions is an exam-length pass, judged exactly like the exam.
{
  const trip = createRoadTrip(bank(TRIP_MAX_QUESTIONS), 0);
  for (let i = 0; i < 30; i++) play(trip, i < 3 ? "B" : "A");
  assert.equal(trip.examMistakes, 3, "Three mistakes in 30 questions is a pass");
  play(trip, "B");
  assert.equal(trip.finished, true);
  const summary = roadTripSummary(trip);
  assert.equal(summary.outcome, "crashed");
  assert.equal(summary.examPassed, true, "A later mistake cannot undo the exam-length pass");
  assert.equal(summary.examMistakes, 3);
}
{
  const trip = createRoadTrip(bank(TRIP_MAX_QUESTIONS), 0);
  for (let i = 0; i < 30; i++) play(trip, i < 26 || i === 29 ? "A" : "B");
  assert.equal(trip.mistakes, 3);
  assert.equal(trip.examMistakes, 3);
  const failing = createRoadTrip(bank(TRIP_MAX_QUESTIONS), 0);
  for (let i = 0; i < 30; i++) play(failing, i < 26 ? "A" : "B");
  assert.equal(failing.finished, true, "A fourth mistake on question 30 ends the trip");
  assert.equal(roadTripSummary(failing).examPassed, false);
  assert.equal(roadTripSummary(failing).answered, 30);
}

// Fifty right answers reach Porto, even with every spare mistake used.
{
  const trip = createRoadTrip(bank(TRIP_MAX_QUESTIONS), 0);
  for (let i = 0; i < 3; i++) play(trip, "B");
  let last;
  for (let i = 0; i < 50; i++) last = play(trip, "A");
  assert.equal(last.stop, ROAD_TRIP.stops.length - 1);
  assert.equal(trip.finished, true);
  const summary = roadTripSummary(trip);
  assert.equal(summary.outcome, "arrived");
  assert.equal(summary.correct, 50);
  assert.equal(summary.answered, 53);
  assert.equal(summary.stop, 10);
  assert.equal(summary.examPassed, true);
}

// A short bank ends the trip politely, and the player may park early.
{
  const trip = createRoadTrip(bank(2), 0);
  play(trip, "A");
  answerRoadTrip(trip, "A", 0);
  assert.equal(trip.outcome, "exhausted");
  advanceRoadTrip(trip, 0);
  assert.equal(trip.finished, true);
  const parked = createRoadTrip(bank(10), 0);
  play(parked, "A");
  assert.equal(endRoadTrip(parked, 3000), true);
  assert.equal(parked.outcome, "stopped");
  assert.equal(endRoadTrip(parked, 4000), false);
  assert.equal(roadTripSummary(parked).durationSeconds, 3);
  const fatal = createRoadTrip(bank(10), 0);
  for (let i = 0; i < 3; i++) play(fatal, "B");
  answerRoadTrip(fatal, "B", 0);
  endRoadTrip(fatal, 0);
  assert.equal(fatal.outcome, "crashed", "Parking cannot hide an outcome the last answer already decided");
}

// Question selection: no repeats, bounded size, and a lean towards missed and unseen questions.
{
  const questions = bank(400);
  const profile = { questionProgress: {} };
  questions.slice(0, 100).forEach((question) => { profile.questionProgress[question.id] = { correct: 0, wrong: 1, streak: 0 }; });
  questions.slice(100, 300).forEach((question) => { profile.questionProgress[question.id] = { correct: 2, wrong: 0, streak: 2 }; });
  const selected = selectRoadTripQuestions(questions, profile);
  assert.equal(selected.length, TRIP_MAX_QUESTIONS);
  assert.equal(new Set(selected).size, selected.length, "A trip never repeats a question");
  const index = (question) => Number(question.id.slice(1));
  assert.equal(selected.filter((question) => index(question) < 100).length, 16, "About 30% come from questions last answered wrongly");
  assert.equal(selected.filter((question) => index(question) >= 300).length, 21, "About 40% are unseen");
  assert.equal(selected.filter((question) => index(question) >= 100 && index(question) < 300).length, 16);

  const fresh = selectRoadTripQuestions(questions, { questionProgress: {} });
  assert.equal(fresh.length, TRIP_MAX_QUESTIONS, "A new profile fills the trip from unseen questions");
  assert.equal(selectRoadTripQuestions(bank(6), { questionProgress: {} }).length, 6, "A small bank limits the trip");
  assert.equal(selectRoadTripQuestions([], { questionProgress: {} }).length, 0);
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  seed = 7; const one = selectRoadTripQuestions(questions, profile, random).map((question) => question.id);
  seed = 7; const two = selectRoadTripQuestions(questions, profile, random).map((question) => question.id);
  assert.deepEqual(one, two, "Selection is reproducible with an injected random source");
  assert.equal(questions.length, 400, "Selection must not mutate the bank");
}

// Device-local records.
{
  assert.deepEqual(normaliseTripRecords(null), emptyTripRecords());
  assert.deepEqual(normaliseTripRecords([1, 2]), emptyTripRecords());
  assert.deepEqual(normaliseTripRecords({ trips: 2, bestScore: -5, farthest: 900, examPasses: "3", extra: 1 }),
    { trips: 2, bestScore: 0, farthest: TRIP_DESTINATION, examPasses: 0 });
  const first = recordRoadTrip(emptyTripRecords(), { score: 1200, correct: 12, examPassed: false });
  assert.deepEqual(first, { records: { trips: 1, bestScore: 1200, farthest: 12, examPasses: 0 }, newBest: true });
  const second = recordRoadTrip(first.records, { score: 900, correct: 31, examPassed: true });
  assert.deepEqual(second, { records: { trips: 2, bestScore: 1200, farthest: 31, examPasses: 1 }, newBest: false });
  assert.equal(recordRoadTrip(emptyTripRecords(), { score: 0, correct: 0, examPassed: false }).newBest, false, "A scoreless trip is not a record");
}

// Without a trip the view helpers stay inert, so other pages keep their shortcuts.
assert.equal(roadTripActive(), false);
assert.equal(handleRoadTripKey({ key: "1", preventDefault() { throw new Error("must not be called"); } }), false);

console.log("Road-trip checks passed.");
