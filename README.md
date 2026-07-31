# RoadReady Portugal

English- and Russian-language study app for the Portuguese IMT Category B theory exam, with the Portuguese source wording available for every question.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Data pipeline

- `npm run scrape` builds the Category B corpus from public Bom Condutor study pages and preserves their source URLs and non-official study answer key.
- `npm run translate` adds an English machine translation while preserving every Portuguese source string.
- `npm run explain` regenerates a concise English/Portuguese study note for every correct answer.
- `npm run translate:ru` builds the compact Russian overlay. It resumes interrupted runs, validates the source hash and answer keys, and applies reviewed road-terminology corrections and Russian topic guidance.
- `npm run check` validates all 3,910 IDs, the English/Portuguese corpus, 18,931 Russian fields, answer keys, and every interface translation key.

The Russian overlay is loaded only when Russian is selected, which keeps the initial mobile download smaller. The app language and the question language are stored separately: the full interface supports English and Russian, while each question can be viewed in English, Russian, or the Portuguese original.

The app links separately to the 14 driver PDF groups published by IMT and clearly distinguishes those documents from the Bom Condutor study corpus and its non-official answer key. IMT does not publish the official solutions.

## Progress storage and cross-device sync

The app is local-first: answer history, spaced-repetition dates, mock results, language preference and study statistics are saved to `localStorage` immediately and remain available offline.

When signed in, the local profile is merged into a private Supabase row and shared with other signed-in devices. Use **Your profile → Export backup** for an independent JSON backup.

### One-time Supabase setup

1. Reset any previously shared database password in **Supabase Dashboard → Database → Settings**.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
3. In **Authentication → URL Configuration**, set the Site URL to `https://andriixyz.github.io/roadready-portugal/` and add the same address as an allowed redirect URL.
4. Copy the project's browser-safe publishable key into `supabase-config.js`. Never put the database password or a `service_role`/secret key in this repository.
5. Deploy, sign in once with your email, and then disable new-user signups if this should remain a single-user cloud account.

The publishable key and project URL are intentionally visible in the static site. Row Level Security restricts every profile row to its authenticated owner.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Run **Deploy RoadReady to GitHub Pages** from the Actions tab, or push another commit to `main`.
4. Open the deployment URL shown by the workflow on your phone and add it to the home screen if desired.

The included workflow validates all question data before publishing. All app paths are relative, so deployment under `username.github.io/repository-name/` works without configuration changes.
