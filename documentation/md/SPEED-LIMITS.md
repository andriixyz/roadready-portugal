# Portugal speed limits — memory-page research

Official sources checked **7 October 2026**. The page focuses on light passenger/mixed and light goods vehicles, matching RoadReady's Category B study context. It does not claim to reproduce the whole vehicle-class table or the official exam questions.

## Primary sources

- [Consolidated Código da Estrada](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830), shown in force with last amendment 12 March 2025: articles 24–28, 72 and 78-A. Article 27 links to the original official table, reproduced in [Lei 72/2013, PDF page 3](https://files.diariodarepublica.pt/1s/2013/09/16900/0544605499.pdf#page=3). The PDF date is the original publication date, not the research date.
- [Consolidated Regulamento de Sinalização do Trânsito](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729), articles 24, 27 and 34–35: C13 maximum, D8 minimum, H6 recommended speed, H24 motorway, H25 road reserved for cars/motorcycles, H46 shared-zone entry, and N1 town entry. Page illustrations are simplified memory cues.

## Values used

General maxima in km/h; a different applicable limit or conditions can require another speed. The first column excludes signed shared zones. The three road columns to its right are outside towns.

| Light vehicle | Town | Other roads | Reserved road | Motorway |
| --- | ---: | ---: | ---: | ---: |
| Passenger / mixed, no trailer | 50 | 90 | 100 | 120 |
| Passenger / mixed, with trailer | 50 | 70 | 80 | 100 |
| Goods, no trailer | 50 | 80 | 90 | 110 |
| Goods, with trailer | 50 | 70 | 80 | 90 |

Signed zones of coexistence have a general maximum of **20 km/h** for all four rows. Article 78-A requires drivers to protect other users, stop when needed and yield to other vehicles on leaving.

The passenger-car mnemonic is **50, then +40, +10, +20**. For that passenger row only, towing subtracts 20 from each outside-town maximum. A solo light goods vehicle subtracts 10 from the passenger row outside town. The goods-with-trailer row must be learned separately: **50 · 70 · 80 · 90**. These are memory devices derived from the table, not additional legal rules.

Article 28 permits special signed limits, including limits above or below the general road limits. Avoid reducing the rule to “always take the lower of the sign and the general road default.” Lower applicable vehicle/driver limits still matter: a normal 120 maximum sign on a motorway does not turn a light goods vehicle's 110 general maximum into 120.

Article 27(6) sets a motorway minimum of **50 km/h**. The page qualifies this as normal circulation because articles 24–25 require speed adapted to traffic, danger, visibility and conditions. Article 72 separately excludes vehicles incapable of exceeding **60 km/h** on level ground or with a fixed maximum at or below 60, along with other prohibited classes. Do not present 60 as the normal motorway minimum or apply the general 50 minimum to every reserved road.

## Exam coverage

[SPEED-LIMITS-EXAM-GAPS.md](SPEED-LIMITS-EXAM-GAPS.md) maps corpus speed questions to this page and lists uncovered themes with question IDs.

## Maintenance and verification

Update legal values, examples and drill answer explanations together in `speed-limits.js` and both `i18n.js` dictionaries. Keep legal Portuguese road labels intact. Check the current official consolidation and linked table before advancing the checked date. Refresh asset version references in `index.html` and the module imports in `app.js`.

The recall drill is author-created and separate from the corpus, answer history, activity and mock-readiness evidence. A new drill starts at zero; an answer is scored once and cannot be changed after feedback. UI-language/sync renders retain vehicle/trailer selection, covered values and the current drill. Reload resets this in-memory state. Normal topic practice uses the existing corpus and scoring behavior.

Run the normal eight release checks and build. Browser QA must use synthetic progress on a separate origin with Supabase disabled/mocked: verify all four rows, hide/reveal, correct and wrong feedback, single scoring, completion/restart, EN/RU including a mid-drill switch, keyboard focus, settings trapping/restoration, topic practice/leave guards, desktop and narrow mobile overflow, light/dark appearance, and the print table while map values are hidden. Node mocks cannot verify layout or printing.
