# Manual QA handoff

Last verified: **7–8 October 2026**, application baseline `b34d6e1`. All four findings below are **open**; this handoff documents testing and does not implement fixes. Read the [full manual report](MANUAL-QA-2026-10-08.md) for completed checks, observations and verification limits.

Use synthetic progress on a separate HTTP origin with Supabase disabled or local RPC mocks, as required by [AGENTS.md](../../AGENTS.md). Never reproduce import, pairing or reset cases against the user's real profile. The source locations describe the tested baseline; follow the named functions and translation keys if line numbers change.

| ID | Priority | Status | Finding | Main source |
| --- | --- | --- | --- | --- |
| [QA-001](#qa-001) | P2 | Open | Russian results clip at 320 pixels | [styles.css](../../styles.css) |
| [QA-002](#qa-002) | P2 | Open | Failed Russian overlay replaces an available full bank with samples | [app.js](../../app.js) |
| [QA-003](#qa-003) | P3 | Open | Dashboard counters use incorrect singular forms | [i18n.js](../../i18n.js), [app.js](../../app.js) |
| [QA-004](#qa-004) | P3 | Open | An expired exam target retains the Exam day phase | [exam-plan.js](../../exam-plan.js), [i18n.js](../../i18n.js) |

## QA-001

**Russian results overflow at 320 pixels.** The time statistic and rightmost action are clipped, and a horizontal scrollbar appears. Source: `.result-stats`, `.result-actions` and narrow `.result-card` rules in `styles.css` (tested lines 418, 423 and 762).

Reproduce by selecting Russian UI, completing a 30-question mock and opening results in a real 320-pixel browsing context. The original pass used an iframe because the browser viewport override did not change `innerWidth`. Measured content width was 305 pixels and scroll width 323; the stats/actions were 239 pixels wide but required 290/288 pixels. Do not infer responsive coverage from a nominal viewport setting alone.

Evidence: [clipped result](../qa/2026-10-08/mobile-result-preview.jpg).

Acceptance checks:

- [ ] At 320 and 375 pixels, EN/RU result statistics and every action are visible and usable without horizontal scrolling, including long Russian duration labels.
- [ ] Desktop layout, result-heading focus and submission scroll behavior remain correct.
- [ ] Scores, errors, elapsed time and result rerenders remain unchanged.

Validation: manual desktop/narrow EN/RU results and keyboard checks; `rtk npm run check:quiz`. Apply the release checks in AGENTS.md if changing served assets.

## QA-002

**An unavailable Russian overlay discards a successful full-bank startup load.** With saved `uiLanguage` or question `language` set to `ru`, `loadCorpus()` awaits `ensureRussianCorpus()` inside each EN/PT corpus attempt (`app.js`, tested lines 211–227). An overlay exception falls through both available corpora to the six built-in samples.

Reproduce in an isolated app copy with some saved bank progress and Russian preferences. Keep the EN/PT corpora available, make the Russian overlay request fail, and reload. The manual pass injected HTTP 503; making that file unavailable in the temporary copy also exercises the failed fetch. Observed: six samples, zero displayed seen questions/attempts, and one retained session. Restore the overlay and reload: the existing two seen questions and six attempts return without importing anything. This is a loading/display failure; the pass did not observe erased storage.

Evidence: [failed startup](../qa/2026-10-08/ru-startup-falls-to-samples.png), [full bank restored](../qa/2026-10-08/ru-bank-restored.png).

Acceptance checks:

- [ ] Overlay failure with an available EN/PT corpus keeps the full bank and existing progress usable, with a clear translation-unavailable message or disclosed fallback.
- [ ] Test saved Russian UI and saved Russian question language independently.
- [ ] Retrying after the overlay becomes available restores Russian wording without resetting progress.
- [ ] Russian overlay hash/order validation still applies; genuine failure of both base corpora still uses clearly labelled samples.
- [ ] A failed Russian backup import remains atomic, and a failed mid-session Russian switch keeps the existing language, checked answer and feedback.

Validation: manual startup/failure/recovery and active-session checks; `rtk npm run check`, `rtk npm run check:content`, `rtk npm run check:backup`, `rtk npm run check:quiz` and `rtk npm run check:study`.

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
