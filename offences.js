import { bindDrill, createDrill, deckChips, drillKeys, drillMarkup } from "./rule-drill.js?v=20261106-1";

// Offence atlas for Portugal: how the Código da Estrada grades driving offences and what each level costs.
// Checked 6 November 2026 against the consolidated Código da Estrada (last amended by Lei 24/2025, 12 March 2025),
// the road articles of the Código Penal and the fines in the Regulamento de Sinalização do Trânsito.
// Research notes, bank-versus-law differences and question coverage: documentation/md/OFFENCES.md.
const CODE = "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830";
const PENAL = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1995-34437675";
const SIGNS = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729";

// Art. 136 (classes), 147 (driving ban), 148 (points); Código Penal art. 69 (court ban for road crimes).
const LEVELS = [
  { id: "minor", pt: "Contraordenação leve" },
  { id: "serious", pt: "Contraordenação grave" },
  { id: "verySerious", pt: "Contraordenação muito grave" },
  { id: "crime", pt: "Crime rodoviário" },
];
const LEVEL_IDS = LEVELS.map((level) => level.id);
const LEVEL_FACTS = ["ban", "crime", "negligence"];

// Default points per level (art. 148): serious −2, very serious −4, a court ban −6. `points` overrides it.
// upgrade: the same offence becomes very serious on a motorway (146 h, c) or also on multi-lane roads (146 g).
const THEMES = ["all", "speed", "alcohol", "lanes", "priority", "motorway", "lights", "parking", "safety", "papers", "accident"];
const ITEMS = [
  { id: "speedSerious", theme: "speed", level: "serious", law: "CE 145.º/1 b)–d)" },
  { id: "speedVerySerious", theme: "speed", level: "verySerious", law: "CE 146.º i)" },
  { id: "speedConditions", theme: "speed", level: "serious", law: "CE 25.º, 145.º/1 e)" },
  { id: "speedSlow", theme: "speed", level: "minor", law: "CE 26.º", fine: "€60–300" },
  { id: "alcohol05", theme: "alcohol", level: "serious", law: "CE 81.º, 145.º/1 l)", fine: "€250–1250", points: 3 },
  { id: "alcohol08", theme: "alcohol", level: "verySerious", law: "CE 81.º, 146.º j)", fine: "€500–2500", points: 5 },
  { id: "alcohol12", theme: "alcohol", level: "crime", law: "CP 292.º/1", points: 6 },
  { id: "drugs", theme: "alcohol", level: "verySerious", law: "CE 81.º, 146.º m)", fine: "€500–2500", points: 5 },
  { id: "drugsUnfit", theme: "alcohol", level: "crime", law: "CP 292.º/2", points: 6 },
  { id: "refuseTest", theme: "alcohol", level: "crime", law: "CE 152.º/3; CP 69.º/1 c)", points: 6 },
  { id: "overtaking", theme: "lanes", level: "serious", law: "CE 41.º, 145.º/1 f)", fine: "€120–600", upgrade: "motorway" },
  { id: "overtakeCrossing", theme: "lanes", level: "serious", law: "CE 41.º/1 d), 148.º/1 a)", fine: "€120–600", points: 3 },
  { id: "continuousLine", theme: "lanes", level: "verySerious", law: "CE 146.º o)", fine: "€120–600" },
  { id: "wrongWay", theme: "lanes", level: "serious", law: "CE 145.º/1 a), 146.º g)", upgrade: "multiLane" },
  { id: "lanePosition", theme: "lanes", level: "serious", law: "CE 145.º/1 f)", upgrade: "motorway" },
  { id: "distance", theme: "lanes", level: "serious", law: "CE 18.º, 145.º/1 f)", fine: "€60–300", upgrade: "motorway" },
  { id: "uTurn", theme: "lanes", level: "serious", law: "CE 45.º, 47.º, 145.º/1 f)", fine: "€120–600", upgrade: "motorway" },
  { id: "giveWay", theme: "priority", level: "serious", law: "CE 145.º/1 f)", upgrade: "motorway" },
  { id: "stopSign", theme: "priority", level: "verySerious", law: "CE 146.º n)", fine: "€120–600" },
  { id: "redLight", theme: "priority", level: "verySerious", law: "CE 146.º l)", fine: "€120–600" },
  { id: "pedestrians", theme: "priority", level: "serious", law: "CE 103.º, 145.º/1 i)", fine: "€120–600" },
  { id: "levelCrossing", theme: "priority", level: "serious", law: "CE 145.º/1 f)" },
  { id: "motorwayCarriageway", theme: "motorway", level: "verySerious", law: "CE 72.º/3, 146.º a)", fine: "€250–1250" },
  { id: "motorwayShoulder", theme: "motorway", level: "serious", law: "CE 72.º/3, 145.º/1 g)", fine: "€120–600" },
  { id: "motorwayAccess", theme: "motorway", level: "verySerious", law: "CE 73.º, 146.º e)", fine: "€250–1250" },
  { id: "motorwaySeparator", theme: "motorway", level: "verySerious", law: "CE 72.º/4, 146.º f)", fine: "€500–2500" },
  { id: "motorwayReverse", theme: "motorway", level: "verySerious", law: "CE 72.º/4, 146.º h)", fine: "€500–2500" },
  { id: "motorwayTrucks", theme: "motorway", level: "serious", law: "CE 74.º, 145.º/1 h)", fine: "€120–600" },
  { id: "dazzle", theme: "lights", level: "verySerious", law: "CE 61.º/6, 146.º d)", fine: "€60–300" },
  { id: "noLights", theme: "lights", level: "serious", law: "CE 61.º/1, 145.º/1 j)", upgrade: "motorway" },
  { id: "triangle", theme: "lights", level: "serious", law: "CE 88.º, 145.º/1 m), 146.º c)", fine: "€120–600", upgrade: "motorway" },
  { id: "parkCrossing", theme: "parking", level: "serious", law: "CE 49.º/3, 145.º/1 o)", fine: "€60–300" },
  { id: "parkDisabled", theme: "parking", level: "serious", law: "CE 145.º/1 q)" },
  { id: "parkRuralBend", theme: "parking", level: "verySerious", law: "CE 49.º/2, 146.º a)", fine: "€60–300" },
  { id: "parkNight", theme: "parking", level: "verySerious", law: "CE 49.º/4, 146.º b)", fine: "€250–1250" },
  { id: "parkDouble", theme: "parking", level: "minor", law: "CE 49.º, 50.º", fine: "€30–150" },
  { id: "parkPavement", theme: "parking", level: "minor", law: "CE 49.º/1 f), 49.º/3", fine: "€60–300" },
  { id: "phone", theme: "safety", level: "serious", law: "CE 84.º, 145.º/1 n)", fine: "€250–1250", points: 3 },
  { id: "children", theme: "safety", level: "serious", law: "CE 55.º, 145.º/1 p)" },
  { id: "seatBelt", theme: "safety", level: "minor", law: "CE 82.º/7", fine: "€120–600" },
  { id: "noInsurance", theme: "papers", level: "serious", law: "CE 145.º/2 a), 162.º" },
  { id: "wrongCategory", theme: "papers", level: "verySerious", law: "CE 146.º p)" },
  { id: "noLicence", theme: "papers", level: "crime", law: "DL 2/98, 3.º" },
  { id: "banned", theme: "papers", level: "crime", law: "CE 138.º/2–3" },
  { id: "documents", theme: "papers", level: "minor", law: "CE 85.º/7", fine: "€60–300" },
  { id: "leaveScene", theme: "accident", level: "verySerious", law: "CE 89.º/2, 146.º q)", fine: "€500–2500" },
  { id: "noHelp", theme: "accident", level: "crime", law: "CP 200.º" },
  { id: "noDetails", theme: "accident", level: "minor", law: "CE 89.º/1, 3", fine: "€120–600" },
];
const DEFAULT_POINTS = { serious: 2, verySerious: 4 };
const PATTERNS = ["motorway", "fine", "rural"];

// Art. 81 and 145/146: general limits 0.5 / 0.8; probationary and professional drivers 0.2 / 0.5; CP 292: 1.2.
export function alcoholBand(tas, strict = false) {
  const value = Math.round(Number(tas) * 100) / 100;
  if (!Number.isFinite(value) || value < 0) return "none";
  if (value >= 1.2) return "crime";
  if (value >= (strict ? 0.5 : 0.8)) return "verySerious";
  if (value >= (strict ? 0.2 : 0.5)) return "serious";
  return "none";
}
const ALCOHOL_FACTS = ["convert", "medical", "refuse", "twelve", "counter", "lend"];

// Art. 121-A and 148: 12 points; −2/−3, −4/−5, −6; +3 after three clean years (cap 15); +1 voluntary training (cap 16).
const POINT_EVENTS = [
  { id: "serious", change: -2 }, { id: "seriousPlus", change: -3 }, { id: "verySerious", change: -4 },
  { id: "verySeriousPlus", change: -5 }, { id: "crime", change: -6 }, { id: "clean", change: 3, cap: 15 }, { id: "training", change: 1, cap: 16 },
];
export function applyPointEvent(points, eventId) {
  const event = POINT_EVENTS.find((item) => item.id === eventId);
  if (!event || points <= 0) return points;
  if (event.change > 0) return Math.max(points, Math.min(event.cap, points + event.change));
  return Math.max(0, points + event.change);
}
export const pointsStatus = (points) => points <= 0 ? "revoked" : points <= 3 ? "exam" : points <= 5 ? "training" : "fine";
const POINT_RULES = ["final", "sameDay", "clean", "training", "missed", "oldRule"];

// Chapter 05 cards: art. 138–143 and 147 (ban), 85/154/160/165/172–173 (clocks), 135 (liability),
// 122/130 (probation), 159–162 (seizures).
const BAN_ITEMS = ["all", "consecutive", "noLicence", "suspend", "halve", "repeat", "breach"];
const DEADLINES = [
  { id: "payment", value: "15", unit: "workingDays" }, { id: "deposit", value: "48", unit: "hours" },
  { id: "documents", value: "5", unit: "days" }, { id: "surrender", value: "15", unit: "workingDays" },
  { id: "twelve", value: "12", unit: "hours" }, { id: "court", value: "10", unit: "days" },
  { id: "removed", value: "45", unit: "days" }, { id: "seized", value: "90", unit: "days" },
];
const WHO = ["driver", "owner", "instructor", "examinee", "lender", "minors", "pedestrian"];
const PROBATION = ["three", "limit", "lapse", "extend", "again", "exchange"];
const SEIZURES = ["licence", "document", "vehicle"];

const DECKS = ["all", "levels", "alcohol", "sanctions"];
// Author-created recall questions, separate from the IMT comparison and study bank.
const DRILLS = [
  { id: "stopSign", deck: "levels", choices: ["serious", "verySerious", "minor"], correct: "verySerious", source: CODE },
  { id: "dazzle", deck: "levels", choices: ["minor", "serious", "verySerious"], correct: "verySerious", source: CODE },
  { id: "continuousLine", deck: "levels", choices: ["serious", "verySerious", "minor"], correct: "verySerious", source: CODE },
  { id: "phone", deck: "levels", choices: ["minor", "serious", "verySerious"], correct: "serious", source: CODE },
  { id: "seatBelt", deck: "levels", choices: ["minor", "serious", "verySerious"], correct: "minor", source: CODE },
  { id: "ruralBend", deck: "levels", choices: ["minor", "serious", "verySerious"], correct: "verySerious", source: CODE },
  { id: "shoulder", deck: "levels", choices: ["minor", "serious", "verySerious"], correct: "serious", source: CODE },
  { id: "upgrade", deck: "levels", choices: ["minor", "serious", "verySerious"], correct: "verySerious", source: CODE },
  { id: "classify", deck: "levels", choices: ["fine", "ban", "motorway"], correct: "ban", source: CODE },
  { id: "noLicence", deck: "levels", choices: ["verySerious", "crime", "minor"], correct: "crime", source: CODE },
  { id: "wrongCategory", deck: "levels", choices: ["minor", "verySerious", "crime"], correct: "verySerious", source: CODE },
  { id: "tas07", deck: "alcohol", choices: ["minor", "serious", "verySerious"], correct: "serious", source: CODE },
  { id: "tas09", deck: "alcohol", choices: ["serious", "verySerious", "crime"], correct: "verySerious", source: CODE },
  { id: "tas12", deck: "alcohol", choices: ["verySerious", "crime", "serious"], correct: "crime", source: PENAL },
  { id: "probation", deck: "alcohol", choices: ["none", "serious", "verySerious"], correct: "serious", source: CODE },
  { id: "refuse", deck: "alcohol", choices: ["verySerious", "crime", "nothing"], correct: "crime", source: CODE },
  { id: "wait", deck: "alcohol", choices: ["six", "twelve", "day"], correct: "twelve", source: CODE },
  { id: "start", deck: "alcohol", choices: ["ten", "twelve", "fifteen"], correct: "twelve", source: CODE },
  { id: "alcoholPoints", deck: "alcohol", choices: ["two", "three", "four"], correct: "three", source: CODE },
  { id: "course", deck: "alcohol", choices: ["five", "three", "zero"], correct: "five", source: CODE },
  { id: "zero", deck: "alcohol", choices: ["months", "years", "never"], correct: "years", source: CODE },
  { id: "recover", deck: "alcohol", choices: ["one", "three", "all"], correct: "three", source: CODE },
  { id: "banSerious", deck: "sanctions", choices: ["oneOne", "twoTwo", "threeThree"], correct: "oneOne", source: CODE },
  { id: "banVerySerious", deck: "sanctions", choices: ["oneOne", "twoTwo", "threeThree"], correct: "twoTwo", source: CODE },
  { id: "moped", deck: "sanctions", choices: ["yes", "no", "day"], correct: "no", source: CODE },
  { id: "consecutive", deck: "sanctions", choices: ["consecutive", "weekends", "working"], correct: "consecutive", source: CODE },
  { id: "pay", deck: "sanctions", choices: ["hours", "working", "month"], correct: "working", source: CODE },
  { id: "owner", deck: "sanctions", choices: ["nobody", "owner", "insurer"], correct: "owner", source: CODE },
  { id: "learner", deck: "sanctions", choices: ["learner", "instructor", "school"], correct: "instructor", source: CODE },
  { id: "probationLapse", deck: "sanctions", choices: ["oneSerious", "oneVerySerious", "anyMinor"], correct: "oneVerySerious", source: CODE },
  { id: "halve", deck: "sanctions", choices: ["halved", "doubled", "replaced"], correct: "halved", source: CODE },
  { id: "repeat", deck: "sanctions", choices: ["halved", "doubled", "same"], correct: "doubled", source: CODE },
];
// Level ids used as drill choices share the level names instead of per-question labels.
const sharedChoice = (choice) => LEVEL_IDS.includes(choice) || choice === "none";

// Chapter buttons scroll to these heading ids; the level cards show these rows.
const CHAPTERS = [["levels", "offenceLevels"], ["sort", "offenceSort"], ["alcohol", "offenceAlcohol"], ["points", "offencePoints"], ["after", "offenceAfter"], ["recall", "offenceRecall"]];
const LEVEL_ROWS = ["fine", "ban", "points", "who"];

// Page state survives language/sync renders, without saving anything. Reload resets it.
const state = { cover: false, theme: "all", hideLevels: false, revealed: new Set(), tas: 0.6, strict: false, points: 12, log: [] };
const drill = createDrill();

const levelName = (t, id) => t(id === "none" ? "offence.alcohol.none.name" : `offence.level.${id}.name`);

export function renderOffences(root, { t, escapeHtml, onPractice, atlasNav = "", locale = "en-GB" }, focusSelector) {
  const link = (url, label) => `<a class="text-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
  const mask = `<span class="atlas-mask" role="img" aria-label="${escapeHtml(t("atlas.hidden"))}">?</span>`;
  const tasFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tasText = (value) => `${tasFormat.format(value)} ${t("offence.alcoholUnit")}`;

  const levelCards = LEVELS.map((level, index) => {
    const row = (part, covered) => `<div><dt>${t(`offence.row.${part}`)}</dt><dd>${covered ? mask : t(`offence.level.${level.id}.${part}`)}</dd></div>`;
    return `<li class="offence-level is-${level.id}"><span class="offence-level-index" aria-hidden="true">${index + 1}</span><h3>${t(`offence.level.${level.id}.name`)}</h3><p class="offence-level-pt" lang="pt">${level.pt}</p><dl>${LEVEL_ROWS.map((part) => row(part, state.cover && level.id !== "minor" && (part === "ban" || part === "points"))).join("")}</dl><p class="offence-level-example">${t(`offence.level.${level.id}.example`)}</p></li>`;
  }).join("");
  const levelFacts = LEVEL_FACTS.map((fact) => `<li><strong>${t(`offence.fact.${fact}.title`)}</strong><p>${t(`offence.fact.${fact}.body`)}</p></li>`).join("");

  const themeChips = THEMES.map((theme) => `<button type="button" class="speed-deck-chip" data-offence-theme="${theme}" aria-pressed="${state.theme === theme}">${t(`offence.theme.${theme}`)} <small>${theme === "all" ? ITEMS.length : ITEMS.filter((item) => item.theme === theme).length}</small></button>`).join("");
  const itemMarkup = (item) => {
    const shown = !state.hideLevels || state.revealed.has(item.id);
    const name = t(`offence.item.${item.id}`);
    const points = item.points || DEFAULT_POINTS[item.level];
    const facts = [`<span lang="pt">${item.law}</span>`, item.fine || "", shown && points ? t(item.level === "crime" ? "offence.pointsBan" : "offence.points", { points }) : ""].filter(Boolean).join(" · ");
    const badge = shown ? `<span class="offence-badge is-${item.level}">${t(`offence.level.${item.level}.name`)}</span>` : `<button type="button" class="offence-badge is-hidden" data-offence-reveal="${item.id}" aria-label="${escapeHtml(t("offence.revealLevel", { offence: name }))}">?</button>`;
    return `<li class="offence-item${shown ? ` is-${item.level}` : ""}"><div><strong>${name}</strong><small>${facts}</small>${shown && item.upgrade ? `<em>${t(`offence.upgrade.${item.upgrade}`)}</em>` : ""}</div>${badge}</li>`;
  };
  const shownItems = ITEMS.filter((item) => state.theme === "all" || item.theme === state.theme);
  const patterns = PATTERNS.map((pattern) => `<li><strong>${t(`offence.pattern.${pattern}.title`)}</strong><p>${t(`offence.pattern.${pattern}.body`)}</p></li>`).join("");

  const band = alcoholBand(state.tas, state.strict);
  const zones = state.strict ? [["none", 0.2], ["serious", 0.3], ["verySerious", 0.7], ["crime", 0.8]] : [["none", 0.5], ["serious", 0.3], ["verySerious", 0.4], ["crime", 0.8]];
  const scale = `<div class="alcohol-scale" aria-hidden="true"><div class="alcohol-zones">${zones.map(([id, width]) => `<span class="is-${id}" style="flex:${width}"></span>`).join("")}</div><i class="alcohol-marker" style="left:${Math.min(100, state.tas / 2 * 100)}%"></i><div class="alcohol-ticks">${(state.strict ? [0.2, 0.5, 1.2] : [0.5, 0.8, 1.2]).map((tick) => `<span style="left:${tick / 2 * 100}%">${tasFormat.format(tick)}</span>`).join("")}</div></div>`;
  const alcoholFacts = ALCOHOL_FACTS.map((fact) => `<li><strong>${t(`offence.alcoholFact.${fact}.title`)}</strong><p>${t(`offence.alcoholFact.${fact}.body`)}</p></li>`).join("");

  const status = pointsStatus(state.points);
  const dots = Array.from({ length: 16 }, (_, index) => `<li class="${index < state.points ? "is-on" : "is-off"}${index >= 12 ? " is-bonus" : ""}"></li>`).join("");
  const eventButtons = POINT_EVENTS.map((event) => {
    const disabled = state.points <= 0 || (event.cap && state.points >= event.cap);
    return `<button type="button" class="points-event${event.change > 0 ? " is-gain" : ""}" data-points-event="${event.id}"${disabled ? " disabled" : ""}><b>${event.change > 0 ? "+" : "−"}${Math.abs(event.change)}</b><span>${t(`offence.pointsEvent.${event.id}`)}</span></button>`;
  }).join("");
  const log = state.log.length ? `<ol class="points-log">${state.log.slice(-6).reverse().map((entry) => `<li><span>${t(`offence.pointsEvent.${entry.id}`)}</span><b>${entry.before} → ${entry.after}</b></li>`).join("")}</ol>` : `<p class="points-empty">${t("offence.pointsEmpty")}</p>`;
  const pointRules = POINT_RULES.map((rule) => `<li><strong>${t(`offence.pointsRule.${rule}.title`)}</strong><p>${t(`offence.pointsRule.${rule}.body`)}</p></li>`).join("");

  const list = (items, group) => `<ul class="atlas-checklist">${items.map((item) => `<li>${t(`offence.${group}.${item}`)}</li>`).join("")}</ul>`;
  const deadlines = DEADLINES.map((item) => `<li><span class="deadline-value">${item.value}<small>${t(`offence.unit.${item.unit}`)}</small></span><p>${t(`offence.deadline.${item.id}`)}</p></li>`).join("");
  const seizures = SEIZURES.map((item) => `<div><h4>${t(`offence.seize.${item}.title`)}</h4><p>${t(`offence.seize.${item}.body`)}</p></div>`).join("");

  const chapters = CHAPTERS;
  const choiceLabel = (question, choice) => sharedChoice(choice) ? levelName(t, choice) : t(`offence.drill.${question.id}.${choice}`);
  const printLevels = `<table class="speed-table atlas-print-table"><thead><tr><th scope="col">${t("offence.printLevel")}</th><th scope="col">${t("offence.row.ban")}</th><th scope="col">${t("offence.row.points")}</th></tr></thead><tbody>${LEVELS.map((level) => `<tr><th scope="row">${t(`offence.level.${level.id}.name`)} <small lang="pt">· ${level.pt}</small></th><td>${t(`offence.level.${level.id}.ban`)}</td><td>${t(`offence.level.${level.id}.points`)}</td></tr>`).join("")}</tbody></table>`;

  const settled = Boolean(root.querySelector(".offence-page"));
  root.innerHTML = `<div class="page speed-page atlas-page offence-page${settled ? " is-settled" : ""}">
    ${atlasNav}
    <header class="speed-header"><div><span class="eyebrow">${t("offence.eyebrow")}</span><h1>${t("offence.title")}</h1><p>${t("offence.subtitle")}</p></div><button class="button button-ghost speed-print" type="button" data-atlas-print><span aria-hidden="true">↓</span> ${t("offence.print")}</button></header>
    <nav class="speed-chapters" aria-label="${escapeHtml(t("atlas.chaptersLabel"))}">${chapters.map(([id, target], index) => `<button type="button" data-atlas-jump="${target}"><b>0${index + 1}</b>${t(`offence.chapter.${id}`)}</button>`).join("")}</nav>

    <section class="speed-map" aria-labelledby="offenceLevels">
      <div class="speed-map-heading"><div><span class="speed-step">01 / ${t("offence.step.levels")}</span><h2 id="offenceLevels" tabindex="-1">${t("offence.levelsTitle")}</h2><p>${t("offence.levelsHelp")}</p></div><button class="speed-cover" type="button" data-offence-cover aria-pressed="${state.cover}">${t(state.cover ? "offence.reveal" : "offence.cover")}</button></div>
      <ol class="offence-levels">${levelCards}</ol>
      <div class="speed-rhythm"><span aria-hidden="true">↗</span><div><strong>${t(state.cover ? "offence.recallCue" : "offence.chant")}</strong><p>${t(state.cover ? "offence.coverHelp" : "offence.chantHelp")}</p></div></div>
      <ul class="offence-facts">${levelFacts}</ul>
      <p class="speed-map-note">${t("offence.levelsNote")} ${link(CODE, t("offence.articles136"))}</p>
    </section>

    <div class="speed-section-heading"><span class="speed-step">02 / ${t("offence.step.sort")}</span><h2 id="offenceSort" tabindex="-1">${t("offence.sortTitle")}</h2><p>${t("offence.sortHelp")}</p></div>
    <section class="offence-sorter" aria-label="${escapeHtml(t("offence.sortTitle"))}">
      <div class="offence-sorter-controls"><div class="speed-decks" role="group" aria-label="${escapeHtml(t("offence.themesLabel"))}">${themeChips}</div><button class="speed-cover" type="button" data-offence-hide aria-pressed="${state.hideLevels}">${t(state.hideLevels ? "offence.showLevels" : "offence.hideLevels")}</button></div>
      <ul class="offence-list">${shownItems.map(itemMarkup).join("")}</ul>
      <ul class="speed-facts offence-patterns">${patterns}</ul>
      <p class="speed-map-note">${t("offence.sortNote")} ${link(CODE, t("offence.articles145"))}</p>
    </section>

    <div class="speed-section-heading"><span class="speed-step">03 / ${t("offence.step.alcohol")}</span><h2 id="offenceAlcohol" tabindex="-1">${t("offence.alcoholTitle")}</h2><p>${t("offence.alcoholHelp")}</p></div>
    <section class="speed-physics" aria-label="${escapeHtml(t("offence.alcoholTitle"))}">
      <div class="speed-physics-lab">
        <div class="speed-physics-controls"><label for="offenceTas"><span>${t("offence.alcoholLevel")}</span><output id="offenceTasValue" for="offenceTas">${tasText(state.tas)}</output></label><input type="range" id="offenceTas" min="0" max="2" step="0.05" value="${state.tas}"/><div class="speed-surface-switch" role="group" aria-label="${escapeHtml(t("offence.driverLabel"))}"><button type="button" data-offence-driver="standard" aria-pressed="${!state.strict}">${t("offence.driver.standard")}</button><button type="button" data-offence-driver="strict" aria-pressed="${state.strict}">${t("offence.driver.strict")}</button></div></div>
        ${scale}
        <div class="alcohol-result is-${band}" id="offenceAlcoholResult" aria-live="polite"><strong>${levelName(t, band)}</strong><p>${t(`offence.alcohol.${band}`)}</p></div>
        <p class="speed-physics-note">${t(state.strict ? "offence.strictHelp" : "offence.standardHelp")}</p>
      </div>
      <ul class="speed-facts">${alcoholFacts}</ul>
    </section>
    <p class="speed-map-note">${link(CODE, t("offence.articles81"))} ${link(PENAL, t("offence.penal292"))}</p>

    <div class="speed-section-heading"><span class="speed-step">04 / ${t("offence.step.points")}</span><h2 id="offencePoints" tabindex="-1">${t("offence.pointsTitle")}</h2><p>${t("offence.pointsHelp")}</p></div>
    <section class="speed-physics offence-points" aria-label="${escapeHtml(t("offence.pointsTitle"))}">
      <div class="speed-physics-lab points-wallet">
        <div class="points-head"><strong class="points-value">${state.points}</strong><span>${t("offence.pointsOf")}</span></div>
        <ol class="points-dots" aria-hidden="true">${dots}</ol>
        <p class="points-status is-${status}" aria-live="polite">${t(`offence.pointsStatus.${status}`)}</p>
        <div class="points-actions" role="group" aria-label="${escapeHtml(t("offence.pointsActions"))}">${eventButtons}</div>
        ${log}
        <button class="speed-cover" type="button" data-points-reset>${t("offence.pointsReset")}</button>
      </div>
      <ul class="speed-facts">${pointRules}</ul>
    </section>
    <p class="speed-map-note">${link(CODE, t("offence.articles148"))}</p>

    <div class="speed-section-heading"><span class="speed-step">05 / ${t("offence.step.after")}</span><h2 id="offenceAfter" tabindex="-1">${t("offence.afterTitle")}</h2><p>${t("offence.afterHelp")}</p></div>
    <section class="speed-traps" aria-label="${escapeHtml(t("offence.afterTitle"))}">
      <article class="speed-trap"><span class="speed-trap-index">A</span><h3>${t("offence.ban.title")}</h3>${list(BAN_ITEMS, "ban")}${link(CODE, t("offence.articles138"))}</article>
      <article class="speed-trap"><span class="speed-trap-index">B</span><h3>${t("offence.deadline.title")}</h3><ul class="deadline-list">${deadlines}</ul>${link(CODE, t("offence.articles172"))}</article>
      <article class="speed-trap"><span class="speed-trap-index">C</span><h3>${t("offence.who.title")}</h3>${list(WHO, "who")}${link(CODE, t("offence.articles135"))}</article>
      <article class="speed-trap"><span class="speed-trap-index">D</span><h3>${t("offence.probation.title")}</h3>${list(PROBATION, "probation")}<p class="speed-trap-extra atlas-bank-note">${t("offence.probation.bank")}</p>${link(CODE, t("offence.articles122"))}</article>
      <article class="speed-trap speed-trap-wide"><span class="speed-trap-index">E</span><h3>${t("offence.seize.title")}</h3><div class="seizure-grid">${seizures}</div>${link(CODE, t("offence.articles159"))}</article>
    </section>

    <section class="speed-recall" aria-labelledby="offenceRecall"><div class="speed-recall-heading"><span class="speed-step">06 / ${t("atlas.recall")}</span><h2 id="offenceRecall" tabindex="-1">${t("atlas.drill.title")}</h2><p>${t("atlas.drill.help", { count: DRILLS.length })}</p><div class="speed-decks" role="group" aria-label="${escapeHtml(t("atlas.deckLabel"))}">${deckChips(drill, { questions: DRILLS, decks: DECKS, prefix: "offence", t })}</div><div class="speed-recall-plan"><span>1</span>${t("atlas.repeat.now")}<span>2</span>${t("atlas.repeat.later")}<span>3</span>${t("atlas.repeat.tomorrow")}</div><button class="button button-ghost" type="button" data-atlas-practice>${t("offence.practice")} ↗</button></div><div class="speed-drill">${drillMarkup(drill, { questions: DRILLS, prefix: "offence", t, escapeHtml, choiceLabel })}</div></section>

    <footer class="speed-sources"><strong>${t("offence.sourcesTitle")}</strong><p>${t("offence.checked")}</p><div>${link(CODE, t("offence.codeSource"))}${link(PENAL, t("offence.penalSource"))}${link(SIGNS, t("offence.signSource"))}</div><p>${t("offence.sourceScope")}</p></footer>
    <div class="speed-print-sheet"><h2>${t("offence.printTitle")}</h2>${printLevels}<ul><li>${t("offence.print.alcohol")}</li><li>${t("offence.print.strict")}</li><li>${t("offence.print.points")}</li><li>${t("offence.print.verySerious")}</li><li>${t("offence.print.deadlines")}</li><li>${t("offence.print.probation")}</li></ul></div>
  </div>`;

  const renderAgain = (focus) => renderOffences(root, { t, escapeHtml, onPractice, atlasNav, locale }, focus);
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("[data-atlas-jump]").forEach((button) => button.addEventListener("click", () => {
    const target = root.querySelector(`#${button.dataset.atlasJump}`);
    target?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  }));
  root.querySelector("[data-atlas-print]").addEventListener("click", () => window.print());
  root.querySelector("[data-offence-cover]").addEventListener("click", () => {
    state.cover = !state.cover;
    renderAgain("[data-offence-cover]");
  });
  root.querySelectorAll("[data-offence-theme]").forEach((button) => button.addEventListener("click", () => {
    state.theme = button.dataset.offenceTheme;
    renderAgain(`[data-offence-theme="${state.theme}"]`);
  }));
  root.querySelector("[data-offence-hide]").addEventListener("click", () => {
    state.hideLevels = !state.hideLevels;
    state.revealed.clear();
    renderAgain("[data-offence-hide]");
  });
  root.querySelectorAll("[data-offence-reveal]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.offenceReveal;
    state.revealed.add(id);
    // Keep the keyboard on the list: move to the next level that is still hidden.
    const next = shownItems.slice(shownItems.findIndex((item) => item.id === id) + 1).find((item) => !state.revealed.has(item.id));
    renderAgain(next ? `[data-offence-reveal="${next.id}"]` : "[data-offence-hide]");
  }));
  const paintAlcohol = () => {
    const current = alcoholBand(state.tas, state.strict);
    root.querySelector("#offenceTasValue").textContent = tasText(state.tas);
    root.querySelector(".alcohol-marker").style.left = `${Math.min(100, state.tas / 2 * 100)}%`;
    const result = root.querySelector("#offenceAlcoholResult");
    result.className = `alcohol-result is-${current}`;
    result.innerHTML = `<strong>${levelName(t, current)}</strong><p>${t(`offence.alcohol.${current}`)}</p>`;
  };
  root.querySelector("#offenceTas").addEventListener("input", (event) => {
    state.tas = Math.round(Number(event.target.value) * 100) / 100;
    paintAlcohol();
  });
  root.querySelectorAll("[data-offence-driver]").forEach((button) => button.addEventListener("click", () => {
    const strict = button.dataset.offenceDriver === "strict";
    if (strict === state.strict) return;
    state.strict = strict;
    renderAgain(`[data-offence-driver="${button.dataset.offenceDriver}"]`);
  }));
  root.querySelectorAll("[data-points-event]").forEach((button) => button.addEventListener("click", () => {
    const before = state.points;
    state.points = applyPointEvent(state.points, button.dataset.pointsEvent);
    if (state.points !== before) state.log.push({ id: button.dataset.pointsEvent, before, after: state.points });
    renderAgain(state.points > 0 ? `[data-points-event="${button.dataset.pointsEvent}"]` : "[data-points-reset]");
  }));
  root.querySelector("[data-points-reset]").addEventListener("click", () => {
    state.points = 12;
    state.log = [];
    renderAgain("[data-points-reset]");
  });
  root.querySelectorAll("[data-atlas-practice]").forEach((button) => button.addEventListener("click", onPractice));
  bindDrill(root, drill, DRILLS, renderAgain);
  if (focusSelector) {
    const target = root.querySelector(focusSelector);
    (target && !target.disabled ? target : root.querySelector("[data-points-reset]"))?.focus({ preventScroll: true });
  }
}

// Content inventory for the data check: every derived translation key, drill answer and rule value.
export const OFFENCE_ATLAS = Object.freeze({
  levels: LEVEL_IDS,
  themes: THEMES,
  items: ITEMS.map((item) => ({ ...item })),
  drills: DRILLS.map(({ id, deck, choices, correct }) => ({ id, deck, choices, correct })),
  decks: DECKS,
  keys: [
    ...CHAPTERS.map(([id]) => `offence.chapter.${id}`),
    ...LEVEL_ROWS.map((part) => `offence.row.${part}`),
    ...LEVELS.flatMap((level) => ["name", ...LEVEL_ROWS, "example"].map((part) => `offence.level.${level.id}.${part}`)),
    ...LEVEL_FACTS.flatMap((fact) => [`offence.fact.${fact}.title`, `offence.fact.${fact}.body`]),
    ...THEMES.map((theme) => `offence.theme.${theme}`),
    ...ITEMS.map((item) => `offence.item.${item.id}`),
    ...[...new Set(ITEMS.map((item) => item.upgrade).filter(Boolean))].map((upgrade) => `offence.upgrade.${upgrade}`),
    ...PATTERNS.flatMap((pattern) => [`offence.pattern.${pattern}.title`, `offence.pattern.${pattern}.body`]),
    ...["none", "serious", "verySerious", "crime"].map((band) => `offence.alcohol.${band}`), "offence.alcohol.none.name",
    ...ALCOHOL_FACTS.flatMap((fact) => [`offence.alcoholFact.${fact}.title`, `offence.alcoholFact.${fact}.body`]),
    ...POINT_EVENTS.map((event) => `offence.pointsEvent.${event.id}`),
    ...["fine", "training", "exam", "revoked"].map((item) => `offence.pointsStatus.${item}`),
    ...POINT_RULES.flatMap((rule) => [`offence.pointsRule.${rule}.title`, `offence.pointsRule.${rule}.body`]),
    ...BAN_ITEMS.map((item) => `offence.ban.${item}`),
    ...DEADLINES.flatMap((item) => [`offence.deadline.${item.id}`, `offence.unit.${item.unit}`]),
    ...WHO.map((item) => `offence.who.${item}`),
    ...PROBATION.map((item) => `offence.probation.${item}`),
    ...SEIZURES.flatMap((item) => [`offence.seize.${item}.title`, `offence.seize.${item}.body`]),
    ...drillKeys("offence", DRILLS, DECKS, sharedChoice),
  ],
});
