-- 주력 작품(대표 작품) — shop_tags에 is_primary 플래그 추가
-- 샵당 최대 3개 제한은 앱(ShopEnrichmentSection)에서 건다.
-- 기존 행은 전부 false로 들어가므로 지금 데이터는 그대로 유지된다.

alter table public.shop_tags
  add column if not exists is_primary boolean not null default false;

-- 주력 작품만 빠르게 찾기 위한 부분 인덱스
create index if not exists shop_tags_primary_idx
  on public.shop_tags (shop_id)
  where is_primary;

-- PostgREST 스키마 캐시 갱신
select pg_notify('pgrst', 'reload schema');
