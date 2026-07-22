# Website integration snippet for the `intake` edge function

Replace the EmailJS submission block in your Hire and Apply forms with a `fetch` to this edge function.

Function URL (after deploy): `https://<your-project-ref>.supabase.co/functions/v1/intake`

## Hire form

```html
<script>
// Record when the form was rendered so the edge function can reject
// sub-3-second bot submissions.
const _formRenderedAt = Date.now();
</script>

<!-- Add a hidden honeypot field. Bots often fill every input. -->
<input type="text" name="hp" value="" style="display:none" tabindex="-1" autocomplete="off">

<script>
document.getElementById('hire-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;

  const payload = {
    kind:           'hire',
    hp:             f.hp.value,
    renderedAt:     _formRenderedAt,
    name:           f.name.value,
    email:          f.email.value,
    projectName:    f.projectName.value,
    description:    f.description.value,
    budget:         f.budget.value,
    timeline:       f.timeline.value,
    references:     f.references?.value,
    requiredSkills: Array.from(f.querySelectorAll('input[name="skills"]:checked')).map(x => x.value),
    referrer:       document.referrer || null,
  };

  const res = await fetch('https://<your-project-ref>.supabase.co/functions/v1/intake', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  const data = await res.json();
  if (res.ok && data.success) {
    // show a "thanks, we'll be in touch" message; optionally keep the
    // EmailJS auto-reply so the user gets a confirmation email.
  } else {
    // show data.error to the user.
  }
});
</script>
```

## Apply form

Same pattern, `kind: 'apply'` and the applicant fields:

```js
const payload = {
  kind:        'apply',
  hp:          f.hp.value,
  renderedAt:  _formRenderedAt,
  displayName: f.displayName.value,
  email:       f.email.value,
  portfolio:   f.portfolio.value,
  experience:  f.experience.value,
  bio:         f.bio?.value,
  skillLevel:  f.skillLevel?.value,
  skills:      Array.from(f.querySelectorAll('input[name="skills"]:checked')).map(x => x.value),
  ageStatus:   f.ageStatus.value,   // must be '18_plus' or 'under_18_guardian'
  referrer:    document.referrer || null,
};
```

Add a small radio/select to the Apply form for age:

```html
<label><input type="radio" name="ageStatus" value="18_plus" required> I am 18 or over</label>
<label><input type="radio" name="ageStatus" value="under_18_guardian"> I am under 18 (guardian consenting)</label>
```

## What to do in Supabase

1. Deploy the function:
   ```
   npx supabase functions deploy intake
   ```

2. Set secrets (Supabase dashboard → Edge Functions → intake → Secrets):
   - `DISCORD_ENQUIRIES_WEBHOOK_URL` — a webhook you create manually in `#client-enquiries` (channel settings → Integrations → Webhooks → New Webhook, copy URL).
   - `DISCORD_DEV_APPLICATIONS_WEBHOOK_URL` — same, in `#developer-applications`.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually auto-injected; check they appear in the function's env.

3. Confirm the site domain in the function's CORS header matches your live domain. Right now it's `https://devlinkco.online`. Edit `ALLOWED_ORIGIN` in `index.ts` if you use a different one for testing.

## Rate limit

Currently 5 submissions per IP per hour, in-memory. If Supabase cold-starts the function frequently the counter resets — for higher-volume protection, move the counter into a Postgres table.
