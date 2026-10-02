import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const indexUrl = "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/";
const cache = new URL("../tmp/imt-audit/", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function download(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`${response.status}: ${url}`);
      return { bytes: Buffer.from(await response.arrayBuffer()), url: response.url };
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

const index = await download(indexUrl);
const links = new Map();
for (const match of index.bytes.toString("utf8").matchAll(/href=["']([^"']*\/rel_(\d+)_condutores\.pdf)["']/gi)) {
  const url = new URL(match[1].replaceAll("&amp;", "&"), indexUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.imt-ip.pt") throw new Error("Unexpected IMT PDF host");
  links.set(Number(match[2]), url.href);
}
if (links.size !== 14 || [...Array(14)].some((_, i) => !links.has(i + 1))) {
  throw new Error(`Expected the 14 driver PDF groups on the live IMT index; found ${links.size}. Inspect the index before updating the audit.`);
}
await mkdir(new URL("pdfs/", cache), { recursive: true });
await writeFile(new URL("index.html", cache), index.bytes);
const sources = [];
// Keep downloads sequential so failures leave a clear, complete source manifest.
for (const [group, url] of [...links].sort(([a], [b]) => a - b)) {
  const pdf = await download(url);
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Group ${group} is not a PDF`);
  const file = `rel_${group}_condutores.pdf`;
  await writeFile(new URL(`pdfs/${file}`, cache), pdf.bytes);
  sources.push({ group, url, resolvedUrl: pdf.url, file, sha256: hash(pdf.bytes), bytes: pdf.bytes.length });
  process.stdout.write(`Downloaded IMT driver group ${group}/14 (${pdf.bytes.length} bytes).\n`);
}
const manifest = { indexUrl, indexSha256: hash(index.bytes), fetchedAt: new Date().toISOString(), sources };
await writeFile(new URL("manifest.json", cache), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write("Saved the live index, 14 PDFs and their hashes in tmp/imt-audit/.\n");
