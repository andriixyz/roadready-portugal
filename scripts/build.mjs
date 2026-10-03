import { cp, mkdir, rm } from "node:fs/promises";
import { ensureQuestionImages } from "./fetch_question_images.mjs";
import { checkVerificationAssets } from "./check_verification.mjs";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

await ensureQuestionImages();
await checkVerificationAssets();
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ["index.html", "app.js", "i18n.js", "theme.js", "sync.js", "question-capture.js", "question-verification.js", "quiz-session.js", "profile-data.js", "study-activity.js", "supabase-config.js", "styles.css", ".nojekyll"]) {
  await cp(new URL(file, root), new URL(file, dist));
}

await mkdir(new URL("public/", dist), { recursive: true });
await cp(new URL("public/data/", root), new URL("public/data/", dist), { recursive: true });
await cp(new URL("public/images/", root), new URL("public/images/", dist), { recursive: true });
await mkdir(new URL("documentation/data/", dist), { recursive: true });
for (const file of ["imt-app-comparison.csv", "imt-pdf-comparison.csv"]) {
  await cp(new URL(`documentation/data/${file}`, root), new URL(`documentation/data/${file}`, dist));
}

process.stdout.write("Built static GitHub Pages site in dist/.\n");
