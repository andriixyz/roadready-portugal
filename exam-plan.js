import { answersOnDay, studyDay } from "./study-activity.js?v=20261002-3";

const DAY_MS = 86400000;
const dayNumber = (day) => Date.parse(`${day}T12:00:00Z`) / DAY_MS;
const answered = (progress) => Boolean(progress && ((progress.correct || 0) + (progress.wrong || 0) > 0));
const latestCorrect = (progress) => progress.streak === undefined
  ? (progress.correct || 0) > (progress.wrong || 0) : progress.streak > 0;

export function validExamPlan(value) {
  const validDay = (day) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(dayNumber(day)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
  return value === null || Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => ["startedOn", "examDate", "language"].includes(key))
    && validDay(value.startedOn) && validDay(value.examDate) && value.examDate > value.startedOn
    && ["en", "ru", "pt"].includes(value.language));
}

export function createExamPlan(today = new Date(), examDate, language = "en") {
  const target = new Date(today);
  target.setDate(target.getDate() + 20);
  return { startedOn: studyDay(today), examDate: examDate || studyDay(target), language };
}

export function unresolvedQuestions(questions, profile) {
  return questions.filter((question) => {
    const progress = profile.questionProgress[question.id];
    return answered(progress) && !latestCorrect(progress);
  });
}

export function examTopicStats(questions, profile) {
  const topics = new Map();
  for (const question of questions) {
    const topic = topics.get(question.topic) || { topic: question.topic, total: 0, seen: 0, correct: 0 };
    topic.total++;
    const progress = profile.questionProgress[question.id];
    if (answered(progress)) {
      topic.seen++;
      if (latestCorrect(progress)) topic.correct++;
    }
    topics.set(question.topic, topic);
  }
  return [...topics.values()].map((topic) => ({
    ...topic, accuracy: topic.seen ? topic.correct / topic.seen : 0,
    coverage: topic.seen / topic.total,
    ready: topic.seen >= Math.min(20, topic.total) && topic.correct / topic.seen >= .9,
  })).sort((a, b) => Number(a.ready) - Number(b.ready) || a.coverage - b.coverage || a.accuracy - b.accuracy
    || String(a.topic).localeCompare(String(b.topic)));
}

export function recentMocks(profile, language, today = new Date()) {
  const day = dayNumber(studyDay(today));
  return (profile.sessions || []).filter((session) => {
    const age = day - dayNumber(studyDay(new Date(session.completedAt)));
    return session.mode === "exam" && session.total === 30 && session.language === language
      && !session.languageChanged && Number.isFinite(session.durationSeconds) && age >= 0 && age < 7;
  }).sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
}

export function examReadiness(questions, profile, language = "en", today = new Date(), sample = false) {
  const topics = examTopicStats(questions, profile);
  const seen = topics.reduce((sum, topic) => sum + topic.seen, 0);
  const unresolved = unresolvedQuestions(questions, profile).length;
  const mocks = recentMocks(profile, language, today).slice(-5);
  const strongMocks = mocks.filter((mock) => mock.correct >= 28).length;
  const mockDays = new Set(mocks.map((mock) => studyDay(new Date(mock.completedAt)))).size;
  const checks = [
    { key: "coverage", met: !sample && questions.length > 0 && seen === questions.length },
    { key: "topics", met: !sample && topics.length > 0 && topics.every((topic) => topic.ready) },
    { key: "mistakes", met: !sample && seen > 0 && unresolved === 0 },
    { key: "mocks", met: !sample && mocks.length === 5 && strongMocks === 5 && mockDays >= 3 },
  ];
  const met = checks.filter((check) => check.met).length;
  return { topics, seen, unresolved, mocks, strongMocks, mockDays, checks, met, ready: met === checks.length };
}

export function getExamPlan(questions, profile, config, today = new Date(), sample = false) {
  const day = studyDay(today);
  const daysLeft = Math.round(dayNumber(config.examDate) - dayNumber(day));
  const totalDays = Math.round(dayNumber(config.examDate) - dayNumber(config.startedOn));
  const finalDays = Math.min(4, Math.max(1, Math.floor(totalDays / 4)));
  const phase = daysLeft <= 0 ? "exam" : daysLeft === 1 ? "light" : daysLeft <= finalDays ? "rehearse" : "cover";
  const readiness = examReadiness(questions, profile, config.language, today, sample);
  const unseen = questions.length - readiness.seen;
  const newToday = questions.filter((question) => {
    const progress = profile.questionProgress[question.id];
    return answered(progress) && progress.firstSeenAt && studyDay(new Date(progress.firstSeenAt)) === day;
  }).length;
  const reviewToday = Math.max(0, answersOnDay(profile, today) - newToday);
  const due = questions.filter((question) => {
    const progress = profile.questionProgress[question.id];
    return answered(progress) && (!progress.nextReview || Date.parse(progress.nextReview) <= today.getTime());
  }).length;
  // Include today's work in the numerator so a target does not shrink as it is completed.
  // Missed days raise tomorrow's pace; the final days stay available for rehearsal.
  const coverageDays = Math.max(1, daysLeft - finalDays);
  const newTarget = daysLeft > 0 ? Math.ceil((unseen + newToday) / coverageDays) : 0;
  const reviewTarget = daysLeft > 0 ? Math.min(due + reviewToday, phase === "light" ? 20 : Math.max(40, Math.ceil(newTarget * .4))) : 0;
  const mockTarget = phase === "cover" ? 1 : phase === "rehearse" ? 2 : 0;
  const mocksToday = recentMocks(profile, config.language, today)
    .filter((mock) => studyDay(new Date(mock.completedAt)) === day).length;
  const tasks = [
    { key: "new", mode: "learn", done: newToday, target: newTarget, met: newToday >= newTarget },
    { key: "review", mode: "review", done: reviewToday, target: reviewTarget, met: reviewToday >= reviewTarget },
    { key: "repair", mode: "repair", done: 0, target: readiness.unresolved, met: readiness.unresolved === 0 },
    { key: "mock", mode: "exam", done: mocksToday, target: mockTarget, met: mocksToday >= mockTarget },
  ];
  const studyMinutes = Math.ceil(Math.max(0, newTarget - newToday) * .7
    + Math.max(0, reviewTarget - reviewToday) * .5 + readiness.unresolved * .7
    + Math.max(0, mockTarget - mocksToday) * 30);
  return { config, daysLeft, totalDays, finalDays, phase, readiness, unseen, due, newToday, newTarget,
    reviewToday, reviewTarget, mockTarget, mocksToday, tasks, studyMinutes,
    day: Math.max(1, Math.min(totalDays, totalDays - daysLeft + 1)),
    dailyPercent: Math.round(tasks.filter((task) => task.met).length / tasks.length * 100) };
}

export function selectNewQuestions(questions, profile, limit = 20, random = Math.random) {
  // Rotate across the least-covered topics instead of repeatedly sampling a large topic.
  const buckets = examTopicStats(questions, profile).map((topic) => ({
    ...topic, remaining: questions.filter((question) => question.topic === topic.topic
      && !answered(profile.questionProgress[question.id])),
  }));
  const selected = [];
  while (selected.length < limit) {
    const available = buckets.filter((bucket) => bucket.remaining.length)
      .sort((a, b) => a.seen / a.total - b.seen / b.total || a.accuracy - b.accuracy);
    if (!available.length) break;
    const bucket = available[0];
    const index = Math.min(bucket.remaining.length - 1, Math.floor(random() * bucket.remaining.length));
    selected.push(bucket.remaining.splice(index, 1)[0]);
    bucket.seen++;
  }
  return selected;
}
