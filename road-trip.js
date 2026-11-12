// Road trip: a 3D driving game on the real question bank that borrows the exam's own tolerance for
// mistakes. Each question is a toll gate with one lane per answer; right answers move the car north,
// three mistakes are forgiven and the fourth ends the trip. Trips sweep the whole bank: unseen
// questions come first. Answers are recorded as ordinary practice by the caller. The trip itself lives
// in page memory and only the device-local records below survive a reload.
import { OFFICIAL_EXAM, unresolvedQuestions, selectNewQuestions } from "./exam-plan.js?v=20261010-1";
import { createTripScene } from "./road-trip-3d.js?v=20261112-1";

const STOPS = Object.freeze(["faro", "beja", "evora", "setubal", "lisboa", "santarem", "leiria", "coimbra", "viseu", "aveiro", "porto"]);

export const ROAD_TRIP = Object.freeze({
  stops: STOPS,
  answersPerLeg: 5,
  spareMistakes: OFFICIAL_EXAM.maxErrors,
  examLength: OFFICIAL_EXAM.questions,
  // The exam allows one minute per question on average; answering sooner earns the pace bonus.
  paceSeconds: OFFICIAL_EXAM.minutes * 60 / OFFICIAL_EXAM.questions,
  basePoints: 100,
  paceBonus: 50,
  stopBonus: 250,
  streakStep: 5,
  maxMultiplier: 4,
});
export const TRIP_DESTINATION = (STOPS.length - 1) * ROAD_TRIP.answersPerLeg;
export const TRIP_MAX_QUESTIONS = TRIP_DESTINATION + ROAD_TRIP.spareMistakes;
// At most this many questions per trip repeat a question last answered wrongly; the rest are new.
export const TRIP_REPAIR_QUESTIONS = Math.round(TRIP_MAX_QUESTIONS * .25);

// Derived translation keys, listed so the data check can confirm both dictionaries.
export const ROAD_TRIP_KEYS = Object.freeze([
  ...STOPS.map((stop) => `trip.stop.${stop}`),
  ...["lanes", "lives", "road", "streak", "pace"].flatMap((rule) => [`trip.rule.${rule}.title`, `trip.rule.${rule}.body`]),
  ...["arrived", "crashed", "stopped", "exhausted"].flatMap((outcome) => [`trip.finish.${outcome}.title`, `trip.finish.${outcome}.body`]),
]);

export const tripMultiplier = (streak) => Math.min(ROAD_TRIP.maxMultiplier, 1 + Math.floor(streak / ROAD_TRIP.streakStep));
export const tripPaceBonus = (elapsedMs) => Math.round(ROAD_TRIP.paceBonus
  * Math.max(0, 1 - Math.max(0, elapsedMs) / (ROAD_TRIP.paceSeconds * 1000)));
export const tripStopIndex = (correct) => Math.min(STOPS.length - 1, Math.floor(correct / ROAD_TRIP.answersPerLeg));

// Sweep the whole bank. A trip repeats a few questions last answered wrongly and otherwise takes
// questions never answered, rotating through the least-covered topics, so every question is reached
// before any correctly answered one returns. Once nothing is unseen, the least recently answered
// questions come back first and the bank keeps rotating.
export function selectRoadTripQuestions(questions, profile, random = Math.random) {
  const shuffled = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };
  const limit = Math.min(TRIP_MAX_QUESTIONS, questions.length);
  const unresolved = shuffled(unresolvedQuestions(questions, profile));
  const picked = new Set(unresolved.slice(0, Math.min(TRIP_REPAIR_QUESTIONS, limit)));
  for (const question of selectNewQuestions(questions, profile, limit - picked.size, random)) picked.add(question);
  if (picked.size < limit) {
    const lastAnswer = (question) => Date.parse(profile.questionProgress?.[question.id]?.lastAnswer) || 0;
    const rest = shuffled(questions.filter((question) => !picked.has(question))).sort((a, b) => lastAnswer(a) - lastAnswer(b));
    for (const question of [...unresolved, ...rest]) {
      if (picked.size >= limit) break;
      picked.add(question);
    }
  }
  return shuffled([...picked]);
}

// How much of the bank has been answered at least once, in any mode.
export function tripCoverage(questions, profile) {
  const seen = questions.filter((question) => {
    const progress = profile.questionProgress?.[question.id];
    return Boolean(progress && (progress.correct || 0) + (progress.wrong || 0) > 0);
  }).length;
  const total = questions.length;
  const remaining = total - seen;
  return {
    seen, total, remaining, percent: total ? Math.floor(seen / total * 100) : 0,
    // The fewest trips that could cover the rest: flawless ones made only of new questions.
    trips: Math.ceil(remaining / TRIP_MAX_QUESTIONS),
  };
}

export function createRoadTrip(questions, now = Date.now()) {
  return {
    questions, index: 0, answers: [], selected: null, checked: false,
    score: 0, streak: 0, bestStreak: 0, correct: 0, mistakes: 0,
    // Mistakes made within the first exam-length stretch, set once that stretch is survived.
    examMistakes: null, outcome: null, finished: false,
    startedAt: now, shownAt: now, finishedAt: null,
  };
}

// The first pick is final: it is checked at once and the trip waits for the player to drive on.
export function answerRoadTrip(trip, key, now = Date.now()) {
  if (trip.finished || trip.checked) return null;
  const question = trip.questions[trip.index];
  if (!question?.answers.some((answer) => answer.key === key)) return null;
  const correct = key === question.correct;
  const answer = { questionId: question.id, pick: key, correct, points: 0, pace: 0, multiplier: 1, stop: null, stopBonus: 0 };
  if (correct) {
    trip.streak++;
    trip.correct++;
    trip.bestStreak = Math.max(trip.bestStreak, trip.streak);
    answer.multiplier = tripMultiplier(trip.streak);
    answer.pace = tripPaceBonus(now - trip.shownAt);
    answer.points = (ROAD_TRIP.basePoints + answer.pace) * answer.multiplier;
    if (trip.correct % ROAD_TRIP.answersPerLeg === 0 && trip.correct <= TRIP_DESTINATION) {
      answer.stop = tripStopIndex(trip.correct);
      answer.stopBonus = ROAD_TRIP.stopBonus;
    }
    trip.score += answer.points + answer.stopBonus;
  } else {
    trip.streak = 0;
    trip.mistakes++;
  }
  trip.answers[trip.index] = answer;
  trip.selected = key;
  trip.checked = true;
  if (trip.answers.length === ROAD_TRIP.examLength && trip.mistakes <= ROAD_TRIP.spareMistakes) trip.examMistakes = trip.mistakes;
  trip.outcome = trip.mistakes > ROAD_TRIP.spareMistakes ? "crashed"
    : trip.correct >= TRIP_DESTINATION ? "arrived"
      : trip.index >= trip.questions.length - 1 ? "exhausted" : null;
  return answer;
}

export function advanceRoadTrip(trip, now = Date.now()) {
  if (trip.finished || !trip.checked) return false;
  if (trip.outcome) {
    trip.finished = true;
    trip.finishedAt = now;
    return true;
  }
  trip.index++;
  trip.selected = null;
  trip.checked = false;
  trip.shownAt = now;
  return true;
}

// The player may park early; an outcome already decided by the last answer is kept.
export function endRoadTrip(trip, now = Date.now()) {
  if (trip.finished) return false;
  trip.outcome ||= "stopped";
  trip.finished = true;
  trip.finishedAt = now;
  return true;
}

export function roadTripSummary(trip) {
  return {
    outcome: trip.outcome, score: trip.score, correct: trip.correct, mistakes: trip.mistakes,
    answered: trip.answers.filter(Boolean).length, bestStreak: trip.bestStreak, stop: tripStopIndex(trip.correct),
    examPassed: trip.examMistakes !== null, examMistakes: trip.examMistakes,
    durationSeconds: Math.max(0, Math.round(((trip.finishedAt ?? trip.startedAt) - trip.startedAt) / 1000)),
  };
}

export const emptyTripRecords = () => ({ trips: 0, bestScore: 0, farthest: 0, examPasses: 0 });

export function normaliseTripRecords(value) {
  const records = emptyTripRecords();
  if (value === null || typeof value !== "object" || Array.isArray(value)) return records;
  for (const key of Object.keys(records)) if (Number.isSafeInteger(value[key]) && value[key] >= 0) records[key] = value[key];
  records.farthest = Math.min(records.farthest, TRIP_DESTINATION);
  return records;
}

export function recordRoadTrip(records, summary) {
  return {
    records: {
      trips: records.trips + 1,
      bestScore: Math.max(records.bestScore, summary.score),
      farthest: Math.max(records.farthest, Math.min(summary.correct, TRIP_DESTINATION)),
      examPasses: records.examPasses + (summary.examPassed ? 1 : 0),
    },
    newBest: summary.score > records.bestScore,
  };
}

// ---- Browser view. Everything below needs a DOM and is driven by app.js. ----

const RECORDS_KEY = "roadready-road-trip";
const CAR = '<svg class="trip-car" viewBox="0 0 34 20" aria-hidden="true"><path d="M3 12 6 6.5C6.6 5.6 7.5 5 8.6 5h9.2c1 0 1.9.4 2.6 1.1L24.6 10l5 1c1.4.3 2.4 1.5 2.4 2.9V15a1 1 0 0 1-1 1h-2.1a3.5 3.5 0 0 0-6.8 0h-8.2a3.5 3.5 0 0 0-6.8 0H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"/><circle cx="8.5" cy="16" r="2.5"/><circle cx="25.5" cy="16" r="2.5"/></svg>';

let trip = null;
let finish = null;
let view = null;
let flash = null;
let paceTimer = null;
let stage = null;
let aimed = null;
let seenAtStart = 0;

const find = (selector) => view.main.querySelector(selector);
const findAll = (selector) => [...view.main.querySelectorAll(selector)];
const stopName = (index) => view.t(`trip.stop.${STOPS[index]}`);
const positionOf = (correct) => Math.min(100, correct / TRIP_DESTINATION * 100);

function loadRecords() {
  try { return normaliseTripRecords(JSON.parse(localStorage.getItem(RECORDS_KEY))); }
  catch { return emptyTripRecords(); }
}
function saveRecords(records) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); }
  catch { /* A full or blocked store only loses the record, never an answer. */ }
}

export const roadTripActive = () => Boolean(trip && !trip.finished);

// One canvas and WebGL context serve the lobby and every trip; each render moves the same element.
// Without WebGL the stage is skipped and the flat route strip carries the game on its own.
function ensureStage() {
  if (stage?.scene?.isLost()) stage = null;
  if (!stage) {
    const canvas = document.createElement("canvas");
    canvas.className = "trip-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const scene = createTripScene(canvas);
    stage = { canvas, scene };
    if (scene) canvas.addEventListener("click", (event) => {
      if (!roadTripActive() || trip.checked) return;
      const bounds = canvas.getBoundingClientRect();
      const lane = scene.laneAt((event.clientX - bounds.left) / bounds.width);
      if (lane === null) return;
      // The first tap steers into a lane; a second tap on the same lane drives through it.
      if (lane === aimed) pick(trip.questions[trip.index].answers[lane].key);
      else setAim(lane);
    });
  }
  return stage.scene;
}
function mountStage() {
  const slot = find("#tripCanvasSlot");
  if (!slot || !stage?.scene) return;
  slot.replaceWith(stage.canvas);
  stage.scene.wake();
}

// Steering only previews a lane. Nothing is checked until the player drives through or picks an answer.
function setAim(index) {
  if (!roadTripActive() || trip.checked) return;
  aimed = index;
  stage?.scene?.aim(index);
  findAll("[data-trip-answer]").forEach((button, lane) => button.classList.toggle("is-aimed", lane === index));
  const button = find("#tripContinue");
  if (!button) return;
  button.disabled = index === null;
  button.textContent = `${index === null ? view.t("quiz.selectAnswer") : view.t("trip.driveLane", { number: view.formatNumber(index + 1) })} →`;
}

// Erasing study progress also forgets the trip in memory and the records on this device.
export function resetRoadTrip() {
  trip = null;
  finish = null;
  aimed = null;
  stage?.scene?.reset(true);
  try { localStorage.removeItem(RECORDS_KEY); } catch { /* Nothing stored. */ }
}

export function renderRoadTrip(main, deps) {
  view = { main, ...deps };
  clearInterval(paceTimer);
  if (trip?.finished && finish) renderFinish();
  else if (trip && !trip.finished) renderDrive();
  else renderLobby();
}

function focusHeading(selector) {
  const heading = find(selector);
  if (!heading || !view.canFocus()) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  view.main.scrollIntoView({ block: "start", behavior: "instant" });
}

function routeMarkup(reached) {
  return `<ol class="trip-route">${STOPS.map((stop, index) => `<li class="${index <= reached ? "is-reached" : ""}"><span class="trip-route-dot" aria-hidden="true"></span><strong>${view.t(`trip.stop.${stop}`)}</strong><small>${view.formatNumber(index * ROAD_TRIP.answersPerLeg)}</small></li>`).join("")}</ol>`;
}

function renderLobby() {
  const { t, formatNumber } = view;
  document.body.dataset.trip = "lobby";
  const records = loadRecords();
  const has3d = Boolean(ensureStage());
  const coverage = tripCoverage(view.questions(), view.profile());
  const size = Math.min(TRIP_MAX_QUESTIONS, view.questions().length);
  const values = {
    spare: formatNumber(ROAD_TRIP.spareMistakes), exam: formatNumber(ROAD_TRIP.examLength), leg: formatNumber(ROAD_TRIP.answersPerLeg),
    total: formatNumber(TRIP_DESTINATION), bonus: formatNumber(ROAD_TRIP.paceBonus), step: formatNumber(ROAD_TRIP.streakStep),
    max: formatNumber(ROAD_TRIP.maxMultiplier), size: formatNumber(size),
    seen: formatNumber(coverage.seen), bank: formatNumber(coverage.total), percent: formatNumber(coverage.percent),
    fresh: formatNumber(Math.min(size, TRIP_MAX_QUESTIONS - TRIP_REPAIR_QUESTIONS)), repair: formatNumber(TRIP_REPAIR_QUESTIONS), trips: formatNumber(coverage.trips),
  };
  const icons = { lanes: "1·2·3", lives: formatNumber(ROAD_TRIP.spareMistakes), road: "→", streak: `×${formatNumber(ROAD_TRIP.maxMultiplier)}`, pace: formatNumber(ROAD_TRIP.paceSeconds) };
  main().innerHTML = `<div class="page trip-page">
    ${view.notice()}
    <header class="page-header"><div><span class="eyebrow">${t("trip.eyebrow")}</span><h1>${t("trip.title")}</h1><p>${t("trip.subtitle", values)}</p></div></header>
    <section class="card trip-hero ${has3d ? "has-3d" : ""}" aria-labelledby="tripRouteTitle">
      ${has3d ? '<div class="trip-hero-stage"><div id="tripCanvasSlot"></div></div>' : ""}
      <h2 id="tripRouteTitle">${t("trip.routeTitle", { from: stopName(0), to: stopName(STOPS.length - 1) })}</h2>
      <p>${t("trip.routeHelp", values)}</p>
      ${routeMarkup(records.trips ? tripStopIndex(records.farthest) : -1)}
      <div class="trip-hero-actions"><button class="button button-accent" id="tripStart" type="button">${t("trip.start")} →</button><span>${t("trip.startMeta", values)}</span></div>
      <div class="trip-coverage">
        <div class="trip-coverage-head"><strong>${t("trip.coverageTitle")}</strong><span>${t("trip.coverageValue", values)}</span></div>
        <div class="meter" style="--value:${coverage.total ? coverage.seen / coverage.total * 100 : 0}%"><span></span></div>
        <p>${t(coverage.remaining ? "trip.coverageHelp" : "trip.coverageDone", values)}</p>
      </div>
    </section>
    <div class="section-heading"><h2>${t("trip.rulesTitle")}</h2></div>
    <section class="trip-rules">${Object.entries(icons).map(([rule, icon]) => `<article class="task-card"><div class="task-top"><span class="task-icon" aria-hidden="true">${icon}</span></div><h3>${t(`trip.rule.${rule}.title`)}</h3><p>${t(`trip.rule.${rule}.body`, values)}</p></article>`).join("")}</section>
    <p class="trip-note">${t("trip.studyNote")}</p>
    <div class="section-heading"><div><h2>${t("trip.recordsTitle")}</h2><p>${t("trip.recordsLocal")}</p></div></div>
    <section class="stat-grid">
      <article class="card stat-card"><span>${t("trip.record.best")}</span><strong>${formatNumber(records.bestScore)}</strong><small>${t("trip.record.bestHelp")}</small></article>
      <article class="card stat-card"><span>${t("trip.record.farthest")}</span><strong>${records.trips ? stopName(tripStopIndex(records.farthest)) : "—"}</strong><small>${t("trip.record.farthestHelp", { count: formatNumber(records.farthest), total: values.total })}</small></article>
      <article class="card stat-card"><span>${t("trip.record.examPasses")}</span><strong>${formatNumber(records.examPasses)}</strong><small>${t("trip.record.examPassesHelp", values)}</small></article>
      <article class="card stat-card"><span>${t("trip.record.trips")}</span><strong>${formatNumber(records.trips)}</strong><small>${t("trip.record.tripsHelp")}</small></article>
    </section>
  </div>`;
  mountStage();
  find("#tripStart").addEventListener("click", () => { void startTrip(); });
}

const main = () => view.main;

async function startTrip() {
  const selected = selectRoadTripQuestions(view.questions(), view.profile());
  if (!selected.length) return;
  if (view.language() === "ru") {
    // Keep playing from the available wording if the optional Russian overlay cannot load.
    try { await view.ensureRussian(); } catch { view.showToast(view.t("quiz.russianLoadError")); }
  }
  trip = createRoadTrip(selected);
  finish = null;
  flash = null;
  aimed = null;
  seenAtStart = tripCoverage(view.questions(), view.profile()).seen;
  const scene = ensureStage();
  scene?.reset();
  scene?.announce(stopName(0));
  scene?.question(selected[0].answers.length);
  renderDrive();
  focusHeading(".trip-intro h1");
}

function renderDrive() {
  const { t, escapeHtml, formatNumber } = view;
  document.body.dataset.trip = "driving";
  const question = trip.questions[trip.index];
  const language = view.language();
  const answer = trip.answers[trip.index];
  const text = (item) => item?.[language] || item?.en || item?.pt || "";
  const last = STOPS.length - 1;
  const from = Math.min(last - 1, tripStopIndex(trip.correct));
  const legDone = trip.correct >= TRIP_DESTINATION ? ROAD_TRIP.answersPerLeg : trip.correct % ROAD_TRIP.answersPerLeg;
  const at = positionOf(trip.correct);
  const before = flash?.correct ? positionOf(trip.correct - 1) : at;
  const sparesLeft = Math.max(0, ROAD_TRIP.spareMistakes - trip.mistakes);
  const has3d = Boolean(ensureStage());
  const coverage = tripCoverage(view.questions(), view.profile());
  if (answer) aimed = null;
  const number = trip.index + 1;
  const optionNumber = (key) => formatNumber(question.answers.findIndex((item) => item.key === key) + 1);
  const id = question.sourceId || question.id;
  const image = question.image
    ? `<a class="question-image-link" href="${escapeHtml(question.image)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t("quiz.openImage", { id }))}"><img src="${escapeHtml(view.imagePath(question))}" alt="${escapeHtml(t("quiz.imageAlt", { id }))}" referrerpolicy="no-referrer" /></a>`
    : `<div class="image-fallback"><strong>${t("quiz.textOnly")}</strong><br><br>${t("quiz.imageNotRequired")}</div>`;
  const explanation = question.explanation?.[language] || question.explanation?.[view.uiLanguage()] || question.explanation?.en
    || t("quiz.correctAnswer", { answer: text(question.answers.find((item) => item.key === question.correct)) || question.correct });
  const warning = !answer || answer.correct ? "" : trip.outcome === "crashed" ? t("trip.crashed")
    : sparesLeft === 0 ? t("trip.lastSpare") : t("trip.sparesLeft", { count: formatNumber(sparesLeft) });
  const feedback = answer ? `<div class="feedback ${answer.correct ? "" : "incorrect"}" id="tripFeedback" tabindex="-1" role="status">
      <div class="feedback-heading"><span>${answer.correct ? "✓" : "!"}</span><strong>${answer.correct ? t("quiz.correct") : t("quiz.studyKey", { answer: optionNumber(question.correct) })}</strong>${answer.correct ? `<b class="trip-gain">+${formatNumber(answer.points)}</b>` : ""}</div>
      ${answer.correct ? `<p class="trip-gain-detail">${t("trip.gainDetail", { base: formatNumber(ROAD_TRIP.basePoints), pace: formatNumber(answer.pace), multiplier: formatNumber(answer.multiplier) })}</p>` : `<p class="trip-warning">${warning}</p>`}
      ${answer.stop !== null ? `<p class="trip-arrival">${t(answer.stop === last ? "trip.arrivedFinal" : "trip.arrived", { city: stopName(answer.stop), points: formatNumber(answer.stopBonus) })}</p>` : ""}
      <p>${escapeHtml(explanation)}</p>${view.explanationSourceLink(question)}
      <small>${t(answer.correct ? "quiz.returnLater" : "quiz.returnSooner")}</small>
    </div>${view.verificationMarkup(question, true)}` : "";
  main().innerHTML = `<div class="page question-page trip-page">
    ${view.notice()}
    <div class="trip-stage ${has3d ? "has-3d" : ""}">
    ${has3d ? '<div id="tripCanvasSlot"></div>' : ""}
    <div class="trip-hud">
      <button class="icon-button" id="tripEnd" type="button" aria-label="${escapeHtml(t("trip.end"))}">×</button>
      <div class="trip-track" role="img" aria-label="${escapeHtml(t("trip.routeLabel", { from: stopName(from), to: stopName(from + 1), done: formatNumber(legDone), total: formatNumber(ROAD_TRIP.answersPerLeg) }))}">
        <div class="trip-road" style="--at:${at}%;--from:${before}%"><span class="trip-road-done"></span>${STOPS.map((_, index) => `<i class="${index * ROAD_TRIP.answersPerLeg <= trip.correct ? "is-reached" : ""}" style="--stop:${index / last * 100}%"></i>`).join("")}${CAR}</div>
        <div class="trip-leg"><strong>${stopName(from)} → ${stopName(from + 1)}</strong><span>${formatNumber(legDone)}/${formatNumber(ROAD_TRIP.answersPerLeg)}</span></div>
      </div>
      <div class="trip-score ${flash?.correct ? "is-gain" : ""}"><small>${t("trip.score")}</small><strong>${formatNumber(trip.score)}</strong></div>
    </div>
    </div>
    <div class="trip-status">
      <span class="trip-chip trip-spares ${flash && !flash.correct ? "is-hit" : ""}" role="img" aria-label="${escapeHtml(t("trip.sparesLabel", { count: formatNumber(sparesLeft), total: formatNumber(ROAD_TRIP.spareMistakes) }))}">${Array.from({ length: ROAD_TRIP.spareMistakes }, (_, index) => `<i class="${index < sparesLeft ? "" : "is-used"}"></i>`).join("")}<span>${t("trip.spares")}</span></span>
      <span class="trip-chip trip-streak ${tripMultiplier(trip.streak + 1) > 1 ? "is-hot" : ""}">${t("trip.streak", { count: formatNumber(trip.streak), multiplier: formatNumber(tripMultiplier(trip.streak + 1)) })}</span>
      <span class="trip-chip">${t(trip.examMistakes === null ? "trip.examProgress" : "trip.examCleared", { number: formatNumber(number), total: formatNumber(ROAD_TRIP.examLength) })}</span>
      <span class="trip-chip">${t("trip.bankChip", { seen: formatNumber(coverage.seen), total: formatNumber(coverage.total) })}</span>
    </div>
    <article class="card trip-card ${flash && !flash.correct ? "is-shake" : ""}">
      <div class="trip-intro">
        <div class="question-tools"><span class="question-topic">${escapeHtml(view.topicName(question.topic, language))}</span><div class="language-toggle" role="group" aria-label="${escapeHtml(t("aria.questionLanguage"))}">${["en", "ru", "pt"].map((value) => `<button type="button" class="${language === value ? "active" : ""}" data-trip-lang="${value}" aria-pressed="${language === value}">${value.toUpperCase()}</button>`).join("")}</div></div>
        <h1>${escapeHtml(text(question.text))}</h1>
      </div>
      <div class="question-visual"><div class="question-image-frame">${image}</div><div class="image-links"><a class="source-pill" href="${escapeHtml(question.sourceUrl)}" target="_blank" rel="noopener">${t("quiz.source", { id: escapeHtml(id) })}</a>${question.image ? `<a class="full-image-link" href="${escapeHtml(question.image)}" target="_blank" rel="noopener">${t("quiz.fullImage")}</a>` : ""}</div></div>
      <div class="trip-body">
        ${answer ? "" : `<div class="trip-pace"><span>${t("trip.pace")}</span><span class="trip-pace-bar" aria-hidden="true"><i id="tripPaceBar"></i></span><b id="tripPaceValue" aria-hidden="true"></b></div>`}
        <div class="answers">${question.answers.map((option, index) => {
          const picked = answer?.pick === option.key;
          const status = answer && option.key === question.correct ? "correct" : picked ? "wrong" : "";
          const marker = answer && option.key === question.correct ? "✓" : picked ? "×" : "";
          if (!answer && index === aimed) return `<button class="answer-option is-aimed" type="button" data-trip-answer="${escapeHtml(option.key)}" aria-pressed="false"><span class="answer-key">${index + 1}</span><span>${escapeHtml(text(option))}</span><span class="answer-marker"></span></button>`;
          return `<button class="answer-option ${status}" type="button" data-trip-answer="${escapeHtml(option.key)}" aria-pressed="${picked}" ${answer ? "disabled" : ""}><span class="answer-key">${index + 1}</span><span>${escapeHtml(text(option))}</span><span class="answer-marker">${marker}</span></button>`;
        }).join("")}</div>
        ${feedback}
        <div class="quiz-actions"><span class="quiz-hint">${t("trip.keyboardHint")}</span><button class="button ${answer ? "button-primary" : "button-accent"}" id="tripContinue" type="button" ${answer || aimed !== null ? "" : "disabled"}>${answer ? t(trip.outcome ? "trip.toSummary" : "trip.continue") : aimed !== null ? t("trip.driveLane", { number: formatNumber(aimed + 1) }) : t("quiz.selectAnswer")} →</button></div>
      </div>
    </article>
  </div>`;
  flash = null;
  mountStage();
  find("#tripEnd").addEventListener("click", stopTrip);
  find("#tripContinue").addEventListener("click", () => {
    if (trip.checked) driveOn();
    else if (aimed !== null) pick(trip.questions[trip.index].answers[aimed].key);
  });
  findAll("[data-trip-answer]").forEach((button, lane) => {
    button.addEventListener("click", () => pick(button.dataset.tripAnswer));
    // Looking at an answer steers the car towards its lane.
    button.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") setAim(lane); });
    button.addEventListener("focus", () => setAim(lane));
  });
  findAll("[data-trip-lang]").forEach((button) => button.addEventListener("click", () => { void view.setQuestionLanguage(button.dataset.tripLang); }));
  const img = find(".question-visual img");
  if (img) img.addEventListener("error", () => {
    if (!img.dataset.remoteFallback) { img.dataset.remoteFallback = "true"; img.src = question.image; return; }
    img.replaceWith(Object.assign(document.createElement("div"), { className: "image-fallback", innerHTML: `<strong>${t("quiz.imageUnavailable")}</strong><br><br>${t("quiz.openSource")}` }));
  });
  if (!answer) startPace();
}

// The pace bar only shows a shrinking bonus. Reaching zero costs nothing and never answers for the player.
function startPace() {
  clearInterval(paceTimer);
  const tick = () => {
    const bar = view.main.querySelector("#tripPaceBar");
    if (!bar || !trip || trip.checked || trip.finished) { clearInterval(paceTimer); return; }
    const bonus = tripPaceBonus(Date.now() - trip.shownAt);
    bar.style.width = `${bonus / ROAD_TRIP.paceBonus * 100}%`;
    view.main.querySelector("#tripPaceValue").textContent = `+${view.formatNumber(bonus)}`;
    if (!bonus) clearInterval(paceTimer);
  };
  tick();
  paceTimer = setInterval(tick, 1000);
}

function pick(key) {
  const answer = answerRoadTrip(trip, key);
  if (!answer) return;
  const question = trip.questions[trip.index];
  view.record(question, answer.correct);
  aimed = null;
  stage?.scene?.resolve(question.answers.findIndex((option) => option.key === key), question.answers.findIndex((option) => option.key === question.correct));
  if (answer.stop !== null) stage?.scene?.announce(stopName(answer.stop));
  flash = answer;
  renderDrive();
  const feedback = find("#tripFeedback");
  feedback.focus({ preventScroll: true });
  feedback.scrollIntoView({ block: "nearest", behavior: "instant" });
}

function driveOn() {
  if (!trip || !advanceRoadTrip(trip)) return;
  stage?.scene?.driveOn();
  if (trip.finished) { completeTrip(); return; }
  aimed = null;
  stage?.scene?.question(trip.questions[trip.index].answers.length);
  renderDrive();
  focusHeading(".trip-intro h1");
}

function stopTrip() {
  if (!trip || trip.finished || !confirm(view.t("trip.endConfirm"))) return;
  endRoadTrip(trip);
  if (trip.answers.some(Boolean)) { completeTrip(); return; }
  // Nothing was answered, so there is no trip to score.
  trip = null;
  stage?.scene?.reset(true);
  renderLobby();
  focusHeading(".page-header h1");
}

function completeTrip() {
  const summary = roadTripSummary(trip);
  const { records, newBest } = recordRoadTrip(loadRecords(), summary);
  saveRecords(records);
  finish = { summary, newBest };
  renderFinish();
  focusHeading(".result-card h1");
}

function renderFinish() {
  const { t, formatNumber } = view;
  document.body.dataset.trip = "finished";
  const { summary, newBest } = finish;
  const language = view.language();
  const city = stopName(summary.stop);
  const values = {
    city, answered: formatNumber(summary.answered), total: formatNumber(ROAD_TRIP.examLength), correct: formatNumber(summary.correct),
    mistakes: formatNumber(summary.examPassed ? summary.examMistakes : summary.mistakes), allowed: formatNumber(ROAD_TRIP.spareMistakes),
    destination: formatNumber(TRIP_DESTINATION),
  };
  const coverage = tripCoverage(view.questions(), view.profile());
  Object.assign(values, {
    fresh: formatNumber(Math.max(0, coverage.seen - seenAtStart)), seen: formatNumber(coverage.seen),
    bank: formatNumber(coverage.total), percent: formatNumber(coverage.percent),
  });
  const exam = summary.examPassed ? "passed" : summary.outcome === "crashed" ? "failed" : "short";
  const missed = trip.questions.map((question, index) => ({ question, answer: trip.answers[index] })).filter(({ answer }) => answer && !answer.correct);
  const review = missed.length ? `<section class="result-review"><div class="section-heading"><div><h2>${t("result.review")}</h2><p>${t("result.reviewHelp")}</p></div></div>${missed.map(({ question, answer }) => view.reviewItem(question, answer, language)).join("")}</section>` : "";
  main().innerHTML = `<div class="page trip-page">${view.notice()}<article class="card result-card trip-result">
    <span class="eyebrow">${t("trip.finishEyebrow")}</span>
    <div class="result-orb trip-orb">${formatNumber(summary.score)}</div>
    ${newBest ? `<p class="trip-new-best">★ ${t("trip.newBest")}</p>` : ""}
    <h1>${t(`trip.finish.${summary.outcome}.title`, values)}</h1>
    <p>${t(`trip.finish.${summary.outcome}.body`, values)}</p>
    <div class="run-verdict ${exam === "passed" ? "is-pass" : exam === "failed" ? "is-fail" : ""}"><span class="run-verdict-badge">${exam === "passed" ? "✓ " : exam === "failed" ? "✕ " : ""}${t(`trip.exam.${exam}`)}</span><p>${t(`trip.exam.${exam}Help`, values)}</p></div>
    <div class="result-stats"><div><strong>${formatNumber(summary.correct)}</strong><span>${t("trip.stat.correct")}</span></div><div><strong>${formatNumber(summary.mistakes)}</strong><span>${t("trip.stat.mistakes")}</span></div><div><strong>${formatNumber(summary.bestStreak)}</strong><span>${t("trip.stat.bestStreak")}</span></div><div><strong>${city}</strong><span>${t("trip.stat.city")}</span></div></div>
    <p class="trip-finish-coverage">${t("trip.finishCoverage", values)}</p>
    <div class="result-actions"><button class="button button-secondary" id="tripLobby" type="button">${t("trip.toLobby")}</button><button class="button button-accent" id="tripAgain" type="button">${t("trip.again")} →</button></div>
  </article>${review}</div>`;
  find("#tripAgain").addEventListener("click", () => { void startTrip(); });
  find("#tripLobby").addEventListener("click", () => {
    trip = null;
    finish = null;
    stage?.scene?.reset(true);
    renderLobby();
    focusHeading(".page-header h1");
  });
  findAll(".review-image img").forEach((image) => image.addEventListener("error", () => {
    if (!image.dataset.remoteFallback) { image.dataset.remoteFallback = "true"; image.src = image.dataset.remoteImage; }
  }));
}

// Returns true when the key belonged to the trip, so app.js can skip its own shortcuts.
export function handleRoadTripKey(event) {
  if (!roadTripActive()) return false;
  const question = trip.questions[trip.index];
  if (["1", "2", "3", "4"].includes(event.key)) {
    const option = question.answers[Number(event.key) - 1];
    if (!option || trip.checked) return false;
    event.preventDefault();
    pick(option.key);
    return true;
  }
  const free = !event.target.closest("button, a, summary");
  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !trip.checked) {
    const count = question.answers.length, step = event.key === "ArrowLeft" ? -1 : 1;
    const middle = (count - 1) / 2;
    event.preventDefault();
    setAim(aimed === null ? (step < 0 ? Math.floor(middle) : Math.ceil(middle)) : Math.max(0, Math.min(count - 1, aimed + step)));
    return true;
  }
  if ((event.key === "Enter" || event.key === " ") && !trip.checked && aimed !== null && free) {
    event.preventDefault();
    pick(question.answers[aimed].key);
    return true;
  }
  if (event.key === "Enter" && trip.checked && (event.target.closest("[data-trip-answer]") || !event.target.closest("button, a, summary"))) {
    event.preventDefault();
    driveOn();
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    stopTrip();
    return true;
  }
  return false;
}
