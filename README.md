# Gemini Final Prompt Pro — Firebase Edition

This package adds:
- Google Login via Firebase Auth
- Admin approval workflow
- Prompt history in Firestore
- Frontend Gemini API prompt generator

## Project structure

- `public/index.html` — main UI
- `public/app.js` — frontend logic
- `public/firebase-config.example.js` — copy to `firebase-config.js` and fill your Firebase web config
- `functions/index.js` — callable backend functions (`syncUser`, `setUserApproval`)
- `firestore.rules` — Firestore security rules
- `firebase.json` — Hosting + Functions + Firestore config

## Firebase setup

1. Create a Firebase project.
2. Enable Google sign-in in Firebase Authentication.
3. Create Firestore in production mode.
4. Copy `public/firebase-config.example.js` to `public/firebase-config.js` and fill your values.
5. Set admin email list before deploy:
   - Linux/macOS:
     `export ADMIN_EMAILS="you@example.com,admin2@example.com"`
6. Deploy functions and hosting.

## Deploy

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
cd functions && npm install && cd ..
firebase deploy
```

## First admin

Any Google account whose email is listed in `ADMIN_EMAILS` becomes:
- approved automatically
- role = admin
- custom claims `admin: true`, `approved: true`

## Approval flow

1. Normal user signs in with Google.
2. `syncUser` creates/updates `users/{uid}`.
3. User sees waiting-for-approval banner.
4. Admin opens the app and uses the Admin Approval Panel.
5. `setUserApproval` updates Firestore and custom claims.
6. User refreshes token by signing in again or refreshing the page.

## Notes

- Prompt history is stored in `promptHistory` collection.
- Gemini API Key is still stored in browser localStorage on the user device.
- This package does not proxy Gemini API through Firebase Functions. It keeps the current browser-side Gemini call pattern.
