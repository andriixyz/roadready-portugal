import { createSyncController } from "./sync.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const main = $("#mainContent");

const TOPIC_EN = {
  "Cedência de passagem": "Right of way",
  "Circulação, segurança e veículos em missão urgente de socorro": "Road use, safety & emergency vehicles",
  "Classificação, constituintes, inspecções, pesos e dimensões, protecção de ambiente, equipamentos de segurança, acidente": "Vehicle classes, inspections & safety",
  "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação": "Driver fitness, alcohol, medicines & mandatory signs",
  "Iluminação, passageiros e carga, condução defensiva e peões": "Lights, passengers, loads & defensive driving",
  "Outras manobras": "Other manoeuvres",
  "Paragem, estacionamento e cruzamento de veículos": "Stopping, parking & passing vehicles",
  "Sinais de indicação": "Information signs",
  "Sinais de perigo": "Warning signs",
  "Sinais de prescrição específica, sinais de cedência de passagem": "Specific rules & priority signs",
  "Sinais de proibição": "Prohibition signs",
  "Sinalização luminosa, marcas no pavimento e outra sinalização": "Traffic lights, road markings & other signals",
  "Títulos de condução, obtenção, revalidação, responsabilidade civil e criminal, contra-ordenações, cassação": "Licensing, liability & offences",
  "Ultrapassagem": "Overtaking",
  "Velocidade": "Speed",
  "Vias de trânsito, condições ambientais adversas": "Roads & adverse conditions",
};

const sampleQuestions = [
  {
    id: "sample-1", sourceId: 1, category: "B", topic: "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação",
    text: { pt: "A visão em túnel manifesta-se de que modo?", en: "How does tunnel vision manifest itself?" },
    answers: [{ key: "A", pt: "Perda total de visão lateral.", en: "Total loss of peripheral vision." }, { key: "B", pt: "Perda total da capacidade de visão cromática.", en: "Total loss of colour vision." }], correct: "A",
    image: "", sourceUrl: "https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_1_condutores.pdf",
  },
  {
    id: "sample-2", sourceId: 2, category: "B", topic: "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação",
    text: { pt: "A alteração do campo visual de um condutor devido à ingestão de bebidas alcoólicas manifesta-se por:", en: "A driver's field of vision is altered by alcohol through:" },
    answers: [{ key: "A", pt: "Redução da visão lateral.", en: "Reduced peripheral vision." }, { key: "B", pt: "Aumento da visão lateral.", en: "Increased peripheral vision." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-3", sourceId: 3, category: "B", topic: "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação",
    text: { pt: "Os condutores têm obrigação de sujeitar-se às provas estabelecidas para a detecção de álcool.", en: "Drivers are required to undergo the prescribed alcohol-detection tests." },
    answers: [{ key: "A", pt: "Certo.", en: "True." }, { key: "B", pt: "Errado.", en: "False." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-4", sourceId: 4, category: "B", topic: "Cedência de passagem",
    text: { pt: "Ao entrar numa rotunda devo ceder a passagem.", en: "When entering a roundabout, I must give way." },
    answers: [{ key: "A", pt: "Certo.", en: "True." }, { key: "B", pt: "Errado.", en: "False." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-5", sourceId: 5, category: "B", topic: "Vias de trânsito, condições ambientais adversas",
    text: { pt: "A circulação sob condições atmosféricas adversas pode prejudicar a distância de travagem.", en: "Driving in adverse weather conditions can adversely affect braking distance." },
    answers: [{ key: "A", pt: "Certo.", en: "True." }, { key: "B", pt: "Errado.", en: "False." }], correct: "A", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
  {
    id: "sample-6", sourceId: 6, category: "B", topic: "Paragem, estacionamento e cruzamento de veículos",
    text: { pt: "É permitido o estacionamento na faixa de rodagem.", en: "Parking on the carriageway is permitted." },
    answers: [{ key: "A", pt: "Certo.", en: "True." }, { key: "B", pt: "Errado.", en: "False." }], correct: "B", image: "", sourceUrl: "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/",
  },
];

const defaultProfile = () => ({
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  dailyGoal: 20,
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
  message: "Saved on this device.",
};

function normaliseProfile(value = {}) {
  return {
    ...defaultProfile(),
    ...value,
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
  render();
  updateStorageSummary();
}
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const formatDate = (date = new Date()) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const topicName = (topic) => TOPIC_EN[topic] || topic || "General road rules";

async function loadCorpus() {
  for (const url of ["public/data/questions-en.json", "public/data/questions-pt.json"]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      questions = data.questions;
      corpusMeta = data;
      if (questions.length) return;
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
  main.innerHTML = `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">Category B · Portugal</span><h1>Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}.</h1><p>Build confidence one road rule at a time.</p></div>
        <span class="date-chip">${formatDate()}</span>
      </header>
      <section class="hero-grid">
        <article class="card route-card">
          <div>
            <span class="eyebrow">Today’s route</span>
            <h2>${s.due ? "Review what is starting to fade" : "Learn 15 new road situations"}</h2>
            <p>${s.due ? `${s.due} questions are due now. A short recall session is the highest-value work you can do today.` : "Start with a focused set, then return tomorrow. Spacing beats cramming for this exam."}</p>
            <div class="route-meta"><span><strong>${s.due || 15}</strong> questions</span><span><strong>≈ ${Math.ceil((s.due || 15) * .7)}</strong> minutes</span><span><strong>${s.todayAnswered}/${profile.dailyGoal}</strong> daily goal</span></div>
            <button class="button button-accent" data-start="${s.due ? "review" : "quick"}">${s.due ? "Review now" : "Start today’s session"} →</button>
          </div>
          <div class="progress-ring" style="--progress:${dailyPercent}"><span>${dailyPercent}%<small>Today</small></span></div>
        </article>
        <article class="card readiness-card">
          <span class="eyebrow" style="color:var(--lime)">Exam readiness</span>
          <div class="readiness-score">${s.readiness}%</div>
          <div class="readiness-label">${s.readiness >= 85 ? "Ready to book" : s.readiness >= 60 ? "Getting close" : "Building foundations"}</div>
          <p>${s.readiness >= 85 ? "Keep it stable with mixed mocks and short reviews." : "Aim for 85% readiness and five passing mocks before booking."}</p>
          <div class="meter" style="--value:${s.readiness}%"><span></span></div>
        </article>
      </section>

      <div class="section-heading"><div><h2>Your next moves</h2><p>Balanced for learning, recall, and exam pressure.</p></div><a class="text-link" href="#practice">All practice modes →</a></div>
      <section class="task-grid">
        <article class="task-card"><div class="task-top"><span class="task-icon">01</span><span class="mode-kicker">Learn</span></div><h3>New questions</h3><p>Grow coverage with 10 unseen situations from across the syllabus.</p><button data-start="quick">Start quick set →</button></article>
        <article class="task-card"><div class="task-top"><span class="task-icon">↻</span><span class="mode-kicker">Recall</span></div><h3>${s.due} due for review</h3><p>Intervals adapt after every answer: 1, 3, 7, 14, then 30 days.</p><button data-start="review">Review due →</button></article>
        <article class="task-card"><div class="task-top"><span class="task-icon">30</span><span class="mode-kicker">Simulate</span></div><h3>Official-format mock</h3><p>30 questions, 30 minutes, maximum 3 errors to pass.</p><button data-start="exam">Start mock exam →</button></article>
      </section>

      <div class="section-heading"><h2>At a glance</h2><a class="text-link" href="#progress">Detailed progress →</a></div>
      <section class="stat-grid">
        <article class="card stat-card"><span>Questions seen</span><strong>${s.seen.toLocaleString("en-GB")}</strong><small>of ${questions.length.toLocaleString("en-GB")}</small></article>
        <article class="card stat-card"><span>Answer accuracy</span><strong>${s.accuracy}%</strong><small>${s.correct + s.wrong} attempts</small></article>
        <article class="card stat-card"><span>Mistakes to fix</span><strong>${s.mistakes}</strong><small>prioritised in review</small></article>
        <article class="card stat-card"><span>Study streak</span><strong>${profile.streak} day${profile.streak === 1 ? "" : "s"}</strong><small>keep the chain alive</small></article>
      </section>
    </div>`;
  bindStartButtons();
}

function renderPractice() {
  const s = getStats();
  main.innerHTML = `
    <div class="page">
      <header class="page-header"><div><span class="eyebrow">Choose your focus</span><h1>Practice with purpose.</h1><p>Every mode updates the same spaced-repetition plan.</p></div><span class="date-chip">${questions.length.toLocaleString("en-GB")} questions loaded</span></header>
      <section class="mode-grid">
        <article class="card mode-card featured"><span class="mode-badge">Recommended today</span><span class="mode-kicker">10 questions · untimed</span><h3>Quick focus</h3><p>Mostly unseen questions, mixed across all Category B topics. Get feedback after every answer.</p><button class="button button-accent" data-start="quick">Start practice →</button></article>
        <article class="card mode-card"><span class="mode-badge">${s.due} available</span><span class="mode-kicker">Spaced repetition</span><h3>Due review</h3><p>Recall questions just before you are likely to forget them. Wrong answers return sooner.</p><button class="button button-primary" data-start="review">Review due →</button></article>
        <article class="card mode-card"><span class="mode-badge">${s.mistakes} weak spots</span><span class="mode-kicker">Targeted repair</span><h3>Mistake clinic</h3><p>Work only on questions you have missed more often than answered correctly.</p><button class="button button-secondary" data-start="mistakes">Fix mistakes →</button></article>
        <article class="card mode-card"><span class="mode-badge">Pass at 27/30</span><span class="mode-kicker">30 questions · 30 minutes</span><h3>Mock exam</h3><p>No feedback until the end. The question mix and passing threshold mirror Category B exam conditions.</p><button class="button button-primary" data-start="exam">Start timed mock →</button></article>
      </section>
      <div class="section-heading"><div><h2>The learning strategy</h2><p>A simple loop designed for retention, not just recognition.</p></div></div>
      <section class="study-plan">
        <article class="plan-row"><span class="plan-day">Phase 1</span><div><h3>Coverage · first 7 days</h3><p>Two quick sets daily. Touch every topic and flag unfamiliar Portuguese road vocabulary.</p></div><span class="plan-status">10–20 min/day</span></article>
        <article class="plan-row"><span class="plan-day">Phase 2</span><div><h3>Recall · days 4–14</h3><p>Begin with due reviews, then add new questions. Never clear a wrong answer by rereading alone.</p></div><span class="plan-status">Due first</span></article>
        <article class="plan-row"><span class="plan-day">Phase 3</span><div><h3>Exam pressure · final 7 days</h3><p>One timed mock a day. Book when you pass five mocks in a row with at least 28/30.</p></div><span class="plan-status">Target ≥ 93%</span></article>
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
  if (!selected.length) { showToast(mode === "review" ? "Nothing is due yet — try a quick focus set." : "Answer a few questions first, then return here."); return; }
  session = { mode, questions: selected, index: 0, answers: [], selected: null, checked: false, startedAt: Date.now(), remaining: mode === "exam" ? 30 * 60 : null };
  location.hash = "quiz";
  renderQuestion();
}

function bindStartButtons() { $$('[data-start]').forEach((button) => button.addEventListener("click", () => startSession(button.dataset.start))); }

function renderQuestion() {
  if (!session) { location.hash = "practice"; return; }
  const q = session.questions[session.index];
  const language = profile.language || "en";
  const progress = (session.index / session.questions.length) * 100;
  const answerState = session.answers[session.index];
  const title = q.text?.[language] || q.text?.en || q.text?.pt;
  const explanation = q.explanation?.[language] || q.explanation?.en || `Correct answer: “${q.answers.find((answer) => answer.key === q.correct)?.[language] || q.answers.find((answer) => answer.key === q.correct)?.en || q.correct}”`;
  const image = q.image ? `<a class="question-image-link" href="${escapeHtml(q.image)}" target="_blank" rel="noopener" aria-label="Open the full-size image for question ${escapeHtml(q.sourceId)}"><img src="${escapeHtml(q.image)}" alt="Road situation for question ${escapeHtml(q.sourceId)}" referrerpolicy="no-referrer" /></a>` : `<div class="image-fallback"><strong>Text-only question</strong><br><br>The official source image is not required for this item.</div>`;
  main.innerHTML = `
    <div class="page question-page">
      <div class="quiz-topbar"><button class="icon-button" id="exitQuiz" aria-label="Exit session">×</button><div class="quiz-progress" style="--value:${progress}%"><span></span></div><span class="quiz-counter">${session.mode === "exam" ? `<b id="timer">${formatTime(session.remaining)}</b> · ` : ""}${session.index + 1} of ${session.questions.length}</span></div>
      <article class="card question-card">
        <div class="question-visual"><div class="question-image-frame">${image}</div><div class="image-links"><a class="source-pill" href="${escapeHtml(q.sourceUrl)}" target="_blank" rel="noopener">Source question #${escapeHtml(q.sourceId)} ↗</a>${q.image ? `<a class="full-image-link" href="${escapeHtml(q.image)}" target="_blank" rel="noopener">Full image ↗</a>` : ""}</div></div>
        <div class="question-body">
          <div class="question-tools"><span class="question-topic">${escapeHtml(topicName(q.topic))}</span><div class="language-toggle"><button class="${language === "en" ? "active" : ""}" data-lang="en">EN</button><button class="${language === "pt" ? "active" : ""}" data-lang="pt">PT</button></div></div>
          <h1>${escapeHtml(title)}</h1>
          <div class="answers">${q.answers.map((answer, i) => {
            const selected = session.selected === answer.key || answerState?.pick === answer.key;
            const checked = session.checked && session.mode !== "exam";
            const status = checked && answer.key === q.correct ? "correct" : checked && selected && answer.key !== q.correct ? "wrong" : selected ? "selected" : "";
            const marker = checked && answer.key === q.correct ? "✓" : checked && selected ? "×" : "";
            return `<button class="answer-option ${status}" data-answer="${answer.key}" aria-pressed="${selected}" ${checked ? "disabled" : ""}><span class="answer-key">${i + 1}</span><span>${escapeHtml(answer[language] || answer.en || answer.pt)}</span><span class="answer-marker">${marker}</span></button>`;
          }).join("")}</div>
          ${session.checked && session.mode !== "exam" ? `<div class="feedback ${session.selected === q.correct ? "" : "incorrect"}"><div class="feedback-heading"><span>${session.selected === q.correct ? "✓" : "!"}</span><strong>${session.selected === q.correct ? "Correct" : `Study key: option ${q.correct}`}</strong></div><p>${escapeHtml(explanation)}</p><small>${session.selected === q.correct ? "This item will return after a longer interval." : "This item is scheduled to return sooner."}</small></div>` : ""}
          <div class="quiz-actions"><span class="quiz-hint">Keys 1–3 select · Enter continues</span><button class="button ${session.checked ? "button-primary" : "button-accent"}" id="quizPrimary" ${session.selected ? "" : "disabled"}>${session.mode === "exam" ? (session.index === session.questions.length - 1 ? "Finish exam" : "Next question") : session.checked ? (session.index === session.questions.length - 1 ? "See results" : "Continue") : "Check answer"} →</button></div>
        </div>
      </article>
    </div>`;
  $("#exitQuiz").addEventListener("click", () => { if (confirm("Leave this session? Your completed answers are already saved.")) location.hash = "practice"; });
  $$('[data-lang]').forEach((button) => button.addEventListener("click", () => { profile.language = button.dataset.lang; saveProfile(); renderQuestion(); }));
  $$("[data-answer]").forEach((button) => button.addEventListener("click", () => chooseAnswer(button.dataset.answer)));
  $("#quizPrimary").addEventListener("click", advanceQuiz);
  const img = $(".question-visual img");
  if (img) img.addEventListener("error", () => { img.replaceWith(Object.assign(document.createElement("div"), { className: "image-fallback", innerHTML: "<strong>Image unavailable</strong><br><br>Open the source link to view the original." })); });
  if (session.mode === "exam") startTimer();
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
  const review = missed.length ? `<section class="result-review"><div class="section-heading"><div><h2>Review the missed rules</h2><p>Short explanations use the public study key; verify disputed wording with your school.</p></div></div>${missed.map(({ question }, index) => `<article class="card review-item"><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(question.text.en || question.text.pt)}</h3><p>${escapeHtml(question.explanation?.en || `Correct answer: ${question.correct}`)}</p></div></article>`).join("")}</section>` : "";
  main.innerHTML = `<div class="page"><article class="card result-card"><span class="eyebrow">${finished.mode === "exam" ? "Mock exam complete" : "Practice complete"}</span><div class="result-orb">${result.correct}/${result.total}</div><h1>${passed ? "A strong run." : "Useful mistakes."}</h1><p>${finished.mode === "exam" ? passed ? "You passed this simulation. Repeat under the same conditions until this feels routine." : `The Category B threshold is 27/30. Review the ${errors} missed questions before your next mock.` : "The questions you missed are already scheduled to return sooner."}</p><div class="result-stats"><div><strong>${result.percent}%</strong><span>Accuracy</span></div><div><strong>${errors}</strong><span>Errors</span></div><div><strong>${Math.ceil(result.durationSeconds / 60)}m</strong><span>Time</span></div></div><div class="result-actions"><button class="button button-secondary" id="resultHome">Dashboard</button><button class="button button-primary" id="resultAgain">Practice again →</button></div></article>${review}</div>`;
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
    return { label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date), count: sessions.reduce((sum, item) => sum + item.total, 0) };
  });
  const max = Math.max(20, ...last7.map((day) => day.count));
  const topicStats = Object.entries(TOPIC_EN).map(([pt, en]) => {
    const topicQuestions = questions.filter((q) => q.topic === pt);
    const seen = topicQuestions.filter((q) => profile.questionProgress[q.id]).length;
    return { name: en, seen, total: topicQuestions.length, percent: topicQuestions.length ? Math.round((seen / topicQuestions.length) * 100) : 0 };
  }).sort((a, b) => b.percent - a.percent);
  main.innerHTML = `<div class="page"><header class="page-header"><div><span class="eyebrow">Learning analytics</span><h1>Progress you can act on.</h1><p>Readiness combines coverage, answer accuracy, and recent mock performance.</p></div><span class="date-chip">${s.seen.toLocaleString("en-GB")} questions seen</span></header><section class="stat-grid"><article class="card stat-card"><span>Readiness</span><strong>${s.readiness}%</strong><small>target 85%</small></article><article class="card stat-card"><span>Coverage</span><strong>${Math.round(s.coverage)}%</strong><small>${s.seen}/${questions.length}</small></article><article class="card stat-card"><span>Accuracy</span><strong>${s.accuracy}%</strong><small>target ≥ 90%</small></article><article class="card stat-card"><span>Mock average</span><strong>${s.mock}%</strong><small>last five exams</small></article></section><div class="section-heading"><h2>Study activity</h2></div><section class="progress-layout"><article class="card chart-card"><h3>Questions answered</h3><p>Last seven days</p><div class="bar-chart">${last7.map((day, i) => `<div class="bar ${i === 6 ? "active" : ""}" style="--height:${Math.max(3, (day.count / max) * 100)}%"><span>${day.label}</span></div>`).join("")}</div></article><article class="card coverage-card"><h3>Syllabus coverage</h3><p>Topics with the most exposure appear first.</p><div class="topic-list">${topicStats.slice(0, 7).map((topic) => `<div class="topic-row"><strong>${escapeHtml(topic.name)}</strong><span>${topic.seen}/${topic.total}</span><div class="meter" style="--value:${topic.percent}%"><span></span></div></div>`).join("")}</div></article></section></div>`;
}

function renderSources() {
  const base = "https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents";
  main.innerHTML = `<div class="page"><header class="page-header"><div><span class="eyebrow">Traceable study material</span><h1>Official questions, transparent answers.</h1><p>Every question keeps its Portuguese wording and a link back to its public source.</p></div><span class="date-chip">IMT page updated 18 Mar 2026</span></header><div class="notice"><strong>About the answer key:</strong> IMT publishes questions and choices, but not the official correct answers. RoadReady uses a public study key maintained from the Portuguese Highway Code. Treat disputed items as study prompts and confirm them with your driving school.</div><div class="section-heading"><div><h2>IMT driver question groups</h2><p>Fourteen PDF groups currently linked by IMT.</p></div><a class="text-link" href="https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/" target="_blank" rel="noopener">Open IMT index ↗</a></div><section class="source-grid">${Array.from({ length: 14 }, (_, i) => `<a class="card source-card" href="${base}/rel_${i + 1}_condutores.pdf" target="_blank" rel="noopener"><span class="pdf-icon">PDF</span><span><strong>Driver questions · group ${i + 1}</strong><span>Portuguese original · IMT</span></span></a>`).join("")}</section><div class="section-heading"><div><h2>Data notes</h2><p>What is inside this build.</p></div></div><section class="stat-grid"><article class="card stat-card"><span>Category B bank</span><strong>${questions.length.toLocaleString("en-GB")}</strong><small>public questions</small></article><article class="card stat-card"><span>Topics</span><strong>${new Set(questions.map((q) => q.topic)).size}</strong><small>syllabus areas</small></article><article class="card stat-card"><span>Languages</span><strong>EN + PT</strong><small>toggle per question</small></article><article class="card stat-card"><span>Last import</span><strong>${corpusMeta.generatedAt ? new Date(corpusMeta.generatedAt).toLocaleDateString("en-GB") : "—"}</strong><small>local corpus</small></article></section></div>`;
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
  $("#storageSummary").textContent = `${stats.seen.toLocaleString("en-GB")} question${stats.seen === 1 ? "" : "s"} · ${profile.sessions.length} session${profile.sessions.length === 1 ? "" : "s"}`;
  $("#lastSaved").textContent = profile.updatedAt ? new Date(profile.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not saved yet";
}

function updateSyncUI(nextState = syncState) {
  syncState = { ...syncState, ...nextState };
  const signedIn = Boolean(syncState.user);
  const statusTitles = {
    unconfigured: "Cloud connection pending",
    local: "Saved on this device",
    connecting: "Connecting cloud sync",
    syncing: "Syncing progress",
    pending: "Cloud update queued",
    synced: "Synced across devices",
    offline: "Available offline",
    error: "Device copy is safe",
    "email-sent": "Check your email",
  };
  const title = statusTitles[syncState.status] || "Saved on this device";
  const detail = syncState.message || (signedIn
    ? "Your progress is shared with your signed-in devices."
    : "Sign in to share progress between devices.");

  $("#syncLabel").textContent = signedIn
    ? syncState.status === "synced" ? "Synced across devices" : "Cloud sync active"
    : syncState.status === "email-sent" ? "Check your email" : "Saved on this device";
  $("#cloudSyncTitle").textContent = title;
  $("#cloudSyncDetail").textContent = detail;
  $("#syncDot").dataset.status = syncState.status;
  $("#syncSignInForm").hidden = signedIn || !syncState.configured;
  $("#syncAccount").hidden = !signedIn;
  $("#syncEmailLabel").textContent = syncState.user?.email || "Signed-in account";
  $("#syncNow").disabled = !signedIn || syncState.status === "syncing";
  $("#signOutSync").disabled = syncState.status === "syncing";
  $("#syncStatus").textContent = syncState.status === "unconfigured"
    ? "Finish the one-time Supabase connection to enable sign-in."
    : syncState.status === "error" && syncState.error
      ? `${detail} ${syncState.error}`
      : "";
  $("#resetData").textContent = signedIn ? "Erase progress on all synced devices" : "Erase all progress on this device";
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
    $("#syncStatus").textContent = error.message || "The sign-in email could not be sent.";
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
    $("#syncStatus").textContent = error.message || "Could not sign out.";
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
  $("#storageStatus").textContent = "Backup downloaded. Keep it somewhere safe.";
});

$("#importData").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const status = $("#storageStatus");
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed.profile || parsed;
    if (!incoming || typeof incoming.questionProgress !== "object" || !Array.isArray(incoming.sessions)) throw new Error("This is not a valid RoadReady backup.");
    profile = normaliseProfile(incoming);
    saveProfile();
    updateStorageSummary();
    render();
    status.textContent = "Backup restored successfully.";
  } catch (error) {
    status.textContent = error.message || "The backup could not be imported.";
  } finally {
    event.target.value = "";
  }
});

$("#resetData").addEventListener("click", async () => {
  const isSynced = Boolean(syncState.user);
  const prompt = isSynced
    ? "Erase all RoadReady progress on this device and in your synced cloud profile? This cannot be undone without a backup."
    : "Erase all RoadReady progress stored in this browser? This cannot be undone without a backup.";
  if (!confirm(prompt)) return;
  localStorage.removeItem(PROFILE_KEY);
  profile = defaultProfile();
  saveProfile();
  if (isSynced) await syncController?.syncNow();
  modal.hidden = true;
  render();
  showToast(isSynced ? "Progress was erased on synced devices." : "All local progress was erased.");
});

main.innerHTML = `<div class="page"><div class="skeleton" style="height:44px;width:310px;margin-bottom:30px"></div><div class="hero-grid"><div class="skeleton" style="height:278px"></div><div class="skeleton" style="height:278px"></div></div></div>`;
await loadCorpus();
render();
syncController = createSyncController({
  getProfile: () => profile,
  applyProfile: applySyncedProfile,
  onStateChange: updateSyncUI,
});
updateSyncUI(syncController.getState());
void syncController.initialize();
