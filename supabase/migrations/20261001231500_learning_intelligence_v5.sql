-- Visual Learning Intelligence V5
-- Structured observations, experiments and regression evidence. Raw educational content is not required here.

create table if not exists public.learning_observations (
  id uuid primary key default gen_random_uuid(),
  run_id text references public.learning_runs(run_id) on delete set null,
  skill text,
  event_type text not null,
  node_type text,
  feature text,
  before_value numeric,
  after_value numeric,
  delta numeric,
  quality_before numeric,
  quality_after numeric,
  accepted boolean,
  exported boolean,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists learning_observations_run_idx on public.learning_observations(run_id);
create index if not exists learning_observations_skill_feature_idx on public.learning_observations(skill,feature);
create index if not exists learning_observations_occurred_idx on public.learning_observations(occurred_at desc);

create table if not exists public.learning_experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null unique,
  skill text,
  status text not null default 'running' check (status in ('draft','running','completed','cancelled')),
  arms jsonb not null default '[]'::jsonb,
  min_samples_per_arm integer not null default 20,
  winner text,
  confidence numeric,
  config jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_experiments_skill_idx on public.learning_experiments(skill);
create index if not exists learning_experiments_status_idx on public.learning_experiments(status);

create table if not exists public.learning_experiment_outcomes (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.learning_experiments(id) on delete cascade,
  run_id text references public.learning_runs(run_id) on delete set null,
  arm text not null,
  reward numeric not null,
  accepted boolean,
  exported boolean,
  quality numeric,
  edits integer,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists learning_experiment_outcomes_exp_idx on public.learning_experiment_outcomes(experiment_id);
create index if not exists learning_experiment_outcomes_run_idx on public.learning_experiment_outcomes(run_id);
create index if not exists learning_experiment_outcomes_arm_idx on public.learning_experiment_outcomes(experiment_id,arm);

create table if not exists public.learning_regression_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.learning_candidates(id) on delete cascade,
  status text not null check (status in ('running','passed','failed','error')),
  cases integer not null default 0,
  passed_cases integer not null default 0,
  failed_cases integer not null default 0,
  current_metrics jsonb not null default '{}'::jsonb,
  candidate_metrics jsonb not null default '{}'::jsonb,
  delta_metrics jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  drive_file_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists learning_regression_runs_candidate_idx on public.learning_regression_runs(candidate_id);
create index if not exists learning_regression_runs_created_idx on public.learning_regression_runs(created_at desc);

alter table public.learning_candidates
  add column if not exists candidate_key text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists recommended_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists review_note text;

create unique index if not exists learning_candidates_key_uidx
  on public.learning_candidates(candidate_key);

alter table public.learning_observations enable row level security;
alter table public.learning_experiments enable row level security;
alter table public.learning_experiment_outcomes enable row level security;
alter table public.learning_regression_runs enable row level security;

revoke all on table public.learning_observations from anon, authenticated;
revoke all on table public.learning_experiments from anon, authenticated;
revoke all on table public.learning_experiment_outcomes from anon, authenticated;
revoke all on table public.learning_regression_runs from anon, authenticated;

grant select, insert, update, delete on table public.learning_observations to service_role;
grant select, insert, update, delete on table public.learning_experiments to service_role;
grant select, insert, update, delete on table public.learning_experiment_outcomes to service_role;
grant select, insert, update, delete on table public.learning_regression_runs to service_role;

drop policy if exists learning_observations_deny_client_roles on public.learning_observations;
create policy learning_observations_deny_client_roles on public.learning_observations as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists learning_experiments_deny_client_roles on public.learning_experiments;
create policy learning_experiments_deny_client_roles on public.learning_experiments as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists learning_experiment_outcomes_deny_client_roles on public.learning_experiment_outcomes;
create policy learning_experiment_outcomes_deny_client_roles on public.learning_experiment_outcomes as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists learning_regression_runs_deny_client_roles on public.learning_regression_runs;
create policy learning_regression_runs_deny_client_roles on public.learning_regression_runs as restrictive for all to anon, authenticated using (false) with check (false);
