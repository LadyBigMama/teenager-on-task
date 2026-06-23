# SMS Approval Notifications

Approval texts are sent from a Supabase Edge Function so private values stay out of the public GitHub Pages app.

## What you need

- A Twilio account.
- A Twilio phone number that can send SMS.
- Your recipient phone number in E.164 format, for example `+15551234567`.

## Supabase setup

1. Open the Supabase SQL editor.
2. Run `supabase-schema.sql` again. This adds `teen_task_notifications`, which prevents duplicate texts for the same approval request.
3. Install and log in to the Supabase CLI.
4. Link this folder to the Supabase project:

```sh
supabase link --project-ref gekjeqcdslurlsrkwmnd
```

5. Add these Edge Function secrets:

```sh
supabase secrets set TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID"
supabase secrets set TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
supabase secrets set TWILIO_FROM_NUMBER="+15551234567"
supabase secrets set APPROVAL_NOTIFY_TO_NUMBER="+15551234567"
supabase secrets set APP_BASE_URL="https://ladybigmama.github.io/teenager-on-task/"
supabase secrets set APP_ALLOWED_ORIGIN="https://ladybigmama.github.io"
```

6. Deploy the function:

```sh
supabase functions deploy notify-approval
```

After this, when a task is filed for parent approval, the app calls `notify-approval`. The function checks that the task is actually pending in Supabase, records that the notification was sent, then sends one SMS through Twilio.

Supabase normally provides the server-side secret key to Edge Functions. If the function logs say `Missing SUPABASE_SERVICE_ROLE_KEY`, add that secret from your Supabase API settings.

## Important

This sends SMS messages only. It does not place phone calls.

Do not put phone numbers, Twilio tokens, or the Supabase service role key in `config.js`. That file is public on GitHub Pages.
