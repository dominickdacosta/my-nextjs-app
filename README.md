# Vitals

Vitals is a mobile-first personal health tracker for recording nutrition,
hydration, movement, sleep, and wellbeing. Health data is sensitive: the
application is being built with authentication and per-user data isolation as
foundational requirements.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create `.env.local` from
`.env.example`; configure `DATABASE_URL` and an `AUTH_SECRET`. Add at least one
sign-in provider (GitHub or Google OAuth; email sign-in is enabled when
`AUTH_RESEND_KEY` is set). Never commit secrets.

### Enable Google sign-in

Google OAuth is already supported. In Google Cloud Console, create an OAuth
client ID for a Web application and add the app origin and callback URL:

- Local origin: `http://localhost:3000`
- Local redirect URI: `http://localhost:3000/api/auth/callback/google`
- Preview origin: `https://<your-preview-domain>`
- Preview redirect URI: `https://<your-preview-domain>/api/auth/callback/google`

In Vercel, add the Google client ID as `AUTH_GOOGLE_ID` and client secret as
`AUTH_GOOGLE_SECRET` for the Preview environment, then redeploy the `develop`
preview. Add them to Production separately if needed. The Google button appears
on `/signin` once both variables are present. Do not send OAuth secrets in chat
or commit them to the repository.

Google sign-in uses OAuth state and OIDC nonce checks. PKCE is omitted because
the Android WebView does not reliably preserve Auth.js's verifier cookie across
the Google sign-in redirect.

For local database development, use a dedicated Neon development branch or
PostgreSQL 16 in Docker (`docker compose up -d`). For Docker, set
`DATABASE_URL=postgres://postgres:postgres@localhost:5432/vitals`. Never point
development scripts at production data unless that is intentional.

Generate and apply the database migrations, then seed the built-in exercise
catalog:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Database migrations use the standard PostgreSQL `pg` driver. Set `DATABASE_URL`
to the connection string for the exact Vercel environment/database you intend
to initialize before running `npm run db:migrate`.

Food logging supports manual entries and recent-food search by default. Set
`FDC_API_KEY` to enable USDA FoodData Central search; the key is used only by
the server-side search route. Natural-language meal estimates use a built-in
reference for common foods and Indian dishes; they are approximate, clearly
labelled, and do not require an AI service or API key. Unsupported foods are
not assigned invented nutrition values. You can search FoodData Central,
correct values, edit saved entries, repeat recent meals, or save favorites.

## Running and Strava

The Train page supports quick activity logs, reusable strength templates,
repeating the last strength workout, and GPS run recording. GPS uses the
browser's high-accuracy Geolocation API, filters inaccurate or implausible
fixes, and renders a private route preview without sending location to a map
tile provider. GPS is collected only while the page is active and is saved
when the run is finished. Mobile browsers may pause location updates when the
page is backgrounded or the screen locks; continuous background tracking is
not guaranteed.

Strava is optional. To enable it, create an application in the Strava API
settings and configure these server-side environment variables for each
deployment:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI` — the exact callback URL registered with Strava, such
  as `https://<your-domain>/api/strava/callback`
- `STRAVA_TOKEN_ENCRYPTION_KEY` — a base64-encoded, randomly generated
  32-byte key used to encrypt access and refresh tokens at rest. Generate one
  with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
  and keep it stable and secret; changing or losing it requires reconnecting
  Strava accounts.

For local development, register and use
`http://localhost:3000/api/strava/callback`. The integration requests read
access to activities, refreshes expired tokens, imports up to 1,000 activities
per sync request with older history continued on subsequent syncs, and prevents
duplicate imports by Strava activity ID. Imported records include available
distance, duration, pace, elevation, heart-rate summary, and route summary.
Users can disconnect at any time; disconnecting removes stored tokens but
keeps already imported workouts. No integration is offered until valid
credentials and the encryption key are configured.

The Trends dashboard summarizes nutrition and protein-goal consistency,
workout frequency and active time, running distance and pace records, strength
progression, body measurements, sleep, and available vital measurements.
Comparisons use equal-length adjacent periods.

### Health Connect steps

The Android companion reads today's aggregated steps from Health Connect after
the user grants read-only step access. It syncs on app launch and resume; Android
does not guarantee background app execution, so steps may not sync while Vitals
is closed. The sync updates only daily steps and preserves manually logged
active minutes and distance. The web app displays the latest synced step total;
step counts are not entered manually.

This repository includes a Capacitor Android shell for local development. It
loads the Next.js app from `CAPACITOR_SERVER_URL` because the app's authenticated
API routes cannot be packaged as a static site. Start the dev server on the
local network, then sync and open the Android project:

```bash
npm run dev
npx cap sync android
npx cap open android
```

The default server URL targets the Android emulator (`http://10.0.2.2:3000`).
For a physical device, set `CAPACITOR_SERVER_URL` to the development computer's
LAN address before `npx cap sync android`. For a production build, use the
deployed HTTPS app URL and do not ship a development server URL. In Android
Studio, install Android SDK 36 and use JDK 21 (Android Studio's bundled runtime
is suitable), then run the `android/` project on an API 26+ device or emulator
with Google Play Services and Health Connect available. Before releasing, set
`android/healthfitness.config.json`'s `privacyPolicyUrl` to the app's publicly
accessible privacy policy.

## Reminders and privacy

The app is installable as a PWA. To deliver scheduled push reminders, generate
VAPID keys with `npx web-push generate-vapid-keys` and configure
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
and `VAPID_SUBJECT` in each deployment. Set a strong `CRON_SECRET`; Vercel calls
the reminder endpoint daily at 09:00 UTC to fit the Hobby Cron limit. Daily
reminders are sent at that run (the local time varies by timezone); weekday
preferences are evaluated in each profile timezone. More frequent and
per-reminder-time delivery requires a Vercel plan that supports more frequent
Cron Jobs. Notifications use generic wording and never contain medication
names or health values. Push delivery is best-effort and requires browser
notification permission.

Use **More → Privacy and support** to download a private JSON backup or
restore a Vitals backup (merge; conflicting records are skipped), or
permanently delete an account and its associated health data. To restore a
backup from another account in the same database, delete the source account
first. Push subscriptions are device-specific and must be enabled again after
restoring. Store backups securely. `DATABASE_URL` and `AUTH_SECRET` should be
protected and configured separately for Production and Preview.

`npm run db:studio` opens Drizzle Studio. To load 30 days of sample data for an
existing, onboarded development account, set `DEV_SEED_USER_ID` to that account
ID and run `npm run db:seed:dev`. The development seed refuses to run when
`NODE_ENV=production`.

## Tests

Run `npm test` for validation, date, trends, reminder, and user-scoped query
tests. `npm run e2e` runs the Playwright privacy smoke tests and requires the
development environment (`DATABASE_URL` and an `AUTH_SECRET`) to be configured.

## Legacy data archive

The previous app's database table is intentionally left untouched. If you need
to preserve its contents before managing that table manually, set
`DATABASE_URL` and run the explicit archive utility in `scripts/` from the
repository root. It writes a JSON archive to the ignored `data/` directory,
which may contain personal data, and never runs as part of app startup.

## Deployment

Deploy with the repository's existing Vercel integration. Keep `main` as the
Production branch and use `develop` for Preview deployments. Connect a Neon
database, run migrations against the intended database, and configure
`DATABASE_URL`, `AUTH_SECRET`, and OAuth credentials for each environment.

## Health information

Vitals is for personal tracking and is not medical advice or a diagnostic
service. Consult a qualified clinician for medical questions or concerns.
