export function getQuestionImagePath(question) {
  if (!question.image) return "";
  const id = String(question.sourceId);
  if (!/^\d+$/.test(id)) throw new Error("Invalid question image ID");
  return `public/images/questions/${id}.jpg`;
}

export function getCaptureContent(question, language = "en") {
  const text = question.text?.[language] || question.text?.en || question.text?.pt || "";
  const answers = question.answers.map((answer, index) => ({
    label: String(index + 1), text: answer[language] || answer.en || answer.pt || "",
  }));
  return { text, answers, imagePath: getQuestionImagePath(question), sourceUrl: question.sourceUrl || "" };
}

export function getQuestionChatGPTPrompt(question, language = "en") {
  const instructions = {
    en: "Please explain this Portugal Category B driving-theory question using the attached image, if provided. Identify the correct option, explain the relevant rule, and briefly explain why the other options are incorrect. Answer in English. If the image is needed but missing, ask me to attach it before answering.",
    ru: "Объясни этот вопрос теоретического экзамена на права категории B в Португалии, используя прикреплённое изображение, если оно есть. Укажи правильный вариант, объясни соответствующее правило и кратко поясни, почему остальные варианты неверны. Ответь на русском. Если для ответа нужно изображение, но оно отсутствует, сначала попроси меня прикрепить его.",
    pt: "Explica esta pergunta do exame teórico da categoria B em Portugal, usando a imagem anexada, se existir. Identifica a opção correta, explica a regra aplicável e indica brevemente por que razão as outras opções estão erradas. Responde em português. Se a imagem for necessária mas estiver em falta, pede-me para a anexar antes de responder.",
  };
  const content = getCaptureContent(question, language);
  return [
    instructions[language] || instructions.en,
    `#${question.sourceId}\n${content.text}`,
    content.answers.map(answer => `${answer.label}. ${answer.text}`).join("\n"),
    content.sourceUrl,
  ].filter(Boolean).join("\n\n");
}

export function wrapCanvasText(context, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (context.measureText(line ? `${line} ${word}` : word).width <= maxWidth) {
        line = line ? `${line} ${word}` : word;
        continue;
      }
      if (line) { lines.push(line); line = ""; }
      for (const character of Array.from(word)) {
        if (line && context.measureText(line + character).width > maxWidth) {
          lines.push(line); line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ""; reject(new Error("Question image timed out")); }, 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error("Question image unavailable")); };
    image.src = url;
  });
}

function drawBox(context, x, y, width, height, fill, stroke) {
  context.fillStyle = fill;
  context.fillRect(x, y, width, height);
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
  }
}

export async function createQuestionImage(question, language, {
  heading = `RoadReady · Portugal B · #${question.sourceId}`,
  documentTarget = document, imageLoader = loadImage,
} = {}) {
  const content = getCaptureContent(question, language);
  const image = content.imagePath ? await imageLoader(content.imagePath) : null;
  const width = 1200, padding = 56, innerWidth = width - padding * 2;
  const canvas = documentTarget.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.font = "600 42px Arial, sans-serif";
  const questionLines = wrapCanvasText(context, content.text, innerWidth);
  context.font = "32px Arial, sans-serif";
  const answerLines = content.answers.map(answer => ({ ...answer, lines: wrapCanvasText(context, answer.text, innerWidth - 118) }));
  const imageWidth = image ? Math.min(innerWidth, image.naturalWidth * 2) : 0;
  const imageHeight = image ? Math.round(imageWidth * image.naturalHeight / image.naturalWidth) : 0;
  const questionHeight = questionLines.length * 54;
  const answerHeights = answerLines.map(answer => Math.max(88, answer.lines.length * 44 + 36));
  canvas.width = width;
  canvas.height = padding + 52 + (image ? imageHeight + 36 : 0) + questionHeight + 36 + answerHeights.reduce((sum, height) => sum + height + 18, 0) + 60 + padding;
  context.fillStyle = "#fffdf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "top";
  context.fillStyle = "#245e46";
  context.font = "700 24px Arial, sans-serif";
  context.fillText(heading, padding, padding);
  let y = padding + 52;
  if (image) {
    context.drawImage(image, Math.round((width - imageWidth) / 2), y, imageWidth, imageHeight);
    y += imageHeight + 36;
  }
  context.fillStyle = "#18261f";
  context.font = "600 42px Arial, sans-serif";
  questionLines.forEach(line => { context.fillText(line, padding, y); y += 54; });
  y += 36;
  answerLines.forEach((answer, index) => {
    drawBox(context, padding, y, innerWidth, answerHeights[index], "#ffffff", "#d9dfd8");
    drawBox(context, padding + 20, y + 20, 50, 50, "#eaf0e9");
    context.fillStyle = "#245e46";
    context.font = "700 28px Arial, sans-serif";
    context.fillText(answer.label, padding + 37, y + 28);
    context.fillStyle = "#18261f";
    context.font = "32px Arial, sans-serif";
    answer.lines.forEach((line, lineIndex) => context.fillText(line, padding + 92, y + 22 + lineIndex * 44));
    y += answerHeights[index] + 18;
  });
  context.fillStyle = "#647369";
  context.font = "20px Arial, sans-serif";
  context.fillText(content.sourceUrl, padding, y + 24);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create question image")), "image/png");
  });
}
