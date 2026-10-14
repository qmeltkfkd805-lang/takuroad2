-- ============================================================
-- 커뮤니티 글 링크 미리보기 카드 (2026-10-14)
--
--   community_posts.link_url  카드로 보여줄 링크 1개 (없으면 카드 없음, 작성자가 ✕로 뺄 수 있음)
--   link_previews             링크별 제목·설명·대표 이미지 저장분 (같은 링크는 한 번만 읽는다)
--
-- 링크 정보는 서버(/api/link-preview, service_role)만 쓴다. 읽기는 누구나.
-- 데이터는 건드리지 않는다(컬럼·테이블 추가만).
-- ============================================================

begin;

-- 1) 글에 붙는 카드 링크
alter table public.community_posts add column if not exists link_url text;
alter table public.community_posts drop constraint if exists community_posts_link_url_chk;
alter table public.community_posts add constraint community_posts_link_url_chk
  check (link_url is null or (char_length(link_url) <= 2000 and link_url ~* '^https?://'));

-- 작성자가 쓰는 컬럼 목록에 link_url 추가 (community_posts_write_privileges.sql 의 컬럼 단위 권한)
grant insert (link_url), update (link_url) on table public.community_posts to authenticated;
grant select (link_url) on table public.community_posts to anon, authenticated;

-- 2) 링크 정보 저장분
create table if not exists public.link_previews (
  url         text primary key check (char_length(url) <= 2000),
  ok          boolean not null default false,       -- false = 읽기 실패(카드 없이 링크만)
  title       text check (title is null or char_length(title) <= 300),
  description text check (description is null or char_length(description) <= 500),
  image_url   text check (image_url is null or char_length(image_url) <= 2000),
  site_name   text check (site_name is null or char_length(site_name) <= 120),
  fetched_at  timestamptz not null default now()
);

alter table public.link_previews enable row level security;
revoke all on public.link_previews from public, anon, authenticated;
grant select on public.link_previews to anon, authenticated;
grant select, insert, update on public.link_previews to service_role;

drop policy if exists link_previews_read on public.link_previews;
create policy link_previews_read on public.link_previews for select to anon, authenticated using (true);

commit;

select pg_notify('pgrst', 'reload schema');

-- [확인] 1행 + 1행
-- select column_name from information_schema.columns where table_name='community_posts' and column_name='link_url';
-- select relname, relrowsecurity from pg_class where relname='link_previews';
