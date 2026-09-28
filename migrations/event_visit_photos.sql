-- ============================================================
-- 이벤트 "다녀왔어요" 사진 (특전·음식·굿즈 등) — 연대기에 함께 남는다
--
-- 규칙
--   - 나만 본다: 비공개 버킷 visit-photos + 표 RLS 본인만
--   - "다녀왔어요"를 누른 이벤트에만 올릴 수 있다 (event_visits 에 내 기록이 있어야 함)
--   - 이벤트당 최대 3장 (트리거로 강제, 동시 업로드도 advisory lock 으로 막음)
--   - 파일 경로: {user_id}/{event_id}/{uuid}.webp  — 첫 폴더가 본인 id 여야 올리고 볼 수 있다
--   - 연대기(activity_logs related_id = event_id)와는 (user_id, event_id) 로 이어진다
--
-- 사전 확인 (읽기 전용) — 둘 다 uuid 여야 FK 가 걸린다
--   select table_name, column_name, data_type from information_schema.columns
--    where table_schema='public' and ((table_name='events' and column_name='id')
--       or (table_name='event_visits' and column_name='event_id'));
-- ============================================================


-- ── 1. 비공개 버킷 ────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 본인 폴더({auth.uid()}/...)만 읽기·올리기·지우기
drop policy if exists visit_photos_select_own on storage.objects;
create policy visit_photos_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists visit_photos_insert_own on storage.objects;
create policy visit_photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists visit_photos_delete_own on storage.objects;
create policy visit_photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ── 2. 사진 목록 표 ───────────────────────────────────────
create table if not exists public.event_visit_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  object_path text not null unique,
  created_at  timestamptz not null default now()
);

create index if not exists event_visit_photos_user_event_idx
  on public.event_visit_photos (user_id, event_id, created_at);

alter table public.event_visit_photos enable row level security;
revoke all on public.event_visit_photos from public, anon, authenticated;
grant select, insert, delete on public.event_visit_photos to authenticated;

drop policy if exists evp_select_own on public.event_visit_photos;
create policy evp_select_own on public.event_visit_photos
  for select to authenticated
  using (user_id = auth.uid());

-- 올리기: 본인 + 경로가 {본인}/{이 이벤트}/ 로 시작 + 이 이벤트에 "다녀왔어요" 기록이 있어야
drop policy if exists evp_insert_own on public.event_visit_photos;
create policy evp_insert_own on public.event_visit_photos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and object_path like auth.uid()::text || '/' || event_id::text || '/%'
    and exists (
      select 1 from public.event_visits v
       where v.user_id = auth.uid() and v.event_id = event_visit_photos.event_id
    )
  );

drop policy if exists evp_delete_own on public.event_visit_photos;
create policy evp_delete_own on public.event_visit_photos
  for delete to authenticated
  using (user_id = auth.uid());


-- ── 3. 이벤트당 3장 제한 ──────────────────────────────────
create or replace function public.event_visit_photos_limit()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- 같은 (사용자, 이벤트) 동시 업로드는 줄 세운다
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || ':' || new.event_id::text));
  if (select count(*) from public.event_visit_photos
       where user_id = new.user_id and event_id = new.event_id) >= 3 then
    raise exception '사진은 이벤트당 3장까지 남길 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists event_visit_photos_limit on public.event_visit_photos;
create trigger event_visit_photos_limit
  before insert on public.event_visit_photos
  for each row execute function public.event_visit_photos_limit();

revoke all on function public.event_visit_photos_limit() from public, anon, authenticated;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select '1.버킷' as 구분, id || ' public=' || public::text as 값 from storage.buckets where id = 'visit-photos'
-- union all
-- select '2.표 RLS', relrowsecurity::text from pg_class where oid = 'public.event_visit_photos'::regclass
-- union all
-- select '3.표 정책', string_agg(policyname, ', ' order by policyname) from pg_policies
--  where schemaname = 'public' and tablename = 'event_visit_photos'
-- union all
-- select '4.저장소 정책', string_agg(policyname, ', ' order by policyname) from pg_policies
--  where schemaname = 'storage' and tablename = 'objects' and policyname like 'visit_photos_%';
--
-- 기대: 1 = visit-photos public=false / 2 = true / 3 = evp_delete_own, evp_insert_own, evp_select_own
--       4 = visit_photos_delete_own, visit_photos_insert_own, visit_photos_select_own


-- ============================================================
-- [롤백] — 올린 사진 목록이 함께 지워진다(파일은 버킷에 남음)
-- ============================================================
-- drop trigger if exists event_visit_photos_limit on public.event_visit_photos;
-- drop function if exists public.event_visit_photos_limit();
-- drop table if exists public.event_visit_photos;
-- drop policy if exists visit_photos_select_own on storage.objects;
-- drop policy if exists visit_photos_insert_own on storage.objects;
-- drop policy if exists visit_photos_delete_own on storage.objects;
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
