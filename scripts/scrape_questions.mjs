import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://www.bomcondutor.pt";
const OUT = new URL("../public/data/questions-pt.json", import.meta.url);
const CONCURRENCY = 4;

const decode = (value = "") => value
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&ecirc;/g, "ê")
  .replace(/&acirc;/g, "â")
  .replace(/&atilde;/g, "ã")
  .replace(/&ccedil;/g, "ç")
  .replace(/&eacute;/g, "é")
  .replace(/&oacute;/g, "ó")
  .replace(/&uacute;/g, "ú")
  .replace(/&iacute;/g, "í")
  .replace(/&agrave;/g, "à")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, " ")
  .trim();

async function fetchText(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } catch (error) {
    if (attempt >= 8) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1100 + Math.random() * 600));
    return fetchText(url, attempt + 1);
  }
}

async function pool(items, worker, concurrency = CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
      if ((index + 1) % 100 === 0) process.stdout.write(`Fetched ${index + 1}/${items.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

function parseQuestion(html, meta) {
  const text = decode(html.match(/<!--sse-->([\s\S]*?)<!--\/sse-->/)?.[1]);
  const answers = [...html.matchAll(/<li class="answer ([A-Z])">[\s\S]*?<span class="answer-text">([\s\S]*?)<\/span><\/li>/g)]
    .map((match) => ({ key: match[1], pt: decode(match[2]) }));
  const cipher = html.match(new RegExp(`bc${meta.id}\\(\"([^\"]+)\"\\)`))?.[1];
  const decoded = cipher ? Number(Buffer.from(cipher, "base64").toString("utf8")) : NaN;
  const correct = Number.isFinite(decoded) ? String.fromCharCode(decoded - Number(meta.id)) : null;
  if (!text || answers.length < 2 || !correct) throw new Error(`Could not parse question ${meta.id}`);
  return {
    id: `bc-${meta.id}`,
    sourceId: Number(meta.id),
    category: "B",
    topic: meta.topic,
    topicSlug: meta.topicSlug,
    text: { pt: text },
    answers,
    correct,
    image: `${BASE}/assets/images/questions/${meta.id}.jpg`,
    sourceUrl: `${BASE}/questao/${meta.id}`,
    confidence: "study-key",
  };
}

async function main() {
  const category = await fetchText(`${BASE}/questoes/B`);
  const themes = [...category.matchAll(/<li><a href="(\/questoes\/B\/([^"]+))">([^<]+)<\/a><\/li>/g)]
    .map((match) => ({ url: match[1], slug: match[2], name: decode(match[3]) }));
  if (themes.length < 10) throw new Error(`Expected category themes, found ${themes.length}`);

  const themePages = await pool(themes, async (theme) => ({ theme, html: await fetchText(`${BASE}${theme.url}`) }), 6);
  const seen = new Set();
  const index = [];
  for (const { theme, html } of themePages) {
    for (const match of html.matchAll(/href="\/questao\/(\d+)"/g)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      index.push({ id: match[1], topic: theme.name, topicSlug: theme.slug });
    }
  }
  process.stdout.write(`Found ${index.length} unique Category B questions across ${themes.length} themes.\n`);
  if (index.length < 3500) throw new Error(`Question index looks incomplete (${index.length})`);

  const parsed = await pool(index, async (meta) => {
    try { return parseQuestion(await fetchText(`${BASE}/questao/${meta.id}`), meta); }
    catch (error) { process.stderr.write(`Skipping ${meta.id}: ${error.message}\n`); return null; }
  });
  const questions = parsed.filter(Boolean);
  questions.sort((a, b) => a.sourceId - b.sourceId);
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: BASE, count: questions.length, questions }));
  process.stdout.write(`Wrote ${questions.length} questions to ${OUT.pathname}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
