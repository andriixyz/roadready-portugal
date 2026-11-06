# Distances atlas — research notes and exam coverage

Official sources checked **6 November 2026**. The page (`distances.js`, `distance.*` keys in `i18n.js`, route `#distances`) collects every distance in metres that the Category B bank asks about. It does not reproduce official exam questions.

## Primary sources

- [Consolidated Código da Estrada](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-116041830) (last amended 12 March 2025): articles 18–19, 38–41, 45–51, 56, 60–61, 72–74, 88, 101 and 163–164, read from `review/law/codigo-da-estrada.md`.
- [Regulamento de Sinalização do Trânsito](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-regulamentar/1998-169035729): articles 20, 22, 24 (C7–C10), 36 (I9), 44 (O2–O4), 46–47 (panels), 64 (M21) and 96 (roadworks), read from `review/law/regulamento-sinalizacao-transito.md`.

## Values used

Stopping and parking, measured along the direction of travel (art. 49–51):

| Place | Rule | Scope |
| --- | --- | --- |
| Pedestrian or cycle crossing | On it and less than 5 m before it | Stop and park (on it: serious, art. 145/1 o) |
| Crossroads, junction, roundabout | Less than 5 m either side; never inside a roundabout | Stop and park |
| Bus stop sign | Less than 25 m behind (“para trás”) and 5 m ahead (“para a frente”) | Stop and park |
| Tram stop sign | Less than 6 m behind | Stop and park |
| Sign or light hidden by the vehicle and load | Less than 20 m before it | Stop and park |
| Level crossing | No stopping on it; no parking less than 10 m either side (art. 50/1 d) | Park |
| Filling station | Less than 5 m either side (art. 50/1 e) | Park |
| Continuous line | Gap between line and vehicle under 3 m | Stop and park |
| Outside towns: junctions, roundabouts, bends, crests with poor visibility | Less than 50 m either side; on the carriageway very serious (art. 146 a, which lists junctions, bends and crests) | Stop and park |

Distances count from the start or end of a bend or crest, otherwise from the extended edge of the crossing road (art. 51). Abusive parking (art. 163): 30 days in a free place, 5 days of unpaid car-park fees, 2 hours past paid or permitted time (immediately if never paid), 48 hours for visibly abandoned vehicles, 72 hours for unhitched trailers, machines and advertising vehicles (30 days in their own parks).

While driving: following distance has no figure — enough to stop (art. 18/1); 1.5 m lateral to cyclists (art. 18/3) and when overtaking cyclists or passing pedestrians on the shoulder (art. 38/2 e); 50 m for slow heavy, agricultural and similar vehicles outside towns on one-lane-each-way roads (art. 40); insufficient visibility below 50 m of full carriageway width (art. 19); pedestrians use a crossing less than 50 m away (art. 101/3); heavy goods vehicles and combinations over 7 m use only the two right lanes of 3+ lane motorways (art. 74); reversing over the shortest possible distance, no figure (art. 46).

Lights and triangle: main beam at least 100 m, dipped up to 30 m (art. 60/1); dip within 100 m of the vehicle ahead and when meeting others; side lights when a stopped vehicle is not recognisable at 100 m; dipped beam where lighting gives at least 100 m (art. 61/1); triangle at least 30 m behind, visible from 100 m, vest on, required whenever stopped on the carriageway or shoulder (art. 88).

Signs and sizes: danger signs 150–300 m before the danger, otherwise a distance panel (RST art. 20/1); B1 at most 50 m from the junction outside towns and 25 m in towns (art. 22/2); B7–B9 150–300 m (art. 22/7); I9 level-crossing bars 100 m each (art. 36); O4 exit bars 250 m on motorways and 150 m elsewhere (art. 44); O2 kilometre and O3 10 km posts (art. 44); model 1 distance panel versus model 2 extension panel (art. 46); first roadworks sign 600 m (motorways) or 400 m before, reducible to 150 m outside and 30 m inside towns, end sign 100 m after (art. 96); C7–C9 forbid vehicles longer, wider or taller than the figure (art. 24); loads at most 4 m above the ground (CE art. 56/3 f).

### Study-bank figures not found in the checked texts

Shown in a dashed “study-bank figure” box: side lights visible at 150 m at night (bc-4469), a lit rear plate readable at 20 m (bc-4426, bc-4612), reversing light reach of at most 10 m (bc-4464, bc-4716) and rear marker plates for vehicles over 12 m (bc-2432, bc-2628). They belong to vehicle-equipment rules that are not in `review/law/`; secondary sources agree with the first three. Confirm against the official lighting regulation before removing the label.

## Study bank versus current law

- bc-4312 and bc-4324 key the triangle as required when the stopped vehicle “is not visible from 100 m”. Current art. 88(2) requires it whenever the vehicle is stopped on the carriageway or shoulder or has dropped its load there. The page states the current rule and notes the bank wording.
- bc-2754 (“prohibited to stop 30 m before a blind bend”) and bc-2790 (30 m from a junction) are consistent with the 50 m outside-towns rule rather than a separate 30 m rule.

## Exam coverage

Reproduce the review list:

```sh
node -e 'const qs=require("./public/data/questions-en.json").questions;const re=/metros|\d\s?m\b|dist[âa]ncia|\bkm\b(?!\/h)/i;for(const q of qs){const s=q.text.pt+" "+q.answers.map(a=>a.pt).join(" ");if(re.test(s))console.log(q.id,"|",q.text.pt)}'
```

All 344 distance questions and the whole Stopping, parking & passing vehicles topic (205) were reviewed.

| Theme | Example IDs | Page location |
| --- | --- | --- |
| Crossings and junctions | bc-2747, bc-2775, bc-2778, bc-2789, bc-2791, bc-2799, bc-2835, bc-2933, bc-3023 | 01 ruler, drills `crossing`, `junction` |
| Bus and tram stops | bc-2281, bc-2744, bc-2749, bc-2751–bc-2753, bc-2850, bc-2905, bc-2909, bc-2921 | 01 ruler, drills `busBehind`, `busAhead`, `tram` |
| Hidden signs, level crossings, fuel, continuous line | bc-2774, bc-2932, bc-2798, bc-3022, bc-2907, bc-2919, bc-2934 | 01 ruler |
| Outside towns 50 m | bc-2750, bc-2754, bc-2756, bc-2790, bc-2841 | 01 ruler, drill `rural`, offences page |
| Abusive parking clocks | bc-2764–bc-2767, bc-2846, bc-2879, bc-2890, bc-2906, bc-2940, bc-4909, bc-5012 | 01 clocks, drills `abandoned`, `free` |
| Following distance has no figure | bc-1125, bc-1138, bc-1390, bc-1424, bc-2637, bc-2675 | 02 card, drill `follow` |
| Slow heavy vehicles 50 m | bc-1243, bc-1342, bc-4778, bc-4779 | 02 card, drill `slow` |
| C10 and safety chevrons | bc-1790, bc-1848, bc-1895, bc-1898, bc-1938, bc-1951, bc-2012, bc-2384 | 02 card |
| Visibility and pedestrians 50 m | bc-1215, bc-3395, bc-4776, bc-4302, bc-1351 | 02 cards, drills |
| Long vehicles on motorways | bc-4786, bc-4810, bc-4855 | 02 card |
| Lights 30/100 m and dipping | bc-2402, bc-4459, bc-4460, bc-4463, bc-4486, bc-4487, bc-4664, bc-4665, bc-4712, bc-4725, bc-2435, bc-2483, bc-2626 | 03 bars, drills |
| Triangle 30/100 m | bc-4284–bc-4286, bc-4312, bc-4317, bc-4318, bc-4324, bc-4352–bc-4356, bc-4652, bc-2946 | 03 bars and facts, drills |
| Danger-sign and give-way placement | bc-1439, bc-1474, bc-1596, bc-1718 | 04 cards, drills `danger`, `giveWay` |
| Level-crossing and exit countdowns | bc-1488, bc-1494, bc-1684, bc-2149, bc-2167, bc-2206, bc-2282, bc-2283, bc-2287, bc-2433, bc-2434, bc-4852 | 04 countdown markers, drills |
| Distance versus extension panels | bc-1440, bc-1442, bc-1523, bc-1614, bc-2291 | 04 card, drill `panel` |
| Height, width and length signs, load height | bc-1806, bc-1851, bc-1885, bc-1887, bc-1892, bc-1894, bc-1896, bc-1941, bc-1961, bc-1994, bc-2022, bc-4321, bc-4520 | 04 cards, drills `load`, `height` |
| Cyclist lateral distance | bc-1395, bc-4452, bc-4687, bc-4735 | 02 card, drill `cyclist` |

Outside the page: speed and stopping-distance concepts (on the Speed limits page), image-only service-sign distances (fuel, telephone, service areas), percentage gradients and kilometre readings that the sign shows directly, and the rule for which vehicle reverses on narrow roads (no metre figure).

## Maintenance and verification

`distances.js` exports `DISTANCE_ATLAS` (landmarks, beams, countdowns, drills and every derived key). `scripts/check_data.mjs` checks both dictionaries, drill answers and decks, landmark scopes and plausible metre values. The diagrams are not to scale. Hide mode removes every metre value and the helper text that repeats it. Page state (selected place, hidden metres, drill) survives language and sync renders and resets on reload; drill answers never enter the profile.

Browser QA (6 November 2026) is recorded in [OFFENCES.md](OFFENCES.md#maintenance-and-verification); the same sessions covered this page, including every landmark diagram, hide mode, the beam scale at 320 px and the print sheet.
