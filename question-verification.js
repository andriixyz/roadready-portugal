// This proof concerns the Portuguese question/options and image, never the
// official answer key or a translation. A changed corpus invalidates it.
const STATUSES = new Set(["matched", "text-only", "differences", "not-found"]);
const IMAGE_LIMITS = { mean: 6, p95: 18, tileMean: 16, aspect: 0.02 };
const HASH = /^[a-f0-9]{64}$/;

export function verificationInput(question) {
  return [question.id, question.text?.pt, question.answers.map(({ key, pt }) => [key, pt]),
    question.image || "", question.sourceUrl || ""];
}

export async function prepareVerificationAudit(questions, payload) {
  if (payload?.schemaVersion !== 1 || !HASH.test(payload.corpusFingerprint || "")
      || !Number.isFinite(Date.parse(payload.auditedAt)) || payload.method?.parserVersion !== 1
      || payload.method.answerKeyVerified !== false || payload.method.translationsVerified !== false
      || payload.sources?.length !== 14 || payload.summary?.appQuestions !== questions.length) {
    throw new Error("Invalid IMT verification manifest");
  }
  const bytes = new TextEncoder().encode(JSON.stringify(questions.map(verificationInput)));
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (digest !== payload.corpusFingerprint) throw new Error("IMT verification belongs to a different Portuguese corpus");
  const sources = new Map();
  for (const source of payload.sources) {
    const url = new URL(source.url);
    if (!Number.isInteger(source.group) || source.group < 1 || source.group > 14 || sources.has(source.group)
        || url.origin !== "https://www.imt-ip.pt" || url.search || url.hash
        || !url.pathname.endsWith(`/rel_${source.group}_condutores.pdf`)
        || !Number.isInteger(source.pages) || source.pages < 1 || !Number.isInteger(source.entries) || source.entries < 1
        || !HASH.test(source.sha256 || "")) throw new Error("Invalid IMT PDF source");
    sources.set(source.group, Object.freeze({ ...source }));
  }
  if (Object.keys(payload.questions || {}).length !== questions.length) throw new Error("IMT proof count mismatch");
  const counts = { matched: 0, "text-only": 0, differences: 0, "not-found": 0 };
  const records = new Map();
  for (const question of questions) {
    const record = payload.questions[question.id];
    if (!record || !STATUSES.has(record.status) || !Array.isArray(record.locations)
        || !HASH.test(record.imageSha256 || "") || records.has(question.id)
        || (record.status === "not-found" ? record.locations.length !== 0 : record.locations.length === 0)) {
      throw new Error("Invalid question verification");
    }
    for (const location of record.locations) {
      const source = sources.get(location.group);
      if (!source || !Number.isInteger(location.page) || location.page < 1 || location.page > source.pages
          || !Number.isInteger(location.row) || location.row < 1 || location.row > 7
          || Object.keys(IMAGE_LIMITS).some((key) => !Number.isFinite(location.image?.[key]) || location.image[key] < 0)
          || (record.status === "matched" && Object.entries(IMAGE_LIMITS).some(([key, limit]) => location.image[key] > limit))) {
        throw new Error("Invalid PDF comparison location");
      }
    }
    records.set(question.id, { input: JSON.stringify(verificationInput(question)), record });
    counts[record.status]++;
  }
  const summary = payload.summary;
  if (summary.matched !== counts.matched || summary.textOnly !== counts["text-only"]
      || summary.differences !== counts.differences || summary.notFound !== counts["not-found"]
      || summary.pdfEntries !== payload.sources.reduce((sum, source) => sum + source.entries, 0)
      || !Number.isInteger(summary.pdfEntriesMatched) || summary.pdfEntriesMatched < 0
      || summary.pdfEntriesMatched > summary.pdfEntries
      || summary.pdfEntriesWithoutMatch !== summary.pdfEntries - summary.pdfEntriesMatched) {
    throw new Error("IMT verification summary mismatch");
  }
  return { auditedAt: payload.auditedAt, summary: Object.freeze({ ...summary }), sources, records };
}

export function getQuestionVerification(question, audit) {
  const proof = audit?.records.get(question.id);
  return proof?.input === JSON.stringify(verificationInput(question)) ? proof.record : null;
}

export function verificationPdfUrl(audit, location) {
  const source = audit?.sources.get(location.group);
  return source ? `${source.url}#page=${location.page}` : "";
}
