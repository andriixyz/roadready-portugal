import assert from "node:assert/strict";
import { createQuizSession, selectSessionAnswer, checkSessionAnswer, moveToQuestion, firstUnansweredIndex } from "../quiz-session.js";

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
  assert.equal(moveToQuestion(session, 2), true, "Unanswered questions can be skipped");
  assert.equal(firstUnansweredIndex(session), 0);
  selectSessionAnswer(session, "B");
  moveToQuestion(session, 0);
  assert.equal(session.selected, null, "Selections must not leak between questions");
  moveToQuestion(session, 2);
  assert.equal(session.selected, "B", "Draft selections survive navigation");
  assert.equal(session.questionLanguage, "ru");

  assert.equal(session.answers[2], undefined, "Drafts must not count as checked answers");
  assert.equal(checkSessionAnswer(session).correct, false);
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
    checkSessionAnswer(session);
  }
  assert.equal(firstUnansweredIndex(session), -1, "Out-of-order completion includes every question");
  assert.equal(session.answers.filter(answer => answer.correct).length, 2);
  session.result = {};
  assert.equal(moveToQuestion(session, 1), false);
  assert.equal(selectSessionAnswer(session, "B"), false);
  assert.equal(checkSessionAnswer(session), null);
}

console.log("Quiz checks passed: navigation, drafts, persistent feedback, locked first attempts, no deadline, single recording and out-of-order completion in all six modes.");
