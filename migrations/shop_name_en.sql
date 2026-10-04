-- ============================================================
-- 샵 영문 이름 — 영어로 검색해도 샵이 나오게
--
--   shops.name_en text (선택 입력) 예: "animate Hongdae"
--   검색: 상단 검색·샵 목록·/search 가 name 또는 name_en 으로 찾는다.
--
--   shops 는 컬럼 단위 GRANT 를 쓴다(shops_write_privileges.sql).
--   새 컬럼은 insert·update 권한을 따로 줘야 등록·수정 화면에서 저장된다.
--   이 SQL 을 실행하기 전에도 앱은 동작한다 — 영문 이름만 저장·검색이 안 될 뿐.
-- ============================================================

alter table public.shops
  add column if not exists name_en text;

alter table public.shops drop constraint if exists shops_name_en_len;
alter table public.shops
  add constraint shops_name_en_len check (name_en is null or char_length(name_en) <= 80);

grant insert (name_en), update (name_en) on public.shops to authenticated;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select column_name,
--        has_column_privilege('authenticated','public.shops',column_name,'INSERT') as ins,
--        has_column_privilege('authenticated','public.shops',column_name,'UPDATE') as upd
--   from information_schema.columns
--  where table_schema='public' and table_name='shops' and column_name='name_en';
-- 기대: name_en | true | true


-- ============================================================
-- [롤백]
-- ============================================================
-- revoke insert (name_en), update (name_en) on public.shops from authenticated;
-- alter table public.shops drop constraint if exists shops_name_en_len;
-- alter table public.shops drop column if exists name_en;
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
