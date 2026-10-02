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

export const RIGHT_TURN_SOURCE = "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830";
const rightTurnQuestion = "Ao mudar de direcção à direita no próximo entroncamento devo:";
const rightTurnAnswer = "Aproximar-me, com a necessária antecedência e quanto possível, do limite direito da faixa de rodagem e efectuar a manobra no trajecto mais curto.";
const rightTurnExplanation = {
  en: "For this right turn, move towards the right edge in good time, then follow the shortest route. Option A places you by the centre line instead of the right edge. Código da Estrada, Article 43(1).",
  pt: "Neste caso, prepare o desvio para a direita junto ao bordo direito e siga o percurso mais curto. A opção A coloca o veículo junto ao eixo, em vez do bordo direito. Código da Estrada, artigo 43.º, n.º 1.",
  ru: "Для этого поворота направо заранее приблизьтесь к правому краю и выберите кратчайшую траекторию. Вариант A предлагает положение у осевой линии вместо правого края. Código da Estrada, статья 43(1).",
};

export function hasReviewedExplanation(question) {
  return question.text.pt === rightTurnQuestion && question.correct === "B" && question.answers.length === 2
    && question.answers.find((answer) => answer.key === "A")?.pt === "Aproximar-me do limite esquerdo do eixo da faixa de rodagem e efectuar a manobra de modo a entrar na via que pretendo tomar pelo lado destinado ao seu sentido de circulação."
    && question.answers.find((answer) => answer.key === question.correct)?.pt === rightTurnAnswer;
}

export function studyExplanation(question, language, answers = question.answers) {
  if (hasReviewedExplanation(question)) return rightTurnExplanation[language];
  const correct = answers.find((answer) => answer.key === question.correct);
  const text = (correct?.[language] || correct?.en || correct?.pt || question.correct).trim();
  // Show only the study answer until the question has its own reviewed
  // reasoning. Topic guidance must not masquerade as its explanation.
  if (language === "ru") return `Ответ по учебному ключу: «${text}» Подробное пояснение для этого вопроса ещё не проверено.`;
  if (language === "pt") return `Resposta do material de estudo: «${text}» Ainda não foi revista uma explicação detalhada para esta pergunta.`;
  return `Study key answer: “${text}” A detailed explanation has not yet been reviewed for this question.`;
}
