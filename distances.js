import { bindDrill, createDrill, deckChips, drillKeys, drillMarkup } from "./rule-drill.js?v=20261106-1";

// Distance atlas for Portugal: every metre the Category B exam asks about. Checked 6 November 2026 against the
// consolidated Código da Estrada (CE, last amended by Lei 24/2025) and the Regulamento de Sinalização do Trânsito
// (RST). Figures marked `bank` come from the study bank's vehicle-lighting questions and were not found in those
// texts. Research notes and question coverage: documentation/md/DISTANCES.md.
const CODE = "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830";
const SIGNS = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729";

// Art. 49–51. before/after are metres along the direction of travel (before = approaching the landmark).
// scope: stopPark = no stopping or parking; park = no parking (a brief stop is allowed). lateral = side gap.
const LANDMARKS = [
  { id: "crossing", before: 5, after: 0, scope: "stopPark", law: "CE 49.º/1 d)" },
  { id: "junction", before: 5, after: 5, scope: "stopPark", law: "CE 49.º/1 a)–b), 51.º" },
  { id: "busStop", before: 25, after: 5, scope: "stopPark", law: "CE 49.º/1 c)" },
  { id: "tramStop", before: 6, after: 0, scope: "stopPark", law: "CE 49.º/1 c)" },
  { id: "hiddenSign", before: 20, after: 0, scope: "stopPark", law: "CE 49.º/1 e)" },
  { id: "levelCrossing", before: 10, after: 10, scope: "park", law: "CE 49.º/1 a), 50.º/1 d)" },
  { id: "fuel", before: 5, after: 5, scope: "park", law: "CE 50.º/1 e)" },
  { id: "line", lateral: 3, scope: "stopPark", law: "CE 49.º/1 g)" },
  { id: "rural", before: 50, after: 50, scope: "stopPark", law: "CE 49.º/2 a), 51.º, 146.º a)" },
];
const NEVER = ["places", "islands", "outside", "motorway"];
// Art. 163: when parking becomes abusive (the vehicle may then be clamped or removed, art. 164).
// Units have their own key per clock so Russian plural forms stay correct (2 часа, 48 часов).
const CLOCKS = [{ id: "free", value: "30" }, { id: "carPark", value: "5" }, { id: "paid", value: "2" }, { id: "abandoned", value: "48" }, { id: "trailers", value: "72" }];

const DRIVE = [
  { id: "follow", law: "CE 18.º/1, 145.º/1 f)" }, { id: "cyclist", law: "CE 18.º/3, 38.º/2 e)" },
  { id: "slow", law: "CE 40.º" }, { id: "sign", law: "RST 24.º (C10), 64.º (M21)" },
  { id: "visibility", law: "CE 19.º, 41.º, 45.º, 47.º, 49.º" }, { id: "pedestrian", law: "CE 101.º/3" },
  { id: "long", law: "CE 74.º" }, { id: "reverse", law: "CE 46.º" },
];

// Art. 60–61 and 88. Bars are drawn on a 0–150 m scale.
const BEAMS = [
  { id: "dipped", metres: 30, law: "CE 60.º/1 b)" }, { id: "main", metres: 100, law: "CE 60.º/1 a)" },
  { id: "dip", metres: 100, law: "CE 61.º/1 b), 61.º/6" }, { id: "parked", metres: 100, law: "CE 61.º/1 a)" },
  { id: "triangle", metres: 30, law: "CE 88.º/3" }, { id: "triangleSeen", metres: 100, law: "CE 88.º/3" },
];
const BANK_FIGURES = [{ id: "sideLights", metres: 150 }, { id: "plate", metres: 20 }, { id: "reversing", metres: 10 }];
const LIGHT_FACTS = ["when", "vest", "exempt", "tunnel"];

const SIGN_ITEMS = [
  { id: "danger", law: "RST 20.º/1" }, { id: "panels", law: "RST 46.º–47.º" }, { id: "giveWay", law: "RST 22.º/2" },
  { id: "roundabout", law: "RST 22.º/7" }, { id: "posts", law: "RST 44.º (O2, O3)" }, { id: "works", law: "RST 96.º" },
  { id: "limits", law: "RST 24.º (C7–C9)" }, { id: "load", law: "CE 56.º/3 f)" }, { id: "plates", law: "", bank: true },
];
// Countdown markers: I9 level-crossing bars are 100 m each (RST 36.º); O4 exit bars 250 m on motorways, 150 m elsewhere (RST 44.º).
const COUNTDOWNS = [{ id: "levelBars", step: 100 }, { id: "exitMotorway", step: 250 }, { id: "exitOther", step: 150 }];

const DECKS = ["all", "parking", "driving", "signs"];
// Author-created recall questions, separate from the study bank. Numeric choices are metres.
const DRILLS = [
  { id: "crossing", deck: "parking", choices: [3, 5, 10], correct: 5, source: CODE },
  { id: "junction", deck: "parking", choices: ["each5", "before10", "each20"], correct: "each5", source: CODE },
  { id: "busBehind", deck: "parking", choices: [5, 15, 25], correct: 25, source: CODE },
  { id: "busAhead", deck: "parking", choices: [3, 5, 10], correct: 5, source: CODE },
  { id: "tram", deck: "parking", choices: [3, 6, 25], correct: 6, source: CODE },
  { id: "hiddenSign", deck: "parking", choices: [10, 20, 50], correct: 20, source: CODE },
  { id: "levelCrossing", deck: "parking", choices: [5, 10, 20], correct: 10, source: CODE },
  { id: "fuel", deck: "parking", choices: [3, 5, 10], correct: 5, source: CODE },
  { id: "line", deck: "parking", choices: [1.5, 3, 5], correct: 3, source: CODE },
  { id: "rural", deck: "parking", choices: [30, 50, 100], correct: 50, source: CODE },
  { id: "abandoned", deck: "parking", choices: ["day", "twoDays", "month"], correct: "twoDays", source: CODE },
  { id: "free", deck: "parking", choices: ["fifteen", "thirty", "sixty"], correct: "thirty", source: CODE },
  { id: "follow", deck: "driving", choices: ["thirty", "fifty", "stop"], correct: "stop", source: CODE },
  { id: "cyclist", deck: "driving", choices: [1, 1.5, 2], correct: 1.5, source: CODE },
  { id: "slow", deck: "driving", choices: [25, 50, 100], correct: 50, source: CODE },
  { id: "visibility", deck: "driving", choices: [30, 50, 100], correct: 50, source: CODE },
  { id: "pedestrian", deck: "driving", choices: [25, 50, 100], correct: 50, source: CODE },
  { id: "dipped", deck: "driving", choices: [30, 50, 100], correct: 30, source: CODE },
  { id: "main", deck: "driving", choices: [50, 100, 150], correct: 100, source: CODE },
  { id: "dip", deck: "driving", choices: [50, 100, 150], correct: 100, source: CODE },
  { id: "triangle", deck: "driving", choices: [10, 30, 100], correct: 30, source: CODE },
  { id: "triangleSeen", deck: "driving", choices: [30, 100, 150], correct: 100, source: CODE },
  { id: "danger", deck: "signs", choices: ["near", "standard", "far"], correct: "standard", source: SIGNS },
  { id: "giveWay", deck: "signs", choices: [25, 50, 100], correct: 50, source: SIGNS },
  { id: "levelBars", deck: "signs", choices: [50, 100, 150], correct: 100, source: SIGNS },
  { id: "exitMotorway", deck: "signs", choices: [100, 150, 250], correct: 250, source: SIGNS },
  { id: "exitOther", deck: "signs", choices: [100, 150, 250], correct: 150, source: SIGNS },
  { id: "panel", deck: "signs", choices: ["distance", "length", "speed"], correct: "length", source: SIGNS },
  { id: "load", deck: "signs", choices: [3.5, 4, 4.5], correct: 4, source: CODE },
  { id: "height", deck: "signs", choices: ["yes", "no"], correct: "yes", source: SIGNS },
];

// Chapter buttons scroll to these heading ids.
const CHAPTERS = [["parking", "distanceParking"], ["driving", "distanceDriving"], ["lights", "distanceLights"], ["signs", "distanceSigns"], ["recall", "distanceRecall"]];

// Page state survives language/sync renders, without saving anything. Reload resets it.
const state = { landmark: "crossing", cover: false };
const drill = createDrill();

function landmarkIcon(id) {
  const art = {
    crossing: '<path d="M6 4v24M26 4v24"/><path d="M10 9h12M10 14h12M10 19h12M10 24h12" stroke-width="3"/>',
    junction: '<path d="M12 3v9H3m0 8h9v9m8 0v-9h9m0-8h-9V3"/>',
    busStop: '<rect x="6" y="5" width="20" height="18" rx="3"/><path d="M6 15h20M10 27v-4m12 4v-4M11 10h10"/>',
    tramStop: '<rect x="8" y="8" width="16" height="16" rx="3"/><path d="M12 3h8M16 3v5M8 18h16M11 28l2-4m8 4-2-4"/>',
    hiddenSign: '<rect x="11" y="3" width="10" height="20" rx="3"/><circle cx="16" cy="8" r="2"/><circle cx="16" cy="13" r="2"/><circle cx="16" cy="18" r="2"/><path d="M16 23v6"/>',
    levelCrossing: '<path d="M6 6l20 20M26 6 6 26"/><path d="M3 29h26"/>',
    fuel: '<rect x="6" y="5" width="13" height="23" rx="2"/><path d="M9 10h7M19 13h3l3 3v8a2 2 0 0 1-4 0v-5"/>',
    line: '<path d="M8 3v26M13 3v26" stroke-width="3"/><rect x="19" y="9" width="9" height="15" rx="2"/>',
    rural: '<path d="M5 29C5 17 27 23 27 11c0-4-4-6-8-6"/><path d="M11 29c0-6 10-8 10-14" stroke-dasharray="3 3"/>',
  };
  return `<svg class="ruler-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art[id]}</g></svg>`;
}

export function renderDistances(root, { t, escapeHtml, onPractice, atlasNav = "", locale = "en-GB" }, focusSelector) {
  const link = (url, label) => `<a class="text-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const metres = (value) => `${number.format(value)} ${t("distance.unit")}`;
  const mask = `<span class="atlas-mask" role="img" aria-label="${escapeHtml(t("atlas.hidden"))}">?</span>`;
  const landmark = LANDMARKS.find((item) => item.id === state.landmark) || LANDMARKS[0];

  const chips = LANDMARKS.map((item) => {
    const value = item.lateral ? metres(item.lateral) : item.before && item.after && item.before !== item.after ? `${number.format(item.before)} / ${metres(item.after)}` : metres(item.before || item.after);
    return `<button type="button" class="speed-garage-chip ruler-chip" data-distance-landmark="${item.id}" aria-pressed="${state.landmark === item.id}">${landmarkIcon(item.id)}<span>${t(`distance.landmark.${item.id}.name`)}</span><b>${state.cover ? "?" : value}</b></button>`;
  }).join("");
  const zone = (value, side) => `<span class="ruler-zone is-${landmark.scope}" style="flex-grow:${Math.max(value, 4)}"><b>${state.cover ? "?" : metres(value)}</b><small>${t(`distance.side.${side}`)}</small></span>`;
  const diagram = landmark.lateral
    ? `<div class="ruler-lateral"><span class="ruler-line" aria-hidden="true"></span><span class="ruler-gap is-${landmark.scope}"><b>${state.cover ? "?" : `≥ ${metres(landmark.lateral)}`}</b><small>${t("distance.side.gap")}</small></span><span class="ruler-car" aria-hidden="true"></span></div>`
    : `<div class="ruler-road"><span class="ruler-free"></span>${landmark.before ? zone(landmark.before, "before") : ""}<span class="ruler-landmark">${landmarkIcon(landmark.id)}</span>${landmark.after ? zone(landmark.after, "after") : ""}<span class="ruler-free"></span></div><p class="ruler-direction"><span aria-hidden="true">→</span> ${t("distance.direction")}</p>`;
  const never = NEVER.map((item) => `<li>${t(`distance.never.${item}`)}</li>`).join("");
  const clocks = CLOCKS.map((item) => `<li><span class="deadline-value">${item.value}<small>${t(`distance.clockUnit.${item.id}`)}</small></span><p>${t(`distance.clock.${item.id}`)}</p></li>`).join("");

  // Hidden mode turns cards into flashcards: the bodies repeat the numbers, so they wait until the reveal.
  const cardBody = (key) => state.cover ? "" : `<p>${t(key)}</p>`;
  const driveCards = DRIVE.map((item) => `<li class="distance-card"><span class="distance-value">${state.cover ? "?" : t(`distance.drive.${item.id}.value`)}</span><h3>${t(`distance.drive.${item.id}.title`)}</h3>${cardBody(`distance.drive.${item.id}.body`)}<small lang="pt">${item.law}</small></li>`).join("");

  const beamBars = BEAMS.map((item) => `<div class="speed-bar beam-bar is-${item.id}"><span>${t(`distance.beam.${item.id}`)}</span><div class="speed-bar-track"><i style="width:${Math.min(100, item.metres / 150 * 100)}%"></i></div><output>${state.cover ? "?" : metres(item.metres)}</output></div>`).join("");
  const bankFigures = BANK_FIGURES.map((item) => `<li><b>${metres(item.metres)}</b> ${t(`distance.bank.${item.id}`)}</li>`).join("");
  const lightFacts = LIGHT_FACTS.map((fact) => `<li><strong>${t(`distance.lightFact.${fact}.title`)}</strong><p>${t(`distance.lightFact.${fact}.body`)}</p></li>`).join("");

  const countdown = COUNTDOWNS.map((item) => `<figure class="countdown"><div class="countdown-posts" aria-hidden="true">${[3, 2, 1].map((bars) => `<span class="countdown-post">${"<i></i>".repeat(bars)}<b>${state.cover ? "?" : number.format(bars * item.step)}</b></span>`).join("")}</div><figcaption><strong>${t(`distance.countdown.${item.id}`)}</strong> ${t("distance.countdownStep", { metres: state.cover ? "?" : metres(item.step) })}</figcaption></figure>`).join("");
  const signCards = SIGN_ITEMS.map((item) => `<li class="distance-card${item.bank ? " is-bank" : ""}"><span class="distance-value">${state.cover ? "?" : t(`distance.sign.${item.id}.value`)}</span><h3>${t(`distance.sign.${item.id}.title`)}</h3>${cardBody(`distance.sign.${item.id}.body`)}<small${item.bank ? "" : ' lang="pt"'}>${item.bank ? t("atlas.bankFigure") : item.law}</small></li>`).join("");

  const chapters = CHAPTERS;
  const choiceLabel = (question, choice) => typeof choice === "number" ? metres(choice) : t(`distance.drill.${question.id}.${choice}`);
  const printRows = LANDMARKS.map((item) => `<tr><th scope="row">${t(`distance.landmark.${item.id}.name`)}</th><td>${t(`distance.landmark.${item.id}.rule`)}</td></tr>`).join("");

  const settled = Boolean(root.querySelector(".distance-page"));
  root.innerHTML = `<div class="page speed-page atlas-page distance-page${settled ? " is-settled" : ""}">
    ${atlasNav}
    <header class="speed-header"><div><span class="eyebrow">${t("distance.eyebrow")}</span><h1>${t("distance.title")}</h1><p>${t("distance.subtitle")}</p></div><button class="button button-ghost speed-print" type="button" data-atlas-print><span aria-hidden="true">↓</span> ${t("distance.print")}</button></header>
    <nav class="speed-chapters" aria-label="${escapeHtml(t("atlas.chaptersLabel"))}">${chapters.map(([id, target], index) => `<button type="button" data-atlas-jump="${target}"><b>0${index + 1}</b>${t(`distance.chapter.${id}`)}</button>`).join("")}</nav>

    <section class="speed-map" aria-labelledby="distanceParking">
      <div class="speed-map-heading"><div><span class="speed-step">01 / ${t("distance.step.parking")}</span><h2 id="distanceParking" tabindex="-1">${t("distance.parkingTitle")}</h2><p>${t("distance.parkingHelp")}</p></div><button class="speed-cover" type="button" data-distance-cover aria-pressed="${state.cover}">${t(state.cover ? "distance.reveal" : "distance.cover")}</button></div>
      <div class="speed-garage ruler-chips" role="group" aria-label="${escapeHtml(t("distance.landmarksLabel"))}">${chips}</div>
      <div class="ruler" id="distanceRuler">
        <div class="ruler-heading"><h3>${t(`distance.landmark.${landmark.id}.name`)}</h3><span class="ruler-scope is-${landmark.scope}">${t(`distance.scope.${landmark.scope}`)}</span></div>
        ${diagram}
        <p class="ruler-rule">${state.cover ? t("distance.coverHelp") : t(`distance.landmark.${landmark.id}.rule`)}</p>
        ${state.cover ? "" : `<p class="ruler-note">${t(`distance.landmark.${landmark.id}.note`)}</p><p class="ruler-cost"><b>${t("distance.costLabel")}</b> ${t(`distance.landmark.${landmark.id}.cost`)} <span lang="pt">${landmark.law}</span></p>`}
      </div>
      <div class="distance-parking-extra">
        <div><h3>${t("distance.neverTitle")}</h3><ul class="atlas-checklist">${never}</ul></div>
        <div><h3>${t("distance.countTitle")}</h3><p>${t("distance.countBody")}</p><h3>${t("distance.clockTitle")}</h3><ul class="deadline-list">${clocks}</ul></div>
      </div>
      <p class="speed-map-note">${t("distance.parkingNote")} ${link(CODE, t("distance.articles49"))}</p>
    </section>

    <div class="speed-section-heading"><span class="speed-step">02 / ${t("distance.step.driving")}</span><h2 id="distanceDriving" tabindex="-1">${t("distance.drivingTitle")}</h2><p>${t("distance.drivingHelp")}</p></div>
    <ul class="distance-cards">${driveCards}</ul>
    <p class="speed-map-note">${t("distance.drivingNote")} ${link(CODE, t("distance.articles18"))}</p>

    <div class="speed-section-heading"><span class="speed-step">03 / ${t("distance.step.lights")}</span><h2 id="distanceLights" tabindex="-1">${t("distance.lightsTitle")}</h2><p>${t("distance.lightsHelp")}</p></div>
    <section class="speed-physics" aria-label="${escapeHtml(t("distance.lightsTitle"))}">
      <div class="speed-physics-lab"><div class="speed-physics-bars beam-bars">${beamBars}<div class="speed-bar beam-scale" aria-hidden="true"><span></span><div class="beam-scale-track">${[0, 50, 100, 150].map((value) => `<i style="left:${value / 150 * 100}%">${value === 150 ? metres(value) : number.format(value)}</i>`).join("")}</div><span></span></div></div><div class="atlas-bank-note"><strong>${t("distance.bankTitle")}</strong><ul>${bankFigures}</ul><p>${t("distance.bankHelp")}</p></div></div>
      <ul class="speed-facts">${lightFacts}</ul>
    </section>
    <p class="speed-map-note">${link(CODE, t("distance.articles60"))}</p>

    <div class="speed-section-heading"><span class="speed-step">04 / ${t("distance.step.signs")}</span><h2 id="distanceSigns" tabindex="-1">${t("distance.signsTitle")}</h2><p>${t("distance.signsHelp")}</p></div>
    <div class="countdowns">${countdown}</div>
    <ul class="distance-cards">${signCards}</ul>
    <p class="speed-map-note">${link(SIGNS, t("distance.signSource"))}</p>

    <section class="speed-recall" aria-labelledby="distanceRecall"><div class="speed-recall-heading"><span class="speed-step">05 / ${t("atlas.recall")}</span><h2 id="distanceRecall" tabindex="-1">${t("atlas.drill.title")}</h2><p>${t("atlas.drill.help", { count: DRILLS.length })}</p><div class="speed-decks" role="group" aria-label="${escapeHtml(t("atlas.deckLabel"))}">${deckChips(drill, { questions: DRILLS, decks: DECKS, prefix: "distance", t })}</div><div class="speed-recall-plan"><span>1</span>${t("atlas.repeat.now")}<span>2</span>${t("atlas.repeat.later")}<span>3</span>${t("atlas.repeat.tomorrow")}</div><button class="button button-ghost" type="button" data-atlas-practice>${t("distance.practice")} ↗</button></div><div class="speed-drill">${drillMarkup(drill, { questions: DRILLS, prefix: "distance", t, escapeHtml, choiceLabel })}</div></section>

    <footer class="speed-sources"><strong>${t("distance.sourcesTitle")}</strong><p>${t("distance.checked")}</p><div>${link(CODE, t("distance.codeSource"))}${link(SIGNS, t("distance.signSource"))}</div><p>${t("distance.sourceScope")}</p></footer>
    <div class="speed-print-sheet"><h2>${t("distance.printTitle")}</h2><table class="speed-table atlas-print-table"><tbody>${printRows}</tbody></table><ul><li>${t("distance.print.driving")}</li><li>${t("distance.print.lights")}</li><li>${t("distance.print.triangle")}</li><li>${t("distance.print.signs")}</li><li>${t("distance.print.clocks")}</li></ul></div>
  </div>`;

  const renderAgain = (focus) => renderDistances(root, { t, escapeHtml, onPractice, atlasNav, locale }, focus);
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("[data-atlas-jump]").forEach((button) => button.addEventListener("click", () => {
    const target = root.querySelector(`#${button.dataset.atlasJump}`);
    target?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  }));
  root.querySelector("[data-atlas-print]").addEventListener("click", () => window.print());
  root.querySelector("[data-distance-cover]").addEventListener("click", () => {
    state.cover = !state.cover;
    renderAgain("[data-distance-cover]");
  });
  root.querySelectorAll("[data-distance-landmark]").forEach((button) => button.addEventListener("click", () => {
    state.landmark = button.dataset.distanceLandmark;
    renderAgain(`[data-distance-landmark="${state.landmark}"]`);
  }));
  root.querySelectorAll("[data-atlas-practice]").forEach((button) => button.addEventListener("click", onPractice));
  bindDrill(root, drill, DRILLS, renderAgain);
  if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
}

// Content inventory for the data check: every derived translation key, drill answer and distance value.
export const DISTANCE_ATLAS = Object.freeze({
  landmarks: LANDMARKS.map((item) => ({ ...item })),
  beams: BEAMS.map((item) => ({ ...item })),
  countdowns: COUNTDOWNS.map((item) => ({ ...item })),
  drills: DRILLS.map(({ id, deck, choices, correct }) => ({ id, deck, choices, correct })),
  decks: DECKS,
  keys: [
    ...CHAPTERS.map(([id]) => `distance.chapter.${id}`),
    ...LANDMARKS.flatMap((item) => ["name", "rule", "note", "cost"].map((part) => `distance.landmark.${item.id}.${part}`)),
    ...[...new Set(LANDMARKS.map((item) => item.scope))].map((scope) => `distance.scope.${scope}`),
    ...["before", "after", "gap"].map((side) => `distance.side.${side}`),
    ...NEVER.map((item) => `distance.never.${item}`),
    ...CLOCKS.flatMap((item) => [`distance.clock.${item.id}`, `distance.clockUnit.${item.id}`]),
    ...DRIVE.flatMap((item) => ["value", "title", "body"].map((part) => `distance.drive.${item.id}.${part}`)),
    ...BEAMS.map((item) => `distance.beam.${item.id}`),
    ...BANK_FIGURES.map((item) => `distance.bank.${item.id}`),
    ...LIGHT_FACTS.flatMap((fact) => [`distance.lightFact.${fact}.title`, `distance.lightFact.${fact}.body`]),
    ...COUNTDOWNS.map((item) => `distance.countdown.${item.id}`),
    ...SIGN_ITEMS.flatMap((item) => ["value", "title", "body"].map((part) => `distance.sign.${item.id}.${part}`)),
    ...drillKeys("distance", DRILLS, DECKS),
  ],
});
