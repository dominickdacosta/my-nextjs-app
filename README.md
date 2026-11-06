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

Open [http://localhost:3000](http://localhost:3000). Database-backed features
will require `DATABASE_URL`; configure it in `.env.local` and do not commit
secrets.

For local database development, use a dedicated Neon development branch or
PostgreSQL 16 in Docker. Never point development scripts at production data
unless that is intentional.

## Legacy data archive

The previous app's database table is intentionally left untouched. If you need
to preserve its contents before managing that table manually, set
`DATABASE_URL` and run the explicit archive utility in `scripts/` from the
repository root. It writes a JSON archive to the ignored `data/` directory,
which may contain personal data, and never runs as part of app startup.

## Deployment

Deploy with the repository's existing Vercel integration. Keep `main` as the
Production branch and use `develop` for Preview deployments. Configure the
required environment variables for each environment before enabling
database-backed features.

## Health information

Vitals is for personal tracking and is not medical advice or a diagnostic
service. Consult a qualified clinician for medical questions or concerns.
