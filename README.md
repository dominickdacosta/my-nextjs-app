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

Food logging supports manual entries and recent-food search by default. Set
`FDC_API_KEY` to enable USDA FoodData Central search; the key is used only by
the server-side search route.

`npm run db:studio` opens Drizzle Studio. To load 30 days of sample data for an
existing, onboarded development account, set `DEV_SEED_USER_ID` to that account
ID and run `npm run db:seed:dev`. The development seed refuses to run when
`NODE_ENV=production`.

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
