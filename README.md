# Family Chore Board

A family-friendly task board built with Next.js. Tasks are stored in a local
JSON file during development and in Neon Postgres when `DATABASE_URL` is set.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local tasks are stored in `data/tasks.json`. This file is intentionally ignored
by Git so household data is not committed.

## Persistent storage and data migration

The app uses Neon Postgres for durable storage on Vercel. The app creates its
`household_tasks` table automatically when it first accesses the database.

1. Create a Neon database from the Vercel Marketplace and connect it to your
   Vercel project. Make sure the project has a `DATABASE_URL` environment
   variable for Production, and for Preview if you use preview deployments.
2. For local migration, create `.env.local` in the repository root and set
   `DATABASE_URL` to the Neon connection string. Keep this secret out of Git.
3. Run `npm run migrate:tasks` once from the repository root. The script copies
   task IDs, recurrence details, and completion history from
   `data/tasks.json`. It leaves existing database rows unchanged and does not
   delete the local file.
4. Verify the migrated tasks in the app before removing or archiving any local
   copies.

If `DATABASE_URL` is not configured in production, task requests fail rather
than silently using temporary serverless storage.

## Deploy to Vercel

1. Push this repository to GitHub and import it into Vercel.
2. Connect the Neon Marketplace integration and confirm `DATABASE_URL` is
   available to the deployment environment.
3. Deploy the `main` branch. Vercel's Git integration automatically deploys
   later pushes to the connected production branch; pull requests and other
   branches can produce preview deployments.

No separate GitHub Actions workflow is required for Vercel deployments.

## Access and data safety

The task API does not require sign-in. Anyone who can access the deployed app
can read, add, update, or delete its tasks. Do not put sensitive information
in tasks. Add authentication and authorization before using the app for
non-public household data.
