# RoadReady Portugal

English- and Russian-language study app for the Portuguese IMT Category B theory exam, with the Portuguese source wording available for every question.

## Prepare for an exam in 20 days

The dashboard starts with an **English preparation target of 27 October 2026**, twenty days after 7 October. This is a tentative study date, not a booking. Change the date and mock language under **Your profile → Your exam target**; the saved target syncs to linked devices and is included in backups.

Start with the recommended diagnostic mock, then finish the dashboard's daily targets. The plan reserves the final four days for rehearsal and a lighter last day. A fresh 3,910-question profile needs about **245 new questions per day for the first 16 days**, plus recall, mistake repair and one daily mock. Expect several hours, depending on your mistakes and reading speed; the displayed remaining-time estimate is approximate. Missed days increase the remaining daily pace. During rehearsal, take two mocks a day and review every error.

**New questions** uses sets of up to 20, rotating through the least-covered topics. **Repair latest mistakes** includes a question whose latest answer was wrong even when its lifetime accuracy is high; one correct answer removes it from that queue. Due review retains its strict due-only selection, with difficult and overdue questions first. Topic links start targeted practice. Checked answers from unfinished sets still count, and submitted mocks contribute to new-question and recall totals.

Preparation is shown as four explicit study goals: encounter the whole bank; attempt at least 20 questions in each topic (all questions in smaller topics) with at least 90% correct latest answers; correct every latest mistake; and achieve **five full timed mocks at 28/30 or better within the last seven local calendar days, spanning at least three days**. These are preparation goals, not a guarantee of passing. Mocks need a recorded matching language, unchanged during the test, and a duration no longer than 30 minutes. Older mocks without language metadata remain in your history but do not establish language-specific readiness. Sample questions cannot satisfy these goals.

The [IMT Category B format](https://imt.madeira.gov.pt/index.php/pt/transportes-terrestres/condutores/provas-teoricas) is **30 questions in 30 minutes, passing at 27 correct**; 28/30 is the app's preparation margin. Confirm your actual date, centre, time, English exam or interpreter arrangements and required documents with your driving school.

## Remember Portugal's speed limits

Open **Speed limits** in navigation or the memory-map link on Practice. The English/Russian page starts with **50 → 90 → 100 → 120 km/h** for a light passenger or mixed vehicle without a trailer: town, other roads outside town, roads reserved for cars/motorcycles, motorway. Switch to a light goods vehicle or add a trailer to learn the corresponding row; signed shared zones have a general maximum of **20 km/h**.

Hide the four limits to recall them, then try the 12 custom questions with rule explanations and official links. These exercises do not change exam progress. **Practice the Speed topic** starts a regular study-bank set, and **Print memory sheet** prints all four light-vehicle rows. The page also explains maximum/minimum/recommended signs, posted restrictions, the motorway minimum and adjusting speed to conditions. [Research notes and official sources](documentation/md/SPEED-LIMITS.md) record the scope and source-check date.

## Run locally

```bash
npm run images
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Use a local HTTP server or the deployed site, not a `file://` URL. The first image preparation downloads the public question pictures; subsequent runs reuse the local cache.

## Move between questions

All question modes (quick practice, review, mistakes and mock exam) support **Previous question**, **Next question**, and numbered shortcuts. You can skip a question and return to it later; selected answers stay in the current session. Checked practice answers keep their feedback and count toward progress only once. Mock exam answers can be changed until submission, and navigation does not reset the timer. At the end, **Return to unanswered** takes you to skipped questions before submitting. Use the left/right arrow keys to navigate, number keys 1–4 to select an answer, and Enter to check or continue.

Leaving an unfinished set through navigation, browser Back, or the exit button asks before discarding it. Cancel keeps the question order, checked feedback, drafts and mock deadline. Reloading or closing an active session requests the browser's leave warning; confirming a leave discards the session. Sessions are not resumed after reload.

**Due review** selects only questions whose review date has arrived. If none are due, it shows the existing empty-state message and keeps you on the current page.

Quick practice uses up to 10 questions, due review and Mistake clinic up to 20, and a mock up to 30. Dashboard counts and time estimates use the same limits as question selection. Mistake clinic includes only questions with more wrong than correct answers and shows an empty state when none qualify.

On phones, the question grid expands on demand, the timer and question counter stay visible while scrolling, and navigating brings the next question back into view. Results review includes the road image, source question ID, your selected answer (or an unanswered label), and the study-key answer. Sources is available from mobile navigation.

Settings supports keyboard focus within the dialog, Escape to close, and focus restoration to the opening control. Language and profile updates keep focus inside the open dialog.

## Copy a question into ChatGPT

During a quiz, press **Ask ChatGPT** to copy the screenshot and open ChatGPT in a new tab, then paste it into the composer. Return to the quiz, press **Copy prompt**, and paste the explanation request into the same composer. Paste the image before copying the prompt, because copying text replaces the image on the clipboard. If the browser blocks the new tab, use the **Open ChatGPT** link shown below the button. Neither text nor image is inserted or sent automatically. **Copy image for ChatGPT** remains available if you want to paste into an existing chat instead.

The prompt includes the question and options in the selected question language and asks for the relevant rule and an explanation of each option. It never includes the app's answer key or your personal study data. If text clipboard access is denied, the app shows selectable text for manual copying. Query-string prompt links are not used, because they can submit the text before an image is attached.

Both buttons copy one PNG containing the full road image, the current question wording, and all answer options in the selected question language. Correct-answer highlights, explanations, progress, and the private device link are not included.

Image clipboard access needs a supported browser and HTTPS (or localhost). If it is unavailable or denied, **Download question image** lets you save the same PNG and attach it manually. Question images are bundled with the static deployment to avoid cross-origin canvas restrictions; no screenshot proxy or ChatGPT API account is used.

## Data pipeline

- `npm run scrape` builds the Category B corpus from public Bom Condutor study pages and preserves their source URLs and non-official study answer key.
- `npm run translate` adds an English machine translation while preserving every Portuguese source string.
- `npm run explain` refreshes reviewed translation corrections and EN/PT/RU feedback without a translation service. The existing Russian overlay must match the English source hash before refreshing.
- `npm run translate:ru` builds the compact Russian overlay. It resumes interrupted runs, validates the source hash and answer keys, and applies reviewed road-terminology corrections.
- `npm run check` validates all 3,910 IDs, the English/Portuguese corpus, 18,931 Russian fields, answer keys, and every interface translation key.
- `npm run check:content` verifies the reviewed corrections, explanation coverage, and preservation of the Portuguese wording and answer keys.

Reviewed corrections are matched against the preserved Portuguese wording in `scripts/reviewed-content.mjs`. Detailed explanations appear only for questions with reviewed reasoning and a linked source. Other questions show the study-key answer and explicitly state that a detailed explanation has not yet been reviewed. Broad topic text is no longer presented as a question explanation; the whole corpus has not been manually reviewed.

The Russian overlay is loaded only when Russian is selected, which keeps the initial mobile download smaller. The app language and the question language are stored separately: the full interface supports English and Russian, while each question can be viewed in English, Russian, or the Portuguese original.

The app links separately to the 14 driver PDF groups published by IMT and clearly distinguishes those documents from the Bom Condutor study corpus and its non-official answer key. IMT does not publish the official solutions.

### Compare with the IMT PDFs

The Sources page shows the comparison of every app question with all 14 driver PDF groups and offers CSV reports. Questions link to the relevant PDF page and show one of four results: Portuguese wording/choices and image matched automatically; wording/choices matched but image unconfirmed; a candidate with differences; or no confirmed match. Expand the label for the scope and source-check date. An image match is an automated comparison, not a manual review.

The PDFs include driver questions beyond Category B, so an unmatched PDF entry is not automatically a missing Category B question. Matching the Portuguese question does not certify its answer key, English/Russian translations or inclusion in a future exam. **Answer reasoning reviewed** is a separate label shown after checking an answer or reviewing results, with the existing rule-source link.

See the [audit report](documentation/md/IMT-AUDIT.md) for counts, sources and comparison limits. To refresh the snapshot:

```sh
rtk npm run audit:imt:fetch       # downloads the live IMT index and 14 PDFs into tmp/imt-audit/
rtk npm run audit:imt            # regenerates verification metadata and CSV/report files
rtk npm run check:verification   # validates the corpus, sources and all cached image hashes
```

The audit command needs a Python interpreter with `pdfplumber`, `pypdf`, Pillow and NumPy. In Codex, use the bundled Python runtime returned by `load_workspace_dependencies`; invoke that interpreter directly with `scripts/audit_imt_pdfs.py` if the system `python3` lacks these packages. Routine app use and packaging still have no npm dependencies.

Verification is stored separately from the translated corpora, so the audit does not modify question IDs, wording, answer order, answer keys or the Russian overlay. Changed Portuguese questions invalidate the old proof in the browser; missing/stale metadata leaves studying available with an unavailable label. Packaging also rejects image files changed since the audit. Refresh served version references when publishing a new audit snapshot.

## Progress storage and cross-device sync

The app is local-first: answer history, spaced-repetition dates, mock results, language preference and study statistics are saved to `localStorage` immediately and remain available offline.

Daily goals and the seven-day activity chart count practice answers when checked, including unfinished or abandoned sets. Draft answers do not count. Mock questions count on submission, and completing a practice set does not count its answers again. New activity is dated using the device's local calendar day and merges per-device counters without duplicates; older completed-session totals remain available.

The study streak counts consecutive active local dates through today, or through yesterday while today's study is still pending. A fresh profile starts at zero and a missed full day breaks the streak. Progress shows all 16 syllabus topics, ordered by lowest coverage and then lowest answer accuracy; a selector also offers most-covered-first ordering. `npm run check:study` verifies activity, streaks, session limits, topic ranking and the leave/review/mistakes behavior.

There is no sign-in or account. A random private device key is generated automatically and saved in this browser. Supabase stores a hash of that key and the study profile, not an email address or a password. Only possession of the private key allows reading or updating that profile.

To connect your phone and Mac, open **Your profile → Link another device**, copy/share the private link, and open it once on the other device. The key is imported and immediately removed from the address bar. From then on both devices sync automatically on changes, reconnect, and return to the app. Keep this link private.

Concurrent updates use revision checks; answer counters are tracked per device so offline answers can be combined without double-counting. Resetting progress creates a new history generation so older devices cannot restore erased results. Use **Export backup** for recovery; the backup includes the private key and must also be kept private.

Imports validate nested records and preferences before replacing saved progress. An invalid backup, failed language download, or storage quota failure leaves the previous profile intact. Backups are limited to 2 MiB. If older stored data is damaged, startup retains valid records and saves the original under `roadready-profile-recovery` when storage permits. `npm run check:backup` covers rejection, successful restore, and startup recovery.

### One-time Supabase setup

1. Run [`supabase/personal-sync.sql`](supabase/personal-sync.sql) in the Supabase SQL Editor.
2. Keep the browser-safe project URL and publishable key in `supabase-config.js`. Never put a device key, database password, or service-role/secret key in the repository.
3. Deploy the app and open it on the device holding your existing progress. Link your second device using the private link.

No Authentication provider or redirect configuration is needed. The storage table is in the non-exposed `private` schema, has RLS enabled, and denies direct access to browser roles. The only exposed operations are key-scoped read/write functions. They cannot list profiles. Profile payloads are limited to 2 MiB and 100 sessions. The public publishable key is not the private device key.

If a database password has ever been shared in chat or committed to a repository, rotate it yourself in the Supabase dashboard. This app does not need or use that password.

This intentionally lightweight personal-app design allows visitors to create their own isolated random-key profile; it is not a public multi-user service with abuse prevention. Never weaken the table permissions to allow anonymous listing or unrestricted writes.

The previous `public.roadready_profiles` table is left untouched for recovery. Existing browser progress migrates automatically; cloud-only legacy progress can be recovered through an old backup or the Supabase dashboard. `supabase/schema.sql` is retained only as the legacy auth schema.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Run **Deploy RoadReady to GitHub Pages** from the Actions tab, or push another commit to `main`.
4. Open the deployment URL shown by the workflow on your phone and add it to the home screen if desired.

The included workflow validates all question data before publishing. All app paths are relative, so deployment under `username.github.io/repository-name/` works without configuration changes.
