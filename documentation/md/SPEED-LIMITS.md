# Portugal speed limits — speed-atlas research

Official sources checked **8 October 2026**. The page covers every vehicle row of the article 27 table that a Category B candidate meets on the exam, the signs that change a limit, the article 25 moderation list, slow driving, speeding severity, the exceptions in articles 28 and 64, and an illustrative stopping-distance model. It does not reproduce the official exam questions.

## Primary sources

- [Consolidated Código da Estrada](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830), in force with last amendment 12 March 2025 (Lei 24/2025): articles 24–28, 64, 72, 75, 78-A, 145 and 146. Article 27 links to the original official table, reproduced in [Lei 72/2013, PDF page 3](https://files.diariodarepublica.pt/1s/2013/09/16900/0544605499.pdf#page=3). The PDF date is the original publication date, not the research date. The consolidated article text was read on the Procuradoria-Geral Regional de Lisboa mirror of the same 28th version because the Diário da República pages render client-side; the DRE links remain the official references.
- [Consolidated Regulamento de Sinalização do Trânsito](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729): C13 maximum, C20b end of speed limit, D8 minimum, D14 end of minimum, H6 recommended speed, H37 end of recommended speed, G4 speed-limited zone, G8 end of zone, N1a/N1b town entry, N2a/N2b town exit, H24 motorway, H25 road reserved for cars and motorcycles, H46 shared zone. Per-lane minimums appear on lane-assignment panels that carry D8 symbols; the page draws that panel as a cue without a single code. Page illustrations are simplified memory cues, and temporary signs are shown with a yellow background.

## Values used

General maxima in km/h from article 27(1); a different applicable limit or the conditions can require another speed. Every row is **20 km/h** in a signed zona de coexistência (first table column). The three road columns to the right of "Town" are outside towns. "—" means the class may not use that road under articles 72 and 75: pedestrians, animals, cycles, mopeds, motorcycles and tricycles up to 50 cm³, quadricycles, agricultural vehicles, tourist trains, and vehicles unable to exceed 60 km/h on level ground or with a fixed maximum at or below that value.

| Vehicle | Town | Other roads | Reserved road | Motorway |
| --- | ---: | ---: | ---: | ---: |
| Light passenger / mixed, no trailer | 50 | 90 | 100 | 120 |
| Light passenger / mixed, with trailer | 50 | 70 | 80 | 100 |
| Light goods, no trailer | 50 | 80 | 90 | 110 |
| Light goods, with trailer | 50 | 70 | 80 | 90 |
| Heavy passenger, no trailer | 50 | 80 | 90 | 100 |
| Heavy passenger, with trailer | 50 | 70 | 80 | 90 |
| Heavy goods, no trailer or with semi-trailer | 50 | 80 | 80 | 90 |
| Heavy goods, with trailer | 40 | 70 | 70 | 80 |
| Motorcycle over 50 cm³, no sidecar | 50 | 90 | 100 | 120 |
| Motorcycle with sidecar or trailer | 50 | 70 | 80 | 100 |
| Motorcycle up to 50 cm³ | 40 | 60 | — | — |
| Tricycle | 50 | 80 | 90 | 100 |
| Moped or quadricycle | 40 | 45 | — | — |
| Agricultural or forestry tractor | 30 | 40 | — | — |
| Agricultural machine, motor cultivator, tractocarro | 20 | 20 | — | — |

Industrial machines (30/30 without registration, 40/70/70/80 with registration) are in the official table but omitted from the page because the corpus does not ask about them. The tricycle row applies to tricycles over 50 cm³ on motorways and reserved roads; smaller tricycles are barred by article 72.

Memory devices on the page are derived from the table, not additional rules: the car row is **50, +40, +10, +20**; towing takes 20 off the car's out-of-town values; a light goods vehicle takes 10 off the car's out-of-town values; a bus shares the tricycle row (50 · 80 · 90 · 100); a towing bus shares the towing van row (50 · 70 · 80 · 90); a heavy goods vehicle is the "double 80" row and its towing row is the only 40 in town; motorway maxima form a ladder 120 · 110 · 100 · 90 · 80.

## Rules used

- **Article 24**: regulate speed so as to stop within the free, visible space ahead; do not reduce speed suddenly without checking the vehicles behind, except in imminent danger.
- **Article 25**: especially moderate speed at pedestrian/cycle crossings; signed schools, hospitals and nurseries; towns and roads lined with buildings; shared zones; vulnerable users; crowds of people or animals; steep descents; curves, junctions, roundabouts, bumps and other places with reduced visibility; bridges, tunnels and level crossings; poor, wet, muddy or low-grip surfaces; danger signs; heavy traffic. Excessive speed for the conditions or in these places is a serious offence under article 145(1)(e).
- **Article 26**: driving so slowly as to cause unjustified hindrance is an offence (€60–300). Outside motorways there is no numeric minimum.
- **Article 27(2), 145(1)(b)–(c), 146(1)(i)**: for light cars and motorcycles, an excess up to 20 km/h in town or 30 outside is the lowest band (€60–300); more than 20/30 up to 40/60 is a serious offence (€120–600); more than 40/60 is very serious (€300–1 500 up to 60/80, €500–2 500 beyond). Other vehicles reach each band at 10/20, 20/40 and 40/60.
- **Article 27(6)**: motorway minimum of 50 km/h in normal circulation, without prejudice to article 26. The page does not apply this minimum to reserved roads.
- **Article 28**: special limits may be set above or below the general ones and must be signed; temporary limits that cannot be signed may be announced on panels or in the media. The page phrases this as "a sign may change the number; your vehicle may lower it, never raise it".
- **Article 64**: vehicles on police, rescue, prison-security or urgent public-interest missions that signal their passage may disregard traffic rules when the mission requires it, without endangering others.
- **Article 72**: access prohibitions above, including the 60 km/h capability rule. Do not present 60 as the motorway minimum.
- **Article 78-A**: shared-zone rules, including giving way to other vehicles when leaving.

The stopping-distance model uses one second of reaction time and 7 m/s² (dry) or 4 m/s² (wet) deceleration. It is labelled as illustrative; the law sets no figure.

## Exam coverage

[SPEED-LIMITS-EXAM-GAPS.md](SPEED-LIMITS-EXAM-GAPS.md) maps corpus speed questions to page locations and lists what remains outside the page.

## Maintenance and verification

Update legal values, sign meanings, scene lists and drill explanations together in `speed-limits.js` and both `i18n.js` dictionaries. `speed-limits.js` exports `SPEED_ATLAS`; `scripts/check_data.mjs` derives every vehicle, sign, place, flash, fact, exception, deck and drill key from it and fails on a missing EN/RU string, a drill whose answer is not among its choices, or an implausible table value. Keep legal Portuguese labels intact. Check the current official consolidation and linked table before advancing the checked date. Refresh asset version references in `index.html` and the module imports in `app.js`.

The recall drill is author-created and separate from the corpus, answer history, activity and mock-readiness evidence. A deck change or new run starts at zero; an answer is scored once and cannot be changed after feedback. UI-language/sync renders retain the vehicle, trailer, hidden values, open sign cards, open table, slider position, surface, deck and current drill. Reload resets this in-memory state. Chapter buttons scroll and focus headings without touching the route hash. Normal topic practice uses the existing corpus and scoring behavior.

Run the normal eight release checks and build. Browser QA must use synthetic progress on a separate origin with Supabase disabled/mocked: verify several vehicle rows including a barred class, trailer/sidecar variants, hide/reveal, the full table highlight, sign cards opening and surviving renders, the slider and surface toggle, each deck, correct and wrong feedback, single scoring, completion/restart, EN/RU including a mid-drill switch, keyboard focus on chips and chapter headings, settings trapping/restoration, topic practice/leave guards, desktop and narrow mobile overflow, light/dark appearance, and the print sheet while map values are hidden. Node mocks cannot verify layout or printing.
