# Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase-schema.sql`.
3. Copy `config.example.js` to `config.js`.
4. Fill in `url`, `anonKey`, and a `householdId` that is not easy to guess.
5. Reload `index.html`.

The app stays local-only until `config.js` contains real values. Once configured, tasks and the parent authorization password record sync to the `teen_task_state` table, with localStorage kept as a fallback.

This setup uses Supabase's public anon key from a browser app and permissive row policies for a simple shared-family tool. For stronger privacy, add Supabase Auth and tighten the row-level security policies before sharing the app publicly.

For SMS approval alerts, see `PHONE_NOTIFICATIONS.md`. Phone numbers and SMS provider secrets must be stored as Supabase Edge Function secrets, not in the public app files.
