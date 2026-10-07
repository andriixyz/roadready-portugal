# RoadReady Portugal — agent guide

RoadReady is a static study app for Portugal's Category B driving theory exam. It uses plain HTML, CSS and browser JavaScript modules, with English/Russian UI and English/Russian/Portuguese questions. Progress saves locally and can sync through a private device link using Supabase; there is no sign-in.

Read [README.md](README.md) for user-facing behavior and setup. Read [documentation/md/PROJECT.md](documentation/md/PROJECT.md) when changing quiz behavior, study data, translations or sync. That reference explains the current implementation and its verification limits.

## Working conventions

- Check Git status first and preserve unrelated changes and local QA evidence.
- In this workspace, prefix shell commands with `rtk`, as required by the session's RTK instructions. Use `rtk proxy <command>` when raw output is useful.
- If a `.codegraph/` index exists, use CodeGraph before searching or reading code to understand it. Do not create an index without a request. Otherwise use `rg` and targeted source reads.
- Keep the existing dependency-free approach. Follow the current module structure and make focused changes; new frameworks, build systems and test libraries need a concrete reason.
- Edit source files, not `dist/`. `dist/`, `public/images/`, `public/pdfs/` and `tmp/` are ignored generated/local assets.
- Keep this guide concise. Update the project reference when behavior or maintenance commands change; avoid adding chat history or speculative plans.
- After completing changes and passing the release checks, commit the task's files and push to `origin/main` to deploy production through the GitHub Pages workflow. This is the default finish step unless the user explicitly asks to keep changes local. Preserve unrelated work, verify the deployment succeeds, and report the production URL; do not treat a successful push alone as a completed deployment.

## Where to work

| Area | Source |
| --- | --- |
| Routes, rendering, question selection, recording answers, results, settings | `app.js` |
| Pure quiz transitions: drafts, checking, navigation and mock deadlines | `quiz-session.js` |
| Profile validation, normalization and recovery | `profile-data.js` |
| Local calendar activity, streaks and activity merging | `study-activity.js` |
| Exam deadline, daily targets, topic balance and preparation evidence | `exam-plan.js`; dashboard/settings in `app.js` |
| Device identity, private links, conflict resolution and cloud requests | `sync.js`; public connection settings in `supabase-config.js` |
| Question PNGs, wrapping, image paths and ChatGPT prompt content | `question-capture.js` |
| UI strings and plural/locale helpers | `i18n.js`; static `data-i18n*` attributes in `index.html` |
| Layout, theme variables and responsive behavior | `styles.css`; page shell/settings in `index.html` |
| Question content and reproducible corrections | `public/data/`; `scripts/reviewed-content.mjs`, `scripts/explanations.mjs`, translation scripts |
| IMT PDF comparison and verification labels | `question-verification.js`; `scripts/fetch_imt_pdfs.mjs`, `scripts/audit_imt_pdfs.py`; `documentation/md/IMT-AUDIT.md` |
| Active database setup | `supabase/personal-sync.sql`; `supabase/schema.sql` is legacy reference only |
| Static packaging and deployment checks | `scripts/build.mjs`; `.github/workflows/pages.yml` |

## Run and verify

Use a recent Node.js with built-in `fetch`/`AbortSignal.timeout`, and Python 3 for the local server. `package.json` declares no dependencies; routine setup needs no package installation.

```sh
rtk npm run images   # prepare missing question images; requires network on a fresh checkout
rtk npm run dev      # serve the project at http://localhost:4173
rtk npm run build    # prepare images and regenerate dist/
```

Serve over HTTP; browser modules and data loading require it. Image clipboard support requires HTTPS or localhost. All deployed asset paths must remain relative so GitHub Pages repository subpaths work.

Run the existing checks relevant to a change:

| Change | Checks |
| --- | --- |
| Corpus, translations, UI translation keys, explanations | `rtk npm run check`; `rtk npm run check:content` |
| IMT comparison metadata, source labels or question/image changes | `rtk npm run check:verification`; also quiz/study checks for rendering changes |
| Quiz, scoring, navigation, activity, topic ordering | `rtk npm run check:quiz`; `rtk npm run check:study` |
| Backup, profile schema, startup recovery | `rtk npm run check:backup`; also study/sync checks when shared fields change |
| Merge rules, linking, cloud controller, reset | `rtk npm run check:sync` |
| Capture or ChatGPT prompt | `rtk npm run check:capture` |

Before a release, run all eight check commands above and the build. For documentation-only changes, verify links and Git whitespace. UI changes also need browser checks: desktop and narrow mobile, EN/RU, keyboard navigation, settings focus, and any affected quiz flow. The Node checks use mocks and do not verify actual layout or browser permissions.

For browser QA, use synthetic progress on a separate origin and disable Supabase in a temporary app copy or mock its RPCs. Startup automatically creates a key and attempts sync. Do not import, reset or pair the user's real profile during testing.

## Behavior to preserve

- Preserve question IDs, Portuguese source wording, answer keys/order and source attribution. The corpus uses a **non-official study key**. Detailed reasoning must be reviewed for the exact question and linked to a relevant source; topic boilerplate must not be presented as a reviewed explanation.
- UI language (`uiLanguage`: EN/RU) and question language (`language`: EN/RU/PT) are distinct. Add UI keys in both `i18n.js` dictionaries, including accessibility strings. Russian question content is a lazy overlay tied to the exact English corpus file hash.
- Practice drafts do not count. Checked practice answers save once, even if the session is abandoned. Mock answers remain editable, reveal no feedback before submission, and count only on submission; unanswered mock questions count as wrong.
- Navigation, language changes and sync renders must preserve the active session, checked feedback, drafts and mock deadline. Completed results must survive later renders without recording again. Sessions are in memory and do not resume after reload.
- Keep review limited to due questions and mistakes limited to `wrong > correct`. Empty modes stay on the current page. Displayed session sizes must agree with actual selection limits.
- Preserve per-device counters and legacy base counts. Merge each device's counters using maxima, then calculate totals; summing already-merged totals double-counts. Preserve `resetAt` so stale devices cannot resurrect erased progress.
- Daily activity uses the device's local calendar date. Derive the visible streak from activity/legacy sessions, rather than trusting the stored `streak` field.
- Backup import must validate/load everything before committing to storage and then memory. Invalid data, unavailable Russian content or quota failure must leave the previous profile intact. Retain startup recovery and the 2 MiB/100-session limits.
- Keep private sync keys out of source, logs and query strings. Device links use a URL fragment that is removed on import. The Supabase URL/publishable key are public settings; the private sync key grants profile access. Keep the database table inaccessible to browser roles except through scoped RPCs.
- Question capture includes the full image and current wording/options, without answer highlights, explanations or personal data. Preserve the promised PNG clipboard write started in the click handler, plus download/manual-copy fallbacks. ChatGPT opens for manual pasting; content is not automatically submitted.
- Preserve settings focus trapping/restoration, mobile sticky timer/navigation and results focus/scroll behavior. Escape external text before interpolating it into HTML.

## Maintenance shortcuts

- Make reviewed wording/explanation changes in `scripts/reviewed-content.mjs`, then run `rtk npm run explain` and the content/data checks. This refresh updates EN/RU together and requires the existing overlay to match first.
- Scraping and machine translation regenerate tracked data and use external services. Run them only for a content task; see the project reference for the required order and Russian `--force` behavior. Never bypass a source-hash mismatch by editing the hash alone.
- After changing served assets, advance the relevant `?v=` references in `index.html`, module imports and corpus fetches. If adding a browser module, add it to the explicit copy list in `scripts/build.mjs`.
- Refresh IMT comparisons with `rtk npm run audit:imt:fetch`, then `rtk npm run audit:imt` using Python with the PDF packages, and run `rtk npm run check:verification`. Never turn a fuzzy candidate into a confirmed match or imply that PDF matching verifies the answer key or translations.
