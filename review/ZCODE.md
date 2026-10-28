# ZCode run: review every question

Goal: one checked result file in `review/results/` for each of the 3,910 questions. Each result records what the image shows, an independent answer, whether it agrees with the study key and a short EN/PT/RU explanation with its legal source.

You are the orchestrator. You only hand packets to subagents and check their files. Do not edit app code, build, install packages, import results or commit.

## Before starting

1. `ls public/images/questions | wc -l` must print `3910`. If it does not, run `npm run images` once (it needs the network).
2. Make sure the subagent model can see images: do the first round with `node scripts/review_queue.mjs next 1` and a single subagent, and read its reply. If it replies `NO-IMAGE`, stop and tell the owner.

## Loop

1. Run `node scripts/review_queue.mjs next 10`. It prints up to ten packet paths, such as `review/queue/bc-1103.md`, and writes those packets.
2. Start one subagent per path, in parallel, with this prompt:

   > Read review/AGENT.md and follow it for review/queue/bc-1103.md. Reply with one line.

3. When all have replied, run `node scripts/review_queue.mjs check`. For each `INVALID <id>: <errors>` line, start one subagent:

   > Read review/AGENT.md. Fix review/results/<id>.json for review/queue/<id>.md. The checker reported: <errors>. Reply with one line.

   Give each file at most two repair attempts, then leave it; the owner will see it in the import report.
4. Repeat from step 1 until `next` prints `Nothing left to review.`
5. Run `node scripts/review_queue.mjs status`, report its output and stop.

If three subagents in a row reply `NO-IMAGE`, stop and tell the owner.

## Notes

- Give each subagent one packet and nothing else. Do not paste law files into prompts; subagents search `review/law/` themselves.
- The run can stop and resume at any time. `next` skips every question that already has a result file or a reviewed explanation.
- To run several ZCode sessions at once, give each one its own shard and add it to every `next` call: `node scripts/review_queue.mjs next 10 --shard 1/4`, `--shard 2/4`, and so on. Never give two sessions the same shard.
- Budget: 300 million tokens for 3,910 questions is about 75,000 tokens per question, including searches and repairs.

## After the run (owner, not ZCode)

`node scripts/review_queue.mjs import` folds the valid results into `scripts/reviewed-explanations.json`. It holds back disagreements and lists them, with invalid files and translation notes, in `review/import-report.md`. Then refresh and check the corpus as described in `documentation/md/PROJECT.md`.
