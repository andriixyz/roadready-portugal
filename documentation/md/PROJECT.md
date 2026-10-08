# RoadReady Portugal — project reference

Source analysis and automated verification: **2 October 2026**, based on commit `4c2708e`. Counts below describe this snapshot; code and current check output take precedence after changes. Start with the root [agent guide](../../AGENTS.md) for commands and the file map, or [README](../../README.md) for user setup.

## Shape of the application

The project has no framework, bundler or npm dependencies. `index.html` supplies the navigation, settings dialog and empty main region. `app.js` imports the browser modules and builds views with template strings and `innerHTML`. Rendering replaces view elements and binds their event handlers again. CSS variables define the theme; responsive breakpoints are 980, 720 and 390 px.

The routes are `#dashboard`, `#practice`, `#saved-questions`, `#quiz`, `#progress`, `#speed-limits` and `#sources`. Settings is a dialog over the current route. A bare `#quiz` without an in-memory session returns to Dashboard.

The speed atlas lives in `speed-limits.js`, with EN/RU strings in `i18n.js` and scoped CSS in `styles.css`. It renders six chapters: the article 27 rows for ten vehicle classes (trailer/sidecar variants, barred roads, a motorway ladder and the full table), fifteen sign cards, the article 25 moderation list with a yes/no lightning round, floors and ceilings (slow driving, motorway minimum and access, article 145–146 severity bands, article 28/64 exceptions), an illustrative stopping-distance model and 26 author-created recall questions in three decks. Module-local state (vehicle, trailer, hidden values, open sign cards, open table, slider, surface, deck and drill) survives UI-language and sync renders but resets on reload; drill answers never enter the saved profile or study evidence. Chapter buttons scroll and focus section headings without changing the route hash. The Speed-topic button starts a normal `Velocidade` practice set. Printing uses a dedicated full table plus key rules regardless of the selected/hidden map. `speed-limits.js` exports `SPEED_ATLAS`, which `scripts/check_data.mjs` uses to verify every derived EN/RU key, drill answer and table value. [SPEED-LIMITS.md](SPEED-LIMITS.md) records the primary sources checked on 8 October 2026 and the maintenance/QA scope.

Settings offers System, Light and Dark appearance in both UI languages. The default follows `prefers-color-scheme` and responds to device appearance changes. The small classic `theme.js` script runs in the document head before CSS to apply the saved theme on the first paint; choosing an appearance only updates CSS and never rerenders the active quiz. It also updates the browser theme color and keeps other open tabs in step. Theme colors cover all routes, answer feedback, results, verification labels and settings; question images and captured PNGs retain their original colors.

Appearance is a per-browser preference stored separately from study data. It is not synced, exported, imported or erased by progress reset. If storage is unavailable, theme selection remains usable for the current page.

Startup in `app.js`:

1. Load/generate the browser device ID and validate the saved local profile; salvage valid records if damaged.
2. Apply UI translations and fetch `questions-en.json`. If loading fails, try the Portuguese corpus, then six built-in sample questions. A saved Russian preference also loads the Russian overlay. Overlay failure retains the available base bank and saved preferences/progress, with an EN/RU notice on study pages. New sets requesting unavailable Russian use the available English or Portuguese wording; explicit mid-session Russian switches still fail without changing the checked question. Selecting Russian again retries the overlay and clears the notice after success.
3. Render the selected view and install interface-language handlers.
4. Create the sync controller, consume any private-link fragment and initialize cloud sync asynchronously.

The corpus, profile and active quiz are module-level state. Pure quiz transitions live in `quiz-session.js`; `app.js` owns DOM rendering, persistence, scoring side effects and the timer. Russian overlay fields are added to the question objects, which active sessions also reference.

“Local-first” means progress persists without cloud connectivity. There is no service worker or app manifest; a complete offline reload/install experience is not implemented.

## Quiz and study behavior

### Exam preparation (7 October 2026)

`exam-plan.js` derives calendar deadlines, adaptive daily targets, topic coverage/latest-answer accuracy, unresolved latest mistakes and language-specific practice-mock evidence. The initial personal target is **27 October 2026, English**, with a start date of 7 October. `profile.examPlan` overrides it; a missing legacy preference adopts the target on the next answer/save. Dates never roll forward after expiry. Settings saves a validated future date atomically before replacing memory; changing the target does not change an active session or elapsed time. The plan is synced/exported/imported and retained during progress reset.

For the 20-day plan, cover unseen questions in 16 days, reserve three days for two mocks daily and one lighter last day. Daily new-question quota is `ceil((unseen + newToday) / max(1, daysLeft - finalDays))`, so it remains stable during the day and catches up after missed days. Shorter plans reserve a proportional one-to-four-day final phase. Recall counts are today's checked/submitted answers minus today's first encounters; mocks contribute to both counts. Recall targets cap the current due/answered workload at the greater of 40 or 40% of the new-question quota, with a 20-question cap on the final day. The time estimate uses 0.7 minutes per new/repair question, 0.5 per recall and 30 per remaining mock; it is an estimate, not a time budget or eligibility rule.

A past target has an `expired` phase: the dashboard and roadmap ask for a new future date, and all scheduled daily targets/time estimates are zero. Preparation evidence, mistakes and progress remain available, as does extra practice. Today's target retains Exam day; tomorrow retains Final review. Comparisons use the device's local calendar date, including daylight-saving changes.

`learn` selects at most 20 unseen questions, rotating through least-covered topics; it never falls back to seen questions. `repair` selects at most 20 questions whose latest answer was wrong, using the question streak (a conservative count comparison for legacy records without a streak). Correct answers remove them from repair. The original `mistakes` mode keeps its `wrong > correct` contract. Due review remains due-only and prioritises low streak, then older due dates. Topic buttons start targeted ten-question practice. Plan modes and topic practice use the configured plan language; ordinary quick practice and the original mistake clinic retain the current question language.

Four preparation goals replace the weighted readiness percentage: complete bank coverage; all topics with at least 20 encounters (or every question in smaller topics) and 90% latest-answer accuracy; no unresolved latest mistakes; and the last five full 30-question mocks, in the configured language and within the last seven local calendar days, all at least 28/30 and spanning at least three dates. Mock duration is unrestricted for both readiness and daily targets. A newer failed mock replaces older success. Language changes during an active mock invalidate its language-specific evidence; old summaries without language/duration remain historical data. Samples cannot satisfy any preparation goal. These are app study targets with immediate answer feedback, not official readiness or a promise of passing. IMT's published B/B1 format is 30 questions, 30 minutes and a 27/30 pass mark; the app's 28/30 target adds a study margin.

New question progress records preserve `firstSeenAt` so daily first encounters do not increase on retries/reloads. Sync merges the earliest first-seen date alongside the existing per-device maxima and reset generations. Session summaries now store `language` and `languageChanged`, and validation accepts `learn`/`repair`. Invalid plan/first-seen/session metadata still follows strict atomic backup rejection and independent startup recovery. A newer client/profile without a plan cannot delete an existing plan during merge. `check:study` now also runs `scripts/check_exam_plan.mjs` for deadlines/DST, quota stability/catch-up, balance, recent-language mock criteria, sync and backup contracts.

| Mode | Maximum | Selection | Progress recorded |
| --- | --- | --- | --- |
| `quick` | 10 | Shuffled unseen questions first, then seen ones | When each answer is checked |
| `review` | 20 | Seen questions whose `nextReview` is absent or due | When each answer is checked |
| `mistakes` | 20 | Questions with more wrong than correct attempts | When each answer is checked |
| `exam` | 30 | Shuffled corpus | At submission, including unanswered items as wrong |
| `learn` | 20 | Unseen questions, least-covered topics first | When each answer is checked |
| `repair` | 20 | Latest wrong answers, shuffled | When each answer is checked |

Limits shrink with availability. Empty review/mistakes modes show a toast without starting another kind of session. `sessionSize()` also supplies the UI counts and time estimates.

`picks` holds selected choices; `answers` holds checked answers in every mode. `chooseAnswer()` selects and immediately checks the answer, records practice progress once, rerenders feedback, and focuses/scrolls it into view. It never navigates or submits. All checked answers lock, including mocks, preserving the first attempt after the key is revealed. Navigating restores the selection and checked feedback. `firstUnansweredIndex()` uses `answers`; skipped questions remain unanswered until selected. The transition helpers still support unchecked drafts, but the UI checks within the same click/key handler.

`session.notSure[index]` holds the checkbox state independently for each question; navigation, language changes and sync renders preserve it. The full Not sure panel is a native checkbox label, so its heading, help text and padding toggle the mark; keyboard users can focus the checkbox and press Space. `setSessionNotSure()` accepts changes only before the answer is checked. Checked answers include `notSure` without changing correctness or scoring. Uncertain correct answers and all checked wrong answers save immediately to `profile.savedQuestions`, including in unfinished mocks. Submitted unanswered mock items are also saved as mistakes. Practice progress still records on checking; mock progress/activity still waits for submission.

The read-only `#saved-questions` collection is linked from Dashboard and Practice, with 20 expandable questions per page, source IDs, images, all choices, reason labels and EN/RU/PT wording selection. It neither starts a quiz nor records attempts. Saved reasons accumulate by question ID and never disappear after later correct answers. Normalization backfills every legacy question with `wrong > 0`, independently of the stricter mistake-clinic/repair queues. It preserves unknown IDs while displaying only questions in the loaded bank. No removal or further study workflow is implemented.

Mocks have no time limit or automatic submission. Their timer derives `elapsedSeconds` from `startedAt`; clearing/restarting its interval on a render must preserve the original start. Only explicit Continue/Next/Finish actions navigate or submit, including after the final wrong or correct answer. Mocks retain a pass at at most three errors; practice uses an 80% threshold for the positive result headline. The [published IMT B/B1 format](https://imt.madeira.gov.pt/index.php/pt/transportes-terrestres/condutores/provas-teoricas) remains separate from this untimed study flow.

`recordQuestion()` updates answer counters, per-question streak, review date and daily activity, then saves locally. Correct-answer intervals are 1, 3, 7, 14 and 30 days, capped at 30; a wrong answer resets the question streak and is due immediately. Finishing adds a session summary with `activityRecorded: true` and retains the latest 100 summaries. Practice answers are not counted again at completion.

Completed quizzes retain `session.result`; route, language and sync renders keep showing results until the user leaves or starts again. Missed-question review includes the image, source ID, selected/unanswered label, study-key answer and feedback. Completion focuses the result heading and scrolls to the top, unless Settings is open. Later renders do not repeat that completion action.

At phone widths (720 px or less), the question text appears above the full road image, and Previous/Next, the answered count and the collapsible question grid follow the answers and primary action. The timer/counter stays sticky. Crossing the breakpoint moves the existing DOM nodes so keyboard order follows the layout without rerendering or changing session state; desktop keeps navigation above the card and the question beside the image.

Leaving an unfinished quiz requires confirmation, including browser Back. Cancel restores `#quiz` with the same session. Reload/close requests the browser's leave warning. Confirmed departure discards the in-memory session; saved checked practice progress remains.

Dashboard and Progress show the four preparation goals above. Counts include only questions in the currently loaded corpus, and the mock average uses eligible recent language-specific mocks. Progress displays all 16 mapped topics; default ordering uses unrounded coverage ascending, then lifetime answer accuracy, then localized name. The alternative sorts coverage descending. Preparation goals separately use latest-answer accuracy.

## Stored profile and backups

| `localStorage` key | Meaning |
| --- | --- |
| `roadready-profile` | Preferences, question progress, completed summaries and activity |
| `roadready-theme` | Per-browser appearance preference: `system`, `light` or `dark` |
| `roadready-profile-recovery` | Original damaged profile retained during startup recovery, when storage permits |
| `roadready-device-id` | Browser UUID identifying its answer/activity counters |
| `roadready-sync-key` | Private 43-character key identifying the shared cloud profile |
| `roadready-last-sync` | Last successful sync timestamp |

The browser device ID and private sync key serve different purposes: linked devices share the sync key but have separate counter IDs.

Profile fields are `startedAt`, `updatedAt`, optional `resetAt`, `dailyGoal` (legacy preference), `examPlan`, `uiLanguage`, `language`, `questionProgress`, `savedQuestions`, `sessions`, `answerActivity` and stored `streak`. Each question progress record contains totals, legacy `baseCorrect`/`baseWrong`, `countsByDevice`, its correct-answer streak, optional `firstSeenAt`, `lastAnswer` and `nextReview`. `savedQuestions[id]` contains boolean `notSure` and/or `mistake` reasons, with at least one true. It is separate from answer counters so saving a checked mock answer does not count an unsubmitted attempt. Session records contain ID, mode, correct/total/percent, completion time, duration, the activity marker and optional `language`/`languageChanged`. Active questions and draft answers are not saved.

Activity is shaped as `answerActivity[local YYYY-MM-DD][deviceId] = count`. Merge uses the maximum counter for each device/day, then the UI sums devices. Older summaries without `activityRecorded` contribute their completed-session totals for compatibility. The visible streak is recomputed across consecutive local dates, allowing yesterday's streak while today is still pending; calendar stepping handles daylight-saving changes.

Exports use the version-2 envelope `{ app, version, exportedAt, profile, syncKey }`. They include the private key. Imports accept that envelope or a raw legacy profile, with a 2 MiB file limit. `profile-data.js` validates nested records, dates, counts, languages and unsafe object keys, clones the candidate, recomputes percentages and keeps at most 100 summaries.

Import order matters: parse/validate → validate optional key → load required Russian content → write candidate to `localStorage` → replace active profile → render/sync. A cloud failure after local commit leaves the restored profile available. Startup uses a more forgiving recovery path that salvages valid records rather than rejecting the whole profile.

## Cloud merge and database contract

`sync.js` uses direct POST requests to Supabase's `roadready_read_progress` and `roadready_write_progress` RPCs. There is no Supabase SDK or Auth flow. A random 256-bit key is generated automatically. Linking uses `#sync=<key>`; the controller immediately removes that fragment and switches to Dashboard. Request URLs omit the private key; it is supplied in the JSON body.

Synchronization reads the cloud revision, merges against the latest local profile and writes with `p_expected_revision`. A conflict returns the current row for another merge; one run attempts up to five writes. Local changes debounce for 1.2 seconds. Reconnect and return-to-visible trigger sync; retryable failures back off up to 60 seconds. Generation checks prevent results for a previous key from applying after a link change. Local state is read again after requests so answers made during a fetch survive.

The merge rules are the important part of this design:

- Per-question counters use maxima for each device, then sum devices plus the preserved legacy base counts. Records containing only legacy totals use maxima. Repeated sync must be idempotent.
- Saved question IDs are unioned, and each reason merges by boolean OR. Missing fields from older clients cannot delete saved reasons. Backup validation rejects malformed collection entries atomically; startup recovery salvages valid entries independently.
- The latest `lastAnswer` determines question scheduling/streak fields. Profile preferences use `updatedAt`; ties prefer local values.
- Session summaries are unioned by ID, with a legacy tuple fallback, sorted by completion and capped at 100. An existing activity marker must survive a merge.
- Daily activity merges by device/day maxima. The UI derives its streak from the merged activity rather than using the merged stored streak directly.
- A newer `resetAt` discards the older history generation, including saved questions, before merging. Reset preserves language preferences and the private key, and propagates to linked devices when sync succeeds.

The active SQL is [supabase/personal-sync.sql](../../supabase/personal-sync.sql). It stores a SHA-256 hash of the key in `private.roadready_device_profiles`, with JSON profile, revision and update timestamp. RLS is enabled and direct table privileges are revoked from browser roles. Public invoker wrappers call private functions with a restricted search path. Payloads must have profile/progress/session containers and fit 2 MiB/100 sessions; browser validation is stricter about nested records.

`supabase-config.js` contains only the public URL and publishable key. `supabase/schema.sql` describes the old email-auth table and is retained for recovery/reference; the current app does not use it. This is a lightweight personal-profile design without public-service abuse prevention.

## Corpus and translation maintenance

The snapshot contains **3,910 questions across 16 topics**, **18,931 Russian fields** and **305 UI translation keys**. The three tracked JSON files total about 9.1 MB; inspect specific records with a parsing script instead of dumping the files.

| File | Contract |
| --- | --- |
| `questions-pt.json` | Preserved scrape: IDs (`bc-<sourceId>`), category/topic, Portuguese text/options, study key and source/image URLs |
| `questions-en.json` | Runtime base: preserves PT and adds EN text/options, feedback and review metadata |
| `questions-ru.json` | Compact object keyed by question ID, containing RU text, keyed answers and feedback; metadata binds it to the exact EN file bytes |

All paths above are under `public/data/`. The runtime attaches Russian fields by ID/answer key when needed. It validates all overlay count/IDs, text/explanation fields and unique answer keys before mutating any question, preserving base question/choice order. The offline data check additionally verifies completeness metadata and the SHA-256 source hash. UI translations are separate dictionaries in `i18n.js`, with English fallback, placeholder interpolation and Russian plural helpers.

The study key comes from Bom Condutor. The app separately links 14 IMT PDF groups; it does not treat those links as an official solution key. **Only `bc-1165` has a reviewed detailed explanation in this snapshot.** All other feedback explicitly says detailed reasoning has not been reviewed. `scripts/reviewed-content.mjs` matches corrections against preserved Portuguese phrases; reviewed reasoning additionally matches the exact question/options/key and carries a source URL.

### IMT PDF comparison

`scripts/fetch_imt_pdfs.mjs` reads the live official index, requires all 14 numbered driver groups, and saves their PDF bytes, index snapshot, source URLs and SHA-256 hashes under ignored `tmp/imt-audit/`. `scripts/audit_imt_pdfs.py` extracts each illustrated question row and checks that image-row counts agree with the number of first answer options. It compares the preserved PT question and every PT option, allowing only documented layout/typographic normalization and ignoring option order. Automated image matching uses conservative RGB/region thresholds. Fuzzy/image-only candidates never receive a full-match label. The PDFs contain questions beyond Category B; unpaired entries require applicability review rather than automatic addition to the corpus.

The generated [audit report](IMT-AUDIT.md) and two CSV files under `documentation/data/` give both directions of comparison. `public/data/imt-verification.json` records status and PDF group/page/row per app ID, source hashes, image metrics/hashes and a corpus fingerprint. This is source comparison, **not official-answer or translation verification**. The Python maintenance command requires `pdfplumber`, `pypdf`, Pillow and NumPy; the bundled workspace Python supplies them. It does not add npm/browser dependencies or rewrite the PT/EN/RU corpora.

`question-verification.js` validates the manifest and SHA-256 of `JSON.stringify(questions.map(verificationInput))`: ID, Portuguese text, keyed/ordered Portuguese choices, image URL and study-source URL. It retains the input for each question so a later in-memory mutation also removes the label. Translation or study-key changes are outside this proof's scope. Startup loads and validates the audit after the corpus/optional RU overlay; an unavailable, malformed or stale proof does not prevent studying. The module is explicitly packaged by the build.

Quiz questions and Sources show separate full/text-only/difference/unconfirmed results with PDF page links and the checked date. Checked feedback in every mode and completed results show the separate answer-reasoning review status, available reviewed explanation and rule link. Unanswered questions do not reveal answer reasoning. Sources provides the two CSV downloads; the build copies those files explicitly. The old fixed IMT-page update-date claim has been replaced by the audit's actual snapshot date.

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

On **7 October 2026**, all eight release checks passed: data, content, IMT verification, sync, capture, quiz/results, study/exam planning and backup. Build passed with all 3,910 cached images and **zero downloads**. Exam-plan calendar checks also passed with `TZ=Europe/Lisbon` across the October daylight-saving boundary.

Checks use Node's built-in assertions. Backup, quiz-results and study-flow checks execute real `app.js` handlers in VM contexts with DOM/storage fakes; they strip imports and omit startup at its skeleton-render marker. If reorganizing startup or adding required DOM methods, update those harnesses. Sync tests use an in-memory server, and capture tests use a fake canvas.

Chromium browser checks covered desktop and 375/320 px phones in EN/RU: immediate correct/wrong feedback with manual continuation, the final wrong answer, restored feedback across navigation/language changes, keyboard controls, Settings focus trapping/restoration, and full 30-question mocks manually submitted after 31 minutes. All 12 cases passed without browser errors or horizontal overflow. QA used synthetic profiles on a separate local origin with Supabase disabled and made zero cloud-profile requests; local evidence is in ignored `tmp/mistake-feedback-qa/` when present. Earlier exam-plan and dark-theme QA remains in its separate ignored directories.

Passing checks do not establish live Supabase setup/RLS behavior, actual browser downloads/clipboard/popups, physical-device compatibility or correctness of every translated road-rule answer. The untouched `qa-manual-2026-10-02/` directory contains historical browser evidence and follow-up fixes and may not exist in another checkout; consult the latest fix notes before treating an old finding as open.
