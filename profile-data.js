import { validExamPlan } from "./exam-plan.js?v=20261007-1";

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export class InvalidStudyProfileError extends Error {
  constructor() { super("Invalid study profile"); }
}

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const safeKeys = (value) => Object.keys(value).every((key) => !["__proto__", "prototype", "constructor"].includes(key));
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const date = (value) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
const optional = (value, key, check) => value[key] === undefined || check(value[key]);

function validProgress(value) {
  if (!record(value) || !safeKeys(value)) return false;
  if (!["correct", "wrong", "streak", "baseCorrect", "baseWrong"].every((key) => optional(value, key, count))) return false;
  if (!["lastAnswer", "nextReview", "firstSeenAt"].every((key) => optional(value, key, date))) return false;
  if (value.countsByDevice !== undefined) {
    if (!record(value.countsByDevice) || !safeKeys(value.countsByDevice)) return false;
    if (!Object.values(value.countsByDevice).every((item) => record(item) && safeKeys(item)
      && optional(item, "correct", count) && optional(item, "wrong", count))) return false;
  }
  return true;
}

function validSavedQuestion(value) {
  return record(value) && safeKeys(value)
    && ["notSure", "mistake"].every((key) => optional(value, key, (flag) => typeof flag === "boolean"))
    && (value.notSure === true || value.mistake === true);
}

const validSavedQuestions = (value) => record(value) && safeKeys(value) && Object.values(value).every(validSavedQuestion);

function validSession(value) {
  return record(value) && safeKeys(value)
    && ["quick", "review", "mistakes", "exam", "learn", "repair"].includes(value.mode)
    && count(value.total) && value.total > 0 && count(value.correct) && value.correct <= value.total
    && typeof value.completedAt === "string" && date(value.completedAt)
    && optional(value, "percent", (n) => Number.isFinite(n) && n >= 0 && n <= 100)
    && optional(value, "durationSeconds", count)
    && optional(value, "activityRecorded", (flag) => typeof flag === "boolean")
    && optional(value, "language", (language) => ["en", "ru", "pt"].includes(language))
    && optional(value, "languageChanged", (flag) => typeof flag === "boolean")
    && optional(value, "id", (id) => typeof id === "string" && id.length > 0);
}

const validDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`))
  && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
const validActivityDevices = (devices) => record(devices) && safeKeys(devices) && Object.values(devices).every(count);
const validActivity = (activity) => record(activity) && Object.entries(activity)
  .every(([day, devices]) => validDay(day) && validActivityDevices(devices));

const preferences = {
  dailyGoal: (value) => count(value) && value > 0,
  streak: count,
  language: (value) => ["en", "ru", "pt"].includes(value),
  uiLanguage: (value) => ["en", "ru"].includes(value),
  startedAt: date,
  updatedAt: date,
  resetAt: date,
  examPlan: validExamPlan,
};

export function validateStudyProfile(value) {
  if (!record(value) || !safeKeys(value)
    || !record(value.questionProgress) || !safeKeys(value.questionProgress)
    || !Object.values(value.questionProgress).every(validProgress)
    || !optional(value, "savedQuestions", validSavedQuestions)
    || !Array.isArray(value.sessions) || !value.sessions.every(validSession)
    || !optional(value, "answerActivity", validActivity)
    || !Object.entries(preferences).every(([key, check]) => optional(value, key, check))) {
    throw new InvalidStudyProfileError();
  }
  return value;
}

export function normaliseStudyProfile(value, defaults) {
  validateStudyProfile(value);
  // Clone the nested data: validation and an import must not mutate the caller.
  const copy = JSON.parse(JSON.stringify(value));
  const language = copy.language || defaults.language;
  const savedQuestions = copy.savedQuestions || {};
  // Include every historical mistake, even if later correct answers repaired it.
  for (const [id, progress] of Object.entries(copy.questionProgress)) {
    if (progress.wrong > 0) savedQuestions[id] = { ...savedQuestions[id], mistake: true };
  }
  return {
    ...defaults, ...copy,
    language,
    answerActivity: copy.answerActivity || {},
    savedQuestions,
    uiLanguage: copy.uiLanguage || (language === "ru" ? "ru" : "en"),
    sessions: copy.sessions.slice(-100).map((session) => ({
      ...session,
      percent: Math.round(session.correct / session.total * 100),
    })),
  };
}

export function recoverStudyProfile(value, defaults) {
  // On startup, retain independently valid records instead of locking the
  // user out of Settings because one old record is damaged.
  const recovered = { questionProgress: {}, sessions: [] };
  if (record(value)) {
    for (const [key, check] of Object.entries(preferences)) {
      if (value[key] !== undefined && check(value[key])) recovered[key] = value[key];
    }
    if (record(value.questionProgress)) {
      recovered.questionProgress = Object.fromEntries(Object.entries(value.questionProgress)
        .filter(([key, item]) => safeKeys({ [key]: item }) && validProgress(item)));
    }
    if (record(value.savedQuestions)) {
      recovered.savedQuestions = Object.fromEntries(Object.entries(value.savedQuestions)
        .filter(([key, item]) => safeKeys({ [key]: item }) && validSavedQuestion(item)));
    }
    if (Array.isArray(value.sessions)) recovered.sessions = value.sessions.filter(validSession);
    if (record(value.answerActivity)) {
      recovered.answerActivity = Object.fromEntries(Object.entries(value.answerActivity)
        .filter(([day, devices]) => validDay(day) && validActivityDevices(devices)));
    }
  }
  return normaliseStudyProfile(recovered, defaults);
}
