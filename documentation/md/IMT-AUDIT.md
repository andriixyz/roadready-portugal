# IMT question-bank comparison

Source snapshot fetched **2026-10-02T21:33:06.432Z** from the [official IMT driver-question index](https://www.imt-ip.pt/condutores/obtencao/perguntas-de-exame/).

| App Category B questions | Count |
| --- | ---: |
| Portuguese question/options and image matched automatically | 2094 |
| Portuguese question/options matched; image not confirmed | 1550 |
| Similar image/text candidate; wording or options differ | 79 |
| No accepted match found | 187 |
| Total | 3910 |

The PDFs contain **4880 entries**. **2094** have a full app match and **2786** do not. The driver PDFs include questions beyond Category B. An unmatched PDF entry is **not automatically a missing Category B question**; category applicability and extraction/wording differences require review.

## Meaning of verification

This is an automated comparison of the preserved **Portuguese question, all Portuguese choices, and the road image**. Choice order is ignored because the PDFs and study site may reorder answers. Text normalization only removes PDF wrapping, soft hyphens and typographic apostrophe/hyphen differences. It does not remove accents, punctuation, negatives or numbers. Fuzzy suggestions are reported as differences, never verified matches.

Images are resized to 128×128 RGB and compared using average pixel difference ≤6, 95th-percentile difference ≤18, maximum 16×16 tile average difference ≤16, and aspect-ratio difference ≤2%. This accommodates resizing/JPEG compression; it is **not a manual review or proof of pixel identity**. Borderline/unconfirmed images remain separate from full matches.

This comparison **does not verify the correct-answer key, English/Russian translations, current legal correctness, complete Category B coverage, or the exact questions in a future examination**. Existing question-specific reviewed explanations remain a separate form of review.

## Sources

| Group | Pages | Entries | Entries with full app match | Source |
| --- | ---: | ---: | ---: | --- |
| 1 | 57 | 399 | 201 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_1_condutores.pdf) |
| 2 | 58 | 400 | 181 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_2_condutores.pdf) |
| 3 | 15 | 104 | 0 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_3_condutores.pdf) |
| 4 | 57 | 399 | 175 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_4_condutores.pdf) |
| 5 | 58 | 400 | 169 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_5_condutores.pdf) |
| 6 | 58 | 400 | 147 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_6_condutores.pdf) |
| 7 | 58 | 400 | 155 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_7_condutores.pdf) |
| 8 | 58 | 400 | 214 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_8_condutores.pdf) |
| 9 | 58 | 400 | 217 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_9_condutores.pdf) |
| 10 | 58 | 400 | 148 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_10_condutores.pdf) |
| 11 | 58 | 400 | 158 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_11_condutores.pdf) |
| 12 | 58 | 400 | 152 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_12_condutores.pdf) |
| 13 | 31 | 212 | 84 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_13_condutores.pdf) |
| 14 | 24 | 166 | 93 | [PDF](https://www.imt-ip.pt/wp-content/uploads/IMTT/Portugues/Condutores/PerguntasExames/Documents/rel_14_condutores.pdf) |

PDF byte hashes, the index hash, image metrics, page/row references and the corpus fingerprint are recorded in [the verification manifest](../../public/data/imt-verification.json). The app rejects metadata for a different Portuguese corpus. Cached PDFs and extracted comparison details are under `tmp/imt-audit/` and are not published.

## Review files

- [All app questions, status and candidate PDF locations](../data/imt-app-comparison.csv)
- [All PDF entries and matching app IDs](../data/imt-pdf-comparison.csv)

Do not infer answer-letter equivalence across sources; compare answer text. Do not change corpus IDs, Portuguese wording, option order or the study key based on a fuzzy suggestion.
