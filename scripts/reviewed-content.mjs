import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Corrections use the preserved Portuguese wording, never an English
// machine translation or a broad topic. Both corpus generators apply them.
export const REVIEWED_TRANSLATIONS = new Map([
  ["Nesta situação, ao mudar de direcção para a esquerda, cedo a passagem:", {
    en: "In this situation, when turning left, I give way to:",
    ru: "В этой ситуации при повороте налево я уступаю дорогу:",
  }],
  ["Cedo a passagem à ambulância porque:", {
    en: "I give way to the ambulance because:",
    ru: "Я уступаю дорогу машине скорой помощи, потому что:",
  }],
  ["Assinala adequadamente a marcha de urgência.", {
    en: "It properly signals that it is on an emergency journey.",
    ru: "Она надлежащим образом обозначает движение по срочному вызову.",
  }],
  ["É sempre um veículo prioritário.", {
    en: "It is always a priority vehicle.",
    ru: "Она всегда имеет приоритет.",
  }],
  ["Sai de um parque e se apresenta pela direita.", {
    en: "It is leaving a car park and approaching from the right.",
    ru: "Она выезжает с парковки и приближается справа.",
  }],
  ["Ao mudar de direcção à direita no próximo entroncamento devo:", {
    en: "When turning right at the next junction, I must:",
    ru: "При повороте направо на следующем перекрёстке я должен:",
  }],
  ["Aproximar-me do limite esquerdo do eixo da faixa de rodagem e efectuar a manobra de modo a entrar na via que pretendo tomar pelo lado destinado ao seu sentido de circulação.", {
    en: "Approach the left side of the centre line and turn into the intended road on the side used by traffic travelling in that direction.",
    ru: "Приблизиться к левой стороне осевой линии и выполнить манёвр так, чтобы въехать на выбранную дорогу со стороны, предназначенной для своего направления движения.",
  }],
  ["Aproximar-me, com a necessária antecedência e quanto possível, do limite direito da faixa de rodagem e efectuar a manobra no trajecto mais curto.", {
    en: "Move towards the right edge of the carriageway in good time and as close as possible, then make the turn by the shortest route.",
    ru: "Заблаговременно приблизиться как можно ближе к правому краю проезжей части и выполнить поворот по кратчайшей траектории.",
  }],
  ["Ao automóvel pesado e velocípede que não mudam de direcção.", {
    en: "The heavy vehicle and the bicycle that are not changing direction.",
    ru: "Тяжёлому транспортному средству и велосипеду, которые не меняют направление движения.",
  }],
  ["Ao automóvel pesado.", { en: "The heavy vehicle.", ru: "Тяжёлому транспортному средству." }],
  ["Ao velocípede.", { en: "The bicycle.", ru: "Велосипеду." }],
  ["Eu me apresento à sua direita.", {
    en: "I am approaching from the driver's right.",
    ru: "Я приближаюсь справа от водителя.",
  }],
]);

// Wording fixes found while reviewing each question with its image. They may
// cover only English or only Russian; the curated entries above take precedence.
const QUESTION_REVIEW_TRANSLATIONS = JSON.parse(readFileSync(new URL("./reviewed-translations.json", import.meta.url), "utf8"));
for (const [portuguese, wording] of Object.entries(QUESTION_REVIEW_TRANSLATIONS)) {
  if (!REVIEWED_TRANSLATIONS.has(portuguese)) REVIEWED_TRANSLATIONS.set(portuguese, wording);
}

export function reviewedTranslation(portuguese, language, fallback) {
  return REVIEWED_TRANSLATIONS.get(portuguese)?.[language] || fallback;
}

export function applyReviewedTranslations(question, language, target = question) {
  target.text[language] = reviewedTranslation(question.text.pt, language, target.text[language]);
  for (const answer of target.answers) {
    const source = question.answers.find((item) => item.key === answer.key);
    answer[language] = reviewedTranslation(source?.pt, language, answer[language]);
  }
  return target;
}

// Question-specific explanations reviewed against the question image and the
// current law. Each one is bound to the exact Portuguese wording, options, key
// and image, so a later scrape that changes any of them falls back to the
// unreviewed study-key text instead of asserting reasoning for another question.
export const REVIEWED_EXPLANATIONS = JSON.parse(readFileSync(new URL("./reviewed-explanations.json", import.meta.url), "utf8"));
export const EXPLANATION_SOURCES = REVIEWED_EXPLANATIONS.sources;

// Reasoning normally links an official source and ends with its article
// citation. "general" marks answers that rest on vehicle physics, physiology
// or first aid rather than a legal article; they carry no rule link, so a
// reviewer is never pushed to invent a citation.
export const GENERAL_SOURCE = "general";
export const OFFICIAL_SOURCE = /^https:\/\/([a-z0-9-]+\.)*(diariodarepublica\.pt|dre\.pt|imt-ip\.pt|ansr\.pt|inem\.pt|gov\.pt|eur-lex\.europa\.eu)\//;
export const CITATION = {
  en: /(Código da Estrada|Regulamento de Sinalização do Trânsito|Regulamento da Habilitação Legal para Conduzir|Código Penal|Decreto|Lei|Portaria).*?Articles? \d/,
  pt: /artigos? \d+\.º/,
  ru: /стать[яи] \d/,
};
export const PLACEHOLDER_EXPLANATION = /^(Study key answer|Resposta do material|Ответ по учебному ключу)/;

export function explanationFingerprint(question) {
  const identity = [question.id, question.text.pt, question.answers.map(({ key, pt }) => [key, pt]), question.correct, question.image];
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

function reviewedEntry(question) {
  const entry = REVIEWED_EXPLANATIONS.questions[question.id];
  return entry?.fingerprint === explanationFingerprint(question) ? entry : null;
}

export function hasReviewedExplanation(question) {
  return Boolean(reviewedEntry(question));
}

// "caution" marks reviewed items whose study key looked wrong, outdated or
// ambiguous; their explanation says so and the app labels them separately.
export function hasExplanationCaution(question) {
  return reviewedEntry(question)?.status === "caution";
}

export function reviewedExplanationSource(question) {
  const entry = reviewedEntry(question);
  if (!entry || entry.source === GENERAL_SOURCE) return undefined;
  return entry.sourceUrl || EXPLANATION_SOURCES[entry.source];
}

export function studyExplanation(question, language, answers = question.answers) {
  const reviewed = reviewedEntry(question);
  if (reviewed) return reviewed[language];
  const correct = answers.find((answer) => answer.key === question.correct);
  const text = (correct?.[language] || correct?.en || correct?.pt || question.correct).trim();
  // Show only the study answer until the question has its own reviewed
  // reasoning. Topic guidance must not masquerade as its explanation.
  if (language === "ru") return `Ответ по учебному ключу: «${text}» Подробное пояснение для этого вопроса ещё не проверено.`;
  if (language === "pt") return `Resposta do material de estudo: «${text}» Ainda não foi revista uma explicação detalhada para esta pergunta.`;
  return `Study key answer: “${text}” A detailed explanation has not yet been reviewed for this question.`;
}
