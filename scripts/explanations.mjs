const TOPIC_GUIDANCE = {
  "Cedência de passagem": "Check the signs, road layout and approach of each road user before deciding who must give way.",
  "Circulação, segurança e veículos em missão urgente de socorro": "Emergency priority applies only when the urgent journey is properly signalled and can still be made safely.",
  "Classificação, constituintes, inspecções, pesos e dimensões, protecção de ambiente, equipamentos de segurança, acidente": "Use the vehicle class, weight and inspection or safety requirements stated in the question.",
  "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação": "Apply the Portuguese limits and the effect of alcohol, medicines, fatigue or mandatory signs.",
  "Iluminação, passageiros e carga, condução defensiva e peões": "Choose the action that preserves visibility and protects passengers, pedestrians and the vehicle load.",
  "Outras manobras": "A manoeuvre is allowed only after signalling, checking the surroundings and avoiding danger or obstruction.",
  "Paragem, estacionamento e cruzamento de veículos": "Consider the vehicle position, required clearance and whether stopping would create danger or obstruction.",
  "Sinais de indicação": "Read the symbol, colour and placement of the information sign exactly as shown.",
  "Sinais de perigo": "A warning sign announces a hazard ahead, so identify that hazard and adapt speed and position early.",
  "Sinais de prescrição específica, sinais de cedência de passagem": "Apply the specific instruction or priority rule shown by the sign before relying on general rules.",
  "Sinais de proibição": "The sign restricts the road users or actions represented from the point where it applies.",
  "Sinalização luminosa, marcas no pavimento e outra sinalização": "Traffic lights, road markings and temporary signals determine the permitted path and take priority where applicable.",
  "Títulos de condução, obtenção, revalidação, responsabilidade civil e criminal, contra-ordenações, cassação": "Use the licence category and the legal consequence or administrative requirement described in the question.",
  "Ultrapassagem": "Overtake only where visibility, markings, distance and the movements of other road users make it legal and safe.",
  "Velocidade": "Use the applicable limit while also reducing speed whenever visibility, traffic or road conditions require it.",
  "Vias de trânsito, condições ambientais adversas": "Choose the lane and speed that preserve control, visibility and a safe following distance in the conditions shown.",
};

const trimAnswer = (value = "") => value.trim().replace(/\s+/g, " ");

export function addExplanations(questions) {
  return questions.map((question) => {
    const correct = question.answers.find((answer) => answer.key === question.correct);
    const answerEn = trimAnswer(correct?.en || correct?.pt);
    const answerPt = trimAnswer(correct?.pt || correct?.en);
    const guidance = TOPIC_GUIDANCE[question.topic] || "Apply the exact road rule and details shown in the situation.";
    return {
      ...question,
      explanation: {
        en: `Correct answer: “${answerEn}” ${guidance}`,
        pt: `Resposta correta: “${answerPt}” Esta opção corresponde à regra aplicável ao tema «${question.topic}».`,
      },
    };
  });
}
