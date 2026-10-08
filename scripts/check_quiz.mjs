import assert from "node:assert/strict";
import { createQuizSession, setSessionNotSure, selectSessionAnswer, checkSessionAnswer, moveToQuestion, firstUnansweredIndex } from "../quiz-session.js";

const questions = Array.from({ length: 3 }, (_, index) => ({
  id: `q${index}`, answers: [{ key: "A" }, { key: "B" }], correct: "A",
}));

for (const mode of ["quick", "review", "mistakes", "exam", "learn", "repair"]) {
  const session = createQuizSession(mode, questions, "ru", 1000);
  assert.equal(moveToQuestion(session, -1), false);
  assert.equal(moveToQuestion(session, 3), false);
  assert.equal(moveToQuestion(session, 1.5), false);
  assert.equal(session.index, 0);
  assert.equal(selectSessionAnswer(session, "C"), false);
  assert.equal(checkSessionAnswer(session), null);
  assert.equal(setSessionNotSure(session, true), true);
  assert.equal(moveToQuestion(session, 2), true, "Unanswered questions can be skipped");
  assert.equal(session.notSure[2], undefined, "Uncertainty must not leak to the next question");
  assert.equal(setSessionNotSure(session, true), true);
  assert.equal(setSessionNotSure(session, false), true, "A draft mark can be removed before answering");
  assert.equal(firstUnansweredIndex(session), 0);
  selectSessionAnswer(session, "B");
  moveToQuestion(session, 0);
  assert.equal(session.selected, null, "Selections must not leak between questions");
  moveToQuestion(session, 2);
  assert.equal(session.selected, "B", "Draft selections survive navigation");
  assert.equal(session.questionLanguage, "ru");

  assert.equal(session.answers[2], undefined, "Drafts must not count as checked answers");
  const wrongAnswer = checkSessionAnswer(session);
  assert.equal(wrongAnswer.correct, false);
  assert.equal(wrongAnswer.notSure, false);
  assert.equal(setSessionNotSure(session, true), false, "Uncertainty locks with the first checked attempt");
  assert.equal(session.index, 2, "Checking a mistake must keep the current question");
  moveToQuestion(session, 0);
  moveToQuestion(session, 2);
  assert.equal(session.checked, true, "Checked feedback survives navigation in every mode");
  assert.equal(selectSessionAnswer(session, "A"), false, "Revealed answers remain locked to preserve the first attempt");
  assert.equal(checkSessionAnswer(session), null, "Revisiting cannot record an answer twice");
  assert.equal(session.endsAt, undefined, "Sessions have no submission deadline");
  assert.equal(session.remaining, undefined, "Sessions have no countdown");
  assert.equal(session.elapsedSeconds, mode === "exam" ? 0 : null);

  for (const index of [1, 0]) {
    moveToQuestion(session, index);
    selectSessionAnswer(session, "A");
    const answer = checkSessionAnswer(session);
    assert.equal(answer.notSure, index === 0, "A mark survives navigation and can accompany a correct answer");
  }
  assert.equal(firstUnansweredIndex(session), -1, "Out-of-order completion includes every question");
  assert.equal(session.answers.filter(answer => answer.correct).length, 2);
  session.result = {};
  assert.equal(moveToQuestion(session, 1), false);
  assert.equal(selectSessionAnswer(session, "B"), false);
  assert.equal(checkSessionAnswer(session), null);
  assert.equal(setSessionNotSure(session, true), false);
}

console.log("Quiz checks passed: navigation, drafts, persistent feedback, locked first attempts, no deadline, single recording and out-of-order completion in all six modes.");
