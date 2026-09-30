# RoadReady Portugal

English- and Russian-language study app for the Portuguese IMT Category B theory exam, with the Portuguese source wording available for every question.

## Run locally

```bash
npm run images
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Use a local HTTP server or the deployed site, not a `file://` URL. The first image preparation downloads the public question pictures; subsequent runs reuse the local cache.

## Copy a question into ChatGPT

During a quiz, press **Ask ChatGPT** to copy the screenshot and open ChatGPT in a new tab, then paste it into the composer. If the browser blocks the new tab, use the **Open ChatGPT** link shown below the button. The image is not attached or sent automatically. **Copy image for ChatGPT** remains available if you want to paste into an existing chat instead.

Both buttons copy one PNG containing the full road image, the current question wording, and all answer options in the selected question language. Correct-answer highlights, explanations, progress, and the private device link are not included.

Image clipboard access needs a supported browser and HTTPS (or localhost). If it is unavailable or denied, **Download question image** lets you save the same PNG and attach it manually. Question images are bundled with the static deployment to avoid cross-origin canvas restrictions; no screenshot proxy or ChatGPT API account is used.

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

There is no sign-in or account. A random private device key is generated automatically and saved in this browser. Supabase stores a hash of that key and the study profile, not an email address or a password. Only possession of the private key allows reading or updating that profile.

To connect your phone and Mac, open **Your profile → Link another device**, copy/share the private link, and open it once on the other device. The key is imported and immediately removed from the address bar. From then on both devices sync automatically on changes, reconnect, and return to the app. Keep this link private.

Concurrent updates use revision checks; answer counters are tracked per device so offline answers can be combined without double-counting. Resetting progress creates a new history generation so older devices cannot restore erased results. Use **Export backup** for recovery; the backup includes the private key and must also be kept private.

### One-time Supabase setup

1. Run [`supabase/personal-sync.sql`](supabase/personal-sync.sql) in the Supabase SQL Editor.
2. Keep the browser-safe project URL and publishable key in `supabase-config.js`. Never put a device key, database password, or service-role/secret key in the repository.
3. Deploy the app and open it on the device holding your existing progress. Link your second device using the private link.

No Authentication provider or redirect configuration is needed. The storage table is in the non-exposed `private` schema, has RLS enabled, and denies direct access to browser roles. The only exposed operations are key-scoped read/write functions. They cannot list profiles. Profile payloads are limited to 2 MiB and 100 sessions. The public publishable key is not the private device key.

If a database password has ever been shared in chat or committed to a repository, rotate it yourself in the Supabase dashboard. This app does not need or use that password.

This intentionally lightweight personal-app design allows visitors to create their own isolated random-key profile; it is not a public multi-user service with abuse prevention. Never weaken the table permissions to allow anonymous listing or unrestricted writes.

The previous `public.roadready_profiles` table is left untouched for recovery. Existing browser progress migrates automatically; cloud-only legacy progress can be recovered through an old backup or the Supabase dashboard. `supabase/schema.sql` is retained only as the legacy auth schema.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Run **Deploy RoadReady to GitHub Pages** from the Actions tab, or push another commit to `main`.
4. Open the deployment URL shown by the workflow on your phone and add it to the home screen if desired.

The included workflow validates all question data before publishing. All app paths are relative, so deployment under `username.github.io/repository-name/` works without configuration changes.
