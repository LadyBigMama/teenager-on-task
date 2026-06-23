create table if not exists public.teen_task_state (
  household_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.teen_task_state enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.teen_task_state to anon, authenticated;

drop policy if exists "teen_task_state_select" on public.teen_task_state;
drop policy if exists "teen_task_state_insert" on public.teen_task_state;
drop policy if exists "teen_task_state_update" on public.teen_task_state;

create policy "teen_task_state_select"
on public.teen_task_state
for select
to anon, authenticated
using (true);

create policy "teen_task_state_insert"
on public.teen_task_state
for insert
to anon, authenticated
with check (true);

create policy "teen_task_state_update"
on public.teen_task_state
for update
to anon, authenticated
using (true)
with check (true);
