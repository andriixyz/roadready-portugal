import { hasExplanationCaution, hasReviewedExplanation, reviewedExplanationSource, studyExplanation } from "./reviewed-content.mjs";

export function addExplanations(questions) {
  return questions.map((question) => {
    const { explanationSource: previousSource, explanationCaution: previousCaution, ...rest } = question;
    const reviewed = hasReviewedExplanation(question);
    const source = reviewedExplanationSource(question);
    return {
      ...rest,
      explanation: {
        en: studyExplanation(question, "en"),
        pt: studyExplanation(question, "pt"),
      },
      explanationReviewed: reviewed,
      ...(source ? { explanationSource: source } : {}),
      ...(hasExplanationCaution(question) ? { explanationCaution: true } : {}),
    };
  });
}
