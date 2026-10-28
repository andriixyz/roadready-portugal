import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { monitorImtPdfs, observationFingerprint } from "./monitor_imt_pdfs.mjs";

const indexUrl = "https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/";
const url = (group) => `https://www.imt-ip.pt/pdfs/rel_${group}_condutores.pdf`;
const pdf = (group) => Buffer.from(`%PDF-1.7\nfixture group ${group}\n%%EOF`);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baseline = {
  indexUrl, indexSha256: hash("old page"), auditedAt: "2026-10-02T21:33:06.432Z",
  sources: [1, 2].map((group) => ({ group, url: url(group), resolvedUrl: url(group), sha256: hash(pdf(group)) })),
};
const html = (groups) => groups.map((group) => `<a href="${url(group)}">Group ${group}</a>`).join("\n");
function fakeFetch(page, replacements = new Map()) {
  return async (requested) => {
    const replacement = replacements.get(requested);
    if (replacement instanceof Error) throw replacement;
    const group = Number(requested.match(/rel_(\d+)_condutores/)?.[1]);
    return {
      ok: true, url: replacement?.resolvedUrl || requested,
      arrayBuffer: async () => replacement?.bytes ?? (requested === indexUrl ? Buffer.from(page) : pdf(group)),
    };
  };
}
const run = (page, replacements) => monitorImtPdfs(baseline, { fetchImpl: fakeFetch(page, replacements) });

const unchanged = await run(html([1, 2]));
assert.equal(unchanged.status, "unchanged");
assert.equal(unchanged.sources.length, 2);
assert.equal(unchanged.indexPageChanged, true, "Unrelated page edits must not imply PDF changes");
assert.equal(observationFingerprint(unchanged), observationFingerprint(await run(`New banner${html([2, 1, 1])}`)));

const changed = await run(html([1, 2]), new Map([[url(1), { bytes: Buffer.from("%PDF-1.7\nnew question") }]]));
assert.equal(changed.status, "changed");
assert.deepEqual(changed.changes.map(({ group, kind }) => ({ group, kind })), [{ group: 1, kind: "bytes" }]);
assert.notEqual(observationFingerprint(changed), observationFingerprint(unchanged));

const groups = await run(html([2, 3]));
assert.equal(groups.status, "changed");
assert.deepEqual(groups.changes.map(({ group, kind }) => ({ group, kind })), [{ group: 1, kind: "removed" }, { group: 3, kind: "added" }]);

const moved = await run(html([1, 2]).replace(url(1), `${url(1)}?v=2&amp;download=1`));
assert.equal(moved.status, "changed");
assert.ok(moved.changes.some(({ kind, url: value }) => kind === "url" && value.endsWith("?v=2&download=1")));
const redirected = await run(html([1, 2]), new Map([[url(1), { resolvedUrl: "https://www.imt-ip.pt/new.pdf" }]]));
assert.ok(redirected.changes.some(({ kind }) => kind === "redirect"));

// Incomplete downloads must never certify the rest of the baseline as current.
for (const replacement of [new Error("Network unavailable"), { bytes: Buffer.from("<html>maintenance</html>") }, { resolvedUrl: "https://example.test/file.pdf" }]) {
  const incomplete = await run(html([1, 2]), new Map([[url(1), replacement]]));
  assert.equal(incomplete.status, "error");
  assert.equal(incomplete.errors[0].group, 1);
  assert.equal(incomplete.sources.length, 1, "Continue checking other groups after one failure");
}
const partialChange = await run(html([1, 3]), new Map([[url(1), new Error("Offline")]]));
assert.equal(partialChange.status, "error");
assert.ok(partialChange.changes.some(({ kind }) => kind === "added"));
assert.ok(partialChange.changes.some(({ kind }) => kind === "removed"));

for (const page of ["<html>No links</html>", html([1, 2]).replace(url(1), "https://example.test/rel_1_condutores.pdf"), `${html([1, 2])}<a href="${url(1)}?other=1">Duplicate</a>`]) {
  const invalid = await run(page);
  assert.equal(invalid.status, "error");
  assert.equal(invalid.sources.length, 0);
  assert.equal(invalid.changes.length, 0, "Parser failure must not announce removal of the whole bank");
}
const badBaseline = structuredClone(baseline);
badBaseline.sources[0].sha256 = "not-a-hash";
const invalid = await monitorImtPdfs(badBaseline, { fetchImpl: () => { throw new Error("Must not fetch"); } });
assert.equal(invalid.status, "error");
assert.match(invalid.errors[0].message, /audited PDF/);

console.log("IMT monitor checks passed: same-URL replacements, added/removed groups, URL/redirect changes, banner noise and incomplete/invalid downloads.");
