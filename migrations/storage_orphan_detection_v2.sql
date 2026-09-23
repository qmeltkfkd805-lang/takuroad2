-- ============================================================
-- Storage 삭제 후보 탐지 v2 — 참조 목록을 REF_SOURCES 로 일원화
--
-- 무엇이 달라졌나
--   v1 은 참조 컬럼 목록을 SQL 뷰(storage_reference_values)에 따로 들고 있었다.
--   그런데 같은 목록이 이미 src/lib/storage/canonicalRef.ts 의 REF_SOURCES 에
--   있었고(50개 출처, cleanupWorker 가 쓰는 것), 둘이 어긋나 있었다.
--
--   확인된 차이 — 전부 멀쩡한 파일을 삭제 후보로 만드는 방향의 오류다
--     · shop_images.storage_path 의 버킷을 'shop-images' 로 상수 처리했다.
--       REF_SOURCES 는 storage_bucket 컬럼을 읽는다
--     · shop_verify_requests.evidence_url 을 경로 전용으로 다뤘다.
--       REF_SOURCES 는 urlOrPath 다 — 전체 URL 이 들어오면 v1 은 대조에 실패한다
--     · 외부 링크로 보인다는 이유로 컬럼 16개를 목록에서 뺐다.
--       REF_SOURCES 는 전부 넣고 실행 시점에 external 로 분류한다
--     · 퍼센트 인코딩을 디코드하지 않았다.
--       badges.icon_url 의 'demon-slayer%20(1).png' 가 실제 객체 이름
--       'demon-slayer (1).png' 와 어긋났다
--     · exhibit_storage_cleanup_queue.object_path 를 참조원에 넣었다. 이건 순환이다 —
--       큐는 삭제 예정 목록이지 사용 목록이 아니고, cleanupWorker 가 바로 그 큐 항목의
--       참조 여부를 판정하는 데 REF_SOURCES 를 쓴다. 큐가 참조원이면 아무것도 삭제되지 않는다
--
--   대조 검증 (2026-09-23, 같은 시점)
--     v1 참조 키 1,321 / v2 1,318. 큐 3건을 빼면 1,318 = 1,318 이지만 지문은 달랐다
--     (v1 1d569d05… / v2 4aaf24c7…). 버킷별로 좁히니 shop-images 한 곳이었고,
--     원인은 위의 퍼센트 인코딩 한 건이었다. 나머지 6개 버킷 1,152키는 지문까지 동일.
--     후보 집합은 양쪽 공집합.
--     → 개수가 같다고 같은 집합이 아니다. 지문까지 비교해야 한다
--
-- 지금 구조
--   참조 출처 정의·파싱·참조 집합 : canonicalRef.ts (REF_SOURCES, buildReferenceSnapshot)
--   객체 나열                     : 이 파일의 storage_object_inventory()
--   대조·판정                     : /api/admin/storage-orphans
--   화면                          : 관리자 대시보드 StorageSection
--
--   SQL 은 참조 지식을 갖지 않는다. PostgREST 가 storage 스키마를 노출하지 않아
--   객체 나열 한 조각만 여기 남는다.
-- ============================================================


-- ============================================================
-- 1. 객체 나열 — 참조 지식 없음
-- ============================================================
create or replace function public.storage_object_inventory(
  p_offset   integer default 0,
  p_limit    integer default 1000,
  p_max_rows integer default 50000
)
returns table (
  bucket      text,
  path        text,
  bytes       bigint,
  created     timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  -- 호출자가 상한을 무한정 올리지 못하게 하는 서버 측 천장
  c_row_ceiling constant integer := 200000;
  c_page_max    constant integer := 1000;
  v_total bigint;
begin
  if p_offset is null or p_offset < 0 then
    raise exception 'p_offset 은 0 이상이어야 합니다' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > c_page_max then
    raise exception 'p_limit 은 1..% 범위여야 합니다', c_page_max using errcode = '22023';
  end if;
  if p_max_rows is null or p_max_rows < 1 or p_max_rows > c_row_ceiling then
    raise exception 'p_max_rows 는 1..% 범위여야 합니다', c_row_ceiling using errcode = '22023';
  end if;

  select count(*) into v_total from storage.objects;

  -- 상한을 넘으면 조용히 덜 주지 않고 실패시킨다
  if v_total > p_max_rows then
    raise exception 'storage 객체 수(%)가 상한(%)을 넘었습니다. 상한을 올리거나 범위를 좁혀 다시 호출하세요',
      v_total, p_max_rows using errcode = '54000';
  end if;

  /* 모든 행에 total_count 를 실어 보낸다. 호출자는 수집한 행 수와 대조해
     잘렸는지 확인한다. 잘린 목록으로 "참조 없음" 을 판정하면
     살아 있는 파일이 삭제 후보가 된다.
     (bucket_id, name) 은 유일하므로 페이지 경계가 안정적이다. */
  return query
    select o.bucket_id::text,
           o.name::text,
           coalesce((o.metadata->>'size')::bigint, 0),
           o.created_at,
           v_total
    from storage.objects o
    order by o.bucket_id, o.name
    offset p_offset
    limit p_limit;
end;
$fn$;

comment on function public.storage_object_inventory(integer, integer, integer) is
  'storage.objects 나열 전용. 참조 판정은 하지 않는다. 참조 출처는 canonicalRef.ts 의 REF_SOURCES.';

revoke execute on function public.storage_object_inventory(integer, integer, integer) from public, anon, authenticated;
grant  execute on function public.storage_object_inventory(integer, integer, integer) to service_role;


-- ============================================================
-- 2. v1 제거
--    적용 순서 주의 — 새 경로(함수 + 라우트 + 화면)를 먼저 올려 검증한 뒤 지웠다.
--    먼저 지우면 전환 중 관리자 화면이 실패한다.
--    제거 전 확인: 의존 뷰 0, 부르는 함수 0, 코드 호출부 0
-- ============================================================
drop function if exists public.storage_deletion_candidates(integer, integer);
drop view     if exists public.storage_reference_pairs;
drop view     if exists public.storage_reference_values;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 확인]
-- ============================================================
-- -- storage_ 로 시작하는 것은 새 함수 하나만 남아야 한다
-- select 'view' as 종류, table_name as 이름
-- from information_schema.views
-- where table_schema = 'public' and table_name like 'storage\_%'
-- union all
-- select 'function', p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname like 'storage\_%'
-- order by 1, 2;
--
-- -- 페이지 전체를 받으면 total_count 와 맞는가
-- begin; set local role service_role;
-- with all_rows as (
--   select * from public.storage_object_inventory(0,    1000, 50000)
--   union all select * from public.storage_object_inventory(1000, 1000, 50000)
--   union all select * from public.storage_object_inventory(2000, 1000, 50000)
-- )
-- select count(*), max(total_count), count(*) = max(total_count) as 일치,
--        count(distinct bucket || '/' || path) as 고유키
-- from all_rows;
-- rollback;
--
-- -- 상한 초과가 실패하는가 → 54000
-- begin; set local role service_role;
-- select * from public.storage_object_inventory(0, 10, 100);
-- rollback;
--
-- -- 브라우저는 못 부른다 → 42501
-- begin; set local role authenticated;
-- select * from public.storage_object_inventory(0, 10, 50000);
-- rollback;
