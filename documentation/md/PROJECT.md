# RoadReady Portugal — project reference

Source analysis and automated verification: **2 October 2026**, based on commit `4c2708e`. Counts below describe this snapshot; code and current check output take precedence after changes. Start with the root [agent guide](../../AGENTS.md) for commands and the file map, or [README](../../README.md) for user setup.

## Shape of the application

The project has no framework, bundler or npm dependencies. `index.html` supplies the navigation, settings dialog and empty main region. `app.js` imports the browser modules and builds views with template strings and `innerHTML`. Rendering replaces view elements and binds their event handlers again. CSS variables define the theme; responsive breakpoints are 980, 720 and 390 px.

The routes are `#dashboard`, `#practice`, `#quiz`, `#progress` and `#sources`. Settings is a dialog over the current route. A bare `#quiz` without an in-memory session returns to Dashboard.

Startup in `app.js`:

1. Load/generate the browser device ID and validate the saved local profile; salvage valid records if damaged.
2. Apply UI translations and fetch `questions-en.json`. If loading fails, try the Portuguese corpus, then six built-in sample questions. A saved Russian preference also loads the Russian overlay.
3. Render the selected view and install interface-language handlers.
4. Create the sync controller, consume any private-link fragment and initialize cloud sync asynchronously.

The corpus, profile and active quiz are module-level state. Pure quiz transitions live in `quiz-session.js`; `app.js` owns DOM rendering, persistence, scoring side effects and the timer. Russian overlay fields are added to the question objects, which active sessions also reference.

“Local-first” means progress persists without cloud connectivity. There is no service worker or app manifest; a complete offline reload/install experience is not implemented.

## Quiz and study behavior

| Mode | Maximum | Selection | Progress recorded |
| --- | --- | --- | --- |
| `quick` | 10 | Shuffled unseen questions first, then seen ones | When each answer is checked |
| `review` | 20 | Seen questions whose `nextReview` is absent or due | When each answer is checked |
| `mistakes` | 20 | Questions with more wrong than correct attempts | When each answer is checked |
| `exam` | 30 | Shuffled corpus | At submission, including unanswered items as wrong |

Limits shrink with availability. Empty review/mistakes modes show a toast without starting another kind of session. `sessionSize()` also supplies the UI counts and time estimates.

`picks` holds draft choices; `answers` holds checked practice answers or editable mock choices. Navigating restores the appropriate selection and feedback. `firstUnansweredIndex()` uses `answers`, so an unchecked practice draft still needs attention. Checked practice answers lock; mock choices can change until submission.

The mock is configured for 30 minutes and a pass at at most three errors. The timer derives remaining time from `endsAt`; clearing/restarting its interval on a render must not reset that deadline. Expiry submits automatically. Practice uses an 80% threshold for the positive result headline. These describe app scoring, not independently verified exam requirements.

`recordQuestion()` updates answer counters, per-question streak, review date and daily activity, then saves locally. Correct-answer intervals are 1, 3, 7, 14 and 30 days, capped at 30; a wrong answer resets the question streak and is due immediately. Finishing adds a session summary with `activityRecorded: true` and retains the latest 100 summaries. Practice answers are not counted again at completion.

Completed quizzes retain `session.result`; route, language and sync renders keep showing results until the user leaves or starts again. Missed-question review includes the image, source ID, selected/unanswered label, study-key answer and feedback. Completion focuses the result heading and scrolls to the top, unless Settings is open. Later renders do not repeat that completion action.

At phone widths (720 px or less), the question text appears above the full road image, and Previous/Next, the answered count and the collapsible question grid follow the answers and primary action. The timer/counter stays sticky. Crossing the breakpoint moves the existing DOM nodes so keyboard order follows the layout without rerendering or changing session state; desktop keeps navigation above the card and the question beside the image.

Leaving an unfinished quiz requires confirmation, including browser Back. Cancel restores `#quiz` with the same session. Reload/close requests the browser's leave warning. Confirmed departure discards the in-memory session; saved checked practice progress remains.

Dashboard readiness is a UI heuristic: 35% corpus coverage, 35% answer accuracy and 30% mean percentage of the last five mock summaries, clamped to 0–100 with a minimum of 8 once a question has been seen. It is not an official assessment. Progress displays all 16 mapped topics; default ordering uses unrounded coverage ascending, then accuracy, then localized name. The alternative sorts coverage descending.

## Stored profile and backups

| `localStorage` key | Meaning |
| --- | --- |
| `roadready-profile` | Preferences, question progress, completed summaries and activity |
| `roadready-profile-recovery` | Original damaged profile retained during startup recovery, when storage permits |
| `roadready-device-id` | Browser UUID identifying its answer/activity counters |
| `roadready-sync-key` | Private 43-character key identifying the shared cloud profile |
| `roadready-last-sync` | Last successful sync timestamp |

The browser device ID and private sync key serve different purposes: linked devices share the sync key but have separate counter IDs.

Profile fields are `startedAt`, `updatedAt`, optional `resetAt`, `dailyGoal`, `uiLanguage`, `language`, `questionProgress`, `sessions`, `answerActivity` and stored `streak`. Each question record contains totals, legacy `baseCorrect`/`baseWrong`, `countsByDevice`, its correct-answer streak, `lastAnswer` and `nextReview`. Session records contain ID, mode, correct/total/percent, completion time, duration and the activity marker. Active questions and draft answers are not saved.

Activity is shaped as `answerActivity[local YYYY-MM-DD][deviceId] = count`. Merge uses the maximum counter for each device/day, then the UI sums devices. Older summaries without `activityRecorded` contribute their completed-session totals for compatibility. The visible streak is recomputed across consecutive local dates, allowing yesterday's streak while today is still pending; calendar stepping handles daylight-saving changes.

Exports use the version-2 envelope `{ app, version, exportedAt, profile, syncKey }`. They include the private key. Imports accept that envelope or a raw legacy profile, with a 2 MiB file limit. `profile-data.js` validates nested records, dates, counts, languages and unsafe object keys, clones the candidate, recomputes percentages and keeps at most 100 summaries.

Import order matters: parse/validate → validate optional key → load required Russian content → write candidate to `localStorage` → replace active profile → render/sync. A cloud failure after local commit leaves the restored profile available. Startup uses a more forgiving recovery path that salvages valid records rather than rejecting the whole profile.

## Cloud merge and database contract

`sync.js` uses direct POST requests to Supabase's `roadready_read_progress` and `roadready_write_progress` RPCs. There is no Supabase SDK or Auth flow. A random 256-bit key is generated automatically. Linking uses `#sync=<key>`; the controller immediately removes that fragment and switches to Dashboard. Request URLs omit the private key; it is supplied in the JSON body.

Synchronization reads the cloud revision, merges against the latest local profile and writes with `p_expected_revision`. A conflict returns the current row for another merge; one run attempts up to five writes. Local changes debounce for 1.2 seconds. Reconnect and return-to-visible trigger sync; retryable failures back off up to 60 seconds. Generation checks prevent results for a previous key from applying after a link change. Local state is read again after requests so answers made during a fetch survive.

The merge rules are the important part of this design:

- Per-question counters use maxima for each device, then sum devices plus the preserved legacy base counts. Records containing only legacy totals use maxima. Repeated sync must be idempotent.
- The latest `lastAnswer` determines question scheduling/streak fields. Profile preferences use `updatedAt`; ties prefer local values.
- Session summaries are unioned by ID, with a legacy tuple fallback, sorted by completion and capped at 100. An existing activity marker must survive a merge.
- Daily activity merges by device/day maxima. The UI derives its streak from the merged activity rather than using the merged stored streak directly.
- A newer `resetAt` discards the older history generation before merging. Reset preserves language preferences and the private key, and propagates to linked devices when sync succeeds.

The active SQL is [supabase/personal-sync.sql](../../supabase/personal-sync.sql). It stores a SHA-256 hash of the key in `private.roadready_device_profiles`, with JSON profile, revision and update timestamp. RLS is enabled and direct table privileges are revoked from browser roles. Public invoker wrappers call private functions with a restricted search path. Payloads must have profile/progress/session containers and fit 2 MiB/100 sessions; browser validation is stricter about nested records.

`supabase-config.js` contains only the public URL and publishable key. `supabase/schema.sql` describes the old email-auth table and is retained for recovery/reference; the current app does not use it. This is a lightweight personal-profile design without public-service abuse prevention.

## Corpus and translation maintenance

The snapshot contains **3,910 questions across 16 topics**, **18,931 Russian fields** and **305 UI translation keys**. The three tracked JSON files total about 9.1 MB; inspect specific records with a parsing script instead of dumping the files.

| File | Contract |
| --- | --- |
| `questions-pt.json` | Preserved scrape: IDs (`bc-<sourceId>`), category/topic, Portuguese text/options, study key and source/image URLs |
| `questions-en.json` | Runtime base: preserves PT and adds EN text/options, feedback and review metadata |
| `questions-ru.json` | Compact object keyed by question ID, containing RU text, keyed answers and feedback; metadata binds it to the exact EN file bytes |

All paths above are under `public/data/`. The runtime attaches Russian fields by ID/answer key when needed. It checks overlay count/IDs; the offline data check verifies completeness, answer keys and the SHA-256 source hash. UI translations are separate dictionaries in `i18n.js`, with English fallback, placeholder interpolation and Russian plural helpers.

The study key comes from Bom Condutor. The app separately links 14 IMT PDF groups; it does not treat those links as an official solution key. **Only `bc-1165` has a reviewed detailed explanation in this snapshot.** All other feedback explicitly says detailed reasoning has not been reviewed. `scripts/reviewed-content.mjs` matches corrections against preserved Portuguese phrases; reviewed reasoning additionally matches the exact question/options/key and carries a source URL.

### IMT PDF comparison

`scripts/fetch_imt_pdfs.mjs` reads the live official index, requires all 14 numbered driver groups, and saves their PDF bytes, index snapshot, source URLs and SHA-256 hashes under ignored `tmp/imt-audit/`. `scripts/audit_imt_pdfs.py` extracts each illustrated question row and checks that image-row counts agree with the number of first answer options. It compares the preserved PT question and every PT option, allowing only documented layout/typographic normalization and ignoring option order. Automated image matching uses conservative RGB/region thresholds. Fuzzy/image-only candidates never receive a full-match label. The PDFs contain questions beyond Category B; unpaired entries require applicability review rather than automatic addition to the corpus.

The generated [audit report](IMT-AUDIT.md) and two CSV files under `documentation/data/` give both directions of comparison. `public/data/imt-verification.json` records status and PDF group/page/row per app ID, source hashes, image metrics/hashes and a corpus fingerprint. This is source comparison, **not official-answer or translation verification**. The Python maintenance command requires `pdfplumber`, `pypdf`, Pillow and NumPy; the bundled workspace Python supplies them. It does not add npm/browser dependencies or rewrite the PT/EN/RU corpora.

`question-verification.js` validates the manifest and SHA-256 of `JSON.stringify(questions.map(verificationInput))`: ID, Portuguese text, keyed/ordered Portuguese choices, image URL and study-source URL. It retains the input for each question so a later in-memory mutation also removes the label. Translation or study-key changes are outside this proof's scope. Startup loads and validates the audit after the corpus/optional RU overlay; an unavailable, malformed or stale proof does not prevent studying. The module is explicitly packaged by the build.

Quiz questions and Sources show separate full/text-only/difference/unconfirmed results with PDF page links and the checked date. Only checked practice feedback and completed results show the separate answer-reasoning review status. Active mocks do not reveal that status, the reviewed explanation or rule link. Sources provides the two CSV downloads; the build copies those files explicitly. The old fixed IMT-page update-date claim has been replaced by the audit's actual snapshot date.

`rtk npm run check:verification` checks both PT/EN fingerprints, all 3,910 local image hashes, source/location integrity, stale proof rejection, summary totals and the independent answer/translation scope. The build runs its asset validation after image preparation, so changed images cannot ship with stale proof. To refresh: `rtk npm run audit:imt:fetch`, then `rtk npm run audit:imt` (or the bundled Python executable with `scripts/audit_imt_pdfs.py`), then the verification/content/data checks. Advance the audit fetch version in `app.js` when publishing a new snapshot. Cached PDF/extraction evidence is not packaged.

For reviewed translation/explanation changes, edit the reviewed-content logic and run:

```sh
rtk npm run explain
rtk npm run check
rtk npm run check:content
```

`explain` validates the existing RU overlay's source hash and answer identities before updating EN/PT feedback, reviewed EN/RU wording and RU feedback together. It then updates the hash to the newly written EN content. It requires an existing matching overlay; it is not the initial corpus-generation command.

For an intentional full corpus refresh, the dependency order is:

```sh
rtk npm run scrape                 # Bom Condutor -> Portuguese corpus
rtk npm run translate              # Google machine translation -> EN/PT base + feedback
rtk npm run translate:ru -- --force # rebuild RU when the EN source hash changed
rtk npm run check
rtk npm run check:content
```

These commands rewrite tracked files and use external services. Russian translation uses Microsoft Translator, deduplicates source strings, retries/splits failing batches and checkpoints through a temporary file/rename. An unchanged source supports resuming with `rtk npm run translate:ru`; `--force` discards the existing overlay and starts again. `rtk npm run translate:ru -- --validate-only` validates without writing or requesting translations. Review Portuguese preservation, answer keys and wording diffs before accepting regenerated data. A changed EN file, even formatting alone, invalidates the existing source hash.

## Images, capture and deployment

`getQuestionImagePath()` maps numeric source IDs to `public/images/questions/<id>.jpg`. The image preparation script downloads missing JPEGs, validates downloaded size/signature, writes atomically and reuses cached files. Quiz/results prefer these local images and offer remote source links/fallbacks. PNG capture uses the local image so the canvas can be exported without cross-origin taint; it preserves aspect ratio and wraps the entire question/options. UI remote fallback does not guarantee capture will work when a local image is missing.

ChatGPT actions prepare a PNG, copy it and optionally open ChatGPT for manual paste. The separate prompt includes the selected language, question/options, source URL and explanation request. Neither output exposes the study key, feedback or profile. Paste the image before copying the text, which replaces clipboard contents. Actual clipboard/popup permissions and Safari user activation need browser testing.

`scripts/build.mjs` prepares all question images, removes/recreates `dist/`, copies its explicit browser-file list and copies data/images. New runtime modules must be added to that list. IMT PDFs are remote links; local PDF caches are not packaged. Manual `?v=` query versions in HTML, module imports and data fetches are the cache-refresh mechanism.

The Pages workflow runs on pushes to `main` and manual dispatch, runs every existing check command, caches images by Portuguese-corpus hash, builds and deploys `dist/`. Pushing to `main` can publish the app automatically. Preserve relative paths for repository-subpath hosting.

## Verification baseline and limits

All seven commands in the root guide passed during this analysis: data, content, sync, capture, quiz/results, study flows and backup. Build also passed, using all 3,910 cached images with **zero downloads**.

Checks use Node's built-in assertions. Backup, quiz-results and study-flow checks execute real `app.js` handlers in VM contexts with DOM/storage fakes; they strip imports and omit startup at its skeleton-render marker. If reorganizing startup or adding required DOM methods, update those harnesses. Sync tests use an in-memory server, and capture tests use a fake canvas.

Passing checks do not establish live Supabase setup/RLS behavior, actual browser downloads/clipboard/popups, physical-device compatibility or correctness of every translated road-rule answer. No new browser or live-cloud test was performed for this documentation task. The local `qa-manual-2026-10-02/` directory contains historical browser evidence and follow-up fixes, but was untracked at analysis time and may not exist in another checkout; consult the latest fix notes before treating an old finding as open.
