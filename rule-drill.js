// Shared recall drill for the offence and distance atlases. Answers live in page memory only: they never enter
// the saved profile, activity or exam-readiness evidence. A deck change or a new run starts again at zero.
export const createDrill = () => ({ deck: "all", started: false, index: 0, picked: null, score: 0, order: [] });

const inDeck = (drill, questions) => questions.filter((question) => drill.deck === "all" || question.deck === drill.deck);

export function deckChips(drill, { questions, decks, prefix, t }) {
  return decks.map((deck) => {
    const count = deck === "all" ? questions.length : questions.filter((question) => question.deck === deck).length;
    const label = deck === "all" ? t("atlas.deck.all") : t(`${prefix}.deck.${deck}`);
    return `<button type="button" class="speed-deck-chip" data-drill-deck="${deck}" aria-pressed="${drill.deck === deck}">${label} <small>${count}</small></button>`;
  }).join("");
}

// choiceLabel(question, choice) returns the visible text of one option; prefix selects the page's question keys.
export function drillMarkup(drill, { questions, prefix, t, escapeHtml, choiceLabel }) {
  const total = drill.started ? drill.order.length : inDeck(drill, questions).length;
  if (!drill.started) {
    return `<div class="speed-drill-intro"><span class="speed-drill-symbol" aria-hidden="true">↺</span><h3>${t("atlas.drill.startTitle")}</h3><p>${t("atlas.drill.startHelp", { count: total })}</p><button class="button button-primary" type="button" data-drill-start>${t("atlas.drill.start")}</button></div>`;
  }
  if (drill.index >= drill.order.length) {
    return `<div class="speed-drill-intro"><span class="speed-drill-score">${drill.score}<small> / ${total}</small></span><h3 id="atlasDrillQuestion" tabindex="-1">${t(drill.score === total ? "atlas.drill.perfect" : "atlas.drill.finished")}</h3><p>${t(`${prefix}.drill.finishHelp`)}</p><div class="speed-drill-actions"><button class="button button-primary" type="button" data-drill-start>${t("atlas.drill.again")}</button><button class="button button-ghost" type="button" data-atlas-practice>${t(`${prefix}.practice`)}</button></div></div>`;
  }
  const question = drill.order[drill.index];
  const answered = drill.picked !== null;
  const choices = question.choices.map((choice, index) => {
    const correct = answered && choice === question.correct;
    const wrong = answered && choice === drill.picked && !correct;
    return `<button type="button" class="speed-choice${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}" data-drill-answer="${index}" aria-disabled="${answered}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(choiceLabel(question, choice))}${correct || wrong ? `<b aria-label="${escapeHtml(t(correct ? "atlas.correct" : "atlas.incorrect"))}">${correct ? "✓" : "×"}</b>` : ""}</button>`;
  }).join("");
  const feedback = answered ? `<div class="speed-drill-feedback" id="atlasDrillFeedback" tabindex="-1"><strong>${t(drill.picked === question.correct ? "atlas.correct" : "atlas.drill.notQuite")}</strong><p>${t(`${prefix}.drill.${question.id}.why`)}</p><a class="text-link" href="${question.source}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("atlas.ruleSource"))} ↗</a></div><button class="button button-primary speed-drill-next" type="button" data-drill-next>${t(drill.index === drill.order.length - 1 ? "atlas.drill.finish" : "atlas.drill.next")} →</button>` : "";
  return `<div class="speed-drill-top"><span class="eyebrow">${t("atlas.drill.counter", { current: drill.index + 1, total })}</span><span>${t("atlas.drill.score", { score: drill.score })}</span></div><h3 id="atlasDrillQuestion" tabindex="-1">${t(`${prefix}.drill.${question.id}.question`)}</h3><div class="speed-choices">${choices}</div>${feedback}`;
}

export function bindDrill(root, drill, questions, renderAgain) {
  root.querySelectorAll("[data-drill-deck]").forEach((button) => button.addEventListener("click", () => {
    if (drill.deck === button.dataset.drillDeck) return;
    Object.assign(drill, createDrill(), { deck: button.dataset.drillDeck });
    renderAgain(`[data-drill-deck="${drill.deck}"]`);
  }));
  root.querySelector("[data-drill-start]")?.addEventListener("click", () => {
    Object.assign(drill, { started: true, index: 0, picked: null, score: 0, order: inDeck(drill, questions) });
    renderAgain("#atlasDrillQuestion");
  });
  root.querySelectorAll("[data-drill-answer]").forEach((button) => button.addEventListener("click", () => {
    if (drill.picked !== null) return;
    const question = drill.order[drill.index];
    drill.picked = question.choices[Number(button.dataset.drillAnswer)];
    if (drill.picked === question.correct) drill.score++;
    renderAgain("#atlasDrillFeedback");
  }));
  root.querySelector("[data-drill-next]")?.addEventListener("click", () => {
    if (drill.picked === null || drill.index >= drill.order.length) return;
    drill.index++;
    drill.picked = null;
    renderAgain("#atlasDrillQuestion");
  });
}

// Every translation key a drill can display, so the data check verifies both dictionaries.
export const drillKeys = (prefix, questions, decks, sharedChoice = () => false) => [
  `${prefix}.drill.finishHelp`, `${prefix}.practice`,
  ...decks.filter((deck) => deck !== "all").map((deck) => `${prefix}.deck.${deck}`),
  ...questions.flatMap((question) => [
    `${prefix}.drill.${question.id}.question`, `${prefix}.drill.${question.id}.why`,
    ...question.choices.filter((choice) => typeof choice === "string" && !sharedChoice(choice)).map((choice) => `${prefix}.drill.${question.id}.${choice}`),
  ]),
];
