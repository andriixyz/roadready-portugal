# Speed limits page — exam coverage gaps

Research from **8 October 2026**. It compares the study corpus (`public/data/questions-en.json`, 3,910 questions) with the Speed limits page (`speed-limits.js`, `speed.*` keys in `i18n.js`). Nothing was changed in the app. Use this as the backlog when extending the page; see [SPEED-LIMITS.md](SPEED-LIMITS.md) for the current sources and values.

Question IDs are corpus IDs (`bc-<sourceId>`). Answer keys are the corpus's **non-official study key**, and most explanations are unreviewed. Many questions depend on their image, so read the picture before using one as evidence for a rule. Verify every new legal value against the official Código da Estrada and the article 27 table before adding it.

## Scope reviewed

- All 381 questions in topic `Velocidade`.
- About 120 questions in other topics that mention `km/h`, speed limits, minimum/recommended speed, end-of-limit signs or speeding offences.

Reproduce the extraction:

```sh
node -e 'const qs=require("./public/data/questions-en.json").questions;for(const q of qs){const s=q.text.pt+" "+q.answers.map(a=>a.pt).join(" ");if(q.topic==="Velocidade"||/km\/h|velocidade (mínima|máxima|recomendada)|limite de velocidade/i.test(s))console.log(q.id,"|",q.text.en,"||",q.answers.map(a=>(a.key===q.correct?"*":"")+a.key+") "+a.en).join(" ; "))}'
```

## Already covered

| Exam theme | Example IDs | Page location |
| --- | --- | --- |
| Light-vehicle maxima, all four rows (≈60 questions; all values match `LIMITS`) | bc-3282, bc-3303, bc-3304, bc-3312, bc-3346, bc-3353, bc-3532, bc-3588, bc-3601 | Memory map, drill |
| Motorway minimum 50; no general minimum elsewhere | bc-3341, bc-3423, bc-3603, bc-3641, bc-3410 | Trap C, drill `minimum` |
| Motorway access: vehicle must exceed 60 km/h | bc-4811 | Trap C |
| Signs can set lower/higher limits; 120 sign does not lift goods-vehicle 110 | bc-3421, bc-3579, bc-3580, bc-3594, bc-3627, bc-4797 | Trap B, drill `posted` |
| Red ring = maximum, blue circle = minimum, blue square = recommended | bc-2015, bc-2018, bc-4851, bc-4861, bc-2213, bc-2288, bc-3442 | Trap A |
| Town limit same for all light vehicles | bc-3375, bc-3376 | Memory map |
| Adapt to conditions; excessive = cannot stop in clear visible space | bc-3455, bc-4801, bc-3431 | Trap D, drill `weather` |

## Gaps (largest first)

### 1. Other vehicle classes — ≈70 questions, not covered

The page deliberately limits itself to light vehicles, but the exam asks exact numbers for:

- **Heavy passenger / heavy goods**, with and without trailer (≈38): bc-3284, bc-3291, bc-3293, bc-3306, bc-3313, bc-3378, bc-3380, bc-3392, bc-3393, bc-3394, bc-3422, bc-3471, bc-3472, bc-3474, bc-3509, bc-3513, bc-3530, bc-3535, bc-3554 (semi-trailer), bc-3596, bc-3598, bc-3602, bc-3622, bc-3636, bc-3637.
- **Motorcycles (>50 / <50 cm³) and mopeds** (≈20): bc-3337 (sidecar), bc-3340, bc-3589, bc-3624, bc-3648, bc-4853.
- **Tricycles** (9) and **quadricycles** (5) — drivable on a Category B licence (bc-3402), so arguably in scope: bc-3294, bc-3314, bc-3355, bc-3356, bc-3357, bc-3373, bc-3377, bc-3536, bc-3537, bc-3591, bc-3649.
- **Agricultural tractors/machines** (6), including the rear speed panel: bc-3338, bc-3381, bc-3425, bc-3540, bc-3628.
- Traps that need heavy-vehicle numbers: "in towns all cars are always 50" is **false** (bc-3374) because heavy goods with trailer is 40 (bc-3530).

### 2. "Especially moderate speed" places — ≈100 questions, only generic coverage

Trap D mentions bends, crossings and vulnerable people. The exam tests a concrete list (Código art. 25): pedestrian crossings (bc-3288), level crossings (bc-3384, bc-3403), roundabouts (bc-3405, bc-3531), bridges (bc-3350, bc-3645), tunnels (bc-3281, bc-3322, bc-3330), roads lined with buildings (bc-3382, bc-3430), narrowings (bc-3503), steep slopes (bc-3424, bc-3631), poor surface/grip (bc-3406, bc-3428, bc-3487), danger signs (bc-3385, bc-3527), rumble strips (bc-3336), pedestrians/elderly (bc-3351, bc-3400), crosswind (bc-3495), snow (bc-3468), night (bc-3269, bc-3372).

Traps worth teaching explicitly:

- "Moderate on **all** curves?" → No (bc-3391). "All curves, bumps and other places **with reduced visibility**?" → Yes (bc-3635). "Always on a bump?" → No (bc-3324).
- Priority at a junction does not remove the duty to moderate (bc-3297, bc-3300).
- Must moderate even below the posted limit (bc-3319, bc-3368).

### 3. End-of-limit, zone and town-exit signs — ≈15 questions, not covered

- End of maximum / minimum / recommended speed signs: bc-1799, bc-1850, bc-1862, bc-2087, bc-2102, bc-2192, bc-2195, bc-4154.
- Key trap: an end-of-limit sign does **not** mean "no limit" — the general limit applies again (bc-3550); inside a town that is 50 (bc-2137).
- Speed-limited **zone** signs: bc-2074, bc-2130; zone 30 / local limits: bc-3498, bc-1929.
- Town exit sign (page only shows entry N1): bc-3286, bc-3334, bc-3524.

### 4. Lane-specific minimum speeds — ≈8 questions, partial

Per-lane minimum panels (e.g. 90 left, 70 centre, heavy vehicles barred from left lanes): bc-2089, bc-2090, bc-2118, bc-3371, bc-3416, bc-3593, bc-3563, bc-1769. A limit applies to the whole carriageway unless lane-specific (bc-1844). Left lane only for overtaking: bc-3347, bc-3639, bc-1239, bc-2042. The page shows D8 but not lane use.

### 5. Driving too slowly — ≈7 questions, partial

Slow driving that causes undue hindrance is an offence (art. 26); the "minimum" outside towns and in towns is a speed that does not hinder traffic: bc-1372, bc-1428, bc-3279, bc-3349, bc-3410, bc-3412, bc-3502, bc-3519. The page only says there is no general minimum off motorways.

### 6. Speed vs stopping/safety distance — ≈30 questions, not explained

Higher speed or lower grip → longer stopping/braking distance → more following distance; night reduces visibility: bc-3270, bc-3271, bc-3272, bc-3327, bc-3339, bc-3390, bc-3443, bc-3541, bc-3604–bc-3609, bc-3629, bc-3630, bc-3633, bc-1182.

### 7. Small themes (2–5 questions each), not covered

- Temporary (roadworks) signs override the motorway limit: bc-1391, bc-3585.
- Motorway limits may change for adverse weather: bc-3558.
- Emergency vehicles on urgent missions may exceed limits: bc-3559, bc-1250, bc-1340, bc-1322.
- Hazard lights when slowing suddenly: bc-3309, bc-3445.
- Engine braking on descents/slippery roads: bc-3401, bc-3457, bc-3485, bc-3616, bc-3642.
- Do not change speed while being overtaken: bc-3618.
- Speeding offence severity (grave vs muito grave): bc-4908, bc-4925. Thresholds must come from the official article 27 text before being added.

### 8. Wording trap — "can travel at X" ≠ "maximum is X"

Some questions ask which speed is **permitted**, not the maximum, so a value below the limit is correct: bc-3285 (car + trailer outside towns → 60 km/h, because 70 is the maximum and the other options exceed it), bc-3624, bc-3621, bc-1842, bc-1976. The drill only asks "Maximum?".

## Suggested order

1. Extra vehicle-class rows (heavy, motorcycle, tricycle, quadricycle, tractor), e.g. a collapsible second table.
2. An "end of limit / zone / town exit" card.
3. A checklist of especially-moderate places, including the curve/bump traps.
4. Extend Trap C with lane minimums and the slow-driving rule.

Items 1–3 cover roughly 185 corpus questions.
