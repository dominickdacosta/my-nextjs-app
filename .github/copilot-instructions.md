# Workspace implementation preferences

- Prefer small, focused changes that preserve existing data and behavior.
- For UI changes, use the already-running development server and verify the requested interaction in the browser.
- Do not rebuild, restart the server, or run lint checks unless explicitly requested.
- Keep verification scoped to the browser interaction requested for the change.
- Reuse existing components and patterns; avoid unrelated edits.
