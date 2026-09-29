-- ============================================================
-- 루트 완주 후기 + 사진 (이벤트 "다녀왔어요" 사진처럼)
--
-- 규칙
--   - 루트를 완주한 사람(route_completions 에 내 행이 있음)만 후기를 쓸 수 있다. 루트당 1개(수정 가능)
--   - 글 1000자까지, 사진 3장까지(트리거, 동시 업로드도 advisory lock 으로 막음)
--   - 공개: 루트를 볼 수 있는 사람(공개·추천 루트, 또는 작성자)에게 보인다. 차단 관계면 서로 안 보인다
--   - 사진은 공개 버킷 route-photos, 경로 {user_id}/{route_id}/{uuid}.webp (첫 폴더 = 본인만 올리고 지움)
--   - 연대기·공개 프로필 방문 기록의 "루트 완주" 아래에도 이 사진이 보인다
--   - 경험치는 주지 않는다 (비GPS 완주 악용 방지 — 필요하면 따로 정한다)
--
-- 사전 확인(읽기 전용): routes.id 가 uuid 여야 FK 가 걸린다
--   select data_type from information_schema.columns where table_schema='public' and table_name='routes' and column_name='id';
-- ============================================================


-- ── 1. 공개 버킷 ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('route-photos', 'route-photos', true, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists route_photos_select on storage.objects;
create policy route_photos_select on storage.objects
  for select using (bucket_id = 'route-photos');

drop policy if exists route_photos_insert_own on storage.objects;
create policy route_photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'route-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists route_photos_delete_own on storage.objects;
create policy route_photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'route-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ── 2. 후기 ───────────────────────────────────────────────
create table if not exists public.route_reviews (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null default '' check (char_length(content) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, user_id)
);
create index if not exists route_reviews_route_idx on public.route_reviews (route_id, created_at desc);

alter table public.route_reviews enable row level security;
revoke all on public.route_reviews from public, anon, authenticated;
grant select on public.route_reviews to anon, authenticated;
grant insert (route_id, user_id, content), update (content, updated_at), delete on public.route_reviews to authenticated;

drop policy if exists rr_select on public.route_reviews;
create policy rr_select on public.route_reviews
  for select using (
    exists (select 1 from public.routes r
             where r.id = route_reviews.route_id
               and (r.is_shared or r.is_official or r.user_id = auth.uid()))
    and not coalesce(public.is_blocked_between(route_reviews.user_id), false)   -- 보는 사람과 작성자가 차단 관계면 숨김
  );

drop policy if exists rr_insert_own on public.route_reviews;
create policy rr_insert_own on public.route_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.route_completions c
                 where c.route_id = route_reviews.route_id and c.user_id = auth.uid())
  );

drop policy if exists rr_update_own on public.route_reviews;
create policy rr_update_own on public.route_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists rr_delete_own on public.route_reviews;
create policy rr_delete_own on public.route_reviews
  for delete to authenticated using (user_id = auth.uid());


-- ── 3. 후기 사진 ──────────────────────────────────────────
create table if not exists public.route_review_photos (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.route_reviews(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists route_review_photos_review_idx on public.route_review_photos (review_id, sort, created_at);

alter table public.route_review_photos enable row level security;
revoke all on public.route_review_photos from public, anon, authenticated;
grant select on public.route_review_photos to anon, authenticated;
grant insert (review_id, user_id, object_path, sort), delete on public.route_review_photos to authenticated;

-- 후기를 볼 수 있으면 사진도 (route_reviews 의 RLS 가 하위 조회에도 걸린다)
drop policy if exists rrp_select on public.route_review_photos;
create policy rrp_select on public.route_review_photos
  for select using (exists (select 1 from public.route_reviews rv where rv.id = route_review_photos.review_id));

drop policy if exists rrp_insert_own on public.route_review_photos;
create policy rrp_insert_own on public.route_review_photos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and object_path like auth.uid()::text || '/%'
    and exists (select 1 from public.route_reviews rv where rv.id = route_review_photos.review_id and rv.user_id = auth.uid())
  );

drop policy if exists rrp_delete_own on public.route_review_photos;
create policy rrp_delete_own on public.route_review_photos
  for delete to authenticated using (user_id = auth.uid());

-- 후기당 3장
create or replace function public.route_review_photos_limit()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('rrp:' || new.review_id::text));
  if (select count(*) from public.route_review_photos where review_id = new.review_id) >= 3 then
    raise exception '사진은 후기당 3장까지 남길 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists route_review_photos_limit on public.route_review_photos;
create trigger route_review_photos_limit
  before insert on public.route_review_photos
  for each row execute function public.route_review_photos_limit();

revoke all on function public.route_review_photos_limit() from public, anon, authenticated;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select '1.버킷' 구분, id || ' public=' || public::text 값 from storage.buckets where id = 'route-photos'
-- union all select '2.표', string_agg(relname || ' rls=' || relrowsecurity::text, ', ') from pg_class where relname in ('route_reviews','route_review_photos')
-- union all select '3.정책', string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname) from pg_policies where tablename in ('route_reviews','route_review_photos');
-- 기대: 1 = route-photos public=true / 2 = 둘 다 rls=true / 3 = rr_* 4개, rrp_* 3개


-- ============================================================
-- [롤백] — 후기·사진 목록이 함께 지워진다(파일은 버킷에 남음)
-- ============================================================
-- drop table if exists public.route_review_photos;
-- drop table if exists public.route_reviews;
-- drop function if exists public.route_review_photos_limit();
-- drop policy if exists route_photos_select on storage.objects;
-- drop policy if exists route_photos_insert_own on storage.objects;
-- drop policy if exists route_photos_delete_own on storage.objects;
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
