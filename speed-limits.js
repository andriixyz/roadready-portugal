// Speed atlas for Portugal. General maxima come from the Código da Estrada art. 27(1) table
// (Lei 72/2013), checked 8 October 2026. Road order: town, other roads, reserved road, motorway.
// null = the class is barred from that road (art. 72 and 75); every row is 20 in a shared zone.
const CODE = "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830";
const TABLE = "https://files.diariodarepublica.pt/1s/2013/09/16900/0544605499.pdf#page=3";
const SIGNS = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729";
const SHARED_ZONE = 20;
const VEHICLES = [
  { id: "car", pt: "Automóvel ligeiro de passageiros ou misto", solo: [50, 90, 100, 120], trailer: [50, 70, 80, 100] },
  { id: "lightGoods", pt: "Automóvel ligeiro de mercadorias", solo: [50, 80, 90, 110], trailer: [50, 70, 80, 90] },
  { id: "heavyPassenger", pt: "Automóvel pesado de passageiros", solo: [50, 80, 90, 100], trailer: [50, 70, 80, 90] },
  { id: "heavyGoods", pt: "Automóvel pesado de mercadorias", solo: [50, 80, 80, 90], trailer: [40, 70, 70, 80] },
  { id: "motorcycle", pt: "Motociclo de cilindrada superior a 50 cm³", solo: [50, 90, 100, 120], trailer: [50, 70, 80, 100], sidecar: true },
  { id: "tricycle", pt: "Triciclo", solo: [50, 80, 90, 100] },
  { id: "smallMotorcycle", pt: "Motociclo de cilindrada não superior a 50 cm³", solo: [40, 60, null, null] },
  { id: "moped", pt: "Ciclomotor ou quadriciclo", solo: [40, 45, null, null] },
  { id: "tractor", pt: "Trator agrícola ou florestal", solo: [30, 40, null, null] },
  { id: "machine", pt: "Máquina agrícola, motocultivador ou tratocarro", solo: [20, 20, null, null] },
];
const ROADS = [
  { id: "town", pt: "Dentro das localidades", sign: "N1a" },
  { id: "ordinary", pt: "Restantes vias públicas", sign: "" },
  { id: "reserved", pt: "Vias reservadas a automóveis e motociclos", sign: "H25" },
  { id: "motorway", pt: "Autoestradas", sign: "H24" },
];
// Regulamento de Sinalização do Trânsito codes; the lane panel has no single code and is drawn as a cue.
const SIGN_CARDS = [
  { id: "max", code: "C13" }, { id: "endMax", code: "C20b" }, { id: "temporary", code: "C13" },
  { id: "min", code: "D8" }, { id: "endMin", code: "D14" }, { id: "lanes", code: "" },
  { id: "advisory", code: "H6" }, { id: "endAdvisory", code: "H37" },
  { id: "zone", code: "G4" }, { id: "endZone", code: "G8" },
  { id: "townIn", code: "N1a" }, { id: "townOut", code: "N2a" },
  { id: "motorway", code: "H24" }, { id: "reserved", code: "H25" }, { id: "shared", code: "H46" },
];
// Código da Estrada art. 25(1) a)–m), grouped into twelve scenes.
const PLACES = ["crossings", "schools", "buildings", "shared", "vulnerable", "crowds", "descents", "hidden", "bridges", "surface", "danger", "traffic"];
const FLASH = [
  { id: "allCurves", yes: false }, { id: "hiddenCurves", yes: true }, { id: "everyBump", yes: false },
  { id: "priority", yes: true }, { id: "belowLimit", yes: true }, { id: "night", yes: true }, { id: "heavyOnly", yes: false },
];
const FACTS = ["distance", "grip", "night", "engine", "sudden", "overtaken"];
// Art. 27(2) fine bands with the art. 145(1) b)–c) and 146(1) i) severity thresholds for light cars and motorcycles.
const EXCESS = [
  { id: "minor", town: "≤ 20", outside: "≤ 30", fine: "€60–300" },
  { id: "serious", town: "21–40", outside: "31–60", fine: "€120–600" },
  { id: "verySerious", town: "> 40", outside: "> 60", fine: "€300–2 500" },
];
const DECKS = ["all", "numbers", "signs", "judgement"];
// Author-created recall questions, separate from the IMT comparison/study bank. Numbers are km/h.
const DRILLS = [
  { id: "town", deck: "numbers", choices: [30, 50, 90], correct: 50, source: TABLE },
  { id: "ordinary", deck: "numbers", choices: [80, 90, 100], correct: 90, source: TABLE },
  { id: "reserved", deck: "numbers", choices: [90, 100, 120], correct: 100, source: TABLE },
  { id: "motorway", deck: "numbers", choices: [100, 110, 120], correct: 120, source: TABLE },
  { id: "towMotorway", deck: "numbers", choices: [80, 100, 120], correct: 100, source: TABLE },
  { id: "goods", deck: "numbers", choices: [90, 110, 120], correct: 110, source: TABLE },
  { id: "bus", deck: "numbers", choices: [90, 100, 120], correct: 100, source: TABLE },
  { id: "truckTown", deck: "numbers", choices: [40, 50, 60], correct: 40, source: TABLE },
  { id: "tricycle", deck: "numbers", choices: [80, 90, 100], correct: 90, source: TABLE },
  { id: "moped", deck: "numbers", choices: [40, 45, 50], correct: 40, source: TABLE },
  { id: "tractor", deck: "numbers", choices: [30, 40, 60], correct: 40, source: TABLE },
  { id: "shared", deck: "numbers", choices: [20, 30, 50], correct: 20, source: TABLE },
  { id: "posted", deck: "signs", choices: [80, 100, 120], correct: 80, source: CODE },
  { id: "endLimit", deck: "signs", choices: [50, 60, "none"], correct: 50, source: SIGNS },
  { id: "zone", deck: "signs", choices: [30, 50, 90], correct: 30, source: SIGNS },
  { id: "townExit", deck: "signs", choices: ["yes", "no", "heavy"], correct: "no", source: SIGNS },
  { id: "lane", deck: "signs", choices: ["max", "min", "exact"], correct: "min", source: SIGNS },
  { id: "temporary", deck: "signs", choices: [80, 100, 120], correct: 80, source: CODE },
  { id: "minimum", deck: "signs", choices: [40, 50, 60], correct: 50, source: CODE },
  { id: "weather", deck: "judgement", choices: ["match", "adapt", "sign"], correct: "adapt", source: CODE },
  { id: "curves", deck: "judgement", choices: ["all", "hidden", "never"], correct: "hidden", source: CODE },
  { id: "slow", deck: "judgement", choices: [40, 50, "hinder"], correct: "hinder", source: CODE },
  { id: "permitted", deck: "judgement", choices: [60, 80, 100], correct: 60, source: TABLE },
  { id: "grip", deck: "judgement", choices: ["shorter", "longer", "same"], correct: "longer", source: CODE },
  { id: "emergency", deck: "judgement", choices: ["nobody", "overtaking", "urgent"], correct: "urgent", source: CODE },
  { id: "severity", deck: "judgement", choices: ["minor", "serious", "verySerious"], correct: "minor", source: CODE },
];

// Page state survives language/sync renders, without saving answers. Reload resets it.
const state = { vehicle: "car", trailer: false, covered: false, table: false, signs: new Set(), speed: 50, wet: false, deck: "all", started: false, index: 0, picked: null, score: 0, order: [] };

const RED = "#c53c31", BLUE = "#24649a", INK = "#17261f";
const svg = (box, body, className = "") => `<svg class="${className}" viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;

function vehicleIcon(id) {
  const wheel = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/><circle cx="${x}" cy="${y}" r="${r - 2.5}" fill="var(--surface)"/>`;
  const art = {
    car: `<path d="M5 25v-7l7-2 6-8h18l8 8 11 2v7Z" fill="currentColor"/>${wheel(17, 26)}${wheel(45, 26)}`,
    lightGoods: `<path d="M4 25V9h30l4 6 10 2v8Z" fill="currentColor"/><path d="M34 11h-4v5h8Z" fill="var(--surface)"/>${wheel(15, 26)}${wheel(45, 26)}`,
    heavyPassenger: `<rect x="3" y="7" width="58" height="19" rx="3" fill="currentColor"/><path d="M8 11h9v6H8Zm12 0h9v6h-9Zm12 0h9v6h-9Zm12 0h5v6h-5Z" fill="var(--surface)"/>${wheel(14, 27, 4.5)}${wheel(50, 27, 4.5)}`,
    heavyGoods: `<rect x="23" y="5" width="38" height="20" fill="currentColor"/><path d="M3 25V13l5-6h12v18Z" fill="currentColor"/><path d="M9 10h7v5H9Z" fill="var(--surface)"/>${wheel(12, 27, 4.5)}${wheel(36, 27, 4.5)}${wheel(50, 27, 4.5)}`,
    motorcycle: `<path d="M16 26l10-12h12l6 6M22 14l-6-4M38 14l4-8h6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 14h12l2 6H28Z" fill="currentColor"/>${wheel(14, 26, 7)}${wheel(50, 26, 7)}`,
    tricycle: `<path d="M16 26l10-12h12l6 6M22 14l-6-4M38 14l4-8h6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 14h12l2 6H28Z" fill="currentColor"/>${wheel(14, 26, 7)}${wheel(55, 25, 6)}${wheel(47, 27, 6)}`,
    smallMotorcycle: `<path d="M18 27l8-9h10l6 5M26 18l-4-5M36 18l3-6h5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M26 18h10l1 5h-9Z" fill="currentColor"/>${wheel(16, 28, 5)}${wheel(48, 28, 5)}`,
    moped: `<path d="M18 27l4-9h9l9 10M22 18l-3-7h-6M35 12l4 6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M22 18h12l4 6H24Z" fill="currentColor"/>${wheel(16, 28, 5)}${wheel(48, 28, 5)}`,
    tractor: `<path d="M26 24V8h12l4 10h10v6Z" fill="currentColor"/><path d="M29 11h7l2 6h-9Z" fill="var(--surface)"/>${wheel(17, 23, 10)}${wheel(49, 28, 5)}`,
    machine: `<rect x="12" y="14" width="18" height="12" rx="2" fill="currentColor"/><path d="M30 18l24-10M24 32l-8-6 8-6" fill="none" stroke="currentColor" stroke-width="3"/>${wheel(21, 27, 7)}`,
  };
  return svg("0 0 64 36", art[id], "speed-vehicle-icon");
}

function roadPicture(road) {
  const art = {
    town: '<rect x="10" y="20" width="100" height="44" rx="3" fill="var(--surface)" stroke="currentColor" stroke-width="2"/><text x="60" y="49" text-anchor="middle" fill="currentColor" font-size="19" font-family="sans-serif" font-weight="800">PORTO</text><path d="M35 64v18m50-18v18" stroke="currentColor" stroke-width="3"/>',
    ordinary: '<path d="M19 85C-3 42 112 58 73 8M47 91C18 53 136 66 104 13" fill="none" stroke="currentColor" stroke-width="3"/><path d="M33 89C10 44 124 62 90 11" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="8 8"/><circle cx="23" cy="19" r="10" fill="var(--orange-soft)"/>',
    reserved: `<rect x="22" y="5" width="76" height="76" rx="5" fill="${BLUE}"/><rect x="28" y="11" width="64" height="64" rx="2" fill="none" stroke="white" stroke-width="2"/><path d="M42 43l5-17h26l5 17v17H42Z" fill="white"/><path d="M49 30h22l3 12H46Z" fill="${BLUE}"/><circle cx="48" cy="51" r="3" fill="${BLUE}"/><circle cx="72" cy="51" r="3" fill="${BLUE}"/><path d="M46 60v6m28-6v6" stroke="white" stroke-width="6"/>`,
    motorway: `<rect x="22" y="5" width="76" height="76" rx="5" fill="${BLUE}"/><rect x="28" y="11" width="64" height="64" rx="2" fill="none" stroke="white" stroke-width="2"/><path d="M38 69l14-46h5L46 69Zm36 0L63 23h5l14 46Z" fill="white"/><path d="M34 40h52M39 40v12m42-12v12" stroke="white" stroke-width="5"/>`,
  };
  return svg("0 0 120 96", art[road], "speed-road-picture");
}

function signArt(id) {
  const number = (value, color = INK, size = 36, y = 61) => `<text x="48" y="${y}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="${color}">${value}</text>`;
  const ring = (fill = "#fff", stroke = RED, width = 9) => `<circle cx="48" cy="48" r="43" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const square = (fill = BLUE) => `<rect x="6" y="6" width="84" height="84" rx="6" fill="${fill}"/>`;
  const strike = (color = INK, width = 6) => `<path d="M20 76L76 20" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const plate = (fill = "#fff") => `<rect x="4" y="22" width="88" height="52" rx="3" fill="${fill}" stroke="${INK}" stroke-width="3"/>`;
  const zone = (fill, ink) => `<rect x="6" y="6" width="84" height="84" rx="4" fill="${fill}" stroke="${INK}" stroke-width="3"/><text x="48" y="27" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="13" fill="${ink}">ZONA</text><circle cx="48" cy="58" r="23" fill="#fff" stroke="${fill === "#fff" ? RED : "#777"}" stroke-width="6"/>${number(30, ink, 20, 65)}`;
  const art = {
    max: ring() + number(80),
    endMax: ring("#fff", INK, 3) + number(80, "#6f6f6f") + strike(),
    temporary: ring("#f3c43c") + number(80),
    min: ring(BLUE, "#fff", 4) + number(50, "#fff"),
    endMin: ring(BLUE, "#fff", 4) + number(50, "#fff") + strike(RED, 8),
    lanes: `${square()}<path d="M24 78V36m24 42V30m24 48V36M17 44l7-10 7 10M41 38l7-10 7 10M65 44l7-10 7 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="22" r="11" fill="${BLUE}" stroke="#fff" stroke-width="2"/><text x="24" y="26" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="11" fill="#fff">90</text><circle cx="48" cy="16" r="11" fill="${BLUE}" stroke="#fff" stroke-width="2"/><text x="48" y="20" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="11" fill="#fff">70</text>`,
    advisory: square() + number(40, "#fff"),
    endAdvisory: square() + number(40, "#fff") + strike(RED, 8),
    zone: zone("#fff", INK),
    endZone: zone("#e4e4e4", "#777") + strike(),
    townIn: plate() + number("PORTO", INK, 19, 55),
    townOut: plate() + number("PORTO", INK, 19, 55) + `<path d="M8 72L88 24" stroke="${RED}" stroke-width="6" stroke-linecap="round"/>`,
    motorway: `${square()}<path d="M31 76l14-50h5L42 76Zm34 0L51 26h5l14 50Z" fill="#fff"/><path d="M26 44h44M31 44v13m34-13v13" stroke="#fff" stroke-width="5"/>`,
    reserved: `${square()}<path d="M32 50l6-20h20l6 20v18H32Z" fill="#fff"/><path d="M40 34h16l3 12H37Z" fill="${BLUE}"/><circle cx="39" cy="57" r="3.5" fill="${BLUE}"/><circle cx="57" cy="57" r="3.5" fill="${BLUE}"/><path d="M36 68v7m24-7v7" stroke="#fff" stroke-width="6"/>`,
    shared: `${square()}<path d="M16 50l15-14 15 14v20H16Z" fill="#fff"/><rect x="25" y="58" width="8" height="12" fill="${BLUE}"/><circle cx="62" cy="36" r="5" fill="#fff"/><path d="M62 42v12l-5 13m5-13 5 13M57 48l5-3 5 3" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="78" cy="66" r="5" fill="#fff"/>`,
  };
  return svg("0 0 96 96", art[id], "speed-sign-art");
}

function sceneIcon(id) {
  const art = {
    crossings: '<circle cx="22" cy="6" r="2.5"/><path d="M22 9v8l-3 8m3-8 3 8M22 12l-4 2m4-2 4 2M3 25h26M3 29h26"/>',
    schools: '<path d="M4 29V13l12-8 12 8v16ZM12 29v-8h8v8M16 5V2h5"/>',
    buildings: '<path d="M3 29V9h9v20M12 29V15h8v14M20 29V5h9v24M6 13h3M6 18h3M6 23h3M23 9h3M23 14h3M23 19h3"/>',
    shared: '<path d="M4 29V15l8-7 8 7v14ZM9 29v-7h6v7"/><circle cx="26" cy="24" r="4"/>',
    vulnerable: '<circle cx="11" cy="6" r="3"/><path d="M11 9v9l-4 11m4-11 4 11M7 13l4-2 5 3"/><circle cx="24" cy="12" r="2"/><path d="M24 14v6l-2 8m2-8 2 8M21 17l3-2 3 2"/>',
    crowds: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="7" r="3"/><circle cx="24" cy="9" r="3"/><path d="M3 29v-6a5 5 0 0 1 10 0v6M11 27v-8a5 5 0 0 1 10 0v8M19 29v-6a5 5 0 0 1 10 0v6"/>',
    descents: '<path d="M3 27L29 11v16Z"/><path d="M19 23l6-6"/>',
    hidden: '<path d="M5 29C5 17 27 23 27 11c0-4-4-6-8-6"/><path d="M11 29c0-6 10-8 10-14" stroke-dasharray="3 3"/><path d="M4 8l6-3-1 7"/>',
    bridges: '<path d="M4 29V15a12 12 0 0 1 24 0v14M9 29V17a7 7 0 0 1 14 0v12"/>',
    surface: '<path d="M3 12c3-3 6-3 9 0s6 3 9 0 6-3 9 0M3 20c3-3 6-3 9 0s6 3 9 0 6-3 9 0M3 28c3-3 6-3 9 0s6 3 9 0 6-3 9 0"/>',
    danger: '<path d="M16 4l13 23H3Z"/><path d="M16 12v7m0 3v1"/>',
    traffic: '<path d="M3 20v-4l3-4h6l3 4h4l3-4h6l3 4v4Z"/><circle cx="7" cy="23" r="2"/><circle cx="14" cy="23" r="2"/><circle cx="20" cy="23" r="2"/><circle cx="27" cy="23" r="2"/><path d="M3 29h26"/>',
  };
  return svg("0 0 32 32", `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art[id]}</g>`, "speed-scene-icon");
}

function speedSign(value, covered = false, small = false) {
  return `<span class="speed-sign${small ? " speed-sign-small" : ""}${covered ? " is-covered" : ""}"><span class="speed-number"${covered ? ' aria-hidden="true"' : ""}>${value}</span>${covered ? '<span class="speed-mask" aria-hidden="true">?</span>' : ""}</span>`;
}

// Illustrative stopping model: 1 s reaction, firm braking at 7 m/s² (dry) or 4 m/s² (wet). Not a legal figure.
export function stoppingDistances(speed, wet) {
  const metresPerSecond = speed / 3.6;
  const reaction = metresPerSecond;
  const braking = (metresPerSecond * metresPerSecond) / (2 * (wet ? 4 : 7));
  return { reaction, braking, total: reaction + braking };
}

const variantRows = (vehicle) => [["solo", vehicle.solo], ...(vehicle.trailer ? [["trailer", vehicle.trailer]] : [])];
const currentVehicle = () => VEHICLES.find((vehicle) => vehicle.id === state.vehicle) || VEHICLES[0];
const currentLimits = () => { const vehicle = currentVehicle(); return state.trailer && vehicle.trailer ? vehicle.trailer : vehicle.solo; };
const deckDrills = () => DRILLS.filter((drill) => state.deck === "all" || drill.deck === state.deck);

export function renderSpeedLimits(root, { t, escapeHtml, onPractice }, focusSelector) {
  const vehicle = currentVehicle();
  const towing = state.trailer && Boolean(vehicle.trailer);
  const limits = currentLimits();
  const variantKey = towing ? "trailer" : "solo";
  const unit = t("speed.unit");
  const link = (url, label) => `<a class="text-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
  const variantLabel = (item, variant) => variant === "solo" ? t("speed.noTrailer") : t(item.sidecar ? "speed.withSidecar" : "speed.withTrailer");
  const rowLabel = (item, variant) => `${t(`speed.vehicle.${item.id}`)} · ${variantLabel(item, variant)}`;
  const limitCell = (value, road) => value === null ? `<span class="speed-barred" title="${escapeHtml(t("speed.barred"))}">—</span>` : `<b>${value}</b>`;
  const shownLimits = limits.map((value, index) => ({ value, road: ROADS[index] }));
  const numbersPhrase = limits.map((value) => value === null ? t("speed.barredShort") : value).join(" · ");

  const garageMarkup = VEHICLES.map((item) => `<button type="button" class="speed-garage-chip" data-speed-vehicle="${item.id}" aria-pressed="${state.vehicle === item.id}">${vehicleIcon(item.id)}<span>${t(`speed.vehicle.${item.id}`)}</span></button>`).join("");
  const roadCards = shownLimits.map(({ value, road }, index) => `<li class="speed-road-card${value === null ? " is-barred" : ""}"><span class="speed-road-count" aria-hidden="true">0${index + 1}</span>${roadPicture(road.id)}<div class="speed-road-value" aria-label="${escapeHtml(value === null ? t("speed.barred") : state.covered ? t("speed.hiddenLimit") : `${value} ${unit}`)}">${value === null ? `<span class="speed-barred-badge">${t("speed.barred")}</span>` : speedSign(value, state.covered)}</div><h3>${t(`speed.road.${road.id}`)}</h3><p lang="pt">${road.pt}</p><span class="speed-road-cue">${t(`speed.cue.${road.id}`)}${road.sign ? ` <b>${road.sign}</b>` : ""}</span></li>`).join("");

  const ladderRungs = [120, 110, 100, 90, 80].map((rung) => {
    const members = VEHICLES.flatMap((item) => variantRows(item).filter(([, values]) => values[3] === rung).map(([variant]) => ({ item, variant })));
    return `<li class="speed-rung"><span class="speed-rung-value">${rung}</span><ul>${members.map(({ item, variant }) => `<li class="speed-rung-member${item.id === state.vehicle && variant === variantKey ? " is-current" : ""}">${vehicleIcon(item.id)}<span>${t(`speed.vehicle.${item.id}`)}${variant === "trailer" ? ` <small>${t(item.sidecar ? "speed.sidecarTag" : "speed.trailerTag")}</small>` : ""}</span></li>`).join("")}</ul></li>`;
  }).join("");
  const barred = VEHICLES.filter((item) => item.solo[3] === null);
  const ladderBarred = `<li class="speed-rung is-barred"><span class="speed-rung-value" aria-hidden="true">×</span><ul>${barred.map((item) => `<li class="speed-rung-member${item.id === state.vehicle ? " is-current" : ""}">${vehicleIcon(item.id)}<span>${t(`speed.vehicle.${item.id}`)}</span></li>`).join("")}</ul><p>${t("speed.ladderBarred")}</p></li>`;

  const fullTable = (caption, highlight) => `<table class="speed-table"><caption>${caption}</caption><thead><tr><th scope="col">${t("speed.tableVehicle")}</th><th scope="col">${t("speed.tableShared")}</th>${ROADS.map((road) => `<th scope="col">${t(`speed.road.${road.id}`)}</th>`).join("")}</tr></thead><tbody>${VEHICLES.flatMap((item) => variantRows(item).map(([variant, values]) => `<tr${highlight && item.id === state.vehicle && variant === variantKey ? ' class="is-current"' : ""}><th scope="row">${rowLabel(item, variant)}</th><td>${SHARED_ZONE}</td>${values.map((value, index) => `<td>${limitCell(value, ROADS[index])}</td>`).join("")}</tr>`)).join("")}</tbody></table>`;

  const signCards = SIGN_CARDS.map((sign) => {
    const open = state.signs.has(sign.id);
    return `<li class="speed-sign-card${open ? " is-open" : ""}"><button type="button" data-speed-sign="${sign.id}" aria-expanded="${open}" aria-controls="speedSign-${sign.id}">${signArt(sign.id)}<strong>${t(`speed.sign.${sign.id}.name`)}</strong><small>${sign.code ? `<b>${sign.code}</b> · ` : ""}${t(open ? "speed.signClose" : "speed.signTap")}</small></button><div class="speed-sign-detail" id="speedSign-${sign.id}"${open ? "" : " hidden"}><p>${t(`speed.sign.${sign.id}.meaning`)}</p><p class="speed-sign-trap"><span aria-hidden="true">⚑</span> ${t(`speed.sign.${sign.id}.trap`)}</p></div></li>`;
  }).join("");

  const placeTiles = PLACES.map((place, index) => `<li class="speed-place"><span class="speed-place-index" aria-hidden="true">${String.fromCharCode(97 + index)}</span>${sceneIcon(place)}<span>${t(`speed.place.${place}`)}</span></li>`).join("");
  const flashList = FLASH.map((item) => `<li class="speed-flash ${item.yes ? "is-yes" : "is-no"}"><span class="speed-flash-mark" aria-hidden="true">${item.yes ? "✓" : "×"}</span><div><strong>${t(`speed.flash.${item.id}.q`)}</strong><p><b>${t(item.yes ? "speed.yes" : "speed.no")}.</b> ${t(`speed.flash.${item.id}.a`)}</p></div></li>`).join("");

  const excessRows = EXCESS.map((band) => `<tr class="speed-excess-${band.id}"><th scope="row">${t(`speed.level.${band.id}`)}</th><td>${band.town}</td><td>${band.outside}</td><td>${band.fine}</td></tr>`).join("");
  const exceptions = ["posted", "vehicle", "temporary", "weather", "emergency"].map((item) => `<li><strong>${t(`speed.except.${item}.title`)}</strong><p>${t(`speed.except.${item}.body`)}</p></li>`).join("");
  const facts = FACTS.map((fact) => `<li><strong>${t(`speed.fact.${fact}.title`)}</strong><p>${t(`speed.fact.${fact}.body`)}</p></li>`).join("");

  const choices = (question) => question.choices.map((choice, index) => {
    const answered = state.picked !== null;
    const correct = answered && choice === question.correct;
    const wrong = answered && choice === state.picked && !correct;
    const label = typeof choice === "number" ? `${choice} ${unit}` : t(`speed.drill.${question.id}.${choice}`);
    return `<button type="button" class="speed-choice${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}" data-speed-answer="${index}" aria-disabled="${answered}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(label)}${correct || wrong ? `<b aria-label="${escapeHtml(t(correct ? "speed.correct" : "speed.incorrect"))}">${correct ? "✓" : "×"}</b>` : ""}</button>`;
  }).join("");
  const deckChips = DECKS.map((deck) => `<button type="button" class="speed-deck-chip" data-speed-deck="${deck}" aria-pressed="${state.deck === deck}">${t(`speed.deck.${deck}`)} <small>${deck === "all" ? DRILLS.length : DRILLS.filter((drill) => drill.deck === deck).length}</small></button>`).join("");
  const drillMarkup = () => {
    const total = state.started ? state.order.length : deckDrills().length;
    if (!state.started) return `<div class="speed-drill-intro"><span class="speed-drill-symbol" aria-hidden="true">↺</span><h3>${t("speed.drill.startTitle")}</h3><p>${t("speed.drill.startHelp", { count: total })}</p><button class="button button-primary" type="button" data-speed-start>${t("speed.drill.start")}</button></div>`;
    if (state.index === state.order.length) return `<div class="speed-drill-intro"><span class="speed-drill-score">${state.score}<small> / ${total}</small></span><h3 id="speedDrillQuestion" tabindex="-1">${t(state.score === total ? "speed.drill.perfect" : "speed.drill.finished")}</h3><p>${t("speed.drill.finishHelp")}</p><div class="speed-drill-actions"><button class="button button-primary" type="button" data-speed-start>${t("speed.drill.again")}</button><button class="button button-ghost" type="button" data-speed-practice>${t("speed.practice")}</button></div></div>`;
    const question = state.order[state.index];
    return `<div class="speed-drill-top"><span class="eyebrow">${t("speed.drill.counter", { current: state.index + 1, total })}</span><span>${t("speed.drill.score", { score: state.score })}</span></div><h3 id="speedDrillQuestion" tabindex="-1">${t(`speed.drill.${question.id}.question`)}</h3><div class="speed-choices">${choices(question)}</div>${state.picked !== null ? `<div class="speed-drill-feedback" id="speedDrillFeedback" tabindex="-1"><strong>${t(state.picked === question.correct ? "speed.correct" : "speed.drill.notQuite")}</strong><p>${t(`speed.drill.${question.id}.why`)}</p>${link(question.source, t("speed.ruleSource"))}</div><button class="button button-primary speed-drill-next" type="button" data-speed-next>${t(state.index === state.order.length - 1 ? "speed.drill.finish" : "speed.drill.next")} →</button>` : ""}`;
  };

  const chapters = [["numbers", "speedNumbers"], ["signs", "speedSigns"], ["moderate", "speedModerate"], ["limits", "speedLimits"], ["physics", "speedPhysics"], ["recall", "speedRecallTitle"]];
  const stopping = stoppingDistances(state.speed, state.wet);

  // Re-rendering in place (clicks, language or sync) must not replay the page entry animation.
  const settled = Boolean(root.querySelector(".speed-page"));
  root.innerHTML = `<div class="page speed-page${settled ? " is-settled" : ""}">
    <header class="speed-header"><div><span class="eyebrow">${t("speed.eyebrow")}</span><h1>${t("speed.title")}</h1><p>${t("speed.subtitle")}</p></div><button class="button button-ghost speed-print" type="button" data-speed-print><span aria-hidden="true">↓</span> ${t("speed.print")}</button></header>
    <nav class="speed-chapters" aria-label="${escapeHtml(t("speed.chaptersLabel"))}">${chapters.map(([id, target], index) => `<button type="button" data-speed-jump="${target}"><b>0${index + 1}</b>${t(`speed.chapter.${id}`)}</button>`).join("")}</nav>

    <section class="speed-map" aria-labelledby="speedNumbers">
      <div class="speed-map-heading"><div><span class="speed-step">01 / ${t("speed.learn")}</span><h2 id="speedNumbers" tabindex="-1">${t("speed.mapTitle")}</h2><p>${t("speed.mapHelp")}</p></div><span class="speed-map-unit">${unit}</span></div>
      <div class="speed-garage" role="group" aria-label="${escapeHtml(t("speed.garageLabel"))}">${garageMarkup}</div>
      <div class="speed-controls"><label class="speed-trailer${vehicle.trailer ? "" : " is-disabled"}"><input type="checkbox" id="speedTrailer"${towing ? " checked" : ""}${vehicle.trailer ? "" : " disabled"}/><span>${t(vehicle.sidecar ? "speed.sidecar" : vehicle.trailer ? "speed.trailer" : "speed.noTrailerRow")}</span></label><p class="speed-scope"><b>${rowLabel(vehicle, variantKey)}</b> · <span lang="pt">${vehicle.pt}</span> · ${t("speed.defaults")}</p><button class="speed-cover" type="button" data-speed-cover aria-pressed="${state.covered}">${t(state.covered ? "speed.reveal" : "speed.cover")}</button></div>
      <ol class="speed-road-grid">${roadCards}</ol>
      <div class="speed-rhythm"><span aria-hidden="true">↗</span><div><strong>${t(state.covered ? "speed.recallCue" : "speed.chant", { numbers: numbersPhrase })}</strong><p>${t(state.covered ? "speed.coverHelp" : `speed.memory.${vehicle.id}.${variantKey}`)}</p></div></div>
      <div class="speed-shared">${speedSign(SHARED_ZONE, false, true)}<div><strong>${t("speed.sharedTitle")}</strong><p>${t("speed.sharedHelp")}</p></div><span class="speed-shared-tag" lang="pt">Zona de coexistência · H46</span></div>
      <div class="speed-ladder"><div class="speed-ladder-heading"><h3>${t("speed.ladderTitle")}</h3><p>${t("speed.ladderHelp")}</p></div><ol class="speed-rungs">${ladderRungs}${ladderBarred}</ol></div>
      <details class="speed-table-details" id="speedTableDetails"${state.table ? " open" : ""}><summary>${t("speed.tableToggle")}</summary><div class="speed-table-wrap">${fullTable(t("speed.tableCaption"), true)}</div><p class="speed-map-note">${t("speed.semiNote")}</p></details>
      <p class="speed-map-note">${t("speed.scopeHelp")} ${link(TABLE, t("speed.tableSource"))}</p>
    </section>

    <div class="speed-section-heading"><span class="speed-step">02 / ${t("speed.notice")}</span><h2 id="speedSigns" tabindex="-1">${t("speed.signsTitle")}</h2><p>${t("speed.signsHelp")}</p></div>
    <ul class="speed-sign-grid">${signCards}</ul>
    <p class="speed-map-note">${link(SIGNS, t("speed.signSource"))}</p>

    <div class="speed-section-heading"><span class="speed-step">03 / ${t("speed.moderateStep")}</span><h2 id="speedModerate" tabindex="-1">${t("speed.moderateTitle")}</h2><p>${t("speed.moderateHelp")}</p></div>
    <section class="speed-moderate" aria-label="${escapeHtml(t("speed.moderateTitle"))}">
      <ol class="speed-places">${placeTiles}</ol>
      <div class="speed-flash-round"><h3>${t("speed.flashTitle")}</h3><p>${t("speed.flashHelp")}</p><ul>${flashList}</ul>${link(CODE, t("speed.articles25"))}</div>
    </section>

    <div class="speed-section-heading"><span class="speed-step">04 / ${t("speed.limitsStep")}</span><h2 id="speedLimits" tabindex="-1">${t("speed.limitsTitle")}</h2><p>${t("speed.limitsHelp")}</p></div>
    <section class="speed-traps" aria-label="${escapeHtml(t("speed.limitsTitle"))}">
      <article class="speed-trap"><span class="speed-trap-index">A</span><h3>${t("speed.slowTitle")}</h3><div class="speed-floor"><strong>50</strong><span>${t("speed.floorLabel")}</span></div><p>${t("speed.slowHelp")}</p><p>${t("speed.floorHelp")}</p><p class="speed-trap-extra">${t("speed.laneHelp")}</p><p class="speed-trap-extra">${t("speed.accessHelp")}</p>${link(CODE, t("speed.articles2672"))}</article>
      <article class="speed-trap"><span class="speed-trap-index">B</span><h3>${t("speed.fastTitle")}</h3><p>${t("speed.fastHelp")}</p><table class="speed-excess"><thead><tr><th scope="col">${t("speed.excess.level")}</th><th scope="col">${t("speed.excess.inTown")}</th><th scope="col">${t("speed.excess.outside")}</th><th scope="col">${t("speed.excess.fine")}</th></tr></thead><tbody>${excessRows}</tbody></table><p class="speed-trap-extra">${t("speed.fineNote")}</p>${link(CODE, t("speed.articles27145"))}</article>
      <article class="speed-trap speed-trap-wide"><span class="speed-trap-index">C</span><h3>${t("speed.exceptTitle")}</h3><ul class="speed-exceptions">${exceptions}</ul>${link(CODE, t("speed.articles2864"))}</article>
    </section>

    <div class="speed-section-heading"><span class="speed-step">05 / ${t("speed.physicsStep")}</span><h2 id="speedPhysics" tabindex="-1">${t("speed.physicsTitle")}</h2><p>${t("speed.physicsHelp")}</p></div>
    <section class="speed-physics" aria-label="${escapeHtml(t("speed.physicsTitle"))}">
      <div class="speed-physics-lab">
        <div class="speed-physics-controls"><label for="speedPhysicsRange"><span>${t("speed.physicsSpeed")}</span><output id="speedPhysicsValue" for="speedPhysicsRange">${state.speed} ${unit}</output></label><input type="range" id="speedPhysicsRange" min="30" max="130" step="10" value="${state.speed}"/><div class="speed-surface-switch" role="group" aria-label="${escapeHtml(t("speed.physicsSurface"))}"><button type="button" data-speed-surface="dry" aria-pressed="${!state.wet}">${t("speed.physicsDry")}</button><button type="button" data-speed-surface="wet" aria-pressed="${state.wet}">${t("speed.physicsWet")}</button></div></div>
        <div class="speed-physics-bars" id="speedPhysicsBars" aria-live="polite">
          <div class="speed-bar"><span>${t("speed.physicsReaction")}</span><div class="speed-bar-track"><i class="speed-bar-reaction" style="width:${Math.min(100, stopping.reaction / 2)}%"></i></div><output data-speed-out="reaction">${Math.round(stopping.reaction)} ${t("speed.metres")}</output></div>
          <div class="speed-bar"><span>${t("speed.physicsBraking")}</span><div class="speed-bar-track"><i class="speed-bar-braking" style="width:${Math.min(100, stopping.braking / 2)}%"></i></div><output data-speed-out="braking">${Math.round(stopping.braking)} ${t("speed.metres")}</output></div>
          <div class="speed-bar is-total"><span>${t("speed.physicsTotal")}</span><div class="speed-bar-track"><i class="speed-bar-total" style="width:${Math.min(100, stopping.total / 2)}%"></i></div><output data-speed-out="total">${Math.round(stopping.total)} ${t("speed.metres")}</output></div>
        </div>
        <p class="speed-physics-note">${t("speed.physicsNote")}</p>
      </div>
      <ul class="speed-facts">${facts}</ul>
    </section>

    <section class="speed-recall" aria-labelledby="speedRecallTitle"><div class="speed-recall-heading"><span class="speed-step">06 / ${t("speed.recall")}</span><h2 id="speedRecallTitle" tabindex="-1">${t("speed.drill.title")}</h2><p>${t("speed.drill.help", { count: DRILLS.length })}</p><div class="speed-decks" role="group" aria-label="${escapeHtml(t("speed.deckLabel"))}">${deckChips}</div><div class="speed-recall-plan"><span>1</span>${t("speed.repeat.now")}<span>2</span>${t("speed.repeat.later")}<span>3</span>${t("speed.repeat.tomorrow")}</div><button class="button button-ghost" type="button" data-speed-practice>${t("speed.practice")} ↗</button></div><div class="speed-drill" id="speedDrill">${drillMarkup()}</div></section>

    <footer class="speed-sources"><strong>${t("speed.sourcesTitle")}</strong><p>${t("speed.checked")}</p><div>${link(CODE, t("speed.codeSource"))}${link(TABLE, t("speed.tableSource"))}${link(SIGNS, t("speed.signSource"))}</div><p>${t("speed.sourceScope")}</p></footer>
    <div class="speed-print-sheet"><h2>${t("speed.printTitle")}</h2>${fullTable(`${t("speed.defaults")} · ${unit}`, false)}<p>${t("speed.printContext")}</p><ul><li>${t("speed.print.shared")}</li><li>${t("speed.print.floor")}</li><li>${t("speed.print.endSign")}</li><li>${t("speed.print.moderate")}</li><li>${t("speed.print.severity")}</li></ul></div>
  </div>`;

  const renderAgain = (focus) => renderSpeedLimits(root, { t, escapeHtml, onPractice }, focus);
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("[data-speed-jump]").forEach((button) => button.addEventListener("click", () => {
    const target = root.querySelector(`#${button.dataset.speedJump}`);
    target?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  }));
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
  root.querySelector("#speedTableDetails").addEventListener("toggle", (event) => { state.table = event.target.open; });
  root.querySelector("[data-speed-print]").addEventListener("click", () => window.print());
  root.querySelectorAll("[data-speed-sign]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.speedSign;
    if (state.signs.has(id)) state.signs.delete(id); else state.signs.add(id);
    renderAgain(`[data-speed-sign="${id}"]`);
  }));
  const paintPhysics = () => {
    const result = stoppingDistances(state.speed, state.wet);
    root.querySelector("#speedPhysicsValue").textContent = `${state.speed} ${unit}`;
    for (const [key, value] of Object.entries(result)) {
      root.querySelector(`[data-speed-out="${key}"]`).textContent = `${Math.round(value)} ${t("speed.metres")}`;
      root.querySelector(`.speed-bar-${key}`).style.width = `${Math.min(100, value / 2)}%`;
    }
  };
  root.querySelector("#speedPhysicsRange").addEventListener("input", (event) => {
    state.speed = Number(event.target.value);
    paintPhysics();
  });
  root.querySelectorAll("[data-speed-surface]").forEach((button) => button.addEventListener("click", () => {
    state.wet = button.dataset.speedSurface === "wet";
    root.querySelectorAll("[data-speed-surface]").forEach((other) => other.setAttribute("aria-pressed", String((other.dataset.speedSurface === "wet") === state.wet)));
    paintPhysics();
  }));
  root.querySelectorAll("[data-speed-practice]").forEach((button) => button.addEventListener("click", onPractice));
  root.querySelectorAll("[data-speed-deck]").forEach((button) => button.addEventListener("click", () => {
    if (state.deck === button.dataset.speedDeck) return;
    Object.assign(state, { deck: button.dataset.speedDeck, started: false, index: 0, picked: null, score: 0, order: [] });
    renderAgain(`[data-speed-deck="${state.deck}"]`);
  }));
  root.querySelector("[data-speed-start]")?.addEventListener("click", () => {
    Object.assign(state, { started: true, index: 0, picked: null, score: 0, order: deckDrills() });
    renderAgain("#speedDrillQuestion");
  });
  root.querySelectorAll("[data-speed-answer]").forEach((button) => button.addEventListener("click", () => {
    if (state.picked !== null) return;
    const question = state.order[state.index];
    state.picked = question.choices[Number(button.dataset.speedAnswer)];
    if (state.picked === question.correct) state.score++;
    renderAgain("#speedDrillFeedback");
  }));
  root.querySelector("[data-speed-next]")?.addEventListener("click", () => {
    if (state.picked === null || state.index >= state.order.length) return;
    state.index++;
    state.picked = null;
    renderAgain("#speedDrillQuestion");
  });
  if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
}

// Content inventory for the data check, so every derived translation key and drill answer is verified.
export const SPEED_ATLAS = Object.freeze({
  sharedZone: SHARED_ZONE,
  roads: ROADS.map((road) => road.id),
  vehicles: VEHICLES.map((item) => ({ id: item.id, variants: variantRows(item).map(([variant, values]) => ({ variant, values })), sidecar: Boolean(item.sidecar) })),
  signs: SIGN_CARDS.map((sign) => sign.id),
  places: PLACES,
  flash: FLASH.map((item) => item.id),
  facts: FACTS,
  levels: EXCESS.map((band) => band.id),
  exceptions: ["posted", "vehicle", "temporary", "weather", "emergency"],
  decks: DECKS,
  drills: DRILLS.map((drill) => ({ id: drill.id, deck: drill.deck, choices: drill.choices, correct: drill.correct })),
});
