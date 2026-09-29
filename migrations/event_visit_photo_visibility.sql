-- ============================================================
-- 이벤트 "다녀왔어요" 사진 — 공개 (2026-09-29 결정: 전부 공개)
--
-- 규칙
--   - 새로 올리는 사진은 visibility = 'public' → 내 공개 프로필 > 방문 기록에 보인다
--   - 파일은 비공개 버킷 visit-photos 그대로. 서버(/api/profile/{id}/visits)가
--     프로필 공개범위('활동 내역')·이벤트 조회 권한을 확인한 뒤에만 10분짜리 서명 URL 을 준다
--   - 칸은 남겨둔다(나중에 사진별 나만 보기를 다시 넣을 수 있게). 'private' 사진은 남에게 안 보인다
-- ============================================================

-- 1) 칸 추가 — 기존 사진은 일단 private 로 들어간다
alter table public.event_visit_photos
  add column if not exists visibility text not null default 'private';

alter table public.event_visit_photos drop constraint if exists event_visit_photos_visibility_check;
alter table public.event_visit_photos
  add constraint event_visit_photos_visibility_check check (visibility in ('private', 'public'));

-- 2) 앞으로 올리는 사진은 공개
alter table public.event_visit_photos alter column visibility set default 'public';

-- 3) 이미 올린 사진도 공개 ("나만 보기" 안내를 보고 올린 사진들)
update public.event_visit_photos set visibility = 'public' where visibility <> 'public';

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select visibility, count(*) from public.event_visit_photos group by 1;   -- 기대: public 만
-- select column_default from information_schema.columns
--  where table_schema='public' and table_name='event_visit_photos' and column_name='visibility';  -- 기대: 'public'::text


-- ============================================================
-- [롤백] — 다시 전부 나만 보기
-- ============================================================
-- alter table public.event_visit_photos alter column visibility set default 'private';
-- update public.event_visit_photos set visibility = 'private';
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
