# Speed limits page — exam coverage

Research from **8 October 2026**, updated the same day after the speed-atlas redesign. It compares the study corpus (`public/data/questions-en.json`, 3,910 questions) with the Speed limits page (`speed-limits.js`, `speed.*` keys in `i18n.js`). Use it as the backlog when extending the page; see [SPEED-LIMITS.md](SPEED-LIMITS.md) for the sources and values.

Question IDs are corpus IDs (`bc-<sourceId>`). Answer keys are the corpus's **non-official study key**, and most explanations are unreviewed. Many questions depend on their image, so read the picture before using one as evidence for a rule. Verify every new legal value against the official Código da Estrada and the article 27 table before adding it.

## Scope reviewed

- All 381 questions in topic `Velocidade`.
- About 120 questions in other topics that mention `km/h`, speed limits, minimum/recommended speed, end-of-limit signs or speeding offences.

Reproduce the extraction:

```sh
node -e 'const qs=require("./public/data/questions-en.json").questions;for(const q of qs){const s=q.text.pt+" "+q.answers.map(a=>a.pt).join(" ");if(q.topic==="Velocidade"||/km\/h|velocidade (mínima|máxima|recomendada)|limite de velocidade/i.test(s))console.log(q.id,"|",q.text.en,"||",q.answers.map(a=>(a.key===q.correct?"*":"")+a.key+") "+a.en).join(" ; "))}'
```

## Covered on the page

| Exam theme | Example IDs | Page location |
| --- | --- | --- |
| Light-vehicle maxima, all four rows (≈60 questions) | bc-3282, bc-3303, bc-3304, bc-3312, bc-3346, bc-3353, bc-3532, bc-3588, bc-3601 | 01 garage (car, van, trailer), full table, drill `numbers` |
| Heavy passenger / heavy goods, with and without trailer, semi-trailer (≈38) | bc-3284, bc-3291, bc-3293, bc-3306, bc-3313, bc-3374, bc-3378, bc-3380, bc-3392, bc-3393, bc-3394, bc-3422, bc-3471, bc-3472, bc-3474, bc-3509, bc-3513, bc-3530, bc-3535, bc-3554, bc-3596, bc-3598, bc-3602, bc-3622, bc-3636, bc-3637 | 01 garage (bus, truck), memory cues, motorway ladder, drills `bus`, `truckTown` |
| Motorcycles over/up to 50 cm³, sidecar, mopeds (≈20) | bc-3337, bc-3340, bc-3589, bc-3624, bc-3648, bc-4853 | 01 garage (two motorcycle classes, moped), barred roads, drill `moped` |
| Tricycles and quadricycles (14) | bc-3294, bc-3314, bc-3355, bc-3356, bc-3357, bc-3373, bc-3377, bc-3402, bc-3536, bc-3537, bc-3591, bc-3649 | 01 garage (tricycle, moped or quadricycle), drill `tricycle` |
| Agricultural tractors and machines (6) | bc-3338, bc-3381, bc-3425, bc-3540, bc-3628 | 01 garage (tractor, machine), drill `tractor` |
| Shared zone 20 and leaving rule | bc-3455 context, H46 questions | 01 shared-zone row, 02 sign `shared`, drill `shared` |
| Motorway minimum 50; no numeric minimum elsewhere; slow driving offence (≈15) | bc-1372, bc-1428, bc-3279, bc-3341, bc-3349, bc-3410, bc-3412, bc-3423, bc-3502, bc-3519, bc-3603, bc-3641 | 04 card A, drills `minimum`, `slow` |
| Motorway access: must exceed 60 km/h; barred classes | bc-4811, bc-4853 | 04 card A, 02 sign `motorway`, ladder "never on a motorway" |
| Signs can set lower/higher limits; vehicle limit still applies | bc-3421, bc-3579, bc-3580, bc-3594, bc-3627, bc-4797 | 02 sign `max`, 04 card C, drill `posted` |
| Red ring / blue circle / blue square | bc-2015, bc-2018, bc-4851, bc-4861, bc-2213, bc-2288, bc-3442, bc-1842, bc-1976 | 02 signs `max`, `min`, `advisory` |
| End of maximum / minimum / recommended speed (≈10) | bc-1799, bc-1850, bc-1862, bc-2087, bc-2102, bc-2192, bc-2195, bc-4154, bc-3550, bc-2137 | 02 signs `endMax`, `endMin`, `endAdvisory`, drill `endLimit` |
| Speed-limited zones and zone 30 | bc-2074, bc-2130, bc-3498, bc-1929 | 02 signs `zone`, `endZone`, drill `zone` |
| Town entry and exit | bc-3286, bc-3334, bc-3524 | 02 signs `townIn`, `townOut`, drill `townExit` |
| Lane-specific minimums; left lane for overtaking; heavy vehicles barred (≈12) | bc-2089, bc-2090, bc-2118, bc-3371, bc-3416, bc-3593, bc-3563, bc-1769, bc-1844, bc-2042, bc-3347, bc-3639, bc-1239 | 02 sign `lanes`, 04 card A, drill `lane` |
| "Especially moderate" places (≈100) | bc-3288, bc-3384, bc-3403, bc-3405, bc-3531, bc-3350, bc-3645, bc-3281, bc-3322, bc-3330, bc-3382, bc-3430, bc-3503, bc-3424, bc-3631, bc-3406, bc-3428, bc-3487, bc-3385, bc-3527, bc-3336, bc-3351, bc-3400, bc-3495, bc-3468, bc-3269, bc-3372 | 03 twelve scenes |
| Moderation traps: all curves / bumps / priority / below the limit / night / heavy only | bc-3391, bc-3635, bc-3324, bc-3297, bc-3300, bc-3319, bc-3368, bc-3269, bc-3372, bc-3424 | 03 lightning round, drill `curves` |
| Adapt to conditions; excessive = cannot stop in the visible space | bc-3455, bc-4801, bc-3431 | 05 heading, drill `weather` |
| Speed vs stopping and following distance, grip, night (≈30) | bc-3270, bc-3271, bc-3272, bc-3327, bc-3339, bc-3390, bc-3443, bc-3541, bc-3604–bc-3609, bc-3629, bc-3630, bc-3633, bc-1182 | 05 slider and facts, drill `grip` |
| Engine braking, hazard lights when slowing suddenly, being overtaken | bc-3401, bc-3457, bc-3485, bc-3616, bc-3642, bc-3309, bc-3445, bc-3618 | 05 facts |
| Temporary signs override; motorway limits may change for weather | bc-1391, bc-3585, bc-3558 | 02 sign `temporary`, 04 card C, drill `temporary` |
| Emergency vehicles may exceed limits | bc-3559, bc-1250, bc-1340, bc-1322 | 04 card C, drill `emergency` |
| Speeding severity (grave vs muito grave) | bc-4908, bc-4925 | 04 card B, drill `severity` |
| "Can travel at X" ≠ "maximum is X" | bc-3285, bc-3624, bc-3621, bc-1842, bc-1976 | drill `permitted`, sign `advisory` trap |

## Still outside the page

- **Image-dependent road identification.** Many questions only say "this road"; the answer depends on recognising a motorway, reserved road or town in the picture. The page teaches the road cues (N1a, H24, H25) but cannot replace reading the image.
- **Exact fines beyond the three bands.** The page shows the article 27(2) bands for light cars and motorcycles and says other vehicles reach each band at half the excess; it does not list every amount for every vehicle.
- **Industrial machines** and the registered/unregistered distinction are omitted from the table on purpose.
- **Lane-panel sign code.** The per-lane minimum panel is drawn as a cue without a regulation code.
- **Art. 25 grouping.** The twelve scenes merge some lettered items (for example roads lined with buildings with towns). The drill and lightning round use the law's wording where the exam tests it.

## Suggested next steps

1. If the corpus gains speeding-fine questions for heavy vehicles, add the second band table from article 27(2)(b).
2. If image recognition remains the main error source in the Speed topic, add a "which road is this?" photo cue gallery from the corpus images, keeping question IDs and source attribution.
