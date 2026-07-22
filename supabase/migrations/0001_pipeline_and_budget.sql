-- ============================================================
-- DevLink — pipeline + budget migration
--
-- Adds dashboard-driven workflow columns WITHOUT touching the
-- existing bot-facing columns (enquiries.status, people rows).
-- Safe to run more than once (IF NOT EXISTS / guarded).
--
--   enquiries.pipeline_stage  — dashboard hire pipeline
--   enquiries.budget_text     — original budget label (range-safe)
--   people.application_status — dashboard applicant review state
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- ============================================================

-- ── Enquiry pipeline stage (independent of the bot's `status`) ──
alter table public.enquiries
  add column if not exists pipeline_stage text not null default 'new';

alter table public.enquiries
  add column if not exists budget_text text;

-- ── Developer application review state ──────────────────────
-- Default 'accepted' so anything the bot/onboarding inserts stays
-- visible on the roster. The website intake explicitly sets 'new'
-- so web applicants require review before joining the roster.
alter table public.people
  add column if not exists application_status text not null default 'accepted';

-- ── Constraints (only the dashboard writes these, so safe) ──
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'enquiries_pipeline_stage_chk'
  ) then
    alter table public.enquiries
      add constraint enquiries_pipeline_stage_chk
      check (pipeline_stage in ('new','under_review','accepted','in_progress','completed','declined'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'people_application_status_chk'
  ) then
    alter table public.people
      add constraint people_application_status_chk
      check (application_status in ('new','under_review','accepted','declined'));
  end if;
end $$;

-- ── Helpful indexes for the dashboard filters ───────────────
create index if not exists enquiries_pipeline_stage_idx on public.enquiries (pipeline_stage);
create index if not exists people_application_status_idx on public.people (application_status);
