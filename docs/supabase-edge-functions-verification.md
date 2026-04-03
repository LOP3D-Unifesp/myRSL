# Supabase Edge Functions Verification (Project `jjthonughzxmdaqasbmy`)

Use this checklist whenever `sync-dois`, `extract-pdf`, or `chat-with-pdf` starts returning auth errors.

## 1) Confirm local config points to the new project

- `supabase/config.toml` must contain:
  - `project_id = "jjthonughzxmdaqasbmy"`
- `.env` and `.env.local` must resolve to:
  - `VITE_SUPABASE_PROJECT_ID="jjthonughzxmdaqasbmy"`
  - `VITE_SUPABASE_URL="https://jjthonughzxmdaqasbmy.supabase.co"`

## 2) Confirm CLI auth and project link

Run:

```bash
supabase login
supabase link --project-ref jjthonughzxmdaqasbmy
```

Then deploy:

```bash
supabase db push
supabase functions deploy extract-pdf
supabase functions deploy chat-with-pdf
supabase functions deploy sync-dois
```

## 3) Confirm edge function protection

In `supabase/config.toml`, verify:

- `[functions.extract-pdf] verify_jwt = true`
- `[functions.chat-with-pdf] verify_jwt = true`
- `[functions.sync-dois] verify_jwt = true`

## 4) Confirm dashboard secrets in the same project

In Supabase Dashboard (`jjthonughzxmdaqasbmy`) -> Edge Functions -> Secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 5) Log-based diagnosis matrix

- `Missing Authorization header.`
  - Frontend did not send bearer token or user is not signed in.
- `Invalid or expired token.`
  - Session token expired/invalid, or frontend and function point to different projects.
- `SUPABASE_SERVICE_ROLE_KEY is not configured.`
  - Secret missing in Edge Functions for the active project.

## 6) Browser network sanity check

During DOI sync request, verify endpoint:

- `https://jjthonughzxmdaqasbmy.supabase.co/functions/v1/sync-dois`

If the host differs, frontend env is still pointing to another Supabase project.
