# Anki Card Manager

A React Native / Expo mobile app for managing Anki-style flashcard decks, backed by Firebase Firestore.

## Stack

- **Mobile app**: Expo (React Native) — `artifacts/anki-manager/`
- **API server**: Express + Drizzle ORM — `artifacts/api-server/`
- **Storage**: Firebase Firestore (credentials baked into `google-services.json` and `app.json`)

## Running locally on Replit

Dependencies are managed with **pnpm** (monorepo via `pnpm-workspace.yaml`).

Install all dependencies from the repo root:
```bash
pnpm install
```

Start the Expo dev server (via the configured workflow):
```
artifacts/anki-manager: expo
```

The app runs as a web preview via Expo's web renderer. Scan the QR code shown in logs with **Expo Go** on a physical device for native mobile preview.

## Firebase

Firebase config is read from (in order of priority):
1. `EXPO_PUBLIC_FIREBASE_*` environment variables
2. `expo.extra.*` in `artifacts/anki-manager/app.json`
3. `artifacts/anki-manager/google-services.json`

No additional setup is needed — credentials are already committed.

## User preferences

- Keep the existing monorepo structure (pnpm workspaces)
- Maintain the Expo + Firebase stack

## Setup notes (imported project)

- On import, `artifacts/app` was a duplicate/older copy of `artifacts/anki-manager` (not wired into any workflow) and was removed. Root-level `App.tsx`, `app.json`, `android/`, `eas.json` were leftover pre-monorepo files (the app now lives fully under `artifacts/anki-manager`) and were removed too. `lib/` at the repo root is unrelated — it holds shared workspace packages (`api-client-react`, `api-spec`, `api-zod`, `db`) used by `artifacts/api-server`, and was kept.
- Verified working: `pnpm install`, then the `artifacts/anki-manager: expo` workflow starts Metro/Expo web on port 18947 and serves the app (confirmed via screenshot — "Meus Baralhos" empty state renders).
