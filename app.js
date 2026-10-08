import { createSyncController, getDeviceId, incrementAnswerCounts, isValidSyncKey } from "./sync.js?v=20261007-1";
import { localeFor, normalizeLanguage, russianPluralKey, translate } from "./i18n.js?v=20261008-1";
import { createQuizSession, selectSessionAnswer, checkSessionAnswer, moveToQuestion, firstUnansweredIndex } from "./quiz-session.js?v=20261007-3";
import { createQuestionImage, getQuestionChatGPTPrompt, getQuestionImagePath } from "./question-capture.js?v=20260930-4";
import { MAX_BACKUP_BYTES, InvalidStudyProfileError, normaliseStudyProfile, recoverStudyProfile } from "./profile-data.js?v=20261007-1";
import { recordStudyActivity, answersOnDay, studyStreak } from "./study-activity.js?v=20261002-3";
import { prepareVerificationAudit, getQuestionVerification, verificationPdfUrl } from "./question-verification.js?v=20261002-1";
import { createExamPlan, validExamPlan, getExamPlan, examReadiness, selectNewQuestions, unresolvedQuestions } from "./exam-plan.js?v=20261007-3";
import { renderSpeedLimits } from "./speed-limits.js?v=20261008-2";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const main = $("#mainContent");
const SESSION_LIMITS = { quick: 10, review: 20, mistakes: 20, exam: 30, learn: 20, repair: 20 };
const suggestedExamPlan = { startedOn: "2026-10-07", examDate: "2026-10-27", language: "en" };
let topicOrder = "weakest";

const TOPIC_NAMES = {
  "Cedência de passagem": { en: "Right of way", ru: "Право преимущественного проезда" },
  "Circulação, segurança e veículos em missão urgente de socorro": { en: "Road use, safety & emergency vehicles", ru: "Движение, безопасность и экстренные службы" },
  "Classificação, constituintes, inspecções, pesos e dimensões, protecção de ambiente, equipamentos de segurança, acidente": { en: "Vehicle classes, inspections & safety", ru: "Классы автомобилей, техосмотр и безопасность" },
  "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação": { en: "Driver fitness, alcohol, medicines & mandatory signs", ru: "Состояние водителя, алкоголь, лекарства и предписывающие знаки" },
  "Iluminação, passageiros e carga, condução defensiva e peões": { en: "Lights, passengers, loads & defensive driving", ru: "Освещение, пассажиры, груз, защитное вождение и пешеходы" },
  "Outras manobras": { en: "Other manoeuvres", ru: "Другие манёвры" },
  "Paragem, estacionamento e cruzamento de veículos": { en: "Stopping, parking & passing vehicles", ru: "Остановка, стоянка и встречный разъезд" },
  "Sinais de indicação": { en: "Information signs", ru: "Информационные знаки" },
  "Sinais de perigo": { en: "Warning signs", ru: "Предупреждающие знаки" },
  "Sinais de prescrição específica, sinais de cedência de passagem": { en: "Specific rules & priority signs", ru: "Знаки особых предписаний и приоритета" },
  "Sinais de proibição": { en: "Prohibition signs", ru: "Запрещающие знаки" },
  "Sinalização luminosa, marcas no pavimento e outra sinalização": { en: "Traffic lights, road markings & other signals", ru: "Светофоры, дорожная разметка и другие сигналы" },
  "Títulos de condução, obtenção, revalidação, responsabilidade civil e criminal, contra-ordenações, cassação": { en: "Licensing, liability & offences", ru: "Водительские права, ответственность и нарушения" },
  "Ultrapassagem": { en: "Overtaking", ru: "Обгон" },
  "Velocidade": { en: "Speed", ru: "Скорость" },
  "Vias de trânsito, condições ambientais adversas": { en: "Roads & adverse conditions", ru: "Дороги и неблагоприятные условия" },
};

const sampleQuestions = [
  {
    id: "sample-1", sourceId: 1, category: "B", topic: "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação",
    text: { pt: "A visão em túnel manifesta-se de que modo?", en: "How does tunnel vision manifest itself?", ru: "Как проявляется туннельное зрение?" },
    answers: [{ key: "A", pt: "Perda total de visão lateral.", en: "Total loss of peripheral vision.", ru: "Полная потеря периферического зрения." }, { key: "B", pt: "Perda total da capacidade de visão cromática.", en: "Total loss of colour vision.", ru: "Полная потеря цветового зрения." }], correct: "A",
    image: "", sourceUrl: "https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_1_condutores.pdf",
  },
  {
    id: "sample-2", sourceId: 2, category: "B", topic: "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação",
    text: { pt: "A alteração do campo visual de um condutor devido à ingestão de bebidas alcoólicas manifesta-se por:", en: "A driver's field of vision is altered by alcohol through:", ru: "Как алкоголь изменяет поле зрения водителя?" },
    answers: [{ key: "A", pt: "Redução da visão lateral.", en: "Reduced peripheral vision.", ru: "Снижает периферическое зрение." }, { key: "B", pt: "Aumento da visão lateral.", en: "Increased peripheral vision.", ru: "Расширяет периферическое зрение." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-3", sourceId: 3, category: "B", topic: "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação",
    text: { pt: "Os condutores têm obrigação de sujeitar-se às provas estabelecidas para a detecção de álcool.", en: "Drivers are required to undergo the prescribed alcohol-detection tests.", ru: "Водители обязаны проходить установленные проверки на алкоголь." },
    answers: [{ key: "A", pt: "Certo.", en: "True.", ru: "Верно." }, { key: "B", pt: "Errado.", en: "False.", ru: "Неверно." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-4", sourceId: 4, category: "B", topic: "Cedência de passagem",
    text: { pt: "Ao entrar numa rotunda devo ceder a passagem.", en: "When entering a roundabout, I must give way.", ru: "При въезде на круговое движение я обязан уступить дорогу." },
    answers: [{ key: "A", pt: "Certo.", en: "True.", ru: "Верно." }, { key: "B", pt: "Errado.", en: "False.", ru: "Неверно." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-5", sourceId: 5, category: "B", topic: "Vias de trânsito, condições ambientais adversas",
    text: { pt: "A circulação sob condições atmosféricas adversas pode prejudicar a distância de travagem.", en: "Driving in adverse weather conditions can adversely affect braking distance.", ru: "Движение в неблагоприятных погодных условиях может увеличить тормозной путь." },
    answers: [{ key: "A", pt: "Certo.", en: "True.", ru: "Верно." }, { key: "B", pt: "Errado.", en: "False.", ru: "Неверно." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-6", sourceId: 6, category: "B", topic: "Paragem, estacionamento e cruzamento de veículos",
    text: { pt: "É permitido o estacionamento na faixa de rodagem.", en: "Parking on the carriageway is permitted.", ru: "Стоянка на проезжей части разрешена." },
    answers: [{ key: "A", pt: "Certo.", en: "True.", ru: "Верно." }, { key: "B", pt: "Errado.", en: "False.", ru: "Неверно." }], correct: "B", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
];

const defaultProfile = () => ({
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  dailyGoal: 20,
  examPlan: null,
  uiLanguage: "en",
  language: "en",
  questionProgress: {},
  sessions: [],
  answerActivity: {},
  streak: 0,
});
const PROFILE_KEY = "roadready-profile";
const RECOVERY_KEY = "roadready-profile-recovery";
const deviceId = getDeviceId();

let recoveredStoredProfile = false;
let profile = loadProfile();
let questions = [];
let corpusMeta = { count: 0, generatedAt: null };
let verificationAudit = null;
let session = null;
let timerId = null;
let syncController = null;
let syncState = {
  configured: false,
  status: "local",
  hasSyncKey: false,
  lastSyncedAt: null,
  messageKey: "sync.localReady",
};

function normaliseProfile(value) { return normaliseStudyProfile(value, defaultProfile()); }
function loadProfile() {
  let saved, parsed;
  try {
    saved = localStorage.getItem(PROFILE_KEY);
    if (!saved) return { ...defaultProfile(), updatedAt: null };
    parsed = JSON.parse(saved);
    return normaliseProfile(parsed);
  }
  catch {
    if (!saved) return defaultProfile();
    recoveredStoredProfile = true;
    // Keep the damaged original for recovery even after later answers or sync.
    try {
      if (!localStorage.getItem(RECOVERY_KEY)) localStorage.setItem(RECOVERY_KEY, saved);
    } catch { /* Recovery must still work when storage is full. */ }
    return recoverStudyProfile(parsed, defaultProfile());
  }
}
function saveProfile({ sync = true } = {}) {
  profile.examPlan ||= { ...suggestedExamPlan };
  profile.updatedAt = new Date().toISOString();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (sync) syncController?.schedule();
  updateStorageSummary();
}
function applySyncedProfile(incoming) {
  profile = normaliseProfile(incoming);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  applyStaticTranslations();
  render();
  updateStorageSummary();
  if (profile.uiLanguage === "ru" || profile.language === "ru") {
    void ensureRussianCorpus().then(() => render()).catch(() => {});
  }
}
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const t = (key, values = {}) => translate(key, profile.uiLanguage, values);
const currentLocale = () => localeFor(profile.uiLanguage);
const formatDate = (date = new Date()) => new Intl.DateTimeFormat(currentLocale(), { weekday: "long", day: "numeric", month: "long" }).format(date);
const formatNumber = (value) => Number(value).toLocaleString(currentLocale());
const formatStoredCount = (count, base, englishOne, englishMany) => profile.uiLanguage === "ru"
  ? t(russianPluralKey(count, base), { count: formatNumber(count) })
  : `${formatNumber(count)} ${count === 1 ? englishOne : englishMany}`;
const formatQuestionCount = (count) => formatStoredCount(count, "storage.question", "question", "questions");
const formatSessionCount = (count) => formatStoredCount(count, "storage.session", "session", "sessions");
const formatDayCount = (count) => formatStoredCount(count, "unit.day", "day", "days");
const formatAttemptCount = (count) => formatStoredCount(count, "unit.attempt", "attempt", "attempts");
const formatMinuteCount = (count) => {
  if (profile.uiLanguage !== "ru") return `${formatNumber(count)} minute${count === 1 ? "" : "s"}`;
  const absolute = Math.abs(count) % 100;
  const last = absolute % 10;
  const noun = absolute > 10 && absolute < 20 ? "минут" : last === 1 ? "минута" : last >= 2 && last <= 4 ? "минуты" : "минут";
  return `${formatNumber(count)} ${noun}`;
};
const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const topicName = (topic, language = profile.language) => language === "pt"
  ? (topic || t("topic.general"))
  : (TOPIC_NAMES[topic]?.[language] || TOPIC_NAMES[topic]?.[profile.uiLanguage] || TOPIC_NAMES[topic]?.en || topic || t("topic.general"));

function applyStaticTranslations() {
  document.documentElement.lang = profile.uiLanguage;
  document.title = t("meta.title");
  $("meta[name='description']")?.setAttribute("content", t("meta.description"));
  $$('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
  $$('[data-i18n-placeholder]').forEach((element) => { element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder)); });
  $$('[data-ui-lang]').forEach((button) => {
    const active = button.dataset.uiLang === profile.uiLanguage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

let russianCorpusPromise = null;
async function ensureRussianCorpus() {
  if (questions.length && questions.every((question) => question.text?.ru && question.explanation?.ru && question.answers.every((answer) => answer.ru))) return true;
  if (corpusMeta.sample && questions.every((question) => question.text?.ru && question.answers.every((answer) => answer.ru))) return true;
  if (!russianCorpusPromise) russianCorpusPromise = (async () => {
    const response = await fetch("public/data/questions-ru.json?v=20261002-1");
    if (!response.ok) throw new Error(`Russian corpus request failed: ${response.status}`);
    const data = await response.json();
    const overlayEntries = Array.isArray(data.questions)
      ? data.questions.map((question) => [question.id, question])
      : Object.entries(data.questions || {});
    if (overlayEntries.length !== questions.length) throw new Error("Russian corpus does not match the base corpus.");
    const overlays = new Map(overlayEntries);
    questions.forEach((question) => {
      const overlay = overlays.get(question.id);
      if (!overlay) throw new Error(`Missing Russian translation for ${question.id}`);
      question.text.ru = overlay.text.ru;
      question.explanation = { ...(question.explanation || {}), ru: overlay.explanation.ru };
      const answers = new Map(overlay.answers.map((answer) => [answer.key, answer.ru]));
      question.answers.forEach((answer) => { answer.ru = answers.get(answer.key); });
    });
    return true;
  })().catch((error) => {
    russianCorpusPromise = null;
    throw error;
  });
  return russianCorpusPromise;
}

async function loadCorpus() {
  for (const url of ["public/data/questions-en.json?v=20261002-1", "public/data/questions-pt.json?v=20260731-1"]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      questions = data.questions;
      corpusMeta = data;
      if (questions.length) {
        if (profile.uiLanguage === "ru" || profile.language === "ru") await ensureRussianCorpus();
        await loadVerificationAudit();
        return;
      }
    } catch { /* try fallback */ }
  }
  questions = sampleQuestions;
  corpusMeta = { count: sampleQuestions.length, generatedAt: new Date().toISOString(), sample: true };
}

async function loadVerificationAudit() {
  verificationAudit = null;
  try {
    const response = await fetch("public/data/imt-verification.json?v=20261002-1");
    if (response.ok) verificationAudit = await prepareVerificationAudit(questions, await response.json());
  } catch { /* Missing or stale verification must not prevent studying. */ }
}

function getStats() {
  const entries = questions.map((question) => profile.questionProgress[question.id]).filter(Boolean);
  const seen = entries.filter((item) => (item.correct || 0) + (item.wrong || 0) > 0).length;
  const correct = entries.reduce((sum, item) => sum + (item.correct || 0), 0);
  const wrong = entries.reduce((sum, item) => sum + (item.wrong || 0), 0);
  const accuracy = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;
  const due = dueQuestions().length;
  const mistakes = mistakeQuestions().length;
  const evidence = examReadiness(questions, profile, (profile.examPlan || suggestedExamPlan).language, new Date(), corpusMeta.sample);
  const examSessions = evidence.mocks;
  const mock = examSessions.length ? examSessions.reduce((sum, item) => sum + item.percent, 0) / examSessions.length : 0;
  const coverage = questions.length ? (seen / questions.length) * 100 : 0;
  const readiness = Math.round(evidence.met / evidence.checks.length * 100);
  const today = new Date();
  const todayAnswered = answersOnDay(profile, today);
  const streak = studyStreak(profile, today);
  return { seen, correct, wrong, accuracy, due, mistakes, readiness, evidence, coverage, mock: Math.round(mock), todayAnswered, streak };
}

function studyPlan() { return getExamPlan(questions, profile, profile.examPlan || suggestedExamPlan, new Date(), corpusMeta.sample); }
function planDate(day) { return new Date(`${day}T12:00:00`).toLocaleDateString(currentLocale(), { day: "numeric", month: "short" }); }
function planLanguage(plan) { return t(`plan.language.${plan.config.language}`); }
function nextPlanMode(plan = studyPlan()) {
  if (plan.daysLeft <= 0) return null;
  if (!plan.readiness.mocks.length && plan.mocksToday < plan.mockTarget) return "exam";
  if (plan.readiness.unresolved) return "repair";
  if (plan.reviewToday < plan.reviewTarget && plan.due) return "review";
  if (plan.newToday < plan.newTarget && plan.unseen) return "learn";
  if (plan.mocksToday < plan.mockTarget) return "exam";
  return null;
}

function readinessMarkup(plan) {
  const evidence = plan.readiness;
  const details = {
    coverage: t("plan.coverageEvidence", { seen: formatNumber(evidence.seen), total: formatNumber(questions.length) }),
    topics: t("plan.topicEvidence", { count: formatNumber(evidence.topics.filter((topic) => topic.ready).length), total: formatNumber(evidence.topics.length) }),
    mistakes: t("plan.mistakeEvidence", { count: formatNumber(evidence.unresolved) }),
    mocks: t("plan.mockEvidence", { count: formatNumber(evidence.strongMocks), days: formatNumber(evidence.mockDays), language: planLanguage(plan) }),
  };
  return `<section class="card readiness-evidence" aria-labelledby="readinessTargets"><h2 id="readinessTargets">${t("plan.readinessTargets")}</h2><p>${t("plan.readinessHelp")}</p>${corpusMeta.sample ? `<p class="plan-warning">${t("plan.sample")}</p>` : ""}<ul>${evidence.checks.map((check) => `<li><span class="plan-check ${check.met ? "is-met" : ""}" aria-label="${t(check.met ? "plan.met" : "plan.pending")}">${check.met ? "✓" : "○"}</span><div><strong>${t(`plan.check.${check.key}`)}</strong><small>${details[check.key]}</small></div></li>`).join("")}</ul><a class="text-link" href="https://imt.madeira.gov.pt/index.php/pt/transportes-terrestres/condutores/provas-teoricas" target="_blank" rel="noopener noreferrer">${t("plan.officialFormat")} ↗</a></section>`;
}

function planScheduleMarkup(plan) {
  const shift = (offset) => {
    const date = new Date(`${plan.config.examDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const stages = [
    ["cover", plan.config.startedOn, shift(-plan.finalDays - 1)],
    ["rehearse", [shift(-plan.finalDays), plan.config.startedOn].sort().at(-1), shift(-2)],
    ["light", shift(-1), shift(-1)],
  ].filter(([, from, to]) => from <= to && to >= plan.config.startedOn);
  return `<section class="study-plan">${stages.map(([phase, from, to]) => `<article class="plan-row ${phase === plan.phase ? "is-current" : ""}"><span class="plan-day">${planDate(from)}${from !== to ? ` – ${planDate(to)}` : ""}</span><div><h3>${t(`plan.phase.${phase}`)}</h3><p>${t(`plan.schedule.${phase}`)}</p></div></article>`).join("")}</section><p class="plan-logistics">${t("plan.logistics", { language: planLanguage(plan), date: planDate(plan.config.examDate) })} <a class="text-link" href="https://www.imt-ip.pt/condutores/obtencao/exames-de-conducao/" target="_blank" rel="noopener noreferrer">${t("plan.bookingInfo")} ↗</a></p>`;
}

function setActiveRoute(route) {
  $$("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
}

function render() {
  let route = location.hash.replace("#", "") || "dashboard";
  if (route !== "quiz" && session && !session.result && !confirmLeaveSession()) {
    route = "quiz";
    history.replaceState(null, "", "#quiz");
  }
  if (route === "quiz" && !session) {
    route = "dashboard";
    history.replaceState(null, "", "#dashboard");
  }
  document.body.dataset.route = route;
  clearInterval(timerId);
  if (route !== "quiz") session = null;
  setActiveRoute(route);
  if (route === "practice") renderPractice();
  else if (route === "progress") renderProgress();
  else if (route === "sources") renderSources();
  else if (route === "speed-limits") renderSpeedLimits(main, { t, escapeHtml, onPractice: () => { void startSession("quick", "Velocidade"); } });
  else if (route === "quiz" && session?.result) renderResult(session, session.result);
  else if (route === "quiz" && session) renderQuestion();
  else renderDashboard();
  if (modal.hidden) main.focus({ preventScroll: true });
}

function renderDashboard() {
  const s = getStats();
  const plan = studyPlan();
  const routeMode = nextPlanMode(plan);
  const quickCount = formatQuestionCount(sessionSize("quick"));
  const examCount = formatQuestionCount(sessionSize("exam"));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboard.morning") : hour < 18 ? t("dashboard.afternoon") : t("dashboard.evening");
  main.innerHTML = `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">${t("dashboard.category")}</span><h1>${greeting}</h1><p>${t("plan.subtitle", { language: planLanguage(plan) })}</p></div>
        <button class="date-chip plan-edit" data-edit-plan>${t("plan.targetDate", { date: planDate(plan.config.examDate) })} ✎</button>
      </header>
      <section class="hero-grid">
        <article class="card route-card">
          <div>
            <span class="eyebrow">${t("plan.day", { day: formatNumber(plan.day), total: formatNumber(plan.totalDays) })} · ${t(`plan.phase.${plan.phase}`)}</span>
            <h2>${plan.daysLeft > 0 ? t("plan.daysLeft", { count: formatDayCount(plan.daysLeft) }) : t(plan.daysLeft === 0 ? "plan.examToday" : "plan.datePassed")}</h2>
            <p>${t(`plan.description.${plan.phase}`)}</p>
            ${plan.unseen && plan.phase !== "cover" && plan.daysLeft > 0 ? `<p class="plan-warning">${t("plan.catchUp", { count: formatQuestionCount(plan.unseen) })}</p>` : ""}
            <div class="route-meta"><span><strong>${planLanguage(plan)}</strong></span><span><strong>${t("plan.remainingTime", { minutes: formatMinuteCount(plan.studyMinutes) })}</strong></span><span>${t("plan.answersToday", { count: formatNumber(s.todayAnswered) })}</span></div>
            ${routeMode ? `<button class="button button-accent" data-start="${routeMode}">${t(`plan.start.${routeMode}`)} →</button>` : `<a class="button button-primary plan-link" href="#practice">${t(plan.daysLeft > 0 ? "plan.todayDone" : "plan.openPractice")} →</a>`}
          </div>
          <div class="progress-ring" style="--progress:${plan.dailyPercent}"><span>${plan.tasks.filter((task) => task.met).length}/4<small>${t("plan.tasksDone")}</small></span></div>
        </article>
        <article class="card readiness-card">
          <span class="eyebrow" style="color:var(--lime)">${t("plan.studyTargets")}</span>
          <div class="readiness-score">${plan.readiness.met}/4</div>
          <div class="readiness-label">${t(plan.readiness.ready ? "plan.targetsMet" : "plan.targetsPending")}</div>
          <p>${t("plan.safetyMargin")}</p>
          <div class="meter" style="--value:${s.readiness}%"><span></span></div>
        </article>
      </section>

      <div class="section-heading"><div><h2>${t("plan.todayWork")}</h2><p>${t("plan.todayHelp")}</p></div><a class="text-link" href="#practice">${t("dashboard.allModes")}</a></div>
      <section class="daily-task-grid">${plan.tasks.map((task, index) => `<article class="task-card ${task.met ? "task-complete" : ""}"><div class="task-top"><span class="task-icon">${task.met ? "✓" : String(index + 1).padStart(2, "0")}</span><span class="mode-kicker">${t(task.met ? "plan.met" : "plan.pending")}</span></div><h3>${t(`plan.task.${task.key}`)}</h3><strong class="task-target">${task.key === "repair" ? t("plan.remaining", { count: formatNumber(task.target) }) : `${formatNumber(task.done)}/${formatNumber(task.target)}`}</strong><p>${t(`plan.taskHelp.${task.key}`, { language: planLanguage(plan) })}</p><button data-start="${task.mode}" ${task.met ? "disabled" : ""}>${t(`plan.start.${task.mode}`)} →</button></article>`).join("")}</section>
      <div class="section-heading"><h2>${t("plan.evidenceTitle")}</h2><a class="text-link" href="#progress">${t("dashboard.detailedProgress")}</a></div>
      ${readinessMarkup(plan)}
      <details class="plan-roadmap"><summary>${t("plan.roadmap")}</summary>${planScheduleMarkup(plan)}</details>
      <div class="section-heading"><h2>${t("plan.weakTopics")}</h2></div>
      <section class="weak-topic-grid">${plan.readiness.topics.filter((topic) => !topic.ready).slice(0, 3).map((topic) => `<article class="task-card"><h3>${escapeHtml(topicName(topic.topic, profile.uiLanguage))}</h3><p>${t("plan.weakTopicEvidence", { seen: formatNumber(topic.seen), total: formatNumber(topic.total), accuracy: formatNumber(Math.round(topic.accuracy * 100)) })}</p><button data-topic="${escapeHtml(topic.topic)}">${t("plan.practiceTopic")} →</button></article>`).join("") || `<p class="muted">${t("plan.topicsMet")}</p>`}</section>
      <div class="section-heading"><h2>${t("plan.extraPractice")}</h2></div>
      <section class="task-grid">
        <article class="task-card"><div class="task-top"><span class="task-icon">01</span><span class="mode-kicker">${t("dashboard.learn")}</span></div><h3>${t("dashboard.newQuestions")}</h3><p>${t("dashboard.newQuestionsDescription", { questions: quickCount })}</p><button data-start="quick">${t("dashboard.startQuick")}</button></article>
        <article class="task-card"><div class="task-top"><span class="task-icon">↻</span><span class="mode-kicker">${t("dashboard.recall")}</span></div><h3>${t("dashboard.dueForReview", { count: formatNumber(s.due) })}</h3><p>${t("dashboard.intervals")}</p><button data-start="review">${t("dashboard.reviewDue")}</button></article>
        <article class="task-card"><div class="task-top"><span class="task-icon">${formatNumber(sessionSize("exam"))}</span><span class="mode-kicker">${t("dashboard.simulate")}</span></div><h3>${t("dashboard.officialMock")}</h3><p>${t("dashboard.mockDescription", { questions: examCount })}</p><button data-start="exam">${t("dashboard.startMock")}</button></article>
      </section>

      <div class="section-heading"><h2>${t("dashboard.glance")}</h2><a class="text-link" href="#progress">${t("dashboard.detailedProgress")}</a></div>
      <section class="stat-grid">
        <article class="card stat-card"><span>${t("dashboard.questionsSeen")}</span><strong>${formatNumber(s.seen)}</strong><small>${t("unit.of", { count: formatNumber(questions.length) })}</small></article>
        <article class="card stat-card"><span>${t("dashboard.accuracy")}</span><strong>${s.accuracy}%</strong><small>${formatAttemptCount(s.correct + s.wrong)}</small></article>
        <article class="card stat-card"><span>${t("dashboard.mistakes")}</span><strong>${formatNumber(s.mistakes)}</strong><small>${t("dashboard.mistakesHelp")}</small></article>
        <article class="card stat-card"><span>${t("dashboard.streak")}</span><strong>${formatDayCount(s.streak)}</strong><small>${t("dashboard.streakHelp")}</small></article>
      </section>
    </div>`;
  bindStartButtons();
}

function renderPractice() {
  const s = getStats();
  const plan = studyPlan();
  main.innerHTML = `
    <div class="page">
      <header class="page-header"><div><span class="eyebrow">${t("practice.eyebrow")}</span><h1>${t("practice.title")}</h1><p>${t("practice.subtitle")}</p></div><span class="date-chip">${t("practice.loaded", { questions: formatQuestionCount(questions.length) })}</span></header>
      <a class="speed-preview" href="#speed-limits"><span class="speed-preview-numbers" aria-hidden="true">50 <i>90</i> 100 <i>120</i></span><div><strong>${t("speed.previewTitle")}</strong><p>${t("speed.previewHelp")}</p></div><span class="text-link">${t("speed.previewOpen")} →</span></a>
      <section class="mode-grid">
        <article class="card mode-card featured"><span class="mode-badge">${t("practice.recommended")}</span><span class="mode-kicker">${t("practice.quickMeta", { questions: formatQuestionCount(sessionSize("learn")) })}</span><h3>${t("plan.task.new")}</h3><p>${t("plan.learnDescription", { count: formatQuestionCount(plan.unseen), target: formatNumber(plan.newTarget) })}</p><button class="button button-accent" data-start="learn">${t("plan.start.learn")}</button></article>
        <article class="card mode-card"><span class="mode-badge">${t("practice.available", { count: formatNumber(plan.readiness.unresolved) })}</span><span class="mode-kicker">${t("practice.repair")}</span><h3>${t("plan.task.repair")}</h3><p>${t("plan.repairDescription")}</p><button class="button button-primary" data-start="repair">${t("plan.start.repair")}</button></article>
        <article class="card mode-card"><span class="mode-kicker">${t("practice.quickMeta", { questions: formatQuestionCount(sessionSize("quick")) })}</span><h3>${t("practice.quickTitle")}</h3><p>${t("practice.quickDescription")}</p><button class="button button-primary" data-start="quick">${t("practice.start")}</button></article>
        <article class="card mode-card"><span class="mode-badge">${t("practice.available", { count: formatNumber(s.due) })}</span><span class="mode-kicker">${t("practice.spaced")}</span><h3>${t("practice.dueTitle")}</h3><p>${t("practice.dueDescription")}</p><button class="button button-primary" data-start="review">${t("dashboard.reviewDue")}</button></article>
        <article class="card mode-card"><span class="mode-badge">${t(s.mistakes === 1 ? "practice.weakSpots.one" : "practice.weakSpots", { count: formatNumber(s.mistakes) })}</span><span class="mode-kicker">${t("practice.repair")}</span><h3>${t("practice.clinic")}</h3><p>${t("practice.clinicDescription")}</p><button class="button button-secondary" data-start="mistakes">${t("practice.fix")}</button></article>
        <article class="card mode-card"><span class="mode-badge">${t("practice.pass", { correct: formatNumber(Math.max(0, sessionSize("exam") - 3)), total: formatNumber(sessionSize("exam")) })}</span><span class="mode-kicker">${t("practice.examMeta", { questions: formatQuestionCount(sessionSize("exam")) })}</span><h3>${t("practice.mockTitle")}</h3><p>${t("practice.mockFullDescription")}</p><button class="button button-primary" data-start="exam">${t("practice.startMock")}</button></article>
      </section>
      <div class="section-heading"><div><h2>${t("plan.roadmap")}</h2><p>${t("plan.targetDate", { date: planDate(plan.config.examDate) })}</p></div><button class="button button-ghost" data-edit-plan>${t("plan.edit")}</button></div>
      ${planScheduleMarkup(plan)}
    </div>`;
  bindStartButtons();
}

function dueQuestions(now = Date.now()) {
  return questions.filter((question) => {
    const progress = profile.questionProgress[question.id];
    return progress && (!progress.nextReview || Date.parse(progress.nextReview) <= now);
  });
}

function selectForMode(mode, topic) {
  if (topic) {
    const pool = questions.filter((question) => question.topic === topic);
    const unresolved = unresolvedQuestions(pool, profile);
    const unseen = selectNewQuestions(pool, profile, SESSION_LIMITS.quick);
    const seen = shuffle(pool.filter((question) => !unresolved.includes(question) && !unseen.includes(question)));
    return [...shuffle(unresolved), ...unseen, ...seen].slice(0, SESSION_LIMITS.quick);
  }
  if (mode === "learn") return selectNewQuestions(questions, profile, SESSION_LIMITS.learn);
  if (mode === "repair") return shuffle(unresolvedQuestions(questions, profile)).slice(0, SESSION_LIMITS.repair);
  if (mode === "review") {
    return shuffle(dueQuestions()).sort((a, b) => (profile.questionProgress[a.id].streak || 0) - (profile.questionProgress[b.id].streak || 0)
      || Date.parse(profile.questionProgress[a.id].nextReview || 0) - Date.parse(profile.questionProgress[b.id].nextReview || 0)).slice(0, SESSION_LIMITS.review);
  }
  if (mode === "mistakes") {
    return shuffle(mistakeQuestions()).slice(0, SESSION_LIMITS.mistakes);
  }
  if (mode === "exam") return shuffle(questions).slice(0, sessionSize("exam"));
  const unseen = shuffle(questions.filter((q) => !profile.questionProgress[q.id]));
  const seen = shuffle(questions.filter((q) => profile.questionProgress[q.id]));
  return [...unseen, ...seen].slice(0, sessionSize("quick"));
}

function mistakeQuestions() {
  return questions.filter((question) => {
    const progress = profile.questionProgress[question.id];
    return progress && (progress.wrong || 0) > (progress.correct || 0);
  });
}

function sessionSize(mode) {
  const available = mode === "review" ? dueQuestions().length : mode === "mistakes" ? mistakeQuestions().length
    : mode === "learn" ? questions.filter((question) => !profile.questionProgress[question.id]
      || !(profile.questionProgress[question.id].correct || profile.questionProgress[question.id].wrong)).length
      : mode === "repair" ? unresolvedQuestions(questions, profile).length : questions.length;
  return Math.min(SESSION_LIMITS[mode], available);
}

async function startSession(mode, topic) {
  if (!Object.hasOwn(SESSION_LIMITS, mode)) return;
  const selected = selectForMode(mode, topic);
  if (!selected.length) { showToast(t(mode === "review" ? "practice.nothingDue" : mode === "mistakes" || mode === "repair" ? "practice.noMistakes" : mode === "learn" ? "plan.noNew" : "practice.answerFirst")); return; }
  const language = ["exam", "learn", "repair", "review"].includes(mode) || topic ? studyPlan().config.language : profile.language;
  if (language === "ru") {
    try { await ensureRussianCorpus(); }
    catch { showToast(t("quiz.russianLoadError")); return; }
  }
  session = createQuizSession(mode, selected, language);
  session.topic = topic;
  location.hash = "quiz";
  renderQuestion();
  scrollQuizIntoView();
}

function scrollQuizIntoView() {
  if (modal.hidden && window.matchMedia?.("(max-width: 720px)")?.matches) main.scrollIntoView({ block: "start", behavior: "instant" });
}

function updateQuizLayout() {
  const card = $(".question-card");
  if (!card || !window.matchMedia) return;
  const body = $(".question-body", card);
  const intro = $(".question-intro", card);
  const navigation = $(".quiz-navigation");
  // Move the existing nodes so keyboard order follows the phone layout too.
  if (window.matchMedia("(max-width: 720px)").matches) {
    card.insertBefore(intro, $(".question-visual", card));
    body.insertBefore(navigation, $(".question-capture-actions", body));
  } else {
    body.prepend(intro);
    card.before(navigation);
  }
}

window.matchMedia?.("(max-width: 720px)")?.addEventListener("change", updateQuizLayout);

function bindStartButtons() {
  $$('[data-start]').forEach((button) => button.addEventListener("click", () => { void startSession(button.dataset.start); }));
  $$('[data-topic]').forEach((button) => button.addEventListener("click", () => { void startSession("quick", button.dataset.topic); }));
  $$('[data-edit-plan]').forEach((button) => button.addEventListener("click", (event) => { openSettings(event); $("#examDate").focus(); }));
}

function explanationSourceLink(question) {
  return question.explanationSource ? `<a class="text-link rule-source-link" href="${escapeHtml(question.explanationSource)}" target="_blank" rel="noopener noreferrer">${t("quiz.ruleSource")} ↗</a>` : "";
}

function questionVerificationMarkup(question, showAnswerReview = false) {
  const proof = getQuestionVerification(question, verificationAudit);
  const status = proof?.status || "unavailable";
  const location = proof?.locations[0];
  const date = verificationAudit ? new Date(verificationAudit.auditedAt).toLocaleDateString(currentLocale()) : "";
  const reviewed = question.explanationReviewed === true && Boolean(question.explanationSource);
  return `<div class="question-verification"><details class="verification-details verification-${status}"><summary>${t(`verification.${status}.label`)}</summary><div class="verification-description"><p>${t(`verification.${status}.description`)}</p>${location ? `<a class="text-link" href="${escapeHtml(verificationPdfUrl(verificationAudit, location))}" target="_blank" rel="noopener noreferrer">${t(status === "matched" || status === "text-only" ? "verification.pdfLocation" : "verification.candidateLocation", { group: formatNumber(location.group), page: formatNumber(location.page), row: formatNumber(location.row) })} ↗</a>` : ""}${date ? `<p>${t("verification.date", { date })}</p>` : ""}<p>${t("verification.translations")}</p></div></details>${showAnswerReview ? `<span class="verification-answer ${reviewed ? "is-reviewed" : ""}">${t(reviewed ? "verification.answerReviewed" : "verification.answerUnreviewed")}</span>` : ""}</div>`;
}

function confirmLeaveSession() {
  return confirm(t(session.mode === "exam" ? "quiz.leaveExamConfirm" : "quiz.leaveConfirm"));
}

function renderQuestion() {
  if (!session) { location.hash = "practice"; return; }
  if (session.result) { renderResult(session, session.result); return; }
  const q = session.questions[session.index];
  const language = session.questionLanguage || profile.language || "en";
  const progress = (session.answers.filter(Boolean).length / session.questions.length) * 100;
  const unanswered = firstUnansweredIndex(session);
  const isLast = session.index === session.questions.length - 1;
  const advanceLabel = isLast && unanswered !== -1 ? t("quiz.returnUnanswered") : isLast ? t(session.mode === "exam" ? "quiz.finishExam" : "quiz.results") : t(session.mode === "exam" ? "quiz.next" : "quiz.continue");
  const answerState = session.answers[session.index];
  const title = q.text?.[language] || q.text?.en || q.text?.pt;
  const correctAnswer = q.answers.find((answer) => answer.key === q.correct)?.[language] || q.answers.find((answer) => answer.key === q.correct)?.en || q.correct;
  const explanation = q.explanation?.[language] || q.explanation?.[profile.uiLanguage] || q.explanation?.en || t("quiz.correctAnswer", { answer: correctAnswer });
  const image = q.image ? `<a class="question-image-link" href="${escapeHtml(q.image)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t("quiz.openImage", { id: q.sourceId }))}"><img src="${escapeHtml(getQuestionImagePath(q))}" alt="${escapeHtml(t("quiz.imageAlt", { id: q.sourceId }))}" referrerpolicy="no-referrer" /></a>` : `<div class="image-fallback"><strong>${t("quiz.textOnly")}</strong><br><br>${t("quiz.imageNotRequired")}</div>`;
  main.innerHTML = `
    <div class="page question-page">
      <div class="quiz-topbar"><button class="icon-button" id="exitQuiz" aria-label="${t("quiz.exit")}">×</button><div class="quiz-progress" style="--value:${progress}%"><span></span></div><span class="quiz-counter">${session.mode === "exam" ? `<b id="timer" title="${t("quiz.elapsedTime")}">${formatTime(session.elapsedSeconds)}</b> · ` : ""}${t("quiz.counter", { current: formatNumber(session.index + 1), total: formatNumber(session.questions.length) })}</span></div>
      <nav class="quiz-navigation" aria-label="${t("quiz.navigation")}">
        <div class="quiz-navigation-controls"><button class="button button-secondary" id="quizPrevious" ${session.index === 0 ? "disabled" : ""}>← ${t("quiz.previous")}</button><span class="quiz-navigation-status" role="status">${t("quiz.answeredCount", { count: formatNumber(session.answers.filter(Boolean).length), total: formatNumber(session.questions.length) })}</span><button class="button button-secondary" id="quizNext" ${isLast ? "disabled" : ""}>${t("quiz.next")} →</button></div>
        <button class="button button-secondary quiz-nav-toggle" id="toggleQuizNumbers" type="button" aria-controls="quizQuestionList" aria-expanded="${Boolean(session.navigationExpanded)}">${t(session.navigationExpanded ? "quiz.hideQuestions" : "quiz.showQuestions")}</button>
        <div class="quiz-question-list ${session.navigationExpanded ? "" : "is-collapsed"}" id="quizQuestionList">${session.questions.map((_, index) => {
          const status = session.answers[index] ? "answered" : session.picks[index] ? "draft" : "unanswered";
          return `<button type="button" class="quiz-question-number ${status}" data-question-index="${index}" ${index === session.index ? 'aria-current="step"' : ""} aria-label="${t("quiz.questionStatus", { number: formatNumber(index + 1), status: t(`quiz.status.${status}`) })}">${formatNumber(index + 1)}</button>`;
        }).join("")}</div>
      </nav>
      <article class="card question-card">
        <div class="question-visual"><div class="question-image-frame">${image}</div><div class="image-links"><a class="source-pill" href="${escapeHtml(q.sourceUrl)}" target="_blank" rel="noopener">${t("quiz.source", { id: escapeHtml(q.sourceId) })}</a>${q.image ? `<a class="full-image-link" href="${escapeHtml(q.image)}" target="_blank" rel="noopener">${t("quiz.fullImage")}</a>` : ""}</div></div>
        <div class="question-body">
          <div class="question-intro">
            <div class="question-tools"><span class="question-topic">${escapeHtml(topicName(q.topic, language))}</span><div class="language-toggle" role="group" aria-label="${t("aria.questionLanguage")}"><button class="${language === "en" ? "active" : ""}" data-lang="en" aria-pressed="${language === "en"}">EN</button><button class="${language === "ru" ? "active" : ""}" data-lang="ru" aria-pressed="${language === "ru"}">RU</button><button class="${language === "pt" ? "active" : ""}" data-lang="pt" aria-pressed="${language === "pt"}">PT</button></div></div>
            <h1>${escapeHtml(title)}</h1>
          </div>
          ${questionVerificationMarkup(q, session.checked)}
          <div class="answers">${q.answers.map((answer, i) => {
            const selected = session.selected === answer.key || answerState?.pick === answer.key;
            const checked = session.checked;
            const status = checked && answer.key === q.correct ? "correct" : checked && selected && answer.key !== q.correct ? "wrong" : selected ? "selected" : "";
            const marker = checked && answer.key === q.correct ? "✓" : checked && selected ? "×" : "";
            return `<button class="answer-option ${status}" data-answer="${answer.key}" aria-pressed="${selected}" ${checked ? "disabled" : ""}><span class="answer-key">${i + 1}</span><span>${escapeHtml(answer[language] || answer.en || answer.pt)}</span><span class="answer-marker">${marker}</span></button>`;
          }).join("")}</div>
          ${session.checked ? `<div class="feedback ${session.selected === q.correct ? "" : "incorrect"}" id="answerFeedback" tabindex="-1" role="status"><div class="feedback-heading"><span>${session.selected === q.correct ? "✓" : "!"}</span><strong>${session.selected === q.correct ? t("quiz.correct") : t("quiz.studyKey", { answer: q.correct })}</strong></div><p>${escapeHtml(explanation)}</p>${explanationSourceLink(q)}<small>${session.mode === "exam" ? t("quiz.feedbackHint") : session.selected === q.correct ? t("quiz.returnLater") : t("quiz.returnSooner")}</small></div>` : ""}
          <div class="quiz-actions"><span class="quiz-hint">${t("quiz.keyboardHint")}</span><button class="button ${session.checked ? "button-primary" : "button-accent"}" id="quizPrimary" ${session.checked ? "" : "disabled"}>${session.checked ? advanceLabel : t("quiz.selectAnswer")} →</button></div>
          <div class="question-capture-actions"><button class="button button-primary" id="askChatGPT" type="button">${t("quiz.askChatGPT")} ↗</button><button class="button button-ghost" id="copyQuestionImage" type="button">▣ ${t("quiz.copyForChatGPT")}</button><button class="button button-ghost" id="copyQuestionPrompt" type="button">${t("quiz.copyPrompt")}</button><button class="button button-ghost" id="downloadQuestionImage" type="button" hidden>${t("quiz.downloadImage")}</button><a class="button button-ghost" id="chatGPTOpenLink" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" hidden>${t("quiz.openChatGPT")} ↗</a></div>
          <p class="capture-status" id="questionCaptureStatus" role="status">${t("quiz.chatGPTHint")}</p>
          <div class="question-prompt-fallback" id="questionPromptFallback" hidden><label for="questionPromptText">${t("quiz.promptLabel")}</label><textarea id="questionPromptText" readonly rows="7">${escapeHtml(getQuestionChatGPTPrompt(q, language))}</textarea></div>
        </div>
      </article>
    </div>`;
  updateQuizLayout();
  $("#exitQuiz").addEventListener("click", () => { location.hash = "practice"; });
  $$('[data-lang]').forEach((button) => button.addEventListener("click", () => { void setQuestionLanguage(button.dataset.lang); }));
  $$("[data-answer]").forEach((button) => button.addEventListener("click", () => chooseAnswer(button.dataset.answer)));
  $("#quizPrimary").addEventListener("click", advanceQuiz);
  $("#quizPrevious").addEventListener("click", () => navigateQuestion(session.index - 1));
  $("#quizNext").addEventListener("click", () => navigateQuestion(session.index + 1));
  $("#toggleQuizNumbers").addEventListener("click", () => {
    session.navigationExpanded = !session.navigationExpanded;
    $("#quizQuestionList").classList.toggle("is-collapsed", !session.navigationExpanded);
    $("#toggleQuizNumbers").setAttribute("aria-expanded", String(session.navigationExpanded));
    $("#toggleQuizNumbers").textContent = t(session.navigationExpanded ? "quiz.hideQuestions" : "quiz.showQuestions");
  });
  $$("[data-question-index]").forEach((button) => button.addEventListener("click", () => navigateQuestion(Number(button.dataset.questionIndex))));
  bindQuestionCapture(q, language);
  const img = $(".question-visual img");
  if (img) img.addEventListener("error", () => {
    if (!img.dataset.remoteFallback) { img.dataset.remoteFallback = "true"; img.src = q.image; return; }
    img.replaceWith(Object.assign(document.createElement("div"), { className: "image-fallback", innerHTML: `<strong>${t("quiz.imageUnavailable")}</strong><br><br>${t("quiz.openSource")}` }));
  });
  if (session.mode === "exam") startTimer();
}

function bindQuestionCapture(question, language) {
  const button = $("#copyQuestionImage"), askButton = $("#askChatGPT"), promptButton = $("#copyQuestionPrompt"), promptFallback = $("#questionPromptFallback"), promptText = $("#questionPromptText"), downloadButton = $("#downloadQuestionImage"), chatLink = $("#chatGPTOpenLink"), status = $("#questionCaptureStatus");
  let preparedBlob = null;
  const copyImage = async (openChatGPT = false) => {
    const activeButton = openChatGPT ? askButton : button;
    button.disabled = true;
    askButton.disabled = true;
    promptButton.disabled = true;
    activeButton.textContent = t("quiz.preparingImage");
    status.textContent = "";
    downloadButton.hidden = true;
    chatLink.hidden = true;
    const imagePromise = createQuestionImage(question, language, { heading: t("quiz.captureHeading", { id: question.sourceId }) });
    try {
      // Start the write in the click event. The promised PNG preserves Safari's
      // user activation while its full-size image is still loading.
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Image clipboard unavailable");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": imagePromise })]);
      if (openChatGPT) {
        chatLink.hidden = false;
        status.textContent = t("quiz.chatGPTPaste");
        // No URL attachment API is used. The user pastes the copied PNG in
        // ChatGPT. Keep a real link available if async popup opening is blocked.
        try { window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer"); } catch { /* Use the visible fallback link. */ }
      } else {
        status.textContent = t("quiz.imageCopied");
        showToast(t("quiz.imageCopied"));
      }
    } catch {
      try {
        preparedBlob = await imagePromise;
        downloadButton.hidden = false;
        chatLink.hidden = !openChatGPT;
        status.textContent = t("quiz.copyImageFallback");
      } catch {
        status.textContent = t("quiz.captureImageError");
      }
    } finally {
      if (button.isConnected && askButton.isConnected) {
        button.disabled = false;
        askButton.disabled = false;
        promptButton.disabled = false;
        button.textContent = `▣ ${t("quiz.copyForChatGPT")}`;
        askButton.textContent = `${t("quiz.askChatGPT")} ↗`;
      }
    }
  };
  button.addEventListener("click", () => { void copyImage(); });
  askButton.addEventListener("click", () => { void copyImage(true); });
  promptButton.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Text clipboard unavailable");
      await navigator.clipboard.writeText(promptText.value);
      promptFallback.hidden = true;
      status.textContent = t("quiz.promptCopied");
      showToast(t("quiz.promptCopied"));
    } catch {
      promptFallback.hidden = false;
      status.textContent = t("quiz.copyPromptManually");
      promptText.focus();
      promptText.select();
    }
  });
  downloadButton.addEventListener("click", () => {
    if (!preparedBlob) return;
    const url = URL.createObjectURL(preparedBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `roadready-question-${question.sourceId}-${language}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

async function setQuestionLanguage(language) {
  if (!["en", "ru", "pt"].includes(language)) return;
  if (language === "ru") {
    showToast(t("quiz.russianLoading"));
    try { await ensureRussianCorpus(); }
    catch { showToast(t("quiz.russianLoadError")); return; }
  }
  profile.language = language;
  setSessionLanguage(language);
  saveProfile();
  renderQuestion();
}

function setSessionLanguage(language) {
  if (!session) return;
  if (session.mode === "exam" && !session.result && session.questionLanguage !== language) session.languageChanged = true;
  session.questionLanguage = language;
}

function chooseAnswer(key) {
  if (!selectSessionAnswer(session, key)) return;
  const answer = checkSessionAnswer(session);
  if (session.mode !== "exam") recordQuestion(session.questions[session.index], answer.correct);
  renderQuestion();
  const feedback = $("#answerFeedback");
  feedback.focus({ preventScroll: true });
  feedback.scrollIntoView({ block: "nearest", behavior: "instant" });
}

function navigateQuestion(index) {
  if (!moveToQuestion(session, index)) return;
  session.navigationExpanded = false;
  renderQuestion();
  scrollQuizIntoView();
  const heading = $(".question-intro h1");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function advanceQuiz() {
  if (!session || session.result || !session.selected) return;
  if (!session.checked) { chooseAnswer(session.selected); return; }
  if (session.index >= session.questions.length - 1) {
    const unanswered = firstUnansweredIndex(session);
    if (unanswered !== -1) navigateQuestion(unanswered);
    else finishSession();
    return;
  }
  navigateQuestion(session.index + 1);
}

function recordQuestion(question, isCorrect) {
  const now = new Date();
  const current = profile.questionProgress[question.id] || { correct: 0, wrong: 0, streak: 0 };
  const streak = isCorrect ? (current.streak || 0) + 1 : 0;
  const intervals = [1, 3, 7, 14, 30];
  const days = isCorrect ? intervals[Math.min(streak - 1, intervals.length - 1)] : 0;
  const nextReview = new Date(now.getTime() + days * 86400000).toISOString();
  const firstSeen = (current.correct || 0) + (current.wrong || 0) === 0 ? { firstSeenAt: now.toISOString() } : {};
  profile.questionProgress[question.id] = { ...incrementAnswerCounts(current, isCorrect, deviceId), ...firstSeen, streak, lastAnswer: now.toISOString(), nextReview };
  recordStudyActivity(profile, deviceId, now);
  saveProfile();
}

function finishSession() {
  if (!session || session.result) return;
  clearInterval(timerId);
  if (session.mode === "exam") session.questions.forEach((q, index) => recordQuestion(q, session.answers[index]?.correct || false));
  const correct = session.answers.filter((answer) => answer?.correct).length;
  const total = session.questions.length;
  const result = {
    id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    mode: session.mode,
    correct,
    total,
    percent: Math.round((correct / total) * 100),
    completedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - session.startedAt) / 1000),
    activityRecorded: true,
    language: session.questionLanguage,
    languageChanged: Boolean(session.languageChanged),
  };
  profile.sessions = [...profile.sessions, result].slice(-100);
  const finished = session;
  session = { ...session, result };
  saveProfile();
  renderResult(finished, result);
  if (modal.hidden) {
    const heading = $(".result-card h1");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start", behavior: "instant" });
  }
}

function renderResult(finished, result) {
  const errors = result.total - result.correct;
  const errorLabel = t(profile.uiLanguage === "ru" ? russianPluralKey(errors, "result.errors") : errors === 1 ? "result.errors.one" : "result.errors");
  const passed = finished.mode === "exam" ? errors <= 3 : result.percent >= 80;
  const missed = finished.questions.map((question, index) => ({ question, answer: finished.answers[index] })).filter(({ answer }) => !answer?.correct);
  const language = finished.questionLanguage || profile.language || "en";
  const review = missed.length ? `<section class="result-review"><div class="section-heading"><div><h2>${t("result.review")}</h2><p>${t("result.reviewHelp")}</p></div></div>${missed.map(({ question, answer }) => renderReviewItem(question, answer, language)).join("")}</section>` : "";
  const summary = finished.mode === "exam"
    ? passed ? t("result.examPassed") : t("result.examFailed", { count: formatNumber(errors) })
    : t("result.practiceHelp");
  const next = nextPlanMode();
  main.innerHTML = `<div class="page"><article class="card result-card"><span class="eyebrow">${finished.mode === "exam" ? t("result.mockComplete") : t("result.practiceComplete")}</span><div class="result-orb">${formatNumber(result.correct)}/${formatNumber(result.total)}</div><h1>${passed ? t("result.strong") : t("result.useful")}</h1><p>${summary}</p><div class="result-stats"><div><strong>${result.percent}%</strong><span>${t("result.accuracy")}</span></div><div><strong>${formatNumber(errors)}</strong><span>${errorLabel}</span></div><div><strong>${formatMinuteCount(Math.ceil(result.durationSeconds / 60))}</strong><span>${t("result.time")}</span></div></div><div class="result-actions"><button class="button button-secondary" id="resultHome">${t("result.dashboard")}</button><button class="button button-primary" id="resultAgain">${t("result.again")}</button>${next ? `<button class="button button-accent" data-start="${next}">${t(`plan.start.${next}`)} →</button>` : ""}</div></article>${review}</div>`;
  $("#resultHome").addEventListener("click", () => { session = null; location.hash = "dashboard"; });
  $("#resultAgain").addEventListener("click", () => startSession(finished.mode, finished.topic));
  bindStartButtons();
  $$(".review-image img").forEach((image) => image.addEventListener("error", () => {
    if (!image.dataset.remoteFallback) { image.dataset.remoteFallback = "true"; image.src = image.dataset.remoteImage; }
  }));
}

function renderReviewItem(question, answer, language) {
  const answerText = (key) => {
    const option = question.answers.find((item) => item.key === key);
    return option ? `${key} · ${option[language] || option.en || option.pt}` : t("result.noAnswer");
  };
  const id = question.sourceId || question.id;
  const image = question.image
    ? `<a class="review-image" href="${escapeHtml(question.image)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(t("quiz.openImage", { id }))}"><img src="${escapeHtml(getQuestionImagePath(question))}" data-remote-image="${escapeHtml(question.image)}" alt="${escapeHtml(t("quiz.imageAlt", { id }))}" loading="lazy" referrerpolicy="no-referrer" /></a>`
    : `<div class="review-image-placeholder">${t("quiz.textOnly")}</div>`;
  return `<article class="card review-item">${image}<div class="review-copy"><a class="text-link" href="${escapeHtml(question.sourceUrl)}" target="_blank" rel="noopener noreferrer">${t("quiz.source", { id })}</a><h3>${escapeHtml(question.text?.[language] || question.text.en || question.text.pt)}</h3>${questionVerificationMarkup(question, true)}<dl class="review-answers"><div><dt>${t("result.yourAnswer")}</dt><dd>${escapeHtml(answerText(answer?.pick))}</dd></div><div><dt>${t("result.studyAnswer")}</dt><dd>${escapeHtml(answerText(question.correct))}</dd></div></dl><p>${escapeHtml(question.explanation?.[language] || question.explanation?.[profile.uiLanguage] || question.explanation?.en || t("result.correctFallback", { answer: question.correct }))}</p>${explanationSourceLink(question)}</div></article>`;
}

function startTimer() {
  clearInterval(timerId);
  const tick = () => {
    session.elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
    const timer = $("#timer");
    if (timer) timer.textContent = formatTime(session.elapsedSeconds);
  };
  tick();
  if (!session.result) timerId = setInterval(tick, 1000);
}
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

function renderProgress() {
  const s = getStats();
  const plan = studyPlan();
  const last7 = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    return { label: new Intl.DateTimeFormat(currentLocale(), { weekday: "short" }).format(date), count: answersOnDay(profile, date) };
  });
  const max = Math.max(20, ...last7.map((day) => day.count));
  const topicStats = Object.entries(TOPIC_NAMES).map(([pt, names]) => {
    const topicQuestions = questions.filter((q) => q.topic === pt);
    const seen = topicQuestions.filter((q) => profile.questionProgress[q.id]).length;
    const correct = topicQuestions.reduce((sum, question) => sum + (profile.questionProgress[question.id]?.correct || 0), 0);
    const wrong = topicQuestions.reduce((sum, question) => sum + (profile.questionProgress[question.id]?.wrong || 0), 0);
    const coverage = topicQuestions.length ? seen / topicQuestions.length : 0;
    return { topic: pt, name: names[profile.uiLanguage] || names.en, seen, total: topicQuestions.length, coverage, percent: Math.round(coverage * 100), attempts: correct + wrong, accuracy: correct + wrong ? Math.round(correct / (correct + wrong) * 100) : 0 };
  }).sort((a, b) => (topicOrder === "coverage" ? b.coverage - a.coverage : a.coverage - b.coverage || a.accuracy - b.accuracy)
    || a.name.localeCompare(b.name, currentLocale()));
  main.innerHTML = `<div class="page"><header class="page-header"><div><span class="eyebrow">${t("progress.eyebrow")}</span><h1>${t("progress.title")}</h1><p>${t("progress.subtitle")}</p></div><span class="date-chip">${t("progress.seen", { questions: formatQuestionCount(s.seen) })}</span></header><section class="stat-grid"><article class="card stat-card"><span>${t("plan.studyTargets")}</span><strong>${plan.readiness.met}/4</strong><small>${t(plan.readiness.ready ? "plan.targetsMet" : "plan.targetsPending")}</small></article><article class="card stat-card"><span>${t("progress.coverage")}</span><strong>${Math.round(s.coverage)}%</strong><small>${formatNumber(s.seen)}/${formatNumber(questions.length)}</small></article><article class="card stat-card"><span>${t("progress.accuracy")}</span><strong>${s.accuracy}%</strong><small>${t("progress.target90")}</small></article><article class="card stat-card"><span>${t("progress.mockAverage")}</span><strong>${s.mock}%</strong><small>${t("plan.recentMocks", { language: planLanguage(plan) })}</small></article></section>${readinessMarkup(plan)}<div class="section-heading"><h2>${t("progress.activity")}</h2></div><section class="progress-layout"><article class="card chart-card"><h3>${t("progress.answered")}</h3><p>${t("progress.lastSeven")}</p><div class="bar-chart">${last7.map((day, i) => `<div class="bar ${i === 6 ? "active" : ""}" style="--height:${Math.max(3, (day.count / max) * 100)}%" role="img" aria-label="${escapeHtml(day.label)}: ${formatQuestionCount(day.count)}"><span>${day.label}</span></div>`).join("")}</div></article><article class="card coverage-card"><h3>${t("progress.syllabus")}</h3><p>${t(topicOrder === "coverage" ? "progress.topicsCoveredFirst" : "progress.topicsFirst")}</p><label class="topic-sort" for="topicOrder">${t("progress.topicOrder")}<select id="topicOrder"><option value="weakest" ${topicOrder === "weakest" ? "selected" : ""}>${t("progress.weakestFirst")}</option><option value="coverage" ${topicOrder === "coverage" ? "selected" : ""}>${t("progress.coveredFirst")}</option></select></label><div class="topic-list">${topicStats.map((topic) => `<div class="topic-row"><strong><button class="topic-practice" data-topic="${escapeHtml(topic.topic)}">${escapeHtml(topic.name)} ↗</button></strong><span>${formatNumber(topic.seen)}/${formatNumber(topic.total)}</span><small>${topic.attempts ? t("progress.topicAccuracy", { percent: formatNumber(topic.accuracy) }) : t("progress.notPracticed")}</small><div class="meter" style="--value:${topic.percent}%"><span></span></div></div>`).join("")}</div></article></section></div>`;
  bindStartButtons();
  $("#topicOrder").addEventListener("change", (event) => {
    topicOrder = event.target.value;
    renderProgress();
    if (modal.hidden) $("#topicOrder").focus({ preventScroll: true });
  });
}

function renderSources() {
  const base = "https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents";
  const date = verificationAudit ? new Date(verificationAudit.auditedAt).toLocaleDateString(currentLocale()) : "";
  const summary = verificationAudit?.summary;
  const comparison = summary ? `<section class="card verification-report" aria-labelledby="verificationReportTitle"><h2 id="verificationReportTitle">${t("verification.reportTitle")}</h2><p>${t("verification.reportScope")}</p><div class="verification-totals">${[
    ["matched", summary.matched], ["text-only", summary.textOnly], ["differences", summary.differences], ["not-found", summary.notFound],
  ].map(([status, count]) => `<div><strong>${formatNumber(count)}</strong><span>${t(`verification.${status}.label`)}</span></div>`).join("")}</div><p>${t("verification.pdfTotals", { entries: formatNumber(summary.pdfEntries), unmatched: formatNumber(summary.pdfEntriesWithoutMatch) })}</p><p>${t("verification.categoryScope")}</p><p>${t("verification.answerScope")}</p><div class="verification-downloads"><a class="text-link" href="documentation/data/imt-app-comparison.csv" download>${t("verification.downloadApp")}</a><a class="text-link" href="documentation/data/imt-pdf-comparison.csv" download>${t("verification.downloadPdf")}</a></div></section>` : `<div class="notice">${t("verification.unavailable.description")}</div>`;
  main.innerHTML = `<div class="page"><header class="page-header"><div><span class="eyebrow">${t("sources.eyebrow")}</span><h1>${t("sources.title")}</h1><p>${t("sources.subtitle")}</p></div><span class="date-chip">${date ? t("sources.updated", { date }) : t("verification.unavailable.label")}</span></header>${comparison}<div class="notice"><strong>${t("sources.keyTitle")}</strong> ${t("sources.keyNotice")}<br><strong>${t("sources.translationTitle")}</strong> ${t("sources.translationNotice")}</div><div class="section-heading"><div><h2>${t("sources.groups")}</h2><p>${t("sources.groupsDescription")}</p></div><a class="text-link" href="https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/" target="_blank" rel="noopener">${t("sources.openIndex")}</a></div><section class="source-grid">${Array.from({ length: 14 }, (_, i) => `<a class="card source-card" href="${escapeHtml(verificationAudit?.sources.get(i + 1)?.url || `${base}/rel_${i + 1}_condutores.pdf`)}" target="_blank" rel="noopener"><span class="pdf-icon">PDF</span><span><strong>${t("sources.group", { number: formatNumber(i + 1) })}</strong><span>${t("sources.original")}</span></span></a>`).join("")}</section><div class="section-heading"><div><h2>${t("sources.dataNotes")}</h2><p>${t("sources.dataDescription")}</p></div></div><section class="stat-grid"><article class="card stat-card"><span>${t("sources.bank")}</span><strong>${formatNumber(questions.length)}</strong><small>${t("sources.publicQuestions")}</small></article><article class="card stat-card"><span>${t("sources.topics")}</span><strong>${formatNumber(new Set(questions.map((q) => q.topic)).size)}</strong><small>${t("sources.syllabusAreas")}</small></article><article class="card stat-card"><span>${t("sources.languages")}</span><strong>${t("sources.languageValue")}</strong><small>${t("sources.toggleHelp")}</small></article><article class="card stat-card"><span>${t("sources.lastImport")}</span><strong>${corpusMeta.generatedAt ? new Date(corpusMeta.generatedAt).toLocaleDateString(currentLocale()) : "—"}</strong><small>${t("sources.localCorpus")}</small></article></section></div>`;
}

function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600); }

document.addEventListener("keydown", (event) => {
  if (!modal.hidden) { handleSettingsKey(event); return; }
  if (!session || session.result || location.hash !== "#quiz") return;
  if (event.target.closest("input, textarea, select, [contenteditable]")) return;
  if (["1", "2", "3", "4"].includes(event.key)) {
    const q = session.questions[session.index];
    const answer = q.answers[Number(event.key) - 1];
    if (answer) { event.preventDefault(); chooseAnswer(answer.key); }
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    navigateQuestion(session.index + (event.key === "ArrowLeft" ? -1 : 1));
  } else if (event.key === "Enter" && session.selected && (event.target.closest("[data-answer]") || !event.target.closest("button, a"))) {
    event.preventDefault();
    advanceQuiz();
  }
});

window.addEventListener("hashchange", render);
window.addEventListener("beforeunload", (event) => {
  if (!session || session.result) return;
  event.preventDefault();
  event.returnValue = "";
});

const modal = $("#settingsModal");
async function setUILanguage(language) {
  const normalized = normalizeLanguage(language);
  profile.uiLanguage = normalized;
  if (normalized !== "ru") {
    profile.language = normalized;
    setSessionLanguage(normalized);
  }
  saveProfile();
  applyStaticTranslations();
  updateSyncUI();
  updateStorageSummary();
  render();
  if (normalized === "ru") {
    showToast(t("quiz.russianLoading"));
    try { await ensureRussianCorpus(); }
    catch { showToast(t("quiz.russianLoadError")); return; }
    if (profile.uiLanguage !== "ru") return;
    profile.language = "ru";
    setSessionLanguage("ru");
    saveProfile();
    updateStorageSummary();
    render();
  }
}

let settingsOpener = null;
function openSettings(event) {
  settingsOpener = event?.currentTarget || document.activeElement;
  updateStorageSummary();
  updateExamPlanForm(true);
  updateSyncUI();
  $("#storageStatus").textContent = "";
  modal.hidden = false;
  $("#app").inert = true;
  document.body.classList.add("settings-open");
  $("#closeSettings").focus();
}
function closeSettings() {
  modal.hidden = true;
  $("#app").inert = false;
  document.body.classList.remove("settings-open");
  (settingsOpener?.isConnected ? settingsOpener : main).focus({ preventScroll: true });
}
function handleSettingsKey(event) {
  if (event.key === "Escape") { event.preventDefault(); closeSettings(); return; }
  if (event.key !== "Tab") return;
  const controls = $$("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']", modal)
    .filter((element) => element.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (!first) { event.preventDefault(); $(".modal", modal).focus(); return; }
  if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
}
$("#openSettings").addEventListener("click", openSettings);
$("#mobileSettings").addEventListener("click", openSettings);
$("#closeSettings").addEventListener("click", closeSettings);
modal.addEventListener("click", (event) => { if (event.target === modal) closeSettings(); });
document.addEventListener("focusin", (event) => {
  if (!modal.hidden && !modal.contains(event.target)) $("#closeSettings").focus();
});

function updateStorageSummary() {
  if (!$("#storageSummary")) return;
  const stats = getStats();
  $("#storageSummary").textContent = t("storage.summary", { questions: formatQuestionCount(stats.seen), sessions: formatSessionCount(profile.sessions.length) });
  $("#lastSaved").textContent = profile.updatedAt ? new Date(profile.updatedAt).toLocaleString(currentLocale(), { dateStyle: "medium", timeStyle: "short" }) : t("storage.notSaved");
  updateExamPlanForm();
}

function updateExamPlanForm(force = false) {
  const form = $("#examPlanForm");
  if (!force && form?.contains?.(document.activeElement)) return;
  const config = profile.examPlan || suggestedExamPlan;
  $("#examDate").value = config.examDate;
  $("#examLanguage").value = config.language;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $("#examDate").min = createExamPlan(tomorrow).startedOn;
}

$("#examPlanForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const status = $("#examPlanStatus");
  const today = createExamPlan().startedOn;
  const config = { ...(profile.examPlan || suggestedExamPlan), examDate: $("#examDate").value, language: $("#examLanguage").value };
  if (config.startedOn > today) config.startedOn = today;
  if (!validExamPlan(config) || config.examDate <= today) { status.textContent = t("plan.invalidDate"); return; }
  const candidate = { ...profile, examPlan: config, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(candidate)); }
  catch { status.textContent = t("plan.saveError"); return; }
  profile = candidate;
  syncController?.schedule();
  updateExamPlanForm(true);
  updateStorageSummary();
  render();
  status.textContent = t("plan.saved");
});

function updateSyncUI(nextState = syncState) {
  syncState = { ...syncState, ...nextState };
  const linked = Boolean(syncState.configured && syncState.hasSyncKey);
  const statusTitles = {
    unconfigured: "sync.unconfiguredTitle",
    local: "sync.localTitle",
    connecting: "sync.connectingTitle",
    syncing: "sync.syncingTitle",
    pending: "sync.pendingTitle",
    synced: "sync.syncedTitle",
    offline: "sync.offlineTitle",
    error: "sync.errorTitle",
  };
  const title = t(statusTitles[syncState.status] || "sync.localTitle");
  const detail = t(syncState.messageKey || "sync.localReady", syncState.messageArgs);

  $("#syncLabel").textContent = title;
  $("#cloudSyncTitle").textContent = title;
  $("#cloudSyncDetail").textContent = detail;
  $("#syncDot").dataset.status = syncState.status;
  $("#syncNow").disabled = !linked || syncState.status === "syncing";
  $("#linkDevice").disabled = !syncState.hasSyncKey;
  $("#shareDeviceLink").hidden = typeof navigator.share !== "function";
  if (!$("#deviceLinkPanel").hidden) $("#deviceLink").value = syncController?.getDeviceLink() || "";
  $("#syncStatus").textContent = syncState.status === "unconfigured"
    ? t("sync.setupHelp")
    : syncState.status === "error" ? detail : "";
  $("#resetData").textContent = linked ? t("settings.eraseSynced") : t("settings.eraseLocal");
}

$("#linkDevice").addEventListener("click", () => {
  $("#deviceLinkPanel").hidden = !$("#deviceLinkPanel").hidden;
  $("#deviceLink").value = syncController.getDeviceLink();
});

$("#copyDeviceLink").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(syncController.getDeviceLink());
    showToast(t("sync.linkCopied"));
  } catch {
    $("#deviceLink").focus();
    $("#deviceLink").select();
    $("#syncStatus").textContent = t("sync.copyManually");
  }
});

$("#shareDeviceLink").addEventListener("click", async () => {
  try { await navigator.share({ title: "RoadReady Portugal", text: t("sync.shareLinkPrompt"), url: syncController.getDeviceLink() }); }
  catch (error) { if (error.name !== "AbortError") $("#syncStatus").textContent = t("sync.copyManually"); }
});

$("#syncNow").addEventListener("click", async () => {
  $("#syncNow").disabled = true;
  await syncController?.syncNow();
  updateSyncUI(syncController?.getState());
});

$("#exportData").addEventListener("click", () => {
  const backup = { app: "RoadReady Portugal", version: 2, exportedAt: new Date().toISOString(), profile, syncKey: syncController?.getSyncKey() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `roadready-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  $("#storageStatus").textContent = t("storage.backupDownloaded");
});

$("#importData").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const status = $("#storageStatus");
  let committed = false;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new InvalidStudyProfileError();
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new InvalidStudyProfileError();
    const candidate = normaliseProfile(parsed.profile === undefined ? parsed : parsed.profile);
    if (parsed.syncKey !== undefined && !isValidSyncKey(parsed.syncKey)) throw new InvalidStudyProfileError();
    if (candidate.uiLanguage === "ru" || candidate.language === "ru") await ensureRussianCorpus();
    candidate.updatedAt = new Date().toISOString();
    // setItem is atomic. Validate/load everything first and commit to memory
    // only once storage accepts the candidate, leaving the old profile intact
    // on invalid data, translation failures or a full localStorage quota.
    localStorage.setItem(PROFILE_KEY, JSON.stringify(candidate));
    profile = candidate;
    committed = true;
    applyStaticTranslations();
    updateStorageSummary();
    render();
    status.textContent = t("storage.restoreSuccess");
    if (parsed.syncKey) await syncController.connect(parsed.syncKey);
    else syncController?.schedule();
  } catch (error) {
    status.textContent = t(committed ? "storage.restoreLocal" : error instanceof InvalidStudyProfileError ? "storage.invalidBackup" : "storage.restoreError");
  } finally {
    event.target.value = "";
  }
});

$("#resetData").addEventListener("click", async () => {
  const isSynced = Boolean(syncState.configured && syncState.hasSyncKey);
  const prompt = isSynced ? t("storage.eraseSyncedConfirm") : t("storage.eraseLocalConfirm");
  if (!confirm(prompt)) return;
  const preferences = { uiLanguage: profile.uiLanguage, language: profile.language, examPlan: profile.examPlan || suggestedExamPlan };
  localStorage.removeItem(PROFILE_KEY);
  profile = { ...defaultProfile(), ...preferences, resetAt: new Date().toISOString() };
  saveProfile();
  const cloudErased = isSynced && await syncController?.syncNow();
  session = null;
  render();
  closeSettings();
  showToast(isSynced ? t(cloudErased ? "storage.erasedSynced" : "storage.eraseQueued") : t("storage.erasedLocal"));
});

main.innerHTML = `<div class="page"><div class="skeleton" style="height:44px;width:310px;margin-bottom:30px"></div><div class="hero-grid"><div class="skeleton" style="height:278px"></div><div class="skeleton" style="height:278px"></div></div></div>`;
applyStaticTranslations();
await loadCorpus();
$$('[data-ui-lang]').forEach((button) => button.addEventListener("click", () => { void setUILanguage(button.dataset.uiLang); }));
render();
if (recoveredStoredProfile) showToast(t("storage.recoveredProfile"));
syncController = createSyncController({
  getProfile: () => profile,
  applyProfile: applySyncedProfile,
  onStateChange: updateSyncUI,
});
updateSyncUI(syncController.getState());
void syncController.initialize();
