import { hasReviewedExplanation, RIGHT_TURN_SOURCE, studyExplanation } from "./reviewed-content.mjs";

export function addExplanations(questions) {
  return questions.map((question) => {
    const { explanationSource: previousSource, ...rest } = question;
    const reviewed = hasReviewedExplanation(question);
    return {
      ...rest,
      explanation: {
        en: studyExplanation(question, "en"),
        pt: studyExplanation(question, "pt"),
      },
      explanationReviewed: reviewed,
      ...(reviewed ? { explanationSource: RIGHT_TURN_SOURCE } : {}),
    };
  });
}
