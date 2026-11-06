# Offences atlas — research notes and exam coverage

Official sources checked **6 November 2026**. The page (`offences.js`, `offence.*` keys in `i18n.js`, route `#offences`) explains how Portuguese driving offences are graded and what each level costs. It does not reproduce official exam questions.

## Primary sources

- [Consolidated Código da Estrada](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830), last amended by Lei 24/2025 of 12 March 2025: articles 81–89, 121-A, 122, 130, 133–148, 152–154, 159–165 and 172–173. Read from the local snapshot `review/law/codigo-da-estrada.md` (copied 24 October 2026). A new code was announced in 2026; searches on 6 November 2026 found no publication in the Diário da República, so the 2025 text is in force.
- [Código Penal](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1995-34437675): articles 69, 137, 148, 200, 291 and 292 (snapshot `review/law/codigo-penal-excertos.md`).
- [Regulamento de Sinalização do Trânsito](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729): fines for B1/B2 (art. 23), road markings (art. 65) and traffic lights (art. 76).
- Decreto-Lei 2/98, art. 3 (driving without a licence is a crime; up to 2 years' prison or 240 days' fine for a car or motorcycle). The penalty was confirmed through court decisions that quote it; no consolidated DRE page was reachable, so the page cites the decree by name without a link.

## Values used

| Level | Basis | Driving ban | Points |
| --- | --- | --- | --- |
| Minor (leve) | Fine only (art. 136/2) | — | — |
| Serious (grave) | Art. 145 list | 1 month – 1 year (art. 147/2) | −2; −3 for alcohol, continued phone use, speeding in a shared zone, overtaking immediately before or on a crossing (art. 148/1 a) |
| Very serious (muito grave) | Art. 146 list | 2 months – 2 years (art. 147/2) | −4; −5 for alcohol, drugs, speeding in a shared zone (art. 148/1 b) |
| Crime | Código Penal | Court ban 3 months – 3 years (CP art. 69) | −6 with a court ban or a suspended case with an injunction (art. 148/2) |

- **Alcohol** (art. 81, 145/1 l, 146 j; CP art. 292): 0.5–<0.8 g/l serious (€250–1,250); 0.8–<1.2 very serious (€500–2,500); ≥1.2 crime (up to 1 year or 120 days' fine). Probationary and professional drivers (emergency, school transport up to 16, taxi, TVDE, heavy vehicles, dangerous goods): 0.2 and 0.5. A medical report finding influence is very serious. 1 mg/l of breath = 2.3 g/l of blood. Refusal is disobedience (art. 152/3) with a court ban (CP art. 69/1 c); a positive test or refusal bars driving for 12 hours (art. 154).
- **Points** (art. 121-A, 148): 12 at the start; same-day subtraction capped at 6 except alcohol/drugs; ≤5 compulsory course, ≤3 theory exam, 0 cassação and no new licence for 2 years; +3 per clean 3 years (2 for professional drivers on duty) up to 15; +1 per renewal with a voluntary course up to 16; missing or failing the course/exam also leads to cassação.
- **Bans** (art. 138, 140–143, 147): all motor vehicles; consecutive days; vehicle seizure for unlicensed offenders; suspension only for serious offences; halving for very serious after five clean years with the fine paid; minimum doubled for repeat offenders within five years; driving while banned is a crime.
- **Deadlines**: 15 working days to pay the minimum fine (art. 172), which does not cancel a ban; 48 h deposit when notified on the spot (art. 173); 5 days for physical documents when the app check fails (art. 85/5); 15 working days to surrender a licence (art. 160/3); 10 days after a court ban (CP art. 69/3); 45 days to collect a removed vehicle (art. 165); 90 days of unresolved seizure (art. 162/2).
- **Probation** (art. 81/3, 122, 130): three years; licence lapses after a road crime, one very serious or a second serious offence, then a special exam; T, AM, A1 and B1 holders start a new probation for another category; no probation when exchanging a foreign licence held over three years.

The sorter lists 48 offences with their article, the legal fine range where one applies to the whole offence, points and the motorway upgrade (art. 146 g–h, c). Speeding fines are left to the Speed limits page because they depend on the vehicle and excess.

## Study bank versus current law

The corpus key is non-official and several licensing questions predate the 2016 points system. The page keeps current law and flags the differences:

| Question | Bank key | Current law |
| --- | --- | --- |
| bc-4989 | A B1 holder taking category B has no probation | Art. 122(4): T, AM, A1 and B1 holders start a new probation |
| bc-4962 | Cassação after three very serious offences in five years | Points system (art. 148); three ordinary very serious offences take exactly 12 points, so the keyed option still matches |
| bc-4930, bc-4955 | New exam whenever a provisional holder is banned | Art. 130(1)(c): the licence lapses after a road crime, one very serious or a second serious offence; one serious offence with a ban does not |
| bc-4987 | Present the insurance certificate within 8 days | Not in the snapshot; art. 85 now sets 5 days only when the digital check fails. Not shown on the page |

## Exam coverage

Reproduce the review list:

```sh
node -e 'const qs=require("./public/data/questions-en.json").questions;const re=/contra-?ordena|\bgrave|\bleve\b|coima|inibi[çc][ãa]o|san[çc][ãa]o acess|cassa[çc]|\bcrime|pris[ãa]o|infra[cç]|apreens|reincid/i;for(const q of qs){const s=q.text.pt+" "+q.answers.map(a=>a.pt).join(" ");if(re.test(s)||q.topic.startsWith("Títulos"))console.log(q.id,"|",q.text.pt)}'
```

All 141 offence-term questions and all 129 questions in the Licensing, liability & offences topic were reviewed. Main themes and where the page covers them:

| Theme | Example IDs | Page location |
| --- | --- | --- |
| Classification and what a level brings | bc-4903, bc-4904, bc-4907 | 01 ladder, fact cards, drill `classify` |
| Ban durations | bc-4896, bc-4897, bc-4898, bc-4967, bc-4911, bc-4964, bc-4901 | 01 ladder, 05 card A, drills `banSerious`, `banVerySerious` |
| Very serious acts: dazzling, red light, STOP, continuous line, motorway | bc-4900, bc-4917, bc-4922, bc-4927, bc-4899, bc-4920, bc-2748, bc-2944, bc-4891 | 02 sorter, motorway pattern, drills |
| Serious acts: triangle, U-turn/reversing, parking on crossings | bc-4890, bc-2990, bc-3001, bc-3166, bc-3182, bc-4935 | 02 sorter |
| Minor parking offences | bc-2897, bc-4176 | 02 sorter (`parkDouble`, `parkPavement`) |
| Alcohol levels, fines, ban, crime | bc-4065–bc-4075, bc-4104, bc-4115, bc-4116, bc-4119, bc-4129–bc-4143, bc-4246–bc-4260, bc-4887, bc-4888, bc-4928, bc-5009, bc-5010 | 03 alcohol meter, drills `tas07`, `tas09`, `tas12`, `probation`, `refuse` |
| Suspension, halving, consecutive days, all vehicles, seizure instead of a ban | bc-4893, bc-4894, bc-4895, bc-4988, bc-4992 | 05 card A, drills `moped`, `consecutive`, `halve` |
| Cassação and two-year wait | bc-4962, bc-4971, bc-4974, bc-4998, bc-5001 | 04 points, drill `zero` |
| Probation | bc-4884, bc-4953, bc-4982, bc-4989, bc-4990, bc-4996, bc-5003, bc-4930, bc-4955 | 05 card D |
| Responsibility | bc-2758, bc-4889, bc-4892, bc-4912, bc-4913, bc-4934, bc-4940, bc-4941, bc-4961, bc-4972, bc-4981, bc-4984 | 05 card C, drills `owner`, `learner` |
| Payment and seizure | bc-4970, bc-4973, bc-4915, bc-4916, bc-4952, bc-4954, bc-4963, bc-4994, bc-4906, bc-4936, bc-4986 | 05 cards B and E, drill `pay` |
| Driving without a licence | bc-4910, bc-4958 | 02 sorter, drill `noLicence` |

Outside the page: image-dependent speed classifications (bc-4908, bc-4925, bc-4929, bc-1296), licence categories and vehicle weights (bc-4885–bc-5011 category questions), insurance obligations beyond seizure, and accident-insurance recovery rules (bc-4327).

## Maintenance and verification

Update values, drill explanations and both `i18n.js` dictionaries together. `offences.js` exports `OFFENCE_ATLAS` (every derived key, item and drill), `alcoholBand`, `applyPointEvent` and `pointsStatus`; `scripts/check_data.mjs` verifies the keys in EN and RU, drill answers and decks, item levels/themes/upgrades, the alcohol thresholds at each boundary and the points arithmetic and caps. The shared recall drill lives in `rule-drill.js`. Refresh `?v=` references in `index.html` and `app.js` after changing served files.

The drill and simulators are author-created and in-memory: they never enter the profile, activity or readiness evidence, and a reload resets them. Language and sync renders keep the sorter theme, hidden/revealed levels, alcohol level and driver type, points history and drill progress.

Browser QA (6 November 2026, sync-disabled copy on a separate origin): desktop 1366 × 900 and phones at 375 and 320 px in EN and RU, light and dark themes, hide/reveal with keyboard advance, alcohol thresholds and driver toggle, points events, caps and cassação lock, drill single scoring and finish screen, mid-drill language switch, topic practice and leave guard, O/I/L shortcuts, print sheet via the print rules, no horizontal overflow and no cloud requests.
