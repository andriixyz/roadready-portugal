# Manual QA handoff

Original manual pass: **7–8 October 2026**, application baseline `b34d6e1`. **QA-001 and QA-002 are done**, verified on 8 October; QA-003 and QA-004 remain open. Read the [full manual report](MANUAL-QA-2026-10-08.md) for the historical observations and verification limits.

Use synthetic progress on a separate HTTP origin with Supabase disabled or local RPC mocks, as required by [AGENTS.md](../../AGENTS.md). Never reproduce import, pairing or reset cases against the user's real profile. The source locations describe the tested baseline; follow the named functions and translation keys if line numbers change.

| ID | Priority | Status | Finding | Main source |
| --- | --- | --- | --- | --- |
| [QA-001](#qa-001) | P2 | Done | Russian results clip at 320 pixels | [styles.css](../../styles.css) |
| [QA-002](#qa-002) | P2 | Done | Failed Russian overlay replaces an available full bank with samples | [app.js](../../app.js) |
| [QA-003](#qa-003) | P3 | Open | Dashboard counters use incorrect singular forms | [i18n.js](../../i18n.js), [app.js](../../app.js) |
| [QA-004](#qa-004) | P3 | Open | An expired exam target retains the Exam day phase | [exam-plan.js](../../exam-plan.js), [i18n.js](../../i18n.js) |

## QA-001

**Done — 8 October 2026.** Fixing commit: [`0328a70`](https://github.com/andriixyz/roadready-portugal/commit/0328a70721012c8e9f26130ac3816c177034f9bc).

**Original finding: Russian results overflow at 320 pixels.** The time statistic and rightmost action are clipped, and a horizontal scrollbar appears. Source: `.result-stats`, `.result-actions` and narrow `.result-card` rules in `styles.css` (tested lines 418, 423 and 762).

Reproduce by selecting Russian UI, completing a 30-question mock and opening results in a real 320-pixel browsing context. The original pass used an iframe because the browser viewport override did not change `innerWidth`. Measured content width was 305 pixels and scroll width 323; the stats/actions were 239 pixels wide but required 290/288 pixels. Do not infer responsive coverage from a nominal viewport setting alone.

Evidence: [clipped result](../qa/2026-10-08/mobile-result-preview.jpg).

Acceptance checks:

- [x] At 320 and 375 pixels, EN/RU result statistics and every action are visible and usable without horizontal scrolling, including long Russian duration labels.
- [x] Desktop layout, result-heading focus and submission scroll behavior remain correct.
- [x] Scores, errors, elapsed time and result rerenders remain unchanged.

Resolution: statistics use shrinkable grid tracks and wrapping text. At phone widths (720 pixels or less), accuracy/errors share a row, duration takes a full row, and actions stack at full width. Desktop keeps its three statistics and horizontal actions, with wrapping available when needed. The stylesheet cache version was advanced.

Validation: reproduced the baseline overflow, then completed eight Chromium cases at actual `innerWidth` values of 320, 375, 720 and 1280 pixels in EN/RU. Each case submitted a 30-question mock scoring 25/30 (83%, five errors), with a clock advanced to a 1,234-minute duration. At 320/375 pixels the content's client and scroll widths agreed (305/305 and 360/360 with vertical scrollbars); every statistic and all three actions fit. Keyboard answers/navigation, heading focus, submission scroll, action tab order and activation, Settings focus trapping/restoration, and language rerenders passed. Rerenders preserved scores/time, one session and exactly 30 recorded attempts. All eight release commands (`check`, `check:content`, `check:verification`, `check:sync`, `check:capture`, `check:quiz`, `check:study`, `check:backup`) and `build` passed; the build reused all 3,910 images with zero downloads. Git whitespace checks passed.

Fixed-layout evidence: [Russian 320-pixel results](../qa/2026-10-08/qa-001-fixed-ru-320.png), [Russian desktop results](../qa/2026-10-08/qa-001-fixed-ru-desktop.png). Local QA script and measurements are under ignored `tmp/qa-001/` when present.

Limits: responsive Chromium checks used synthetic profiles on a separate origin with Supabase disabled and made zero external requests. These are not physical-phone or live sync tests. Mobile navigation remains hidden on the quiz/results route, so narrow Settings checks opened the existing desktop control before resizing; focus restoration was checked with that control visible. The dated manual report remains unchanged.

## QA-002

**Done — 8 October 2026.** Fixing commit: [`1d8a754`](https://github.com/andriixyz/roadready-portugal/commit/1d8a754473a90db590890998617d5ed67cd91b26).

**Original finding: an unavailable Russian overlay discards a successful full-bank startup load.** With saved `uiLanguage` or question `language` set to `ru`, `loadCorpus()` awaits `ensureRussianCorpus()` inside each EN/PT corpus attempt (`app.js`, tested lines 211–227). An overlay exception falls through both available corpora to the six built-in samples.

Reproduce in an isolated app copy with some saved bank progress and Russian preferences. Keep the EN/PT corpora available, make the Russian overlay request fail, and reload. The manual pass injected HTTP 503; making that file unavailable in the temporary copy also exercises the failed fetch. Observed: six samples, zero displayed seen questions/attempts, and one retained session. Restore the overlay and reload: the existing two seen questions and six attempts return without importing anything. This is a loading/display failure; the pass did not observe erased storage.

Evidence: [failed startup](../qa/2026-10-08/ru-startup-falls-to-samples.png), [full bank restored](../qa/2026-10-08/ru-bank-restored.png).

Acceptance checks:

- [x] Overlay failure with an available EN/PT corpus keeps the full bank and existing progress usable, with a clear translation-unavailable message or disclosed fallback.
- [x] Test saved Russian UI and saved Russian question language independently.
- [x] Retrying after the overlay becomes available restores Russian wording without resetting progress.
- [x] Russian overlay hash/order validation still applies; genuine failure of both base corpora still uses clearly labelled samples.
- [x] A failed Russian backup import remains atomic, and a failed mid-session Russian switch keeps the existing language, checked answer and feedback.

Resolution: base-bank loading finishes before the optional Russian overlay is attempted. Overlay failure retains the bank and loads its source-comparison audit, with a persistent EN/RU notice on study pages. A new set requesting unavailable Russian uses the available English or Portuguese wording while preserving saved preferences. Selecting Russian again retries without resetting progress; a failed explicit switch within a checked question keeps its existing language/answer/feedback. Overlay fields are validated together before any question is modified.

Validation: twelve Chromium cases at actual 320, 375 and 1280 pixels crossed EN/PT base-bank availability with independently saved Russian UI and Russian question preferences. Injected HTTP 503 failures retained all 3,910 questions, two previously seen questions, six previous attempts and one historical session. EN/PT practice, source-comparison rendering, rejected Russian imports, checked feedback/navigation, Settings keyboard focus, same-session retry and reload recovery passed without horizontal scrolling or browser exceptions. Two additional EN/RU cases verified labelled six-question samples when both base banks failed. An active mock retained its checked pick and 01:01 elapsed time after failed question/UI Russian switches; successful recovery translated it, and the timer continued to 02:01.

Regression checks were added to `check:backup` and `check:quiz` for startup/retry, preserved progress, atomic overlay rejection, keyed answer ordering, base-language sessions and failed checked-session switches. Runtime validation covers overlay IDs/fields/unique answer keys without changing base question/choice order; the existing offline `check` still verifies the exact EN source SHA-256 and completeness metadata. All eight release checks and `build` passed, with all 3,910 images reused and zero downloads. Git whitespace checks passed.

Fixed-failure evidence: [Russian UI at 320 pixels](../qa/2026-10-08/qa-002-fixed-ru-320.png), [English UI with saved Russian question preference](../qa/2026-10-08/qa-002-fixed-en-desktop.png). Local scripts and measurements are under ignored `tmp/qa-002/` when present.

Limits: browser checks used synthetic profiles on a separate origin with Supabase disabled and made zero external requests. These are responsive Chromium and mocked failure tests, not physical-phone or live Supabase tests. Narrow Settings checks opened the desktop control before resizing while a quiz was active, then restored focus with that control visible. The dated manual report remains unchanged.

## QA-003

**Singular dashboard counters have incorrect grammar.** With one checked answer today, English shows `1 answers today`; with exactly one latest mistake, it shows `1 questions still have a wrong latest answer`. Russian shows `Последний ответ ещё неверный в 1 вопросах`. The numeric values were correct.

Reproduce using a synthetic profile with exactly one answer on the device's current local date and one latest incorrect answer. Open Dashboard in EN and RU. Relevant keys are `plan.answersToday` and `plan.mistakeEvidence` in both dictionaries (`i18n.js`, EN tested lines 138/172), plus the dashboard interpolation in `app.js`.

Acceptance checks:

- [ ] EN/RU wording is grammatical for 0, 1, 2, 5, 11 and 21; use existing locale helpers or wording that does not require noun inflection.
- [ ] Counts, repair-queue membership and local-calendar activity remain unchanged.
- [ ] Translation keys exist in both dictionaries and render correctly in the narrow dashboard.

Validation: manual EN/RU dashboard checks; `rtk npm run check` and `rtk npm run check:study`.

## QA-004

**A past exam target still uses the Exam day phase.** `getExamPlan()` maps all `daysLeft <= 0` to `exam` (`exam-plan.js`, tested line 82). The dashboard heading correctly asks to update the date, but the phase remains `DAY 20 OF 20 · EXAM DAY`.

Reproduce by setting an isolated profile's target to yesterday and opening Dashboard. The recorded case used a 6 October target on 7 October. Compare with a target of today, where Exam day is appropriate, and tomorrow, where Final review is appropriate. Relevant translations include `plan.phase.exam` and `plan.datePassed` in EN/RU.

Evidence: [expired target](../qa/2026-10-08/expired-plan.jpg).

Acceptance checks:

- [ ] A past target consistently prompts date revision and does not label that day as the exam day.
- [ ] Today's target retains Exam day; tomorrow retains Final review; later phases keep their current behavior.
- [ ] Expired-date daily targets remain zero and EN/RU wording agrees across the heading, phase and roadmap.
- [ ] Date comparisons retain local-calendar semantics, including the Europe/Lisbon daylight-saving boundary.

Validation: manual yesterday/today/tomorrow/later EN/RU dashboard checks; `rtk npm run check`, `rtk npm run check:study` and the existing study check under `TZ=Europe/Lisbon`.

## Closing a finding

When a fix has passed its relevant checks, update the issue's status and record the fixing commit, validation performed and any remaining limits here. Keep the dated manual report as the historical observation record. Future checks should distinguish mocked sync from live Supabase/RLS and responsive layouts from physical phones.
