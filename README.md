# RoadReady Portugal

English-first study app for the Portuguese IMT Category B theory exam.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Data pipeline

- `npm run scrape` builds the Category B corpus from public question pages that identify IMT questions and expose a study answer key.
- `npm run translate` adds an English machine translation while preserving every Portuguese source string.
- `npm run explain` regenerates a concise bilingual study note for every correct answer.
- `npm run check` validates IDs, bilingual fields, choices, and answer keys.

The app clearly distinguishes official IMT questions from the non-official study answer key. IMT publishes 14 driver PDF groups but does not publish the official solutions.

## Private local storage

All personal information stays in the browser's `localStorage`: answer history, spaced-repetition dates, mock results, language preference and study statistics. The app sends no personal data to a backend and contains no database credentials.

Use **Your profile → Export backup** to download progress as JSON. Import that file to restore progress after changing devices or clearing browser storage. Keep using the same browser and GitHub Pages URL; private/incognito browsing does not preserve data reliably.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Run **Deploy RoadReady to GitHub Pages** from the Actions tab, or push another commit to `main`.
4. Open the deployment URL shown by the workflow on your phone and add it to the home screen if desired.

The included workflow validates all question data before publishing. All app paths are relative, so deployment under `username.github.io/repository-name/` works without configuration changes.
