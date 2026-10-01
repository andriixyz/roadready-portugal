export function createQuizSession(mode, questions, language, now = Date.now()) {
  return {
    mode, questions, index: 0, answers: [], picks: [], selected: null, checked: false,
    startedAt: now, remaining: mode === "exam" ? 1800 : null,
    endsAt: mode === "exam" ? now + 1800000 : null, questionLanguage: language,
  };
}

export function selectSessionAnswer(session, key) {
  if (session.result || session.checked) return false;
  const question = session.questions[session.index];
  if (!question.answers.some((answer) => answer.key === key)) return false;
  session.selected = key;
  session.picks[session.index] = key;
  if (session.mode === "exam") {
    session.answers[session.index] = { questionId: question.id, pick: key, correct: key === question.correct };
  }
  return true;
}

export function checkSessionAnswer(session) {
  if (session.result || session.mode === "exam" || session.checked || !session.selected) return null;
  const question = session.questions[session.index];
  const answer = { questionId: question.id, pick: session.selected, correct: session.selected === question.correct };
  session.answers[session.index] = answer;
  session.checked = true;
  return answer;
}

export function moveToQuestion(session, index) {
  if (session.result || !Number.isInteger(index) || index < 0 || index >= session.questions.length) return false;
  session.index = index;
  session.selected = session.picks[index] || session.answers[index]?.pick || null;
  session.checked = session.mode !== "exam" && Boolean(session.answers[index]);
  return true;
}

export function firstUnansweredIndex(session) {
  return session.questions.findIndex((_, index) => !session.answers[index]);
}
