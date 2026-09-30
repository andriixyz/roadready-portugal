import { cp, mkdir, rm } from "node:fs/promises";
import { ensureQuestionImages } from "./fetch_question_images.mjs";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

await ensureQuestionImages();
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ["index.html", "app.js", "i18n.js", "sync.js", "question-capture.js", "supabase-config.js", "styles.css", ".nojekyll"]) {
  await cp(new URL(file, root), new URL(file, dist));
}

await mkdir(new URL("public/", dist), { recursive: true });
await cp(new URL("public/data/", root), new URL("public/data/", dist), { recursive: true });
await cp(new URL("public/images/", root), new URL("public/images/", dist), { recursive: true });

process.stdout.write("Built static GitHub Pages site in dist/.\n");
