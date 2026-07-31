import { createSyncController } from "./sync.js?v=20260731-1";
import { localeFor, normalizeLanguage, russianPluralKey, translate } from "./i18n.js?v=20260731-1";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const main = $("#mainContent");

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
  uiLanguage: "en",
  language: "en",
  questionProgress: {},
  sessions: [],
  streak: 1,
});
const PROFILE_KEY = "roadready-profile";

let profile = loadProfile();
let questions = [];
let corpusMeta = { count: 0, generatedAt: null };
let session = null;
let timerId = null;
let syncController = null;
let syncState = {
  configured: false,
  status: "local",
  user: null,
  lastSyncedAt: null,
  messageKey: "sync.signInShare",
};

function normaliseProfile(value = {}) {
  const language = ["en", "ru", "pt"].includes(value.language) ? value.language : "en";
  return {
    ...defaultProfile(),
    ...value,
    uiLanguage: normalizeLanguage(value.uiLanguage || (language === "ru" ? "ru" : "en")),
    language,
    questionProgress: { ...(value.questionProgress || {}) },
    sessions: Array.isArray(value.sessions) ? value.sessions.slice(-100) : [],
  };
}
function loadProfile() {
  try { return normaliseProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}")); }
  catch { return defaultProfile(); }
}
function saveProfile({ sync = true } = {}) {
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
const formatDayCount = (count) => profile.uiLanguage === "ru" ? t("unit.days", { count: formatNumber(count) }) : `${formatNumber(count)} day${count === 1 ? "" : "s"}`;
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
    const response = await fetch("public/data/questions-ru.json?v=20260731-1");
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
  for (const url of ["public/data/questions-en.json?v=20260731-1", "public/data/questions-pt.json?v=20260731-1"]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      questions = data.questions;
      corpusMeta = data;
      if (questions.length) {
        if (profile.uiLanguage === "ru" || profile.language === "ru") await ensureRussianCorpus();
        return;
      }
    } catch { /* try fallback */ }
  }
  questions = sampleQuestions;
  corpusMeta = { count: sampleQuestions.length, generatedAt: new Date().toISOString(), sample: true };
}

function getStats() {
  const entries = Object.values(profile.questionProgress);
  const seen = entries.length;
  const correct = entries.reduce((sum, item) => sum + (item.correct || 0), 0);
  const wrong = entries.reduce((sum, item) => sum + (item.wrong || 0), 0);
  const accuracy = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;
  const due = entries.filter((item) => !item.nextReview || new Date(item.nextReview) <= new Date()).length;
  const mistakes = entries.filter((item) => (item.wrong || 0) > (item.correct || 0)).length;
  const examSessions = profile.sessions.filter((item) => item.mode === "exam").slice(-5);
  const mock = examSessions.length ? examSessions.reduce((sum, item) => sum + item.percent, 0) / examSessions.length : 0;
  const coverage = questions.length ? (seen / questions.length) * 100 : 0;
  const readiness = Math.round(clamp(coverage * .35 + accuracy * .35 + mock * .3, seen ? 8 : 0, 100));
  const today = new Date().toDateString();
  const todayAnswered = profile.sessions.filter((item) => new Date(item.completedAt).toDateString() === today).reduce((sum, item) => sum + item.total, 0);
  return { seen, correct, wrong, accuracy, due, mistakes, readiness, coverage, mock: Math.round(mock), todayAnswered };
}

function setActiveRoute(route) {
  $$("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
}

function render() {
  let route = location.hash.replace("#", "") || "dashboard";
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
  else if (route === "quiz" && session) renderQuestion();
  else renderDashboard();
  main.focus({ preventScroll: true });
}

function renderDashboard() {
  const s = getStats();
  const dailyPercent = Math.round(clamp((s.todayAnswered / profile.dailyGoal) * 100, 0, 100));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboard.morning") : hour < 18 ? t("dashboard.afternoon") : t("dashboard.evening");
  main.innerHTML = `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">${t("dashboard.category")}</span><h1>${greeting}</h1><p>${t("dashboard.subtitle")}</p></div>
        <span class="date-chip">${formatDate()}</span>
      </header>
      <section class="hero-grid">
        <article class="card route-card">
          <div>
            <span class="eyebrow">${t("dashboard.todayRoute")}</span>
            <h2>${s.due ? t("dashboard.reviewFade") : t("dashboard.learnNew")}</h2>
            <p>${s.due ? t("dashboard.dueDescription", { count: formatQuestionCount(s.due) }) : t("dashboard.spacingDescription")}</p>
            <div class="route-meta"><span><strong>${formatQuestionCount(s.due || 15)}</strong></span><span><strong>≈ ${formatMinuteCount(Math.ceil((s.due || 15) * .7))}</strong></span><span><strong>${formatNumber(s.todayAnswered)}/${formatNumber(profile.dailyGoal)}</strong> ${t("dashboard.dailyGoal")}</span></div>
            <button class="button button-accent" data-start="${s.due ? "review" : "quick"}">${s.due ? t("dashboard.reviewNow") : t("dashboard.startToday")} →</button>
          </div>
          <div class="progress-ring" style="--progress:${dailyPercent}"><span>${dailyPercent}%<small>${t("dashboard.today")}</small></span></div>
        </article>
        <article class="card readiness-card">
          <span class="eyebrow" style="color:var(--lime)">${t("dashboard.readiness")}</span>
          <div class="readiness-score">${s.readiness}%</div>
          <div class="readiness-label">${s.readiness >= 85 ? t("dashboard.readyBook") : s.readiness >= 60 ? t("dashboard.gettingClose") : t("dashboard.building")}</div>
          <p>${s.readiness >= 85 ? t("dashboard.keepStable") : t("dashboard.readinessAim")}</p>
          <div class="meter" style="--value:${s.readiness}%"><span></span></div>
        </article>
      </section>

      <div class="section-heading"><div><h2>${t("dashboard.nextMoves")}</h2><p>${t("dashboard.nextMovesDescription")}</p></div><a class="text-link" href="#practice">${t("dashboard.allModes")}</a></div>
      <section class="task-grid">
        <article class="task-card"><div class="task-top"><span class="task-icon">01</span><span class="mode-kicker">${t("dashboard.learn")}</span></div><h3>${t("dashboard.newQuestions")}</h3><p>${t("dashboard.newQuestionsDescription")}</p><button data-start="quick">${t("dashboard.startQuick")}</button></article>
        <article class="task-card"><div class="task-top"><span class="task-icon">↻</span><span class="mode-kicker">${t("dashboard.recall")}</span></div><h3>${t("dashboard.dueForReview", { count: formatNumber(s.due) })}</h3><p>${t("dashboard.intervals")}</p><button data-start="review">${t("dashboard.reviewDue")}</button></article>
        <article class="task-card"><div class="task-top"><span class="task-icon">30</span><span class="mode-kicker">${t("dashboard.simulate")}</span></div><h3>${t("dashboard.officialMock")}</h3><p>${t("dashboard.mockDescription")}</p><button data-start="exam">${t("dashboard.startMock")}</button></article>
      </section>

      <div class="section-heading"><h2>${t("dashboard.glance")}</h2><a class="text-link" href="#progress">${t("dashboard.detailedProgress")}</a></div>
      <section class="stat-grid">
        <article class="card stat-card"><span>${t("dashboard.questionsSeen")}</span><strong>${formatNumber(s.seen)}</strong><small>${t("unit.of", { count: formatNumber(questions.length) })}</small></article>
        <article class="card stat-card"><span>${t("dashboard.accuracy")}</span><strong>${s.accuracy}%</strong><small>${t("unit.attempts", { count: formatNumber(s.correct + s.wrong) })}</small></article>
        <article class="card stat-card"><span>${t("dashboard.mistakes")}</span><strong>${formatNumber(s.mistakes)}</strong><small>${t("dashboard.mistakesHelp")}</small></article>
        <article class="card stat-card"><span>${t("dashboard.streak")}</span><strong>${formatDayCount(profile.streak)}</strong><small>${t("dashboard.streakHelp")}</small></article>
      </section>
    </div>`;
  bindStartButtons();
}

function renderPractice() {
  const s = getStats();
  main.innerHTML = `
    <div class="page">
      <header class="page-header"><div><span class="eyebrow">${t("practice.eyebrow")}</span><h1>${t("practice.title")}</h1><p>${t("practice.subtitle")}</p></div><span class="date-chip">${t("practice.loaded", { count: formatNumber(questions.length) })}</span></header>
      <section class="mode-grid">
        <article class="card mode-card featured"><span class="mode-badge">${t("practice.recommended")}</span><span class="mode-kicker">${t("practice.quickMeta")}</span><h3>${t("practice.quickTitle")}</h3><p>${t("practice.quickDescription")}</p><button class="button button-accent" data-start="quick">${t("practice.start")}</button></article>
        <article class="card mode-card"><span class="mode-badge">${t("practice.available", { count: formatNumber(s.due) })}</span><span class="mode-kicker">${t("practice.spaced")}</span><h3>${t("practice.dueTitle")}</h3><p>${t("practice.dueDescription")}</p><button class="button button-primary" data-start="review">${t("dashboard.reviewDue")}</button></article>
        <article class="card mode-card"><span class="mode-badge">${t("practice.weakSpots", { count: formatNumber(s.mistakes) })}</span><span class="mode-kicker">${t("practice.repair")}</span><h3>${t("practice.clinic")}</h3><p>${t("practice.clinicDescription")}</p><button class="button button-secondary" data-start="mistakes">${t("practice.fix")}</button></article>
        <article class="card mode-card"><span class="mode-badge">${t("practice.pass")}</span><span class="mode-kicker">${t("practice.examMeta")}</span><h3>${t("practice.mockTitle")}</h3><p>${t("practice.mockFullDescription")}</p><button class="button button-primary" data-start="exam">${t("practice.startTimed")}</button></article>
      </section>
      <div class="section-heading"><div><h2>${t("practice.strategy")}</h2><p>${t("practice.strategyDescription")}</p></div></div>
      <section class="study-plan">
        <article class="plan-row"><span class="plan-day">${t("practice.phase1")}</span><div><h3>${t("practice.coverageTitle")}</h3><p>${t("practice.coverageDescription")}</p></div><span class="plan-status">${t("practice.minutesDay")}</span></article>
        <article class="plan-row"><span class="plan-day">${t("practice.phase2")}</span><div><h3>${t("practice.recallTitle")}</h3><p>${t("practice.recallDescription")}</p></div><span class="plan-status">${t("practice.dueFirst")}</span></article>
        <article class="plan-row"><span class="plan-day">${t("practice.phase3")}</span><div><h3>${t("practice.pressureTitle")}</h3><p>${t("practice.pressureDescription")}</p></div><span class="plan-status">${t("practice.target")}</span></article>
      </section>
    </div>`;
  bindStartButtons();
}

function selectForMode(mode) {
  const now = new Date();
  if (mode === "review") {
    const due = questions.filter((q) => { const p = profile.questionProgress[q.id]; return p && (!p.nextReview || new Date(p.nextReview) <= now); });
    return shuffle(due.length ? due : questions.filter((q) => profile.questionProgress[q.id])).slice(0, 20);
  }
  if (mode === "mistakes") {
    const missed = questions.filter((q) => { const p = profile.questionProgress[q.id]; return p && (p.wrong || 0) > (p.correct || 0); });
    return shuffle(missed.length ? missed : questions.filter((q) => profile.questionProgress[q.id]?.wrong)).slice(0, 20);
  }
  if (mode === "exam") return shuffle(questions).slice(0, Math.min(30, questions.length));
  const unseen = shuffle(questions.filter((q) => !profile.questionProgress[q.id]));
  const seen = shuffle(questions.filter((q) => profile.questionProgress[q.id]));
  return [...unseen, ...seen].slice(0, Math.min(10, questions.length));
}

function startSession(mode) {
  const selected = selectForMode(mode);
  if (!selected.length) { showToast(mode === "review" ? t("practice.nothingDue") : t("practice.answerFirst")); return; }
  session = { mode, questions: selected, index: 0, answers: [], selected: null, checked: false, startedAt: Date.now(), remaining: mode === "exam" ? 30 * 60 : null, questionLanguage: profile.language };
  location.hash = "quiz";
  renderQuestion();
}

function bindStartButtons() { $$('[data-start]').forEach((button) => button.addEventListener("click", () => startSession(button.dataset.start))); }

function renderQuestion() {
  if (!session) { location.hash = "practice"; return; }
  const q = session.questions[session.index];
  const language = session.questionLanguage || profile.language || "en";
  const progress = (session.index / session.questions.length) * 100;
  const answerState = session.answers[session.index];
  const title = q.text?.[language] || q.text?.en || q.text?.pt;
  const correctAnswer = q.answers.find((answer) => answer.key === q.correct)?.[language] || q.answers.find((answer) => answer.key === q.correct)?.en || q.correct;
  const explanation = q.explanation?.[language] || q.explanation?.[profile.uiLanguage] || q.explanation?.en || t("quiz.correctAnswer", { answer: correctAnswer });
  const image = q.image ? `<a class="question-image-link" href="${escapeHtml(q.image)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t("quiz.openImage", { id: q.sourceId }))}"><img src="${escapeHtml(q.image)}" alt="${escapeHtml(t("quiz.imageAlt", { id: q.sourceId }))}" referrerpolicy="no-referrer" /></a>` : `<div class="image-fallback"><strong>${t("quiz.textOnly")}</strong><br><br>${t("quiz.imageNotRequired")}</div>`;
  main.innerHTML = `
    <div class="page question-page">
      <div class="quiz-topbar"><button class="icon-button" id="exitQuiz" aria-label="${t("quiz.exit")}">×</button><div class="quiz-progress" style="--value:${progress}%"><span></span></div><span class="quiz-counter">${session.mode === "exam" ? `<b id="timer">${formatTime(session.remaining)}</b> · ` : ""}${t("quiz.counter", { current: formatNumber(session.index + 1), total: formatNumber(session.questions.length) })}</span></div>
      <article class="card question-card">
        <div class="question-visual"><div class="question-image-frame">${image}</div><div class="image-links"><a class="source-pill" href="${escapeHtml(q.sourceUrl)}" target="_blank" rel="noopener">${t("quiz.source", { id: escapeHtml(q.sourceId) })}</a>${q.image ? `<a class="full-image-link" href="${escapeHtml(q.image)}" target="_blank" rel="noopener">${t("quiz.fullImage")}</a>` : ""}</div></div>
        <div class="question-body">
          <div class="question-tools"><span class="question-topic">${escapeHtml(topicName(q.topic, language))}</span><div class="language-toggle" role="group" aria-label="${t("aria.questionLanguage")}"><button class="${language === "en" ? "active" : ""}" data-lang="en" aria-pressed="${language === "en"}">EN</button><button class="${language === "ru" ? "active" : ""}" data-lang="ru" aria-pressed="${language === "ru"}">RU</button><button class="${language === "pt" ? "active" : ""}" data-lang="pt" aria-pressed="${language === "pt"}">PT</button></div></div>
          <h1>${escapeHtml(title)}</h1>
          <div class="answers">${q.answers.map((answer, i) => {
            const selected = session.selected === answer.key || answerState?.pick === answer.key;
            const checked = session.checked && session.mode !== "exam";
            const status = checked && answer.key === q.correct ? "correct" : checked && selected && answer.key !== q.correct ? "wrong" : selected ? "selected" : "";
            const marker = checked && answer.key === q.correct ? "✓" : checked && selected ? "×" : "";
            return `<button class="answer-option ${status}" data-answer="${answer.key}" aria-pressed="${selected}" ${checked ? "disabled" : ""}><span class="answer-key">${i + 1}</span><span>${escapeHtml(answer[language] || answer.en || answer.pt)}</span><span class="answer-marker">${marker}</span></button>`;
          }).join("")}</div>
          ${session.checked && session.mode !== "exam" ? `<div class="feedback ${session.selected === q.correct ? "" : "incorrect"}"><div class="feedback-heading"><span>${session.selected === q.correct ? "✓" : "!"}</span><strong>${session.selected === q.correct ? t("quiz.correct") : t("quiz.studyKey", { answer: q.correct })}</strong></div><p>${escapeHtml(explanation)}</p><small>${session.selected === q.correct ? t("quiz.returnLater") : t("quiz.returnSooner")}</small></div>` : ""}
          <div class="quiz-actions"><span class="quiz-hint">${t("quiz.keyboardHint")}</span><button class="button ${session.checked ? "button-primary" : "button-accent"}" id="quizPrimary" ${session.selected ? "" : "disabled"}>${session.mode === "exam" ? (session.index === session.questions.length - 1 ? t("quiz.finishExam") : t("quiz.next")) : session.checked ? (session.index === session.questions.length - 1 ? t("quiz.results") : t("quiz.continue")) : t("quiz.check")} →</button></div>
        </div>
      </article>
    </div>`;
  $("#exitQuiz").addEventListener("click", () => { if (confirm(t("quiz.leaveConfirm"))) location.hash = "practice"; });
  $$('[data-lang]').forEach((button) => button.addEventListener("click", () => { void setQuestionLanguage(button.dataset.lang); }));
  $$("[data-answer]").forEach((button) => button.addEventListener("click", () => chooseAnswer(button.dataset.answer)));
  $("#quizPrimary").addEventListener("click", advanceQuiz);
  const img = $(".question-visual img");
  if (img) img.addEventListener("error", () => { img.replaceWith(Object.assign(document.createElement("div"), { className: "image-fallback", innerHTML: `<strong>${t("quiz.imageUnavailable")}</strong><br><br>${t("quiz.openSource")}` })); });
  if (session.mode === "exam") startTimer();
}

async function setQuestionLanguage(language) {
  if (!["en", "ru", "pt"].includes(language)) return;
  if (language === "ru") {
    showToast(t("quiz.russianLoading"));
    try { await ensureRussianCorpus(); }
    catch { showToast(t("quiz.russianLoadError")); return; }
  }
  profile.language = language;
  if (session) session.questionLanguage = language;
  saveProfile();
  renderQuestion();
}

function chooseAnswer(key) {
  if (session.checked) return;
  session.selected = key;
  $$("[data-answer]").forEach((button) => {
    const selected = button.dataset.answer === key;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("#quizPrimary").disabled = false;
}

function advanceQuiz() {
  if (!session.selected) return;
  const q = session.questions[session.index];
  if (session.mode !== "exam" && !session.checked) {
    session.checked = true;
    recordQuestion(q, session.selected === q.correct);
    session.answers[session.index] = { questionId: q.id, pick: session.selected, correct: session.selected === q.correct };
    renderQuestion();
    return;
  }
  if (session.mode === "exam") session.answers[session.index] = { questionId: q.id, pick: session.selected, correct: session.selected === q.correct };
  if (session.index >= session.questions.length - 1) { finishSession(); return; }
  session.index += 1;
  session.selected = session.answers[session.index]?.pick || null;
  session.checked = false;
  renderQuestion();
}

function recordQuestion(question, isCorrect) {
  const current = profile.questionProgress[question.id] || { correct: 0, wrong: 0, streak: 0 };
  const streak = isCorrect ? (current.streak || 0) + 1 : 0;
  const intervals = [1, 3, 7, 14, 30];
  const days = isCorrect ? intervals[Math.min(streak - 1, intervals.length - 1)] : 0;
  const nextReview = new Date(Date.now() + days * 86400000).toISOString();
  profile.questionProgress[question.id] = { ...current, correct: current.correct + (isCorrect ? 1 : 0), wrong: current.wrong + (isCorrect ? 0 : 1), streak, lastAnswer: new Date().toISOString(), nextReview };
  saveProfile();
}

function finishSession() {
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
  };
  profile.sessions = [...profile.sessions, result].slice(-100);
  saveProfile();
  const finished = session;
  session = { ...session, result };
  renderResult(finished, result);
}

function renderResult(finished, result) {
  const errors = result.total - result.correct;
  const passed = finished.mode === "exam" ? errors <= 3 : result.percent >= 80;
  const missed = finished.questions.map((question, index) => ({ question, answer: finished.answers[index] })).filter(({ answer }) => !answer?.correct);
  const language = finished.questionLanguage || profile.language || "en";
  const review = missed.length ? `<section class="result-review"><div class="section-heading"><div><h2>${t("result.review")}</h2><p>${t("result.reviewHelp")}</p></div></div>${missed.map(({ question }, index) => `<article class="card review-item"><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(question.text?.[language] || question.text.en || question.text.pt)}</h3><p>${escapeHtml(question.explanation?.[language] || question.explanation?.[profile.uiLanguage] || question.explanation?.en || t("result.correctFallback", { answer: question.correct }))}</p></div></article>`).join("")}</section>` : "";
  const summary = finished.mode === "exam"
    ? passed ? t("result.examPassed") : t("result.examFailed", { count: formatNumber(errors) })
    : t("result.practiceHelp");
  main.innerHTML = `<div class="page"><article class="card result-card"><span class="eyebrow">${finished.mode === "exam" ? t("result.mockComplete") : t("result.practiceComplete")}</span><div class="result-orb">${formatNumber(result.correct)}/${formatNumber(result.total)}</div><h1>${passed ? t("result.strong") : t("result.useful")}</h1><p>${summary}</p><div class="result-stats"><div><strong>${result.percent}%</strong><span>${t("result.accuracy")}</span></div><div><strong>${formatNumber(errors)}</strong><span>${t("result.errors")}</span></div><div><strong>${formatMinuteCount(Math.ceil(result.durationSeconds / 60))}</strong><span>${t("result.time")}</span></div></div><div class="result-actions"><button class="button button-secondary" id="resultHome">${t("result.dashboard")}</button><button class="button button-primary" id="resultAgain">${t("result.again")}</button></div></article>${review}</div>`;
  $("#resultHome").addEventListener("click", () => { session = null; location.hash = "dashboard"; });
  $("#resultAgain").addEventListener("click", () => startSession(finished.mode));
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    session.remaining -= 1;
    const timer = $("#timer");
    if (timer) timer.textContent = formatTime(session.remaining);
    if (session.remaining <= 0) finishSession();
  }, 1000);
}
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

function renderProgress() {
  const s = getStats();
  const last7 = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    const sessions = profile.sessions.filter((item) => new Date(item.completedAt).toDateString() === date.toDateString());
    return { label: new Intl.DateTimeFormat(currentLocale(), { weekday: "short" }).format(date), count: sessions.reduce((sum, item) => sum + item.total, 0) };
  });
  const max = Math.max(20, ...last7.map((day) => day.count));
  const topicStats = Object.entries(TOPIC_NAMES).map(([pt, names]) => {
    const topicQuestions = questions.filter((q) => q.topic === pt);
    const seen = topicQuestions.filter((q) => profile.questionProgress[q.id]).length;
    return { name: names[profile.uiLanguage] || names.en, seen, total: topicQuestions.length, percent: topicQuestions.length ? Math.round((seen / topicQuestions.length) * 100) : 0 };
  }).sort((a, b) => b.percent - a.percent);
  main.innerHTML = `<div class="page"><header class="page-header"><div><span class="eyebrow">${t("progress.eyebrow")}</span><h1>${t("progress.title")}</h1><p>${t("progress.subtitle")}</p></div><span class="date-chip">${t("progress.seen", { count: formatNumber(s.seen) })}</span></header><section class="stat-grid"><article class="card stat-card"><span>${t("progress.readiness")}</span><strong>${s.readiness}%</strong><small>${t("progress.target85")}</small></article><article class="card stat-card"><span>${t("progress.coverage")}</span><strong>${Math.round(s.coverage)}%</strong><small>${formatNumber(s.seen)}/${formatNumber(questions.length)}</small></article><article class="card stat-card"><span>${t("progress.accuracy")}</span><strong>${s.accuracy}%</strong><small>${t("progress.target90")}</small></article><article class="card stat-card"><span>${t("progress.mockAverage")}</span><strong>${s.mock}%</strong><small>${t("progress.lastFive")}</small></article></section><div class="section-heading"><h2>${t("progress.activity")}</h2></div><section class="progress-layout"><article class="card chart-card"><h3>${t("progress.answered")}</h3><p>${t("progress.lastSeven")}</p><div class="bar-chart">${last7.map((day, i) => `<div class="bar ${i === 6 ? "active" : ""}" style="--height:${Math.max(3, (day.count / max) * 100)}%"><span>${day.label}</span></div>`).join("")}</div></article><article class="card coverage-card"><h3>${t("progress.syllabus")}</h3><p>${t("progress.topicsFirst")}</p><div class="topic-list">${topicStats.slice(0, 7).map((topic) => `<div class="topic-row"><strong>${escapeHtml(topic.name)}</strong><span>${formatNumber(topic.seen)}/${formatNumber(topic.total)}</span><div class="meter" style="--value:${topic.percent}%"><span></span></div></div>`).join("")}</div></article></section></div>`;
}

function renderSources() {
  const base = "https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents";
  main.innerHTML = `<div class="page"><header class="page-header"><div><span class="eyebrow">${t("sources.eyebrow")}</span><h1>${t("sources.title")}</h1><p>${t("sources.subtitle")}</p></div><span class="date-chip">${t("sources.updated")}</span></header><div class="notice"><strong>${t("sources.keyTitle")}</strong> ${t("sources.keyNotice")}<br><strong>${t("sources.translationTitle")}</strong> ${t("sources.translationNotice")}</div><div class="section-heading"><div><h2>${t("sources.groups")}</h2><p>${t("sources.groupsDescription")}</p></div><a class="text-link" href="https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/" target="_blank" rel="noopener">${t("sources.openIndex")}</a></div><section class="source-grid">${Array.from({ length: 14 }, (_, i) => `<a class="card source-card" href="${base}/rel_${i + 1}_condutores.pdf" target="_blank" rel="noopener"><span class="pdf-icon">PDF</span><span><strong>${t("sources.group", { number: formatNumber(i + 1) })}</strong><span>${t("sources.original")}</span></span></a>`).join("")}</section><div class="section-heading"><div><h2>${t("sources.dataNotes")}</h2><p>${t("sources.dataDescription")}</p></div></div><section class="stat-grid"><article class="card stat-card"><span>${t("sources.bank")}</span><strong>${formatNumber(questions.length)}</strong><small>${t("sources.publicQuestions")}</small></article><article class="card stat-card"><span>${t("sources.topics")}</span><strong>${formatNumber(new Set(questions.map((q) => q.topic)).size)}</strong><small>${t("sources.syllabusAreas")}</small></article><article class="card stat-card"><span>${t("sources.languages")}</span><strong>${t("sources.languageValue")}</strong><small>${t("sources.toggleHelp")}</small></article><article class="card stat-card"><span>${t("sources.lastImport")}</span><strong>${corpusMeta.generatedAt ? new Date(corpusMeta.generatedAt).toLocaleDateString(currentLocale()) : "—"}</strong><small>${t("sources.localCorpus")}</small></article></section></div>`;
}

function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600); }

document.addEventListener("keydown", (event) => {
  if (!session || location.hash !== "#quiz") return;
  if (["1", "2", "3", "4"].includes(event.key)) {
    const q = session.questions[session.index];
    const answer = q.answers[Number(event.key) - 1];
    if (answer) chooseAnswer(answer.key);
  } else if (event.key === "Enter" && session.selected) advanceQuiz();
});

window.addEventListener("hashchange", render);

const modal = $("#settingsModal");
async function setUILanguage(language) {
  const normalized = normalizeLanguage(language);
  if (normalized === "ru") {
    showToast(t("quiz.russianLoading"));
    try { await ensureRussianCorpus(); }
    catch { showToast(t("quiz.russianLoadError")); return; }
  }
  profile.uiLanguage = normalized;
  profile.language = normalized;
  if (session) session.questionLanguage = normalized;
  saveProfile();
  applyStaticTranslations();
  updateSyncUI();
  updateStorageSummary();
  render();
}

function openSettings() {
  updateStorageSummary();
  updateSyncUI();
  $("#storageStatus").textContent = "";
  modal.hidden = false;
}
$("#openSettings").addEventListener("click", openSettings);
$("#mobileSettings").addEventListener("click", openSettings);
$("#closeSettings").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });

function updateStorageSummary() {
  if (!$("#storageSummary")) return;
  const stats = getStats();
  $("#storageSummary").textContent = t("storage.summary", { questions: formatQuestionCount(stats.seen), sessions: formatSessionCount(profile.sessions.length) });
  $("#lastSaved").textContent = profile.updatedAt ? new Date(profile.updatedAt).toLocaleString(currentLocale(), { dateStyle: "medium", timeStyle: "short" }) : t("storage.notSaved");
}

function updateSyncUI(nextState = syncState) {
  syncState = { ...syncState, ...nextState };
  const signedIn = Boolean(syncState.user);
  const statusTitles = {
    unconfigured: "sync.unconfiguredTitle",
    local: "sync.localTitle",
    connecting: "sync.connectingTitle",
    syncing: "sync.syncingTitle",
    pending: "sync.pendingTitle",
    synced: "sync.syncedTitle",
    offline: "sync.offlineTitle",
    error: "sync.errorTitle",
    "email-sent": "sync.emailSentTitle",
  };
  const title = t(statusTitles[syncState.status] || "sync.localTitle");
  const detail = syncState.messageKey ? t(syncState.messageKey, syncState.messageArgs) : (signedIn ? t("sync.signedInDetail") : t("sync.signedOutDetail"));

  $("#syncLabel").textContent = signedIn
    ? syncState.status === "synced" ? t("sync.syncedTitle") : t("sync.active")
    : syncState.status === "email-sent" ? t("sync.emailSentTitle") : t("sync.localTitle");
  $("#cloudSyncTitle").textContent = title;
  $("#cloudSyncDetail").textContent = detail;
  $("#syncDot").dataset.status = syncState.status;
  $("#syncSignInForm").hidden = signedIn || !syncState.configured;
  $("#syncAccount").hidden = !signedIn;
  $("#syncEmailLabel").textContent = syncState.user?.email || t("sync.signedInAccount");
  $("#syncNow").disabled = !signedIn || syncState.status === "syncing";
  $("#signOutSync").disabled = syncState.status === "syncing";
  $("#syncStatus").textContent = syncState.status === "unconfigured"
    ? t("sync.setupHelp")
    : syncState.status === "error" ? detail : "";
  $("#resetData").textContent = signedIn ? t("settings.eraseSynced") : t("settings.eraseLocal");
}

$("#syncSignInForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("#syncEmail").value.trim();
  if (!email) return;
  const button = $("#sendSignInLink");
  button.disabled = true;
  $("#syncStatus").textContent = "";
  try {
    await syncController.requestMagicLink(email);
  } catch (error) {
    $("#syncStatus").textContent = t("sync.signInSendError");
  } finally {
    button.disabled = false;
  }
});

$("#syncNow").addEventListener("click", async () => {
  $("#syncNow").disabled = true;
  await syncController?.syncNow();
  updateSyncUI(syncController?.getState());
});

$("#signOutSync").addEventListener("click", async () => {
  $("#signOutSync").disabled = true;
  try {
    await syncController?.signOut();
  } catch (error) {
    $("#syncStatus").textContent = t("sync.signOutError");
  } finally {
    $("#signOutSync").disabled = false;
  }
});

$("#exportData").addEventListener("click", () => {
  const backup = { app: "RoadReady Portugal", version: 1, exportedAt: new Date().toISOString(), profile };
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
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed.profile || parsed;
    if (!incoming || typeof incoming.questionProgress !== "object" || !Array.isArray(incoming.sessions)) throw new Error(t("storage.invalidBackup"));
    profile = normaliseProfile(incoming);
    if (profile.uiLanguage === "ru" || profile.language === "ru") await ensureRussianCorpus();
    saveProfile();
    applyStaticTranslations();
    updateStorageSummary();
    render();
    status.textContent = t("storage.restoreSuccess");
  } catch (error) {
    status.textContent = error.message === t("storage.invalidBackup") ? error.message : t("storage.restoreError");
  } finally {
    event.target.value = "";
  }
});

$("#resetData").addEventListener("click", async () => {
  const isSynced = Boolean(syncState.user);
  const prompt = isSynced ? t("storage.eraseSyncedConfirm") : t("storage.eraseLocalConfirm");
  if (!confirm(prompt)) return;
  const preferences = { uiLanguage: profile.uiLanguage, language: profile.language };
  localStorage.removeItem(PROFILE_KEY);
  profile = { ...defaultProfile(), ...preferences };
  saveProfile();
  if (isSynced) await syncController?.syncNow();
  modal.hidden = true;
  render();
  showToast(isSynced ? t("storage.erasedSynced") : t("storage.erasedLocal"));
});

main.innerHTML = `<div class="page"><div class="skeleton" style="height:44px;width:310px;margin-bottom:30px"></div><div class="hero-grid"><div class="skeleton" style="height:278px"></div><div class="skeleton" style="height:278px"></div></div></div>`;
applyStaticTranslations();
await loadCorpus();
$$('[data-ui-lang]').forEach((button) => button.addEventListener("click", () => { void setUILanguage(button.dataset.uiLang); }));
render();
syncController = createSyncController({
  getProfile: () => profile,
  applyProfile: applySyncedProfile,
  onStateChange: updateSyncUI,
});
updateSyncUI(syncController.getState());
void syncController.initialize();
