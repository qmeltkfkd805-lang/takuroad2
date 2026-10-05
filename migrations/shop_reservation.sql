-- ============================================================
-- 샵 예약 링크 — 메이드카페처럼 네이버 예약·캐치테이블 등으로 미리 예약해야 하는 곳
--
--   shops.reservation_url      text     예약 페이지 주소 (선택)
--   shops.reservation_required boolean  예약해야만 입장 가능한지 (기본 false)
--
--   shops 는 컬럼 단위 GRANT 를 쓴다(shops_write_privileges.sql).
--   새 컬럼은 insert·update 권한을 따로 줘야 등록·수정 화면에서 저장된다.
--   ⚠️ 이 SQL 을 먼저 실행한 뒤 코드를 배포하세요 (샵 조회가 이 칸을 읽는다).
-- ============================================================

alter table public.shops
  add column if not exists reservation_url text,
  add column if not exists reservation_required boolean not null default false;

alter table public.shops drop constraint if exists shops_reservation_url_http;
alter table public.shops
  add constraint shops_reservation_url_http
  check (reservation_url is null or (reservation_url ~* '^https?://' and char_length(reservation_url) <= 500));

grant insert (reservation_url, reservation_required), update (reservation_url, reservation_required)
  on public.shops to authenticated;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select column_name,
--        has_column_privilege('authenticated','public.shops',column_name,'INSERT') as ins,
--        has_column_privilege('authenticated','public.shops',column_name,'UPDATE') as upd
--   from information_schema.columns
--  where table_schema='public' and table_name='shops' and column_name in ('reservation_url','reservation_required');
-- 기대: 두 줄 모두 true | true


-- ============================================================
-- [롤백]
-- ============================================================
-- revoke insert (reservation_url, reservation_required), update (reservation_url, reservation_required) on public.shops from authenticated;
-- alter table public.shops drop constraint if exists shops_reservation_url_http;
-- alter table public.shops drop column if exists reservation_required;
-- alter table public.shops drop column if exists reservation_url;
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
