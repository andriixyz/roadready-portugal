import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { getQuestionImagePath } from "../question-capture.js";

const root = new URL("../", import.meta.url);

export async function ensureQuestionImages() {
  const corpus = JSON.parse(await readFile(new URL("public/data/questions-pt.json", root), "utf8"));
  const questions = corpus.questions.filter(question => question.image);
  await mkdir(new URL("public/images/questions/", root), { recursive: true });
  let cursor = 0, complete = 0, downloaded = 0;
  const failures = [];
  async function worker() {
    while (cursor < questions.length && failures.length < 10) {
      const question = questions[cursor++];
      const destination = new URL(getQuestionImagePath(question), root);
      try {
        const cached = await stat(destination).catch(() => null);
        if (!cached || cached.size < 4) {
          let bytes;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              const response = await fetch(question.image, { signal: AbortSignal.timeout(30000) });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              bytes = new Uint8Array(await response.arrayBuffer());
              if (bytes.length > 2097152 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error("Invalid JPEG response");
              break;
            } catch (error) {
              if (attempt === 3) throw error;
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          }
          const temporary = new URL(`${destination.href}.part`);
          await writeFile(temporary, bytes);
          await rename(temporary, destination);
          downloaded++;
        }
        complete++;
        if (complete % 250 === 0) console.log(`Question images: ${complete}/${questions.length}`);
      } catch (error) {
        failures.push(`${question.sourceId}: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 12 }, worker));
  if (failures.length || complete !== questions.length) throw new Error(`Question image preparation failed (${complete}/${questions.length} ready): ${failures.join(", ")}`);
  console.log(`Question images ready: ${complete} (${downloaded} downloaded).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await ensureQuestionImages();
