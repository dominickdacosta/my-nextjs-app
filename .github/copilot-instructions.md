# Vitals Health Tracker

This repository is a mobile-first personal health monitoring app built with
Next.js App Router, React, TypeScript, Tailwind CSS, and Neon Postgres.

## Product and privacy

- Treat health information as sensitive personal data.
- Scope every read and write to the authenticated user's session identity.
- Validate untrusted input at API boundaries and return clear JSON errors.
- Never log health data, request bodies, credentials, or tokens.
- Keep health observations informational, not diagnostic; avoid judgmental or
  shaming language.
- Preserve the user's local date and timezone when recording and summarizing
  entries.

## Implementation

- Use `@/*` imports for files under `src/`.
- Keep domain calculations pure and test them independently.
- Prefer relational, user-scoped database queries and migrations over local
  JSON persistence.
- Use existing components and patterns; make focused changes and preserve
  accessibility, including labels, keyboard access, visible focus, and
  touch targets of at least 44px.
- Do not add polling when mutation-driven revalidation can keep views current.
- Add or update directly related documentation when behavior or setup changes.
