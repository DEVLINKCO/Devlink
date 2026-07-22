# DevLink Staff Dashboard

Single static HTML page. No build step, no framework. Uses `@supabase/supabase-js` from a CDN and Supabase Auth's Discord provider for login.

## What it shows

- **Projects** — live `dl_projects`, most recent first.
- **Enquiries** — every enquiry from web + Discord. Staff can decline.
- **Payouts** — unpaid allocations grouped by person, one-click "Mark Paid".
- **Ledger** — the last 200 ledger rows. Pending inbound payments have a Confirm button (does not create allocations — use the Discord button for that).
- **Roster** — every developer person row, edit their PayPal handle inline.

## Setup

### 1. Fill in the Supabase URL and anon key
In `index.html`, at the top of the `<script type="module">` block:

```js
const SUPABASE_URL      = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```

Get both from Supabase → Project Settings → API. The **anon** key is safe to expose; RLS protects the data.

### 2. Turn on Discord as an auth provider in Supabase
Supabase → Authentication → Providers → Discord → toggle Enable.

You'll need a Discord OAuth application (the same one your `discord-verify` function uses is fine, or a new one).
- Discord Developer Portal → your app → OAuth2 → **add a redirect URL**: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
- Paste the Discord Client ID and Client Secret back into Supabase.

### 3. Set the redirect URL in Supabase
Supabase → Authentication → URL Configuration →
- **Site URL:** the page where you're hosting `index.html` (e.g. `https://devlinkco.online/dashboard/`)
- **Redirect URLs:** add that same URL.

### 4. Deploy
Copy `index.html` into your existing site (e.g. `dashboard/index.html` on GitHub Pages).

### 5. Confirm the RLS policies
Run `supabase/schema_phase5.sql` in the SQL editor. That creates `staff_access` + the read/write policies for every table the dashboard reads.

**Then, only after confirming your bot uses the service role key,** uncomment the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` block at the bottom of that file and run it. Without RLS enabled the dashboard *works*, but anyone who knows your anon key can read the data.

### 6. Sign in
Staff visit the page → click "Sign in with Discord" → OAuth → they're back on the page. If they hold a Director / PM / DevLink role, the bot has already synced them into `staff_access` and the dashboard shows data. Non-staff Discord accounts get a friendly empty page.

## Rocket Loader note

If you're on Cloudflare, Rocket Loader can mangle ES modules. If the dashboard fails to load silently, either disable Rocket Loader on `/dashboard/*` (Cloudflare → Speed → Optimization → Configuration Rules) or turn it off entirely.
