// ============================================================
// DevLink — intake Edge Function
// Server-side endpoint for the website's Hire and Apply forms.
//
// Replaces EmailJS: validates + rate-limits server-side, inserts
// the correct row (enquiries or people), and posts a notification
// into #client-enquiries or #developer-applications via a Discord
// webhook.
//
// Env secrets required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   DISCORD_ENQUIRIES_WEBHOOK_URL        (webhook in #client-enquiries)
//   DISCORD_DEV_APPLICATIONS_WEBHOOK_URL (webhook in #developer-applications)
// ============================================================

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = 'https://devlinkco.online';

const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Rate limit (in-memory) ──────────────────────────────────
// Per-IP sliding window. Edge functions may cold-start, so this
// is best-effort, not authoritative. Volume expected is low.
const RATE_WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const RATE_MAX       = 5;                // 5 submissions/hour/IP
const ipHits = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now  = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    ipHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

// ── Validation helpers ──────────────────────────────────────
function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ── Counter helper (mirrors db.js nextDlCounter) ────────────
async function nextDlCounter(supabase: ReturnType<typeof createClient>, type: string, format: (n: number) => string): Promise<string> {
  const { data, error } = await supabase.from('dl_counters').select('count').eq('type', type).maybeSingle();
  if (error) throw error;
  const current = (data as { count?: number } | null)?.count ?? 1;
  const { error: upErr } = await supabase.from('dl_counters').upsert({ type, count: current + 1 }, { onConflict: 'type' });
  if (upErr) throw upErr;
  return format(current);
}
const pad4 = (n: number) => String(n).padStart(4, '0');
const enquiryFormat = (n: number) => `DL-E-${pad4(n)}`;
const devCodename   = (n: number) => `A-${pad4(n)}`;
const clientCodename = (n: number) => `C-${pad4(n)}`;

// ── Discord webhook post ────────────────────────────────────
async function postWebhook(url: string, embed: object, content?: string) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content, embeds: [embed] }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Webhook failed:', res.status, err);
  }
  return res.ok;
}

// ── Handlers ────────────────────────────────────────────────
type HireBody = {
  kind: 'hire';
  hp?: string;              // honeypot
  renderedAt?: number;      // unix ms when form rendered
  name?: string;
  email?: string;
  projectName?: string;
  description?: string;
  budget?: string;          // free text; parsed to pence when numeric
  timeline?: string;
  references?: string;
  requiredSkills?: string[];
  referrer?: string;
  contactMethod?: string;
  discord?: string;
  robloxUsername?: string;
  gameLink?: string;
};

type ApplyBody = {
  kind: 'apply';
  hp?: string;
  renderedAt?: number;
  displayName?: string;
  email?: string;
  portfolio?: string;
  experience?: string;
  bio?: string;
  skillLevel?: string;
  skills?: string[];
  ageStatus?: '18_plus' | 'under_18_guardian';
  referrer?: string;
  contactMethod?: string;
  discord?: string;
  robloxUsername?: string;
  availability?: string;
  rateType?: string;
  rateProject?: string;
  rateHourly?: string;
};

async function handleHire(supabase: ReturnType<typeof createClient>, body: HireBody, webhookUrl: string) {
  const name        = cleanString(body.name,        100);
  const email       = cleanString(body.email,       200);
  const projectName = cleanString(body.projectName, 100);
  const description = cleanString(body.description, 2000);
  const timeline    = cleanString(body.timeline,    100);
  const references  = cleanString(body.references,  1000);
  const referrer    = cleanString(body.referrer,    200);
  const budgetRaw   = cleanString(body.budget,      50);
  const contactMethod  = cleanString(body.contactMethod,  20);
  const discord        = cleanString(body.discord,        50);
  const robloxUsername = cleanString(body.robloxUsername, 20);
  const gameLink       = cleanString(body.gameLink,       300);

  if (!name || !email || !projectName || !description) {
    return json({ error: 'Missing required fields.' }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: 'That email address does not look valid.' }, 400);
  }

  const budgetPence = budgetRaw
    ? (() => {
        const n = parseFloat(budgetRaw.replace(/[^0-9.]/g, ''));
        return isFinite(n) && n > 0 ? Math.round(n * 100) : null;
      })()
    : null;

  const skills = Array.isArray(body.requiredSkills)
    ? body.requiredSkills.filter(s => typeof s === 'string').slice(0, 20)
    : [];

  // Person row (email-only client). discord_id remains null.
  let personId: string | null = null;
  try {
    const codename = await nextDlCounter(supabase, 'clientCodename', clientCodename);
    const { data, error } = await supabase.from('people').insert({
      discord_id:   null,
      email,
      kind:         'client',
      codename,
      display_name: name,
    }).select().single();
    if (error) throw error;
    personId = (data as { id: string }).id;
  } catch (err) {
    console.error('person insert failed (non-fatal):', err);
  }

  const notes = JSON.stringify({ contactMethod, discord, robloxUsername, gameLink });

  // Enquiry row.
  let enquiryId: string;
  try {
    enquiryId = await nextDlCounter(supabase, 'enquiry_v2', enquiryFormat);
    const { error } = await supabase.from('enquiries').insert({
      id:              enquiryId,
      source:          'web',
      client_id:       personId,
      project_name:    projectName,
      description,
      budget_pence:    budgetPence,
      timeline_text:   timeline,
      references_text: references,
      required_skills: skills,
      referrer,
      notes,
    });
    if (error) throw error;
  } catch (err) {
    console.error('enquiry insert failed:', err);
    return json({ error: 'Could not record your enquiry. Please try again or email us.' }, 500);
  }

  const budgetDisplay = budgetPence != null ? `£${(budgetPence / 100).toFixed(2)}` : (budgetRaw ?? 'Not stated');

  const fields = [
    { name: 'Enquiry ID', value: enquiryId, inline: true },
    { name: 'Source',     value: 'Website', inline: true },
    { name: 'Name',       value: name,      inline: true },
    { name: 'Email',      value: email,     inline: true },
    { name: 'Budget',     value: budgetDisplay, inline: true },
    { name: 'Timeline',   value: timeline ?? 'Not stated', inline: true },
    { name: 'Project',    value: projectName },
    { name: 'Description', value: description.slice(0, 1024) },
  ];
  if (skills.length)     fields.push({ name: 'Required Skills', value: skills.join(', ').slice(0, 1024) });
  if (references)        fields.push({ name: 'References',      value: references.slice(0, 1024) });
  if (contactMethod)     fields.push({ name: 'Preferred Contact', value: contactMethod === 'Discord' && discord ? `Discord (${discord})` : contactMethod, inline: true });
  if (robloxUsername)    fields.push({ name: 'Roblox Username',  value: robloxUsername, inline: true });
  if (gameLink)          fields.push({ name: 'Game Link',        value: gameLink });
  if (referrer)          fields.push({ name: 'Referrer',        value: referrer });

  await postWebhook(webhookUrl, {
    title:  'New Web Enquiry',
    color:  0x2b2d31,
    fields,
    footer: { text: `DevLink. Reference ${enquiryId}` },
    timestamp: new Date().toISOString(),
  });

  return json({ success: true, id: enquiryId });
}

async function handleApply(supabase: ReturnType<typeof createClient>, body: ApplyBody, webhookUrl: string) {
  const displayName = cleanString(body.displayName, 100);
  const email       = cleanString(body.email,       200);
  const portfolio   = cleanString(body.portfolio,   500);
  const experience  = cleanString(body.experience,  2000);
  const bio         = cleanString(body.bio,         1000);
  const skillLevel  = cleanString(body.skillLevel,  100);
  const referrer    = cleanString(body.referrer,    200);
  const contactMethod  = cleanString(body.contactMethod,  20);
  const discord         = cleanString(body.discord,         50);
  const robloxUsername  = cleanString(body.robloxUsername,  20);
  const availability    = cleanString(body.availability,    50);
  const rateType        = cleanString(body.rateType,        20);
  const rateProject     = cleanString(body.rateProject,     80);
  const rateHourly      = cleanString(body.rateHourly,      80);
  const ageStatus   = body.ageStatus === '18_plus' || body.ageStatus === 'under_18_guardian'
    ? body.ageStatus
    : null;

  if (!displayName || !email || !portfolio || !experience || !ageStatus) {
    return json({ error: 'Missing required fields (name, email, portfolio, experience, age).' }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: 'That email address does not look valid.' }, 400);
  }

  const skills = Array.isArray(body.skills)
    ? body.skills.filter(s => typeof s === 'string').slice(0, 20)
    : [];

  // People row with kind='developer'. No dev_profiles row yet — that
  // requires a discord_id today. Skills/portfolio/experience bundled
  // into notes so staff can review.
  let codename: string;
  let personId: string;
  try {
    codename = await nextDlCounter(supabase, 'devCodename', devCodename);
    const notes = JSON.stringify({
      portfolio, experience, bio, skillLevel, skills, referrer, source: 'web',
      contactMethod, discord, robloxUsername, availability, rateType, rateProject, rateHourly,
    });
    const { data, error } = await supabase.from('people').insert({
      discord_id:   null,
      email,
      kind:         'developer',
      codename,
      display_name: displayName,
      age_status:   ageStatus,
      notes,
    }).select().single();
    if (error) throw error;
    personId = (data as { id: string }).id;
  } catch (err) {
    console.error('applicant insert failed:', err);
    return json({ error: 'Could not record your application. Please try again or email us.' }, 500);
  }

  const ageLabel = ageStatus === '18_plus' ? '18 or over' : 'Under 18 (guardian consenting)';

  const fields = [
    { name: 'Codename',    value: codename, inline: true },
    { name: 'Source',      value: 'Website', inline: true },
    { name: 'Name',        value: displayName, inline: true },
    { name: 'Email',       value: email, inline: true },
    { name: 'Age',         value: ageLabel, inline: true },
    { name: 'Skill Level', value: skillLevel ?? 'Not stated', inline: true },
    { name: 'Portfolio',   value: portfolio },
    { name: 'Experience',  value: experience.slice(0, 1024) },
  ];
  if (bio)               fields.push({ name: 'Bio',            value: bio.slice(0, 1024) });
  if (skills.length)     fields.push({ name: 'Skills',         value: skills.join(', ').slice(0, 1024) });
  if (contactMethod)     fields.push({ name: 'Preferred Contact', value: contactMethod === 'Discord' && discord ? `Discord (${discord})` : contactMethod, inline: true });
  if (robloxUsername)    fields.push({ name: 'Roblox Username',  value: robloxUsername, inline: true });
  if (availability)      fields.push({ name: 'Availability',     value: availability, inline: true });
  if (rateType)          fields.push({ name: 'Rate Type',        value: rateType, inline: true });
  if (rateProject)       fields.push({ name: 'Project Rate',     value: rateProject, inline: true });
  if (rateHourly)        fields.push({ name: 'Hourly Rate',      value: rateHourly, inline: true });
  if (referrer)          fields.push({ name: 'Referrer',       value: referrer });
  fields.push({ name: 'Next step', value: 'This applicant applied via the website (no Discord account yet). Reach out via email to invite them into the server.' });

  await postWebhook(webhookUrl, {
    title:  'New Web Developer Application',
    color:  0x2b2d31,
    fields,
    footer: { text: `DevLink. Codename ${codename}` },
    timestamp: new Date().toISOString(),
  });

  return json({ success: true, id: codename });
}

// ── Entry ───────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS')  return new Response(null, { headers: CORS });
  if (req.method !== 'POST')     return json({ error: 'Method not allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(ip)) {
    return json({ error: 'Too many submissions from this IP. Please try again later.' }, 429);
  }

  let body: HireBody | ApplyBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  // Honeypot: bots often auto-fill every field.
  if (typeof body === 'object' && body && 'hp' in body && (body as { hp?: string }).hp) {
    return json({ success: true, id: 'IGNORED' });  // don't tell the bot it failed
  }

  // Timing: forms filled in < 3 seconds are almost certainly bots.
  if (typeof body === 'object' && body && 'renderedAt' in body && typeof (body as { renderedAt?: number }).renderedAt === 'number') {
    const elapsed = Date.now() - (body as { renderedAt: number }).renderedAt;
    if (elapsed < 3000) return json({ success: true, id: 'IGNORED' });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const HIRE_WH      = Deno.env.get('DISCORD_ENQUIRIES_WEBHOOK_URL')!;
  const APPLY_WH     = Deno.env.get('DISCORD_DEV_APPLICATIONS_WEBHOOK_URL')!;
  const supabase     = createClient(SUPABASE_URL, SERVICE_KEY);

  if (body.kind === 'hire')  return handleHire(supabase, body, HIRE_WH);
  if (body.kind === 'apply') return handleApply(supabase, body, APPLY_WH);
  return json({ error: 'Unknown intake kind.' }, 400);
});
