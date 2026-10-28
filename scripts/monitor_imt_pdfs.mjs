import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const indexUrl = "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function officialUrl(value) {
  const url = new URL(value, indexUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.imt-ip.pt" || url.username || url.password) {
    throw new Error("Unexpected IMT source host; inspect the index before accepting a new source.");
  }
  url.hash = "";
  return url.href;
}

function driverLinks(html) {
  const links = new Map();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']*\brel_(\d+)_condutores\.pdf(?:[?#][^"']*)?)["']/gi)) {
    const group = Number(match[2]);
    const url = officialUrl(match[1].replaceAll("&amp;", "&"));
    if (!Number.isSafeInteger(group) || group < 1) throw new Error("Invalid driver PDF group.");
    if (links.has(group) && links.get(group) !== url) throw new Error(`Conflicting links for driver group ${group}.`);
    links.set(group, url);
  }
  if (!links.size) throw new Error("No recognized driver PDF links on the live index; its format may have changed.");
  return links;
}

async function download(url, fetchImpl) {
  for (let attempt = 0; ; attempt++) {
    try {
      // Hash full downloads: server dates and ETags alone can miss replaced files.
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(60000), cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const resolvedUrl = officialUrl(response.url || url);
      return { bytes: Buffer.from(await response.arrayBuffer()), resolvedUrl };
    } catch (error) {
      if (attempt >= 1) throw error;
    }
  }
}

export async function monitorImtPdfs(baseline, { fetchImpl = fetch, onProgress = () => {} } = {}) {
  const report = {
    checkedAt: new Date().toISOString(), auditedAt: baseline?.auditedAt ?? null,
    indexUrl, status: "error", sources: [], changes: [], errors: [],
  };
  try {
    if (baseline?.indexUrl !== indexUrl || !Array.isArray(baseline.sources) || !baseline.sources.length) {
      throw new Error("Missing or invalid audited IMT source baseline.");
    }
    const previous = new Map();
    for (const source of baseline.sources) {
      if (!Number.isSafeInteger(source.group) || source.group < 1 || previous.has(source.group)
          || !/^[a-f0-9]{64}$/.test(source.sha256) || officialUrl(source.url) !== source.url) {
        throw new Error("Invalid audited PDF group, URL or hash.");
      }
      previous.set(source.group, source);
    }
    const index = await download(indexUrl, fetchImpl);
    report.indexSha256 = hash(index.bytes);
    report.indexPageChanged = report.indexSha256 !== baseline.indexSha256;
    const links = driverLinks(index.bytes.toString("utf8"));
    for (const [group, source] of previous) {
      if (!links.has(group)) report.changes.push({ group, kind: "removed", previousUrl: source.url });
    }
    // Sequential requests keep load on IMT low. A failed group never means unchanged.
    for (const [group, url] of [...links].sort(([a], [b]) => a - b)) {
      const before = previous.get(group);
      if (!before) report.changes.push({ group, kind: "added", url });
      else if (url !== before.url) report.changes.push({ group, kind: "url", previousUrl: before.url, url });
      try {
        const pdf = await download(url, fetchImpl);
        if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Driver group ${group} did not return a PDF.`);
        const source = { group, url, resolvedUrl: pdf.resolvedUrl, sha256: hash(pdf.bytes), bytes: pdf.bytes.length };
        report.sources.push(source);
        if (before && source.sha256 !== before.sha256) {
          report.changes.push({ group, kind: "bytes", url, previousSha256: before.sha256, sha256: source.sha256 });
        }
        if (before && source.resolvedUrl !== (before.resolvedUrl || before.url)) {
          report.changes.push({ group, kind: "redirect", previousUrl: before.resolvedUrl || before.url, url: source.resolvedUrl });
        }
        onProgress(`Checked IMT driver group ${group} (${source.bytes} bytes).`);
      } catch (error) {
        report.errors.push({ group, url, message: error.message });
        onProgress(`Could not check IMT driver group ${group}: ${error.message}`);
      }
    }
    report.status = report.errors.length ? "error" : report.changes.length ? "changed" : "unchanged";
  } catch (error) {
    report.errors.push({ message: error.message });
  }
  return report;
}

// Ignore page banners and timestamps when deciding whether to repeat an alert.
export function observationFingerprint(report) {
  return hash(JSON.stringify({
    auditedAt: report.auditedAt, status: report.status,
    sources: report.sources, changes: report.changes, errors: report.errors,
  }));
}

async function main() {
  const root = new URL("../", import.meta.url);
  const output = new URL("tmp/imt-monitor/latest.json", root);
  let previous;
  try {
    previous = JSON.parse(await readFile(output, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  let baseline;
  let report;
  try {
    baseline = JSON.parse(await readFile(new URL("public/data/imt-verification.json", root), "utf8"));
    report = await monitorImtPdfs(baseline, { onProgress: console.log });
  } catch (error) {
    report = { checkedAt: new Date().toISOString(), auditedAt: null, indexUrl, status: "error", sources: [], changes: [], errors: [{ message: error.message }] };
  }
  report.previousCheckedAt = previous?.checkedAt ?? null;
  report.observationChanged = !previous || observationFingerprint(report) !== observationFingerprint(previous);
  await mkdir(new URL("tmp/imt-monitor/", root), { recursive: true });
  const staging = new URL("tmp/imt-monitor/latest.json.tmp", root);
  await writeFile(staging, `${JSON.stringify(report, null, 2)}\n`);
  await rename(staging, output);
  console.log(`IMT monitor: ${report.status}; ${report.sources.length} PDFs checked; ${report.changes.length} changes; ${report.errors.length} errors.`);
  for (const change of report.changes) console.log(`Group ${change.group}: ${change.kind} — ${change.url || change.previousUrl}`);
  for (const error of report.errors) console.error(error.message);
  console.log("Report: tmp/imt-monitor/latest.json. The audited baseline and study corpus were not changed.");
  process.exitCode = report.status === "error" ? 2 : report.status === "changed" ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
