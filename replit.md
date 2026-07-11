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
