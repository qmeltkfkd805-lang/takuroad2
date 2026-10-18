-- ============================================================
-- 덕마크: "직접 만든 사이트·서비스예요" 표시 (2026-10-18)
--   post_dukmarks.by_maker — 글쓴이가 소개한 사이트를 직접 만든 사람이면 true
--   (카드·글 상세에 '제작자' 표시용). post_dukmarks.sql 다음에 실행.
-- 데이터는 건드리지 않는다(열 추가만, 기본값 false).
-- ============================================================

alter table public.post_dukmarks add column if not exists by_maker boolean not null default false;

-- 작성자가 쓰는 열 목록에 추가 (post_dukmarks.sql 3) 의 열 단위 권한)
grant insert (by_maker), update (by_maker) on table public.post_dukmarks to authenticated;

select pg_notify('pgrst', 'reload schema');

-- [롤백]
-- alter table public.post_dukmarks drop column if exists by_maker;
