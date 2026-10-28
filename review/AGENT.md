# Review one question

You review exactly one question packet, `review/queue/<id>.md`, and write exactly one file, `review/results/<id>.json`. Do not edit any other file. Do not build, install, commit or change app code.

## Steps

1. Read the packet. The **Portuguese** wording is the original exam text. The English and Russian versions are machine translations and can be wrong.
2. Open the image named in the packet and look at it. If you cannot see it (tool error or no image support), stop: write nothing and reply `<id> NO-IMAGE`.
3. Answer the question yourself from the Portuguese wording, the image and the law.
4. Find the rule in the local law files first. Start with the packet's "Where to look first" line, then search, for example:
   - `rg -n "ultrapassagem" review/law/codigo-da-estrada.md`
   - `rg -n "^## Artigo 41.º" -A 25 review/law/codigo-da-estrada.md`
   - `rg -n "^\| C13 " review/law/sign-codes.md`

   Use a web search only when the local files do not cover the question. Cite only a source you actually read.
5. Compare your answer with the study key and fill `modelAnswer` and `keyCheck`.
6. Write the explanation in English, European Portuguese and Russian. Always explain the **study key** answer.
7. Choose `source`, save the JSON and run `node scripts/review_queue.mjs check <id>`. Fix every reported problem and run it again until it prints `OK <id>`. After three failed attempts, stop.
8. Reply with one line: `<id> OK agree`, `<id> OK disagree`, `<id> OK unsure` or `<id> INVALID <reason>`.

## Fields

| Field | What to write |
| --- | --- |
| `id` | The packet's id, unchanged. |
| `imageNote` | 1–2 English sentences (10–400 characters) on what matters in the picture: signs and their codes when you are sure, road layout, vehicles, lights, markings, your position. If the picture is only decorative, say so. |
| `modelAnswer` | Your own answer key, such as `"B"`. |
| `keyCheck` | `"agree"` when your answer equals the study key. `"disagree"` only when you are confident the key is wrong or outdated. `"unsure"` when two options are defensible, the image is unclear or the law may have changed. |
| `keyCheckNote` | Required unless `agree`: 1–3 English sentences explaining the doubt, with the article. Otherwise `""`. |
| `source` | One key from the table below. |
| `en`, `pt`, `ru` | The explanation, one paragraph each (40–700 characters, no line breaks, no Markdown). |
| `translationNotes` | `""`, unless the English or Russian question/options change the Portuguese meaning. Then describe it in English, for example `RU option B is cut short; it should say "Я не должен уступать дорогу."`. Do not report style. |
| `sourceUrl` | Optional. Only for an official page you opened that is more specific than the source key, such as a Portaria on diariodarepublica.pt. Leave it out otherwise. |

## Sources

| `source` | Use for | Local file |
| --- | --- | --- |
| `ce` | Código da Estrada: traffic rules, priority, speed, manoeuvres, parking, lights, passengers, alcohol offences, licences, fines, points | `review/law/codigo-da-estrada.md` |
| `rst` | Regulamento de Sinalização do Trânsito: every sign, road marking and traffic light | `review/law/regulamento-sinalizacao-transito.md`, codes in `review/law/sign-codes.md` |
| `rhlc` | Regulamento da Habilitação Legal para Conduzir: licence categories, validity, medical fitness, exams | `review/law/regulamento-habilitacao-legal-conduzir.md` |
| `lei18-2007` | How alcohol and drug tests are carried out | `review/law/lei-18-2007-alcool-substancias.md` |
| `cp` | Crimes: drink-driving at 1.2 g/l or more, dangerous driving, failure to help, driving bans | `review/law/codigo-penal-excertos.md` |
| `general` | Only when the answer follows from vehicle physics, physiology, first aid or plain safe-driving sense and no article states it | — |

Do not use `general` to skip a lookup: speed, priority, signs, markings, overtaking, parking, lights, alcohol limits and licences all have articles.

## Writing the explanation

- 2–4 short sentences. Say why the study-key answer is right, using what the image shows. When it helps, say why the most tempting wrong option is wrong.
- Give concrete values (50 km/h, 0.5 g/l, 100 m) and sign codes (C13, B2) when you are sure of them.
- Do not start with "The correct answer is" or "Study key answer", and do not mention the packet, the study key or yourself.
- The three languages say the same thing. Use European Portuguese (condutor, ultrapassagem, faixa de rodagem), not Brazilian forms.
- When you `disagree` or are `unsure`, still explain the study-key answer, then add one sentence on why it is doubtful.
- Keep law names in Portuguese in all three languages. Unless `source` is `general`, end each paragraph with the citation:

| Language | One article | Several articles |
| --- | --- | --- |
| `en` | `Código da Estrada, Article 65(1).` | `Código da Estrada, Articles 64(1) and 65(1).` |
| `pt` | `Código da Estrada, artigo 65.º, n.º 1.` | `Código da Estrada, artigos 64.º, n.º 1, e 65.º, n.º 1.` |
| `ru` | `Código da Estrada, статья 65(1).` | `Código da Estrada, статьи 64(1) и 65(1).` |

For signs write, for example, `Regulamento de Sinalização do Trânsito, Article 19.` / `artigo 19.º.` / `статья 19.` A `general` explanation has no citation.

## Example

Packet `bc-1103`: "A ambulância assinala adequadamente a marcha de urgência." A) Devo ceder a passagem. B) Não devo ceder a passagem. Study key A.

```json
{
  "id": "bc-1103",
  "imageNote": "Town street seen from the driver's seat; an ambulance stands on the right-hand side, angled towards the road ahead.",
  "modelAnswer": "A",
  "keyCheck": "agree",
  "keyCheckNote": "",
  "source": "ce",
  "en": "An ambulance that properly signals its urgent mission with its special lights and siren must be given way by every other driver, even when it is pulling out from the side of the road as here. Código da Estrada, Articles 64(1) and 65(1).",
  "pt": "Uma ambulância que assinala adequadamente a marcha de urgência, com os avisadores luminosos e sonoros especiais, tem de ter a passagem cedida por qualquer condutor, mesmo quando sai da berma, como aqui. Código da Estrada, artigos 64.º, n.º 1, e 65.º, n.º 1.",
  "ru": "Машине скорой помощи, которая надлежащим образом обозначает срочную поездку специальными световыми и звуковыми сигналами, любой водитель обязан уступить дорогу, даже если она выезжает с обочины, как здесь. Código da Estrada, статьи 64(1) и 65(1).",
  "translationNotes": "EN question \"signals the emergency route\" means \"signals that it is on an urgent mission\"; RU option B is cut short (\"Я не должен уступать дорогу.\")."
}
```
