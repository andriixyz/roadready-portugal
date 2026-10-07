// General maxima from Código da Estrada, art. 27(1), checked 7 October 2026.
// Road order here: town, other roads, roads reserved for cars/motorcycles, motorway.
const LIMITS = Object.freeze({
  passenger: Object.freeze({ solo: [50, 90, 100, 120], trailer: [50, 70, 80, 100] }),
  goods: Object.freeze({ solo: [50, 80, 90, 110], trailer: [50, 70, 80, 90] }),
});
const CODE = "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830";
const TABLE = "https://files.diariodarepublica.pt/1s/2013/09/16900/0544605499.pdf#page=3";
const SIGNS = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729";
const ROADS = [
  { id: "town", pt: "Dentro das localidades", sign: "N1" },
  { id: "ordinary", pt: "Restantes vias públicas", sign: "" },
  { id: "reserved", pt: "Vias reservadas a automóveis e motociclos", sign: "H25" },
  { id: "motorway", pt: "Autoestradas", sign: "H24" },
];
// Author-created recall questions, separate from the IMT comparison/study bank.
const DRILLS = [
  { id: "town", choices: [30, 50, 90], correct: 50, source: TABLE },
  { id: "ordinary", choices: [80, 90, 100], correct: 90, source: TABLE },
  { id: "reserved", choices: [90, 100, 120], correct: 100, source: TABLE },
  { id: "motorway", choices: [100, 110, 120], correct: 120, source: TABLE },
  { id: "shared", choices: [20, 30, 50], correct: 20, source: TABLE },
  { id: "towRoad", choices: [70, 80, 90], correct: 70, source: TABLE },
  { id: "towMotorway", choices: [80, 100, 120], correct: 100, source: TABLE },
  { id: "goods", choices: [90, 110, 120], correct: 110, source: TABLE },
  { id: "goodsTow", choices: [80, 90, 100], correct: 90, source: TABLE },
  { id: "posted", choices: [80, 100, 120], correct: 80, source: CODE },
  { id: "minimum", choices: [40, 50, 60], correct: 50, source: CODE },
  { id: "weather", choices: ["match", "adapt", "sign"], correct: "adapt", source: CODE },
];

// Memory-map and drill state survive language/sync renders, without saving answers.
const state = { vehicle: "passenger", trailer: false, covered: false, started: false, index: 0, picked: null, score: 0 };

function roadPicture(road) {
  const art = {
    town: '<rect x="10" y="20" width="100" height="44" rx="3" fill="var(--surface)" stroke="currentColor" stroke-width="2"/><text x="60" y="49" text-anchor="middle" fill="currentColor" font-size="19" font-family="sans-serif" font-weight="800">PORTO</text><path d="M35 64v18m50-18v18" stroke="currentColor" stroke-width="3"/>',
    ordinary: '<path d="M19 85C-3 42 112 58 73 8M47 91C18 53 136 66 104 13" fill="none" stroke="currentColor" stroke-width="3"/><path d="M33 89C10 44 124 62 90 11" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="8 8"/><circle cx="23" cy="19" r="10" fill="var(--orange-soft)"/>',
    reserved: '<rect x="22" y="5" width="76" height="76" rx="5" fill="#24649a"/><rect x="28" y="11" width="64" height="64" rx="2" fill="none" stroke="white" stroke-width="2"/><path d="M42 43l5-17h26l5 17v17H42Z" fill="white"/><path d="M49 30h22l3 12H46Z" fill="#24649a"/><circle cx="48" cy="51" r="3" fill="#24649a"/><circle cx="72" cy="51" r="3" fill="#24649a"/><path d="M46 60v6m28-6v6" stroke="white" stroke-width="6"/>',
    motorway: '<rect x="22" y="5" width="76" height="76" rx="5" fill="#24649a"/><rect x="28" y="11" width="64" height="64" rx="2" fill="none" stroke="white" stroke-width="2"/><path d="M38 69l14-46h5L46 69Zm36 0L63 23h5l14 46Z" fill="white"/><path d="M34 40h52M39 40v12m42-12v12" stroke="white" stroke-width="5"/>',
  };
  return `<svg class="speed-road-picture" viewBox="0 0 120 96" aria-hidden="true">${art[road]}</svg>`;
}

function speedSign(value, covered = false, small = false) {
  return `<span class="speed-sign${small ? " speed-sign-small" : ""}${covered ? " is-covered" : ""}"><span class="speed-number"${covered ? ' aria-hidden="true"' : ""}>${value}</span>${covered ? '<span class="speed-mask" aria-hidden="true">?</span>' : ""}</span>`;
}

export function renderSpeedLimits(root, { t, escapeHtml, onPractice }, focusSelector) {
  const limits = LIMITS[state.vehicle][state.trailer ? "trailer" : "solo"];
  const vehicleKey = `${state.vehicle}.${state.trailer ? "trailer" : "solo"}`;
  const link = (url, label) => `<a class="text-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
  const choices = (question) => question.choices.map((choice, index) => {
    const answered = state.picked !== null;
    const correct = answered && choice === question.correct;
    const wrong = answered && choice === state.picked && !correct;
    const label = typeof choice === "number" ? `${choice} ${t("speed.unit")}` : t(`speed.drill.weather.${choice}`);
    return `<button type="button" class="speed-choice${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}" data-speed-answer="${index}" aria-disabled="${answered}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(label)}${correct || wrong ? `<b aria-label="${escapeHtml(t(correct ? "speed.correct" : "speed.incorrect"))}">${correct ? "✓" : "×"}</b>` : ""}</button>`;
  }).join("");
  const drillMarkup = () => {
    if (!state.started) return `<div class="speed-drill-intro"><span class="speed-drill-symbol" aria-hidden="true">↺</span><h3>${t("speed.drill.startTitle")}</h3><p>${t("speed.drill.startHelp")}</p><button class="button button-primary" type="button" data-speed-start>${t("speed.drill.start")}</button></div>`;
    if (state.index === DRILLS.length) return `<div class="speed-drill-intro"><span class="speed-drill-score">${state.score}<small> / ${DRILLS.length}</small></span><h3 id="speedDrillQuestion" tabindex="-1">${t(state.score === DRILLS.length ? "speed.drill.perfect" : "speed.drill.finished")}</h3><p>${t("speed.drill.finishHelp")}</p><div class="speed-drill-actions"><button class="button button-primary" type="button" data-speed-start>${t("speed.drill.again")}</button><button class="button button-ghost" type="button" data-speed-practice>${t("speed.practice")}</button></div></div>`;
    const question = DRILLS[state.index];
    return `<div class="speed-drill-top"><span class="eyebrow">${t("speed.drill.counter", { current: state.index + 1, total: DRILLS.length })}</span><span>${t("speed.drill.score", { score: state.score })}</span></div><h3 id="speedDrillQuestion" tabindex="-1">${t(`speed.drill.${question.id}.question`)}</h3><div class="speed-choices">${choices(question)}</div>${state.picked !== null ? `<div class="speed-drill-feedback" id="speedDrillFeedback" tabindex="-1"><strong>${t(state.picked === question.correct ? "speed.correct" : "speed.drill.notQuite")}</strong><p>${t(`speed.drill.${question.id}.why`)}</p>${link(question.source, t("speed.ruleSource"))}</div><button class="button button-primary speed-drill-next" type="button" data-speed-next>${t(state.index === DRILLS.length - 1 ? "speed.drill.finish" : "speed.drill.next")} →</button>` : ""}`;
  };

  root.innerHTML = `<div class="page speed-page">
    <header class="speed-header"><div><span class="eyebrow">${t("speed.eyebrow")}</span><h1>${t("speed.title")}</h1><p>${t("speed.subtitle")}</p></div><button class="button button-ghost speed-print" type="button" data-speed-print><span aria-hidden="true">↓</span> ${t("speed.print")}</button></header>

    <section class="speed-map" aria-labelledby="speedMapTitle">
      <div class="speed-map-heading"><div><span class="speed-step">01 / ${t("speed.learn")}</span><h2 id="speedMapTitle">${t("speed.mapTitle")}</h2></div><span class="speed-map-unit">${t("speed.unit")}</span></div>
      <div class="speed-controls"><div class="speed-vehicle-switch" role="group" aria-label="${t("speed.vehicleLabel")}"><button type="button" data-speed-vehicle="passenger" aria-pressed="${state.vehicle === "passenger"}">${t("speed.passenger")}</button><button type="button" data-speed-vehicle="goods" aria-pressed="${state.vehicle === "goods"}">${t("speed.goods")}</button></div><label class="speed-trailer"><input type="checkbox" id="speedTrailer"${state.trailer ? " checked" : ""}/><span>${t("speed.trailer")}</span></label><button class="speed-cover" type="button" data-speed-cover aria-pressed="${state.covered}">${t(state.covered ? "speed.reveal" : "speed.cover")}</button></div>
      <p class="speed-scope">${t(`speed.vehicle.${vehicleKey}`)} · ${t("speed.defaults")}</p>
      <ol class="speed-road-grid">${ROADS.map((road, index) => `<li class="speed-road-card"><span class="speed-road-count" aria-hidden="true">0${index + 1}</span>${roadPicture(road.id)}<div class="speed-road-value" aria-label="${escapeHtml(state.covered ? t("speed.hiddenLimit") : `${limits[index]} ${t("speed.unit")}`)}">${speedSign(limits[index], state.covered)}</div><h3>${t(`speed.road.${road.id}`)}</h3><p lang="pt">${road.pt}</p><span class="speed-road-cue">${t(`speed.cue.${road.id}`)}${road.sign ? ` <b>${road.sign}</b>` : ""}</span></li>`).join("")}</ol>
      <div class="speed-rhythm"><span aria-hidden="true">↗</span><div><strong>${t(state.covered ? "speed.recallCue" : "speed.chant", { numbers: limits.join(" · ") })}</strong><p>${t(state.covered ? "speed.coverHelp" : `speed.memory.${vehicleKey}`)}</p></div></div>
      <div class="speed-shared">${speedSign(20, false, true)}<div><strong>${t("speed.sharedTitle")}</strong><p>${t("speed.sharedHelp")}</p></div><span class="speed-shared-tag" lang="pt">Zona de coexistência · H46</span></div>
      <p class="speed-map-note">${t("speed.scopeHelp")} ${link(TABLE, t("speed.tableSource"))}</p>
    </section>

    <div class="speed-section-heading"><span class="speed-step">02 / ${t("speed.notice")}</span><h2>${t("speed.trapsTitle")}</h2><p>${t("speed.trapsHelp")}</p></div>
    <section class="speed-traps" aria-label="${t("speed.trapsTitle")}">
      <article class="speed-trap"><span class="speed-trap-index">A</span><h3>${t("speed.signsTitle")}</h3><div class="speed-sign-examples"><div>${speedSign(80, false, true)}<strong>${t("speed.maximum")}</strong><small>C13</small></div><div><span class="speed-blue-circle">50</span><strong>${t("speed.minimum")}</strong><small>D8</small></div><div><span class="speed-blue-square">40</span><strong>${t("speed.advisory")}</strong><small>H6</small></div></div><p>${t("speed.signsHelp")}</p>${link(SIGNS, t("speed.signSource"))}</article>
      <article class="speed-trap"><span class="speed-trap-index">B</span><h3>${t("speed.postedTitle")}</h3><p>${t("speed.postedHelp")}</p><div class="speed-example"><span>${t("speed.postedExample")}</span><strong>80 ${t("speed.unit")}</strong></div><p>${t("speed.goodsSignHelp")}</p>${link(CODE, t("speed.articles2728"))}</article>
      <article class="speed-trap"><span class="speed-trap-index">C</span><h3>${t("speed.floorTitle")}</h3><div class="speed-floor"><strong>50</strong><span>${t("speed.floorLabel")}</span></div><p>${t("speed.floorHelp")}</p><p class="speed-trap-extra">${t("speed.accessHelp")}</p>${link(CODE, t("speed.articles2772"))}</article>
      <article class="speed-trap"><span class="speed-trap-index">D</span><h3>${t("speed.weatherTitle")}</h3><div class="speed-condition-icons" aria-hidden="true">☂ <span>≋</span> ↱</div><p>${t("speed.weatherHelp")}</p><strong class="speed-stop-cue">${t("speed.weatherCue")}</strong>${link(CODE, t("speed.articles2425"))}</article>
    </section>

    <section class="speed-recall" aria-labelledby="speedRecallTitle"><div class="speed-recall-heading"><span class="speed-step">03 / ${t("speed.recall")}</span><h2 id="speedRecallTitle">${t("speed.drill.title")}</h2><p>${t("speed.drill.help")}</p><div class="speed-recall-plan"><span>1</span>${t("speed.repeat.now")}<span>2</span>${t("speed.repeat.later")}<span>3</span>${t("speed.repeat.tomorrow")}</div><button class="button button-ghost" type="button" data-speed-practice>${t("speed.practice")} ↗</button></div><div class="speed-drill" id="speedDrill">${drillMarkup()}</div></section>

    <footer class="speed-sources"><strong>${t("speed.sourcesTitle")}</strong><p>${t("speed.checked")}</p><div>${link(CODE, "Código da Estrada · 24–28, 72")}${link(TABLE, t("speed.tableSource"))}${link(SIGNS, t("speed.signSource"))}</div><p>${t("speed.sourceScope")}</p></footer>
    <div class="speed-print-sheet"><h2>${t("speed.printTitle")}</h2><table><caption>${t("speed.defaults")} · ${t("speed.unit")}</caption><thead><tr><th scope="col">${t("speed.vehicleLabel")}</th>${ROADS.map((road) => `<th scope="col">${t(`speed.road.${road.id}`)}</th>`).join("")}</tr></thead><tbody>${Object.entries(LIMITS).flatMap(([vehicle, variants]) => Object.entries(variants).map(([variant, values]) => `<tr><th scope="row">${t(`speed.vehicle.${vehicle}.${variant}`)}</th>${values.map((value) => `<td>${value}</td>`).join("")}</tr>`)).join("")}</tbody></table><p>${t("speed.printContext")}</p><p><strong>20 ${t("speed.unit")}</strong> · ${t("speed.sharedTitle")} · Zona de coexistência</p><p>${t("speed.weatherCue")} · ${t("speed.floorLabel")}: 50 ${t("speed.unit")}</p></div>
  </div>`;

  const renderAgain = (focus) => renderSpeedLimits(root, { t, escapeHtml, onPractice }, focus);
  root.querySelectorAll("[data-speed-vehicle]").forEach((button) => button.addEventListener("click", () => {
    state.vehicle = button.dataset.speedVehicle;
    renderAgain(`[data-speed-vehicle="${state.vehicle}"]`);
  }));
  root.querySelector("#speedTrailer").addEventListener("change", (event) => {
    state.trailer = event.target.checked;
    renderAgain("#speedTrailer");
  });
  root.querySelector("[data-speed-cover]").addEventListener("click", () => {
    state.covered = !state.covered;
    renderAgain("[data-speed-cover]");
  });
  root.querySelector("[data-speed-print]").addEventListener("click", () => window.print());
  root.querySelectorAll("[data-speed-practice]").forEach((button) => button.addEventListener("click", onPractice));
  root.querySelector("[data-speed-start]")?.addEventListener("click", () => {
    Object.assign(state, { started: true, index: 0, picked: null, score: 0 });
    renderAgain("#speedDrillQuestion");
  });
  root.querySelectorAll("[data-speed-answer]").forEach((button) => button.addEventListener("click", () => {
    if (state.picked !== null) return;
    const question = DRILLS[state.index];
    state.picked = question.choices[Number(button.dataset.speedAnswer)];
    if (state.picked === question.correct) state.score++;
    renderAgain("#speedDrillFeedback");
  }));
  root.querySelector("[data-speed-next]")?.addEventListener("click", () => {
    if (state.picked === null || state.index >= DRILLS.length) return;
    state.index++;
    state.picked = null;
    renderAgain("#speedDrillQuestion");
  });
  if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
}
