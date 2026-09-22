-- 작품 추가 요청 (2026-09-22) — 실행 완료
--   일반 사용자는 작품을 직접 만들 수 없고(tags_insert_admin_only.sql),
--   대신 요청을 남기면 관리자가 검토해 등록한다. 보상 없음.

create table if not exists public.work_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  english_name   text,
  ref_url        text,
  note           text,
  status         text not null default 'pending',
  admin_note     text,
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  created_tag_id uuid references public.tags(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint work_requests_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint work_requests_name_len check (char_length(btrim(name)) between 1 and 100)
);

create index if not exists idx_work_requests_status on public.work_requests (status, created_at desc);
create index if not exists idx_work_requests_user on public.work_requests (user_id, created_at desc);

create unique index if not exists uq_work_requests_pending
  on public.work_requests (user_id, lower(btrim(name)))
  where status = 'pending';

alter table public.work_requests enable row level security;

revoke all on public.work_requests from anon, authenticated;
grant select, insert, update on public.work_requests to authenticated;

create policy work_requests_select_own on public.work_requests
  for select to authenticated
  using (user_id = auth.uid());

create policy work_requests_select_admin on public.work_requests
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy work_requests_insert_own on public.work_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and created_tag_id is null
    and admin_note is null
  );

create policy work_requests_update_admin on public.work_requests
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
