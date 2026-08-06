# PolyCards

Custom multilingual flashcards with browser text-to-speech. Fully client-side: no backend,
no API keys, no network calls at runtime. Deck and settings live in `localStorage`.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
Repo Settings -> Pages -> Source must be set to **GitHub Actions**.

The app is served from a project subpath, so `base` in `vite.config.ts` must match the repo
name (`/polyglot-cards/`). Rename the repo and that value has to change with it.

## iPhone

Open the Pages URL in Safari, then Share -> Add to Home Screen. It installs as a PWA:
opens without the browser chrome and works offline (fonts and CSS are self-hosted and
precached; iOS speech voices are on-device).

For Japanese audio, the `ja-JP` voice must be installed under iOS Settings ->
Accessibility -> Spoken Content -> Voices.

## CSV format

Settings -> Import CSV. The first row is the header; column names drive the card layout —
`Phrase` is what gets spoken, `IPA` and any `* Translation` column get their own styling.
