#!/usr/bin/env node

/**
 * Build the compact Russian overlay for the RoadReady question corpus.
 *
 * Question and answer fields are translated from the reviewed English corpus.
 * Explanations combine the Russian correct answer with reviewed topic guidance.
 * The script deduplicates source strings, uses the translator's native JSON
 * array boundaries, validates every returned item, retries transient failures,
 * and checkpoints progress so a stopped run can be resumed safely.
 *
 * Usage:
 *   node scripts/translate_russian.mjs
 *   node scripts/translate_russian.mjs --concurrency=4
 *   node scripts/translate_russian.mjs --validate-only
 */

import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourcePath = path.join(projectRoot, "public/data/questions-en.json");
const outputPath = path.join(projectRoot, "public/data/questions-ru.json");
const temporaryOutputPath = `${outputPath}.tmp`;

const MICROSOFT_TRANSLATE_AUTH_URL = "https://edge.microsoft.com/translate/auth";
const MICROSOFT_TRANSLATE_URL =
  "https://api-edge.cognitive.microsofttranslator.com/translate";
const TARGET_LANGUAGE = "ru";
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_BATCH_CHARACTERS = 30_000;
const DEFAULT_MAX_BATCH_ITEMS = 90;
const CHECKPOINT_EVERY_BATCHES = 20;
const MAX_RETRIES = 6;
const REQUEST_TIMEOUT_MS = 35_000;

// Exact, high-frequency road-code phrases where generic translation engines
// often choose a conversational or non-driving meaning. Keeping these here
// makes terminology reproducible across the entire corpus.
const RUSSIAN_EXACT_OVERRIDES = new Map([
  ["Stop.", "Остановиться."],
  ["Stop immediately.", "Немедленно остановиться."],
  ["Always stop.", "Всегда останавливаться."],
  ["Stop and park.", "Остановиться и припарковаться."],
  ["Stop and give way.", "Остановиться и уступить дорогу."],
  ["Stop and give way to all vehicles.", "Остановиться и уступить дорогу всем транспортным средствам."],
  ["Give way.", "Уступить дорогу."],
  ["Who should give way in this situation?", "Кто должен уступить дорогу в этой ситуации?"],
  ["Park.", "Припарковаться."],
  ["Overtake.", "Выполнить обгон."],
  ["Overtaking.", "Обгон."],
  ["Moderate speed.", "Снизить скорость."],
  ["Drive at moderate speed.", "Двигаться с умеренной скоростью."],
  ["Drive at a particularly moderate speed.", "Двигаться с особенно низкой скоростью."],
  ["Especially moderate speed.", "Особенно низкая скорость."],
  ["The speed especially moderate.", "Особенно снизить скорость."],
  ["Moderate speed and stop if necessary.", "Снизить скорость и при необходимости остановиться."],
  ["Moderate speed and use sound signals.", "Снизить скорость и подать звуковой сигнал."],
  ["Reverse the direction of travel.", "Изменить направление движения на противоположное."],
  ["Can I reverse the direction of travel at this location?", "Могу ли я развернуться в этом месте?"],
  ["In this situation, can I reverse the direction of travel?", "Могу ли я развернуться в этой ситуации?"],
  ["I can't reverse the direction of travel.", "Я не могу развернуться."],
  ["The maneuver to reverse the direction of travel is prohibited.", "Разворот запрещён."],
  ["The dipped lights.", "Фары ближнего света."],
  ["Turn on the dipped beam lights.", "Включить фары ближнего света."],
  ["The parking lights.", "Габаритные огни."],
  ["On the carriageway.", "На проезжей части."],
  ["Increase stopping distance.", "Увеличить остановочный путь."],
  ["The stopping distance decreases.", "Остановочный путь уменьшается."],
  ["Reducing stopping distance.", "Сокращение остановочного пути."],
  ["Decrease the stopping distance.", "Сократить остановочный путь."],
  ["Approaching a roundabout.", "Приближение к перекрёстку с круговым движением."],
  ["Approaching level crossing with guard.", "Приближение к охраняемому железнодорожному переезду."],
  ["Approaching a level crossing without a guard.", "Приближение к неохраняемому железнодорожному переезду."],
  ["Level crossing without guard.", "Неохраняемый железнодорожный переезд."],
  ["A level crossing with guard.", "Охраняемый железнодорожный переезд."],
  ["The yield sign indicates:", "Знак «Уступите дорогу» означает:"],
]);

const RUSSIAN_TOPIC_GUIDANCE = {
  "Cedência de passagem": "Перед решением проверьте знаки, конфигурацию дороги и траектории всех участников движения.",
  "Circulação, segurança e veículos em missão urgente de socorro": "Преимущество экстренного транспорта действует, только когда срочный выезд обозначен надлежащими сигналами и проезд остаётся безопасным.",
  "Classificação, constituintes, inspecções, pesos e dimensões, protecção de ambiente, equipamentos de segurança, acidente": "Учитывайте указанные в вопросе класс автомобиля, массу, требования техосмотра и оборудования безопасности.",
  "Estado físico do condutor, alcool, drogas e medicamentos, sinais de obrigação": "Применяйте португальские нормы и учитывайте влияние алкоголя, лекарств, усталости или предписывающих знаков.",
  "Iluminação, passageiros e carga, condução defensiva e peões": "Выбирайте действие, которое сохраняет видимость и защищает пассажиров, пешеходов и перевозимый груз.",
  "Outras manobras": "Манёвр разрешён только после подачи сигнала, проверки обстановки и при отсутствии опасности или помех.",
  "Paragem, estacionamento e cruzamento de veículos": "Учитывайте положение автомобиля, необходимое свободное пространство и возможную опасность или помеху от остановки.",
  "Sinais de indicação": "Точно учитывайте символ, цвет и расположение показанного информационного знака.",
  "Sinais de perigo": "Предупреждающий знак сообщает об опасности впереди: определите её и заранее скорректируйте скорость и положение на дороге.",
  "Sinais de prescrição específica, sinais de cedência de passagem": "Сначала выполняйте специальное предписание или правило приоритета, показанное знаком, и только затем применяйте общие правила.",
  "Sinais de proibição": "Знак ограничивает обозначенных участников движения или действия с места, где начинается его действие.",
  "Sinalização luminosa, marcas no pavimento e outra sinalização": "Светофоры, разметка и временные сигналы определяют разрешённое движение и имеют приоритет там, где применяются.",
  "Títulos de condução, obtenção, revalidação, responsabilidade civil e criminal, contra-ordenações, cassação": "Учитывайте категорию прав и описанное в вопросе юридическое последствие или административное требование.",
  "Ultrapassagem": "Обгоняйте только при достаточной видимости, разрешающей разметке и безопасной дистанции с учётом движения других участников.",
  "Velocidade": "Соблюдайте действующее ограничение и дополнительно снижайте скорость при плохой видимости, интенсивном движении или сложных дорожных условиях.",
  "Vias de trânsito, condições ambientais adversas": "Выбирайте полосу и скорость, позволяющие сохранять контроль, видимость и безопасную дистанцию в указанных условиях.",
};

const argumentsMap = new Map(
  process.argv.slice(2).map((argument) => {
    const [name, value = "true"] = argument.split("=", 2);
    return [name, value];
  }),
);

const validateOnly = argumentsMap.has("--validate-only");
const forceRestart = argumentsMap.has("--force");
const concurrency = parsePositiveInteger(
  argumentsMap.get("--concurrency"),
  DEFAULT_CONCURRENCY,
  "--concurrency",
);
const maxBatchCharacters = parsePositiveInteger(
  argumentsMap.get("--max-batch-characters"),
  DEFAULT_MAX_BATCH_CHARACTERS,
  "--max-batch-characters",
);
const maxBatchItems = parsePositiveInteger(
  argumentsMap.get("--max-batch-items"),
  DEFAULT_MAX_BATCH_ITEMS,
  "--max-batch-items",
);

function parsePositiveInteger(value, fallback, optionName) {
  if (value === undefined) return fallback;
  const number = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return number;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function compactWhitespace(value) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function makeEmptyQuestionOverlay(question) {
  return {
    text: { ru: "" },
    answers: question.answers.map((answer) => ({ key: answer.key, ru: "" })),
    explanation: { ru: "" },
  };
}

function normalizeExistingQuestionOverlay(question, candidate) {
  const result = makeEmptyQuestionOverlay(question);
  if (isNonEmptyString(candidate?.text?.ru)) {
    result.text.ru = compactWhitespace(candidate.text.ru);
  }
  const candidateAnswers = new Map(
    Array.isArray(candidate?.answers)
      ? candidate.answers.map((answer) => [answer?.key, answer?.ru])
      : [],
  );
  for (const answer of result.answers) {
    const existingTranslation = candidateAnswers.get(answer.key);
    if (isNonEmptyString(existingTranslation)) {
      answer.ru = compactWhitespace(existingTranslation);
    }
  }
  if (isNonEmptyString(candidate?.explanation?.ru)) {
    result.explanation.ru = compactWhitespace(candidate.explanation.ru);
  }
  return result;
}

function applyTerminologyOverrides(source, overlay) {
  let appliedFields = 0;
  for (const question of source.questions) {
    const translated = overlay.questions[question.id];
    const questionOverride = RUSSIAN_EXACT_OVERRIDES.get(question.text.en);
    if (questionOverride) {
      translated.text.ru = questionOverride;
      appliedFields += 1;
    }

    const sourceAnswers = new Map(
      question.answers.map((answer) => [answer.key, answer]),
    );
    for (const answer of translated.answers) {
      const sourceAnswer = sourceAnswers.get(answer.key);
      const answerOverride = RUSSIAN_EXACT_OVERRIDES.get(sourceAnswer?.en);
      if (answerOverride) {
        answer.ru = answerOverride;
        appliedFields += 1;
      }
    }
  }
  return appliedFields;
}

function applyRussianExplanations(source, overlay) {
  for (const question of source.questions) {
    const translated = overlay.questions[question.id];
    const correct = translated.answers.find((answer) => answer.key === question.correct)?.ru;
    const guidance = RUSSIAN_TOPIC_GUIDANCE[question.topic] || "Примените точное правило дорожного движения и все детали показанной ситуации.";
    if (!isNonEmptyString(correct)) continue;
    translated.explanation.ru = `Правильный ответ: «${correct}» ${guidance}`;
  }
}

function validateSource(source) {
  if (!source || !Array.isArray(source.questions)) {
    throw new Error("Source must contain a questions array.");
  }
  if (source.count !== source.questions.length) {
    throw new Error(
      `Source count ${source.count} does not match ${source.questions.length} questions.`,
    );
  }

  const ids = new Set();
  for (const [questionIndex, question] of source.questions.entries()) {
    if (!isNonEmptyString(question?.id) || ids.has(question.id)) {
      throw new Error(`Invalid or duplicate question id at index ${questionIndex}.`);
    }
    ids.add(question.id);
    if (!isNonEmptyString(question?.text?.pt || question?.text?.en)) {
      throw new Error(`Question ${question.id} has no translatable text.`);
    }
    if (!Array.isArray(question.answers) || question.answers.length < 2) {
      throw new Error(`Question ${question.id} has invalid answers.`);
    }
    const answerKeys = new Set();
    for (const answer of question.answers) {
      if (
        !isNonEmptyString(answer?.key) ||
        answerKeys.has(answer.key) ||
        !isNonEmptyString(answer?.pt || answer?.en)
      ) {
        throw new Error(`Question ${question.id} has an invalid answer.`);
      }
      answerKeys.add(answer.key);
    }
    if (!isNonEmptyString(question?.explanation?.en || question?.explanation?.pt)) {
      throw new Error(`Question ${question.id} has no explanation.`);
    }
  }
}

function validateOverlay(source, overlay, { requireComplete }) {
  const issues = [];
  const expectedIds = source.questions.map((question) => question.id);
  const actualIds = Object.keys(overlay?.questions || {});
  const expectedIdSet = new Set(expectedIds);

  if (actualIds.length !== expectedIds.length) {
    issues.push(
      `question count is ${actualIds.length}; expected ${expectedIds.length}`,
    );
  }
  for (const id of actualIds) {
    if (!expectedIdSet.has(id)) issues.push(`unexpected question id ${id}`);
  }

  let completedFields = 0;
  let expectedFields = 0;
  for (const question of source.questions) {
    const translated = overlay?.questions?.[question.id];
    if (!translated) {
      issues.push(`missing question ${question.id}`);
      continue;
    }

    expectedFields += 2 + question.answers.length;
    if (isNonEmptyString(translated?.text?.ru)) completedFields += 1;
    else if (requireComplete) issues.push(`${question.id}: missing Russian text`);

    if (isNonEmptyString(translated?.explanation?.ru)) completedFields += 1;
    else if (requireComplete) {
      issues.push(`${question.id}: missing Russian explanation`);
    }

    const expectedKeys = question.answers.map((answer) => answer.key);
    const actualAnswers = Array.isArray(translated.answers)
      ? translated.answers
      : [];
    const actualKeys = actualAnswers.map((answer) => answer?.key);
    if (
      expectedKeys.length !== actualKeys.length ||
      expectedKeys.some((key, index) => key !== actualKeys[index])
    ) {
      issues.push(`${question.id}: answer keys or ordering do not match source`);
      continue;
    }
    for (const answer of actualAnswers) {
      if (isNonEmptyString(answer.ru)) completedFields += 1;
      else if (requireComplete) {
        issues.push(`${question.id}/${answer.key}: missing Russian answer`);
      }
    }
  }

  if (issues.length > 0) {
    const preview = issues.slice(0, 20).join("\n  - ");
    const suffix = issues.length > 20 ? `\n  ... ${issues.length - 20} more` : "";
    throw new Error(`Russian overlay validation failed:\n  - ${preview}${suffix}`);
  }

  return { completedFields, expectedFields };
}

function addTranslationUnit(unitsBySource, sourceLanguage, sourceText, target) {
  const normalizedSource = compactWhitespace(sourceText);
  const deduplicationKey = `${sourceLanguage}\u0000${normalizedSource}`;
  let unit = unitsBySource.get(deduplicationKey);
  if (!unit) {
    unit = {
      sourceLanguage,
      sourceText: normalizedSource,
      targets: [],
    };
    unitsBySource.set(deduplicationKey, unit);
  }
  unit.targets.push(target);
}

function buildPendingUnits(source, overlay) {
  const unitsBySource = new Map();

  for (const question of source.questions) {
    const translated = overlay.questions[question.id];
    if (!isNonEmptyString(translated.text.ru)) {
      addTranslationUnit(
        unitsBySource,
        isNonEmptyString(question.text.en) ? "en" : "pt",
        question.text.en || question.text.pt,
        (translation) => {
          translated.text.ru = translation;
        },
      );
    }

    const sourceAnswers = new Map(
      question.answers.map((answer) => [answer.key, answer]),
    );
    for (const translatedAnswer of translated.answers) {
      if (isNonEmptyString(translatedAnswer.ru)) continue;
      const sourceAnswer = sourceAnswers.get(translatedAnswer.key);
      addTranslationUnit(
        unitsBySource,
        isNonEmptyString(sourceAnswer.en) ? "en" : "pt",
        sourceAnswer.en || sourceAnswer.pt,
        (translation) => {
          translatedAnswer.ru = translation;
        },
      );
    }

    if (!isNonEmptyString(translated.explanation.ru)) {
      addTranslationUnit(
        unitsBySource,
        isNonEmptyString(question.explanation.en) ? "en" : "pt",
        question.explanation.en || question.explanation.pt,
        (translation) => {
          translated.explanation.ru = translation;
        },
      );
    }
  }

  return [...unitsBySource.values()];
}

function packBatches(units) {
  const batches = [];
  const byLanguage = Map.groupBy
    ? Map.groupBy(units, (unit) => unit.sourceLanguage)
    : units.reduce((groups, unit) => {
        if (!groups.has(unit.sourceLanguage)) groups.set(unit.sourceLanguage, []);
        groups.get(unit.sourceLanguage).push(unit);
        return groups;
      }, new Map());

  for (const [sourceLanguage, languageUnits] of byLanguage) {
    let batch = [];
    let characters = 0;
    for (const unit of languageUnits) {
      const itemCharacters = unit.sourceText.length + 1;
      if (
        batch.length > 0 &&
        (batch.length >= maxBatchItems ||
          characters + itemCharacters > maxBatchCharacters)
      ) {
        batches.push({ sourceLanguage, units: batch });
        batch = [];
        characters = 0;
      }
      batch.push(unit);
      characters += itemCharacters;
    }
    if (batch.length > 0) batches.push({ sourceLanguage, units: batch });
  }
  return batches;
}

let microsoftAccessToken = "";
let microsoftAccessTokenExpiresAt = 0;

async function getMicrosoftAccessToken({ forceRefresh = false } = {}) {
  if (
    !forceRefresh &&
    microsoftAccessToken &&
    Date.now() + 60_000 < microsoftAccessTokenExpiresAt
  ) {
    return microsoftAccessToken;
  }

  const response = await fetch(MICROSOFT_TRANSLATE_AUTH_URL, {
    headers: { "user-agent": "RoadReady-Russian-Corpus/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Microsoft auth returned HTTP ${response.status}`);
  }
  const token = (await response.text()).trim();
  const payloadPart = token.split(".")[1];
  if (!payloadPart) throw new Error("Microsoft auth returned an invalid token");
  const tokenPayload = JSON.parse(
    Buffer.from(payloadPart, "base64url").toString("utf8"),
  );
  microsoftAccessToken = token;
  microsoftAccessTokenExpiresAt = Number(tokenPayload.exp || 0) * 1_000;
  return microsoftAccessToken;
}

async function requestTranslation(units, sourceLanguage) {
  const body = JSON.stringify(units.map((unit) => ({ Text: unit.sourceText })));
  const requestUrl = new URL(MICROSOFT_TRANSLATE_URL);
  requestUrl.searchParams.set("api-version", "3.0");
  requestUrl.searchParams.set("from", sourceLanguage);
  requestUrl.searchParams.set("to", TARGET_LANGUAGE);

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const accessToken = await getMicrosoftAccessToken({
        forceRefresh: attempt > 0 && /HTTP (401|403)/.test(lastError?.message || ""),
      });
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json;charset=UTF-8",
          "user-agent": "RoadReady-Russian-Corpus/1.0",
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Microsoft Translator returned HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length !== units.length) {
        throw new Error(
          `boundary count mismatch: received ${payload?.length ?? 0}, ` +
            `expected ${units.length}`,
        );
      }
      const translations = new Map();
      for (const [index, unit] of units.entries()) {
        const value = compactWhitespace(
          payload[index]?.translations?.[0]?.text || "",
        );
        if (!isNonEmptyString(value)) {
          throw new Error(`empty translation at response index ${index}`);
        }
        translations.set(unit, value);
      }
      return translations;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < MAX_RETRIES) {
        const backoff = Math.min(15_000, 700 * 2 ** attempt) + Math.random() * 400;
        await delay(backoff);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function translateBatchRobustly(batch) {
  try {
    return await requestTranslation(batch.units, batch.sourceLanguage);
  } catch (error) {
    if (batch.units.length === 1) {
      throw new Error(
        `Could not translate one ${batch.sourceLanguage} item: ${error.message}`,
        { cause: error },
      );
    }
    const midpoint = Math.ceil(batch.units.length / 2);
    const left = await translateBatchRobustly({
      sourceLanguage: batch.sourceLanguage,
      units: batch.units.slice(0, midpoint),
    });
    const right = await translateBatchRobustly({
      sourceLanguage: batch.sourceLanguage,
      units: batch.units.slice(midpoint),
    });
    return new Map([...left, ...right]);
  }
}

function applyTranslations(batch, translations) {
  for (const unit of batch.units) {
    const value = translations.get(unit);
    if (!isNonEmptyString(value)) {
      throw new Error("No translation returned for a batch item.");
    }
    for (const setTarget of unit.targets) setTarget(value);
  }
}

const sourceText = await readFile(sourcePath, "utf8");
const source = JSON.parse(sourceText);
const sourceHash = sha256(sourceText);
validateSource(source);

let existingOverlay;
try {
  existingOverlay = JSON.parse(await readFile(outputPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

if (
  existingOverlay &&
  existingOverlay?.metadata?.sourceSha256 !== sourceHash &&
  !forceRestart
) {
  throw new Error(
    "The source corpus changed since the Russian overlay was generated. " +
      "Review the changes and rerun with --force to rebuild it.",
  );
}
if (forceRestart) existingOverlay = undefined;

const overlay = {
  schemaVersion: 1,
  language: TARGET_LANGUAGE,
  count: source.questions.length,
  metadata: {
    sourceFile: "public/data/questions-en.json",
    sourceSha256: sourceHash,
    questionAndAnswerSourceLanguage: "en",
    explanationSourceLanguage: "generated Russian guidance",
    targetLanguage: TARGET_LANGUAGE,
    translationProvider: "Microsoft Translator",
    complete: false,
    translatedAt: existingOverlay?.metadata?.translatedAt || null,
  },
  questions: {},
};

for (const question of source.questions) {
  overlay.questions[question.id] = normalizeExistingQuestionOverlay(
    question,
    existingOverlay?.questions?.[question.id],
  );
}
const terminologyOverrideCount = applyTerminologyOverrides(source, overlay);
applyRussianExplanations(source, overlay);
overlay.metadata.terminologyOverrides = {
  version: 1,
  phrases: RUSSIAN_EXACT_OVERRIDES.size,
  appliedFields: terminologyOverrideCount,
};
overlay.metadata.explanations = {
  version: 1,
  method: "Russian correct answer plus reviewed topic guidance",
};

async function writeOverlay({ complete }) {
  overlay.metadata.complete = complete;
  if (complete) overlay.metadata.translatedAt = new Date().toISOString();
  await writeFile(temporaryOutputPath, `${JSON.stringify(overlay)}\n`, "utf8");
  await rename(temporaryOutputPath, outputPath);
}

if (validateOnly) {
  if (!existingOverlay) throw new Error("Russian overlay does not exist.");
  const validation = validateOverlay(source, overlay, { requireComplete: true });
  console.log(
    `Validated ${source.questions.length} questions and ` +
      `${validation.completedFields} Russian fields.`,
  );
  process.exit(0);
}

const initialValidation = validateOverlay(source, overlay, {
  requireComplete: false,
});
const pendingUnits = buildPendingUnits(source, overlay);
const batches = packBatches(pendingUnits);
console.log(
  `Source: ${source.questions.length} questions, ` +
    `${initialValidation.expectedFields} translatable fields.`,
);
console.log(
  `Pending: ${pendingUnits.length} unique strings in ${batches.length} batches ` +
    `(${concurrency} workers).`,
);

if (batches.length > 0) {
  await writeOverlay({ complete: false });
  let nextBatchIndex = 0;
  let completedBatches = 0;
  let checkpoint = Promise.resolve();

  async function worker() {
    while (true) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      if (batchIndex >= batches.length) return;
      const batch = batches[batchIndex];
      const translations = await translateBatchRobustly(batch);
      applyTranslations(batch, translations);
      completedBatches += 1;

      if (
        completedBatches % CHECKPOINT_EVERY_BATCHES === 0 ||
        completedBatches === batches.length
      ) {
        checkpoint = checkpoint.then(() => writeOverlay({ complete: false }));
      }
      if (
        completedBatches === 1 ||
        completedBatches % 10 === 0 ||
        completedBatches === batches.length
      ) {
        const percent = ((completedBatches / batches.length) * 100).toFixed(1);
        console.log(`Translated ${completedBatches}/${batches.length} batches (${percent}%).`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()),
  );
  await checkpoint;
}

const finalValidation = validateOverlay(source, overlay, {
  requireComplete: true,
});
await writeOverlay({ complete: true });
const finalBytes = Buffer.byteLength(await readFile(outputPath));
console.log(
  `Done: ${source.questions.length} questions, ` +
    `${finalValidation.completedFields} Russian fields, ` +
    `${(finalBytes / 1024 / 1024).toFixed(2)} MiB.`,
);
