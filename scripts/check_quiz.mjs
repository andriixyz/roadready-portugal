import assert from "node:assert/strict";
import { createQuizSession, selectSessionAnswer, checkSessionAnswer, moveToQuestion, firstUnansweredIndex } from "../quiz-session.js";

const questions = Array.from({ length: 3 }, (_, index) => ({
  id: `q${index}`, answers: [{ key: "A" }, { key: "B" }], correct: "A",
}));

for (const mode of ["quick", "review", "mistakes", "exam"]) {
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

  if (mode === "exam") {
    assert.equal(session.checked, false);
    assert.equal(checkSessionAnswer(session), null, "Exams never reveal feedback");
    assert.equal(session.answers[2].correct, false);
    selectSessionAnswer(session, "A");
    assert.equal(session.answers[2].correct, true, "Exam answers remain editable");
    assert.equal(session.endsAt, 1801000, "Navigation leaves the exam deadline unchanged");
  } else {
    assert.equal(session.answers[2], undefined, "Drafts must not count as checked answers");
    assert.equal(checkSessionAnswer(session).correct, false);
    moveToQuestion(session, 0);
    moveToQuestion(session, 2);
    assert.equal(session.checked, true, "Checked feedback survives navigation");
    assert.equal(selectSessionAnswer(session, "A"), false, "Checked answers remain locked");
    assert.equal(checkSessionAnswer(session), null, "Revisiting cannot record an answer twice");
  }

  for (const index of [1, 0]) {
    moveToQuestion(session, index);
    selectSessionAnswer(session, "A");
    if (mode !== "exam") checkSessionAnswer(session);
  }
  assert.equal(firstUnansweredIndex(session), -1, "Out-of-order completion includes every question");
  assert.equal(session.answers.filter(answer => answer.correct).length, mode === "exam" ? 3 : 2);
  session.result = {};
  assert.equal(moveToQuestion(session, 1), false);
  assert.equal(selectSessionAnswer(session, "B"), false);
  assert.equal(checkSessionAnswer(session), null);
}

console.log("Quiz checks passed: navigation, drafts, feedback, single recording, editable exam answers, deadlines, and out-of-order completion in all four modes.");
