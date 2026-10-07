-- Eseguire UNA VOLTA nel SQL Editor di Supabase.
-- Crea la coda fiscale e le funzioni usate dal Mac bridge.

create extension if not exists pgcrypto;

create table if not exists public.fiscal_jobs (
  id uuid primary key default gen_random_uuid(),
  ristorante_id uuid not null,
  receipt_id text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','printed','error')),
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  unique (ristorante_id, receipt_id)
);

alter table public.fiscal_jobs enable row level security;

drop policy if exists fiscal_jobs_select_own on public.fiscal_jobs;
create policy fiscal_jobs_select_own on public.fiscal_jobs
for select to authenticated
using (exists (
  select 1 from public.utenti_ristoranti ur
  where ur.user_id = auth.uid()
    and ur.ristorante_id = fiscal_jobs.ristorante_id
));

drop policy if exists fiscal_jobs_insert_own on public.fiscal_jobs;
create policy fiscal_jobs_insert_own on public.fiscal_jobs
for insert to authenticated
with check (exists (
  select 1 from public.utenti_ristoranti ur
  where ur.user_id = auth.uid()
    and ur.ristorante_id = fiscal_jobs.ristorante_id
));

-- Token del solo bridge locale. Cambiarlo richiede aggiornare anche server-fiscal-queue.js.
create table if not exists public.fiscal_bridge_config (
  ristorante_id uuid primary key,
  token_hash text not null
);

alter table public.fiscal_bridge_config enable row level security;
revoke all on public.fiscal_bridge_config from anon, authenticated;

insert into public.fiscal_bridge_config (ristorante_id, token_hash)
values (
  '8e83495c-69c2-4f30-9267-15f8bca501df',
  encode(digest('SPIN-KUBE-2026-7f4d91c2b8604a2e', 'sha256'), 'hex')
)
on conflict (ristorante_id) do update
set token_hash = excluded.token_hash;

create or replace function public.claim_fiscal_job(p_ristorante_id uuid, p_token text)
returns table(id uuid, receipt_id text, payload jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.fiscal_bridge_config c
    where c.ristorante_id = p_ristorante_id
      and c.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'bridge non autorizzato';
  end if;

  select j.id into v_id
  from public.fiscal_jobs j
  where j.ristorante_id = p_ristorante_id
    and j.status = 'pending'
  order by j.created_at
  for update skip locked
  limit 1;

  if v_id is null then return; end if;

  update public.fiscal_jobs j
  set status = 'processing', claimed_at = now(), error = null
  where j.id = v_id;

  return query
  select j.id, j.receipt_id, j.payload
  from public.fiscal_jobs j
  where j.id = v_id;
end;
$$;

create or replace function public.finish_fiscal_job(
  p_ristorante_id uuid,
  p_token text,
  p_job_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.fiscal_bridge_config c
    where c.ristorante_id = p_ristorante_id
      and c.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'bridge non autorizzato';
  end if;

  update public.fiscal_jobs
  set status = case when p_success then 'printed' else 'error' end,
      error = case when p_success then null else left(coalesce(p_error, 'Errore fiscale'), 2000) end,
      completed_at = now()
  where id = p_job_id
    and ristorante_id = p_ristorante_id
    and status = 'processing';
end;
$$;

grant execute on function public.claim_fiscal_job(uuid,text) to anon, authenticated;
grant execute on function public.finish_fiscal_job(uuid,text,uuid,boolean,text) to anon, authenticated;
