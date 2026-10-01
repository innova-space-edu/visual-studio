-- Visual Learning Cloud v1
-- Large payloads live in Google Drive. Supabase stores searchable indexes and encrypted connection metadata.
-- Client roles are explicitly denied; server-side service_role is the only application writer.

create table if not exists public.learning_storage_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('google_drive')),
  account_email text,
  account_name text,
  refresh_token_ciphertext text not null,
  root_folder_id text,
  folder_map jsonb not null default '{}'::jsonb,
  scopes text[] not null default '{}'::text[],
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  provider text not null default 'google_drive',
  drive_file_id text not null,
  drive_folder_id text,
  drive_path text,
  sha256 text not null,
  mime_type text not null default 'application/gzip',
  size_bytes bigint not null default 0,
  event_count integer not null default 0,
  first_event_at timestamptz,
  last_event_at timestamptz,
  status text not null default 'synced' check (status in ('pending','synced','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create table if not exists public.learning_objects (
  sha256 text primary key,
  kind text not null check (kind in ('scene','export','failure','dataset','candidate','experiment','regression','golden-test','release','backup','other')),
  provider text not null default 'google_drive',
  drive_file_id text not null,
  drive_folder_id text,
  drive_path text,
  mime_type text,
  size_bytes bigint not null default 0,
  reference_count bigint not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_referenced_at timestamptz not null default now()
);

create table if not exists public.learning_runs (
  run_id text primary key,
  batch_id uuid references public.learning_batches(id) on delete set null,
  source text not null default 'visual-studio',
  skill text,
  skill_version text,
  engine_version text,
  input_hash text,
  initial_scene_hash text,
  final_scene_hash text,
  quality_before numeric,
  quality_after numeric,
  accepted boolean,
  exported boolean,
  event_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'visual-studio',
  status text not null default 'running' check (status in ('running','success','error')),
  event_count integer not null default 0,
  batch_id uuid references public.learning_batches(id) on delete set null,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.learning_candidates (
  id uuid primary key default gen_random_uuid(),
  skill text not null,
  current_version text,
  candidate_version text,
  status text not null default 'candidate' check (status in ('candidate','recommended','approved','rejected','released')),
  sample_count integer not null default 0,
  confidence numeric,
  proposal jsonb not null default '{}'::jsonb,
  regression jsonb not null default '{}'::jsonb,
  drive_file_id text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  released_at timestamptz
);

create table if not exists public.learning_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'scheduled' check (status in ('scheduled','approved','rolling-out','released','rolled-back')),
  candidate_ids uuid[] not null default '{}'::uuid[],
  scheduled_for timestamptz,
  notify_at timestamptz,
  released_at timestamptz,
  rollback_of uuid references public.learning_releases(id) on delete set null,
  manifest jsonb not null default '{}'::jsonb,
  drive_file_id text,
  created_at timestamptz not null default now()
);

create index if not exists learning_batches_created_at_idx on public.learning_batches (created_at desc);
create index if not exists learning_batches_sha256_idx on public.learning_batches (sha256);
create index if not exists learning_batches_status_idx on public.learning_batches (status);
create index if not exists learning_objects_kind_idx on public.learning_objects (kind);
create index if not exists learning_objects_last_ref_idx on public.learning_objects (last_referenced_at desc);
create index if not exists learning_runs_skill_idx on public.learning_runs (skill);
create index if not exists learning_runs_created_at_idx on public.learning_runs (created_at desc);
create index if not exists learning_runs_batch_id_idx on public.learning_runs (batch_id);
create index if not exists learning_sync_jobs_started_idx on public.learning_sync_jobs (started_at desc);
create index if not exists learning_sync_jobs_batch_id_idx on public.learning_sync_jobs (batch_id);
create index if not exists learning_candidates_status_idx on public.learning_candidates (status);
create index if not exists learning_candidates_skill_idx on public.learning_candidates (skill);
create index if not exists learning_releases_rollback_of_idx on public.learning_releases (rollback_of);

alter table public.learning_storage_accounts enable row level security;
alter table public.learning_batches enable row level security;
alter table public.learning_objects enable row level security;
alter table public.learning_runs enable row level security;
alter table public.learning_sync_jobs enable row level security;
alter table public.learning_candidates enable row level security;
alter table public.learning_releases enable row level security;

revoke all on table public.learning_storage_accounts from anon, authenticated;
revoke all on table public.learning_batches from anon, authenticated;
revoke all on table public.learning_objects from anon, authenticated;
revoke all on table public.learning_runs from anon, authenticated;
revoke all on table public.learning_sync_jobs from anon, authenticated;
revoke all on table public.learning_candidates from anon, authenticated;
revoke all on table public.learning_releases from anon, authenticated;

grant select, insert, update, delete on table public.learning_storage_accounts to service_role;
grant select, insert, update, delete on table public.learning_batches to service_role;
grant select, insert, update, delete on table public.learning_objects to service_role;
grant select, insert, update, delete on table public.learning_runs to service_role;
grant select, insert, update, delete on table public.learning_sync_jobs to service_role;
grant select, insert, update, delete on table public.learning_candidates to service_role;
grant select, insert, update, delete on table public.learning_releases to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'learning_storage_accounts','learning_batches','learning_objects','learning_runs',
    'learning_sync_jobs','learning_candidates','learning_releases'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_deny_client_roles', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      t || '_deny_client_roles', t
    );
  end loop;
end $$;
