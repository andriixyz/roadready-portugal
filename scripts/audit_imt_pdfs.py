"""Compare the preserved Portuguese corpus with the downloaded IMT PDFs.

Read-only with respect to questions and answer keys. Requires pdfplumber,
pypdf, Pillow and numpy (available in the bundled Codex Python runtime).
Run fetch_imt_pdfs.mjs first. No fuzzy candidate is promoted to a text match.
"""

import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pdfplumber
import PIL
import pypdf
from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PARSER_VERSION = 1
IMAGE_LIMITS = {"mean": 6.0, "p95": 18.0, "tileMean": 16.0, "aspect": 0.02}
LIBRARIES = {"pdfplumber": pdfplumber.__version__, "pypdf": pypdf.__version__,
             "Pillow": PIL.__version__, "numpy": np.__version__}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def verification_input(question):
    return [question["id"], question["text"]["pt"],
            [[a["key"], a["pt"]] for a in question["answers"]],
            question.get("image", ""), question.get("sourceUrl", "")]


def normalize(value):
    # Only PDF layout/typographic differences. Preserve case, accents,
    # punctuation, numbers and legal wording for every accepted text match.
    value = unicodedata.normalize("NFKC", value).replace("\u00ad", "")
    value = value.translate(str.maketrans({"’": "'", "‘": "'", "‐": "-", "‑": "-"}))
    value = re.sub(r"(?<=\w)\s*-\s*(?=\w)", "-", value)
    return re.sub(r"\s+", " ", value).strip()


def signature(text, answers):
    return normalize(text), tuple(sorted(normalize(a) for a in answers))


def pixels(image):
    return np.asarray(image.convert("RGB").resize((128, 128), Image.Resampling.LANCZOS))


def difference_hash(array):
    gray = np.asarray(Image.fromarray(array).convert("L").resize((9, 8), Image.Resampling.LANCZOS))
    return sum(int(bit) << i for i, bit in enumerate((gray[:, 1:] > gray[:, :-1]).flat))


def image_metrics(left, right, left_aspect, right_aspect):
    diff = np.abs(left.astype(np.float32) - right.astype(np.float32))
    tiles = diff.reshape(8, 16, 8, 16, 3).mean(axis=(1, 3, 4))
    return {"mean": round(float(diff.mean()), 4),
            "p95": round(float(np.percentile(diff, 95)), 4),
            "tileMean": round(float(tiles.max()), 4),
            "aspect": round(abs(left_aspect / right_aspect - 1), 6)}


def image_matches(metrics):
    return all(metrics[key] <= limit for key, limit in IMAGE_LIMITS.items())


def parse_lines(lines):
    question, answers = [], []
    for line in lines:
        option = re.match(r"^([a-d])\)\s*(.*)$", line, re.I)
        if option:
            expected = chr(ord("a") + len(answers))
            if option[1].lower() != expected:
                raise ValueError(f"Unexpected option sequence: {lines}")
            answers.append({"key": option[1].upper(), "text": option[2]})
        elif answers:
            answers[-1]["text"] += " " + line
        else:
            question.append(line)
    if not question or not 2 <= len(answers) <= 4:
        raise ValueError(f"Incomplete PDF question: {lines}")
    return normalize(" ".join(question)), [{**a, "text": normalize(a["text"])} for a in answers]


def extract_sources(cache, manifest):
    extraction_path = cache / "extracted.json"
    image_path = cache / "images.npz"
    identity = [PARSER_VERSION, LIBRARIES, [[s["group"], s["sha256"]] for s in manifest["sources"]]]
    if extraction_path.exists() and image_path.exists():
        stored = json.loads(extraction_path.read_text())
        if stored.get("identity") == identity:
            with np.load(image_path) as archive:
                images = {key: archive[key] for key in archive.files}
            return stored["entries"], images, stored["groups"]
    entries, images, groups = [], {}, []
    for source in manifest["sources"]:
        path = cache / "pdfs" / source["file"]
        if digest(path.read_bytes()) != source["sha256"]:
            raise ValueError(f"PDF hash mismatch: {path}")
        reader = PdfReader(path)
        count = 0
        with pdfplumber.open(path) as pdf:
            for page_number, page in enumerate(pdf.pages, 1):
                rows = sorted([im for im in page.images
                               if im["x0"] < 190 and im["width"] > 70 and 60 <= im["top"] < 780],
                              key=lambda im: im["top"])
                lines = [line for line in page.extract_text_lines(return_chars=False)
                         if line["x0"] >= 190 and 60 <= line["top"] < 785]
                if not rows and lines:
                    raise ValueError(f"No question images: group {source['group']} page {page_number}")
                if len(rows) != sum(bool(re.match(r"^a\)", line["text"], re.I)) for line in lines):
                    raise ValueError(f"Question/option count mismatch: group {source['group']} page {page_number}")
                extracted_images = {im.name.rsplit(".", 1)[0]: im for im in reader.pages[page_number - 1].images}
                for row_number, row in enumerate(rows, 1):
                    bottom = rows[row_number]["top"] - 0.1 if row_number < len(rows) else 785
                    text_lines = [line["text"] for line in lines if row["top"] - 2 <= line["top"] < bottom]
                    text, answers = parse_lines(text_lines)
                    extracted = extracted_images[row["name"]]
                    array = pixels(extracted.image)
                    image_id = digest(array.tobytes())
                    images[image_id] = array
                    entry = {"id": f"imt-{source['group']}-{page_number}-{row_number}",
                             "group": source["group"], "page": page_number, "row": row_number,
                             "text": text, "answers": answers, "imageId": image_id,
                             "imageAspect": extracted.image.width / extracted.image.height}
                    entries.append(entry)
                    count += 1
                page.close()
        groups.append({**source, "pages": len(reader.pages), "entries": count})
        print(f"Parsed IMT group {source['group']}/14: {len(reader.pages)} pages, {count} questions.", flush=True)
    extraction_path.write_text(json.dumps({"identity": identity, "entries": entries, "groups": groups}, ensure_ascii=False))
    np.savez_compressed(image_path, **images)
    return entries, images, groups


def audit(cache, output, report_dir):
    manifest = json.loads((cache / "manifest.json").read_text())
    if sorted(s["group"] for s in manifest["sources"]) != list(range(1, 15)):
        raise ValueError("A complete 14-group source manifest is required")
    # Validate cached PDFs too; a cached extraction must never hide replaced sources.
    for source in manifest["sources"]:
        if digest((cache / "pdfs" / source["file"]).read_bytes()) != source["sha256"]:
            raise ValueError(f"Source hash mismatch: group {source['group']}")
    corpus = json.loads((ROOT / "public/data/questions-pt.json").read_text())["questions"]
    entries, images, groups = extract_sources(cache, manifest)
    entry_by_location = {(entry["group"], entry["page"], entry["row"]): entry for entry in entries}
    by_signature = defaultdict(list)
    by_image = defaultdict(list)
    for entry in entries:
        by_signature[signature(entry["text"], [a["text"] for a in entry["answers"]])].append(entry)
        by_image[entry["imageId"]].append(entry)
    hashes = {key: difference_hash(value) for key, value in images.items()}
    records, app_rows, pdf_apps = {}, [], defaultdict(list)
    for question in corpus:
        with Image.open(ROOT / "public/images/questions" / f"{question['sourceId']}.jpg") as image:
            array, aspect = pixels(image), image.width / image.height
        sig = signature(question["text"]["pt"], [a["pt"] for a in question["answers"]])
        candidates = by_signature.get(sig, [])
        checked = [(entry, image_metrics(array, images[entry["imageId"]], aspect, entry["imageAspect"])) for entry in candidates]
        accepted = [(entry, metrics) for entry, metrics in checked if image_matches(metrics)]
        matched_locations = []
        if accepted:
            status = "matched"
            for entry, metrics in sorted(accepted, key=lambda pair: pair[1]["mean"]):
                pdf_apps[entry["id"]].append(question["id"])
                answer_order = [normalize(a["pt"]) for a in question["answers"]] == [normalize(a["text"]) for a in entry["answers"]]
                matched_locations.append({"group": entry["group"], "page": entry["page"], "row": entry["row"],
                                          "answerOrderSame": answer_order, "image": metrics})
        elif candidates:
            status = "text-only"
            entry, metrics = min(checked, key=lambda pair: pair[1]["mean"])
            matched_locations.append({"group": entry["group"], "page": entry["page"], "row": entry["row"], "image": metrics})
        else:
            # Propose a review candidate only when the image comparison passes.
            # Different wording/options can NEVER acquire a matched badge.
            dhash = difference_hash(array)
            image_candidates = [key for key, value in hashes.items() if (dhash ^ value).bit_count() <= 8]
            similar_entries = []
            for key in image_candidates:
                for entry in by_image[key]:
                    metrics = image_metrics(array, images[key], aspect, entry["imageAspect"])
                    if image_matches(metrics):
                        similar_entries.append((entry, metrics))
            # The same photo often supports different questions: require a close
            # text candidate as well before describing this as a discrepancy.
            from difflib import SequenceMatcher
            scored = [(SequenceMatcher(None, normalize(question["text"]["pt"]), e["text"]).ratio(), e, m)
                      for e, m in similar_entries]
            scored.sort(key=lambda item: (-item[0], item[2]["mean"]))
            if scored and scored[0][0] >= 0.75:
                status = "differences"
                similarity, entry, metrics = scored[0]
                matched_locations.append({"group": entry["group"], "page": entry["page"], "row": entry["row"], "image": metrics,
                                          "textSame": normalize(question["text"]["pt"]) == entry["text"],
                                          "optionsSame": sig[1] == signature(entry["text"], [a["text"] for a in entry["answers"]])[1]})
            else:
                status = "not-found"
        records[question["id"]] = {"status": status, "locations": matched_locations,
                                   "imageSha256": digest((ROOT / "public/images/questions" / f"{question['sourceId']}.jpg").read_bytes())}
        app_rows.append({"appId": question["id"], "status": status, "text": question["text"]["pt"],
                         "answers": [{"key": a["key"], "text": a["pt"]} for a in question["answers"]],
                         "locations": matched_locations, "sourceUrl": question["sourceUrl"]})
    counts = Counter(record["status"] for record in records.values())
    pdf_matched = sum(bool(pdf_apps[entry["id"]]) for entry in entries)
    payload = {"schemaVersion": 1, "auditedAt": manifest["fetchedAt"], "indexUrl": manifest["indexUrl"],
               "indexSha256": manifest["indexSha256"],
               "corpusFingerprint": digest(json_bytes([verification_input(q) for q in corpus])),
               "method": {"parserVersion": PARSER_VERSION, "libraries": LIBRARIES, "text": "NFKC, whitespace, typographic apostrophes/hyphens and PDF hyphen spacing only; option order ignored",
                          "image": "Automated RGB comparison at 128x128; no claim of manual review", "imageLimits": IMAGE_LIMITS,
                          "answerKeyVerified": False, "translationsVerified": False},
               "summary": {"appQuestions": len(corpus), "matched": counts["matched"], "textOnly": counts["text-only"],
                           "differences": counts["differences"], "notFound": counts["not-found"],
                           "pdfEntries": len(entries), "pdfEntriesMatched": pdf_matched,
                           "pdfEntriesWithoutMatch": len(entries) - pdf_matched},
               "sources": groups, "questions": records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    report_dir.mkdir(parents=True, exist_ok=True)
    def options_text(answers):
        return " | ".join(f"{a['key']}: {a['text']}" for a in answers)

    with (report_dir / "imt-app-comparison.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["app_id", "status", "portuguese_question", "app_options", "pdf_locations", "pdf_question",
                         "pdf_options", "image_mean", "image_p95", "image_tile_mean", "answer_order_same", "study_source"])
        for row in app_rows:
            locs = "; ".join(f"group {loc['group']}, page {loc['page']}, row {loc['row']}" for loc in row["locations"])
            location = row["locations"][0] if row["locations"] else None
            candidate = entry_by_location[(location["group"], location["page"], location["row"])] if location else None
            metrics = location["image"] if location else {}
            writer.writerow([row["appId"], row["status"], row["text"], options_text(row["answers"]), locs,
                             candidate["text"] if candidate else "", options_text(candidate["answers"]) if candidate else "",
                             metrics.get("mean", ""), metrics.get("p95", ""), metrics.get("tileMean", ""),
                             location.get("answerOrderSame", "") if location else "", row["sourceUrl"]])
    with (report_dir / "imt-pdf-comparison.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["pdf_entry", "group", "page", "row", "portuguese_question", "pdf_options", "app_ids_with_full_match"])
        for entry in entries:
            writer.writerow([entry["id"], entry["group"], entry["page"], entry["row"], entry["text"], options_text(entry["answers"]), "; ".join(pdf_apps[entry["id"]])])
    # Full question/option extraction is local evidence, not a second served corpus.
    (cache / "comparison-details.json").write_text(json.dumps({"app": app_rows, "pdf": entries}, ensure_ascii=False))
    table = "\n".join(f"| {s['group']} | {s['pages']} | {s['entries']} | {sum(bool(pdf_apps[e['id']]) for e in entries if e['group'] == s['group'])} | [PDF]({s['url']}) |" for s in groups)
    report = f"""# IMT question-bank comparison

Source snapshot fetched **{manifest['fetchedAt']}** from the [official IMT driver-question index]({manifest['indexUrl']}).

| App Category B questions | Count |
| --- | ---: |
| Portuguese question/options and image matched automatically | {counts['matched']} |
| Portuguese question/options matched; image not confirmed | {counts['text-only']} |
| Similar image/text candidate; wording or options differ | {counts['differences']} |
| No accepted match found | {counts['not-found']} |
| Total | {len(corpus)} |

The PDFs contain **{len(entries)} entries**. **{pdf_matched}** have a full app match and **{len(entries) - pdf_matched}** do not. The driver PDFs include questions beyond Category B. An unmatched PDF entry is **not automatically a missing Category B question**; category applicability and extraction/wording differences require review.

## Meaning of verification

This is an automated comparison of the preserved **Portuguese question, all Portuguese choices, and the road image**. Choice order is ignored because the PDFs and study site may reorder answers. Text normalization only removes PDF wrapping, soft hyphens and typographic apostrophe/hyphen differences. It does not remove accents, punctuation, negatives or numbers. Fuzzy suggestions are reported as differences, never verified matches.

Images are resized to 128×128 RGB and compared using average pixel difference ≤6, 95th-percentile difference ≤18, maximum 16×16 tile average difference ≤16, and aspect-ratio difference ≤2%. This accommodates resizing/JPEG compression; it is **not a manual review or proof of pixel identity**. Borderline/unconfirmed images remain separate from full matches.

This comparison **does not verify the correct-answer key, English/Russian translations, current legal correctness, complete Category B coverage, or the exact questions in a future examination**. Existing question-specific reviewed explanations remain a separate form of review.

## Sources

| Group | Pages | Entries | Entries with full app match | Source |
| --- | ---: | ---: | ---: | --- |
{table}

PDF byte hashes, the index hash, image metrics, page/row references and the corpus fingerprint are recorded in [the verification manifest](../../public/data/imt-verification.json). The app rejects metadata for a different Portuguese corpus. Cached PDFs and extracted comparison details are under `tmp/imt-audit/` and are not published.

## Review files

- [All app questions, status and candidate PDF locations](../data/imt-app-comparison.csv)
- [All PDF entries and matching app IDs](../data/imt-pdf-comparison.csv)

Do not infer answer-letter equivalence across sources; compare answer text. Do not change corpus IDs, Portuguese wording, option order or the study key based on a fuzzy suggestion.
"""
    (ROOT / "documentation/md/IMT-AUDIT.md").write_text(report)
    print(json.dumps(payload["summary"], indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / "tmp/imt-audit")
    parser.add_argument("--output", type=Path, default=ROOT / "public/data/imt-verification.json")
    parser.add_argument("--report-dir", type=Path, default=ROOT / "documentation/data")
    args = parser.parse_args()
    audit(args.cache, args.output, args.report_dir)
