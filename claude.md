# DevLink — Claude Code Instructions

## What This Project Is

DevLink is a Roblox development agency website at **devlinkco.online**.  
It connects clients who need Roblox projects built with vetted developers from a curated roster.  
DevLink takes a 25% commission on every matched project. Developers keep 75%.

This is a **pure HTML/CSS/JS project — no frameworks, no npm, no build tools.**  
There are three self-contained HTML files and a handful of static assets.

---

## Repository Structure

```
/
├── index.html          → Homepage (devlinkco.online)
├── hire/
│   └── index.html      → Client enquiry form (devlinkco.online/hire)
├── apply/
│   └── index.html      → Developer application form (devlinkco.online/apply)
├── DevLinkRBBX.png     → Logo
├── Favicon.ico         → Browser tab icon
└── CNAME               → Contains: devlinkco.online
```

---

## Hosting & Infrastructure

| Layer | Detail |
|---|---|
| Hosting | GitHub Pages — repo: devlinkco/Devlink, branch: main |
| DNS / CDN | Cloudflare — domain proxied, HTTPS enforced |
| Fonts | Google Fonts — Syne (headings) + DM Sans (body) |
| Email | EmailJS — service_b2nnw1e |
| Inbox | devlink.co@outlook.com |

### EmailJS Credentials
```
Service ID:                service_b2nnw1e
Public Key:                iCCi3WGf2aQ8yeT1q
Notification template:     template_2jg1lt4   (sent to DevLink on submission)
Auto-reply template:       template_5jyjxy9   (sent to the person who submitted)
```
Both forms send two emails per submission using `.then().then()` chaining.

---

## NON-NEGOTIABLE RULES — READ BEFORE WRITING ANY CODE

These rules exist because **Cloudflare proxies the live domain and actively interferes with JavaScript** if they are not followed. Breaking any of these will cause silent failures on the live site.

### 1. ES5 JavaScript Only
```js
// CORRECT
var name = 'DevLink';
function doThing() { }
for (var i = 0; i < items.length; i++) { }

// WRONG — Cloudflare can mangle these
const name = 'DevLink';
const doThing = () => { };
items.forEach(item => { });
```

### 2. All Script Tags Must Have `data-cfasync="false"`
```html
<!-- CORRECT -->
<script data-cfasync="false">
  window.onload = function() { ... };
</script>

<!-- WRONG — Cloudflare will inject scripts that truncate yours -->
<script>
  window.onload = function() { ... };
</script>
```

### 3. Use `window.onload`, Not `DOMContentLoaded`
```js
// CORRECT
window.onload = function() {
  // all JS goes here
};

// WRONG
document.addEventListener('DOMContentLoaded', function() { });
```

### 4. EmailJS Must Load Before `window.onload` Runs
```html
<!-- CORRECT — regular script tag, no defer -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>

<!-- WRONG -->
<script src="..." defer></script>
```

### 5. All Internal Links Must Be Absolute
```html
<!-- CORRECT -->
<a href="/hire">Hire a Dev</a>
<a href="/apply">Apply</a>
<a href="/">Home</a>

<!-- WRONG — breaks when pages are in subfolders -->
<a href="hire.html">Hire a Dev</a>
<a href="../index.html">Home</a>
```

### 6. All Asset Paths Must Be Absolute
```html
<!-- CORRECT -->
<img src="/DevLinkRBBX.png" />
<link rel="icon" href="/Favicon.ico" />

<!-- WRONG -->
<img src="DevLinkRBBX.png" />
<img src="../DevLinkRBBX.png" />
```

### 7. Never Write the Email Address in Raw HTML
The email address `devlink.co@outlook.com` must **never** appear in the HTML source.  
Always assemble it via JavaScript at click-time to prevent Cloudflare obfuscation and scraper harvesting.
```html
<!-- CORRECT -->
<a href="#" onclick="var e='devlink.co'+'@'+'outlook.com';this.href='mailto:'+e;this.textContent=e;return true;">
  click to reveal
</a>

<!-- WRONG -->
<a href="mailto:devlink.co@outlook.com">devlink.co@outlook.com</a>
```

### 8. Promise Chaining Only — No Async/Await
```js
// CORRECT
emailjs.sendForm(SERVICE_ID, TEMPLATE_1, form)
  .then(function() { return emailjs.sendForm(SERVICE_ID, TEMPLATE_2, form); })
  .then(function() { /* success */ })
  .catch(function() { /* error */ })
  .finally(function() { /* cleanup */ });

// WRONG
async function send() {
  await emailjs.sendForm(...);
}
```

---

## Theme System

Light/dark mode is toggled by a button in the nav and persists across pages via `localStorage`.

```js
// Key used in localStorage
localStorage.setItem('devlink-theme', 'dark'); // or 'light'

// Applied to the html element
document.documentElement.setAttribute('data-theme', 'dark');
```

CSS variables are defined for both themes on `:root` / `[data-theme="dark"]` and `[data-theme="light"]`.  
Always load and apply the saved theme at the top of `window.onload` before doing anything else.

---

## Form Security (Both Forms)

Both hire and apply forms include the following protections — **do not remove any of them**:

| Measure | Detail |
|---|---|
| Honeypot | Hidden `<input name="website">` — if populated, submission is silently dropped |
| Time check | Form must be open 3+ seconds — blocks instant bot submissions |
| Rate limit | 30 second cooldown between submissions per session |
| Max submissions | 3 per session — user directed to email after that |
| Input sanitization | All fields: HTML entities escaped, script tags stripped, `javascript:` removed |
| Email validation | Regex validates format before submission |
| URL validation | Game link checked as valid `roblox.com` URL; portfolio as valid URL |

---

## Design Tokens

```css
/* Dark mode (default) */
--bg:     #151515
--bg2:    #1c1c1c
--bg3:    #222222
--white:  #f5f5f5   /* text */
--muted:  #888888
--border: #2e2e2e

/* Light mode */
--bg:     #f5f5f5
--bg2:    #ebebeb
--bg3:    #e0e0e0
--white:  #111111   /* text */
--muted:  #666666
--border: #d0d0d0

/* Accent (same in both modes) */
--accent: #6ee7b7   /* used sparingly */
```

Fonts: **Syne 700/800** for all headings, **DM Sans 400/500/600** for body text.

---

## What Still Needs Doing

- [ ] **HIGH** — Create `hire/` and `apply/` folders in GitHub. Move `hire.html` → `hire/index.html`, `apply.html` → `apply/index.html`. Delete old files from root.
- [ ] **HIGH** — Test light/dark toggle and forms on the live domain after uploading latest files.
- [ ] **MEDIUM** — Add Discord invite link (replace `DISCORD_LINK_HERE` in index.html footer).
- [ ] **MEDIUM** — Build mobile hamburger menu (nav links are currently hidden on mobile via `display:none`).
- [ ] **LOW** — Add `devlinkco.online` to EmailJS allowed origins if forms fail on the live site.
- [ ] **LOW** — Privacy policy page (recommended for GDPR if EU visitors are expected).
- [ ] **FUTURE** — Portfolio / case studies section on the homepage.

---

## What Not to Do

- Do not add any JavaScript frameworks (React, Vue, Alpine, etc.)
- Do not add a bundler or build step of any kind
- Do not use `const`, `let`, arrow functions, or `async/await` in any script tag
- Do not use `DOMContentLoaded`
- Do not omit `data-cfasync="false"` from any `<script>` tag
- Do not write the email address in plain HTML
- Do not use relative paths for internal links or assets
- Do not add `defer` or `async` to the EmailJS script tag

---

## Note to Claude — If You Think a Rule Above Is Wrong

If you are a more capable model (e.g. Opus) and you believe any rule in the "What Not to Do" section is unnecessary, overly conservative, or technically incorrect given the actual constraints of this environment, **do not silently ignore it**.

Instead, before making any changes:

1. State clearly which rule you disagree with
2. Explain your reasoning — why do you think it is wrong or unnecessary?
3. Propose what you would do differently and why it would still be safe in a Cloudflare-proxied GitHub Pages environment
4. Wait for the owner to confirm before proceeding with any approach that breaks one of the listed rules

The rules were written based on real bugs encountered on this project — particularly JavaScript silently breaking on the live domain due to Cloudflare interference. They may be more conservative than strictly necessary, but they exist for a reason. A good reason to override one of them is technical evidence, not just "modern browsers support this." The live environment includes Cloudflare proxying, and that changes things.

**Context that may affect your reasoning:**
- The site is hosted on GitHub Pages behind Cloudflare's proxy (not just DNS — fully proxied)
- Cloudflare injects its own script tags into the HTML on the way out
- Previous bugs confirmed: scripts truncated mid-execution, `DOMContentLoaded` firing unreliably, EmailJS not available when called, JS broken by missing `data-cfasync="false"`
- The owner is not a developer by trade — breaking changes on the live site are high cost to fix