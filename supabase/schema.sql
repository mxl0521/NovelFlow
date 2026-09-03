-- NovelFlow cloud persistence (run once in the Supabase SQL editor).
-- The API server uses the service role only on the server; browser clients
-- never receive it. RLS remains enabled for direct, user-scoped access.

create table if not exists public.novelflow_projects (
  id text primary key,
  owner_id uuid not null,
  title text not null default '未命名作品',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists novelflow_projects_owner_updated_idx
  on public.novelflow_projects (owner_id, updated_at desc);
create index if not exists novelflow_projects_owner_deleted_idx
  on public.novelflow_projects (owner_id, deleted_at, updated_at desc);

create table if not exists public.novelflow_memory_chunks (
  owner_id uuid not null,
  project_id text not null references public.novelflow_projects(id) on delete cascade,
  chapter_id text not null,
  chunk_index integer not null check (chunk_index >= 0),
  title text not null default '',
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (project_id, chapter_id, chunk_index)
);

create index if not exists novelflow_memory_owner_project_idx
  on public.novelflow_memory_chunks (owner_id, project_id, chapter_id);

alter table public.novelflow_projects enable row level security;
alter table public.novelflow_memory_chunks enable row level security;

drop policy if exists novelflow_projects_owner_select on public.novelflow_projects;
create policy novelflow_projects_owner_select on public.novelflow_projects
  for select using (owner_id = auth.uid());
drop policy if exists novelflow_projects_owner_insert on public.novelflow_projects;
create policy novelflow_projects_owner_insert on public.novelflow_projects
  for insert with check (owner_id = auth.uid());
drop policy if exists novelflow_projects_owner_update on public.novelflow_projects;
create policy novelflow_projects_owner_update on public.novelflow_projects
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists novelflow_projects_owner_delete on public.novelflow_projects;
create policy novelflow_projects_owner_delete on public.novelflow_projects
  for delete using (owner_id = auth.uid());

drop policy if exists novelflow_memory_owner_select on public.novelflow_memory_chunks;
create policy novelflow_memory_owner_select on public.novelflow_memory_chunks
  for select using (owner_id = auth.uid());
drop policy if exists novelflow_memory_owner_insert on public.novelflow_memory_chunks;
create policy novelflow_memory_owner_insert on public.novelflow_memory_chunks
  for insert with check (owner_id = auth.uid());
drop policy if exists novelflow_memory_owner_update on public.novelflow_memory_chunks;
create policy novelflow_memory_owner_update on public.novelflow_memory_chunks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists novelflow_memory_owner_delete on public.novelflow_memory_chunks;
create policy novelflow_memory_owner_delete on public.novelflow_memory_chunks
  for delete using (owner_id = auth.uid());

comment on table public.novelflow_projects is 'NovelFlow project snapshots; one row per tenant and project';
comment on table public.novelflow_memory_chunks is 'Searchable chapter chunks indexed from project snapshots';
