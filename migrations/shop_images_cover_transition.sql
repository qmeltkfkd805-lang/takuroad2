-- ============================================================
-- 대표 사진 교체를 "행 삭제"에서 "플래그 강등"으로 바꾼다
--
-- 증상:
--   샵 수정 화면에서 대표 사진을 바꿀 때마다 기존 대표의 Storage 객체가
--   참조 없는 고아가 됐다. 복구도 정리도 불가능한 상태로 누적됐다.
--
-- 원인:
--   shopService.setShopMainImage 가 기존 is_cover=true 행을 먼저 delete 하고
--   새 행을 insert 했다. 행이 사라지는 순간 그 객체를 가리키는 참조가
--   DB 어디에도 남지 않는다. deleteShopImage 는 행 기준으로 동작하므로
--   지울 방법도 없다. delete 와 insert 사이에서 실패하면 대표가 아예 사라졌다.
--   같은 화면에서 setShopCoverImage 는 이미 플래그 전환 방식이었다 —
--   두 경로가 서로 다른 방식이었던 것이 문제의 핵심이다.
--
-- 조치:
--   1) 대표 전환을 RPC 하나의 트랜잭션으로 옮긴다. 행을 지우지 않는다.
--      기존 대표는 삭제되지 않고 일반 갤러리 사진으로 강등된다.
--   2) 샵당 대표 최대 1개를 부분 유니크 인덱스로 DB 가 보장한다.
--   3) 신규 업로드부터 Storage 출처(bucket/path)를 기록한다.
--      기존 행은 NULL 로 두고 backfill 하지 않는다.
--   setShopMainImage 는 코드에서 제거했다. 유일한 호출부는
--   ShopMainImageUploader 였고, addShopImage → setShopCoverImage 로 대체했다.
--
-- ✅ 사전 확인 (2026-09-12, 실제 조회)
--   1. anon·authenticated 는 public·extensions 스키마에 CREATE 권한이 없다.
--   2. pg_catalog 밖에 hashtext · jsonb_build_object · pg_advisory_xact_lock
--      동명 함수가 없다. search_path 가로채기 경로 없음.
--   3. 기존 동명 RPC 없음. 그래서 create or replace 가 아니라 create 를 썼다.
--   4. cover 2개 이상인 샵 0건 → 부분 유니크 인덱스 생성 가능.
--   5. storage_bucket · storage_path 컬럼과 충돌 제약·인덱스 이름 없음.
--   6. shop_images 137행 / cover 47행 / 대표 없는 샵 5개(정상).
--   7. image_url 은 137행 전부 shop-images 버킷이다. 외부 URL 0건.
--   8. shop_images 는 테이블 단위 GRANT 를 쓰므로 새 컬럼이 권한을 자동 상속한다.
--
-- ⚠ 정책 의존성
--   RPC 의 권한 검증은 shop_images_update_owner 의 조건을 복제한 것이다.
--     EXISTS (select 1 from shops
--             where shops.id = shop_images.shop_id
--               and (shops.owner_id = auth.uid()
--                    or EXISTS (select 1 from profiles
--                               where profiles.id = auth.uid()
--                                 and profiles.role = 'admin')))
--   shop_images 의 UPDATE 정책을 바꾸면 RPC 의 권한 조건도 반드시 함께 검토한다.
--   어긋나도 데이터는 안전하다 — RLS 가 0행으로 막고 함수가 예외를 던져
--   전체 트랜잭션이 롤백된다. 다만 사용자에게는 원인 불명 실패로 보인다.
--
--   RPC 는 SECURITY INVOKER 다. 함수 내부 검증은 조기 거부용이고
--   shop_images UPDATE RLS 가 그대로 최종 방어선으로 남는다.
--   내부 EXISTS 도 호출자 권한으로 실행되므로 shops·profiles 의 SELECT RLS 를 탄다.
--   status='deleted' 샵은 소유자가 아닌 관리자에게 보이지 않아 forbidden 이 된다.
--   사진 관리 화면과 같은 동작이라 의도된 결과다.
--
-- ⚠ storage_bucket · storage_path 는 신뢰 데이터가 아니다
--   클라이언트가 INSERT 에 실어 보내는 값이다. URL 파싱보다 정확한 출처를
--   남기려는 기록용이며, 보안 권한의 근거로 쓰면 안 된다.
--   향후 삭제 작업은 이 값만 믿지 말고 매번 다시 검증한다:
--     · bucket/path 형식
--     · 실제 Storage 객체 존재
--     · shop_id → shops.slug 대응
--     · 현재 참조 여부
--     · 삭제 권한
--   service_role 정리 작업도 DB 의 storage_path 만 보고 삭제하지 않는다.
--
-- advisory lock namespace 4271
--   이 기능 전용 namespace 다. 두 번째 인자는 shop_id 의 hashtext.
--   해시 충돌 시 서로 다른 샵 요청이 드물게 직렬화될 뿐 안전성 문제는 없고
--   처리량만 일시적으로 줄어든다. 전역 락이 아니며 트랜잭션 종료 시 자동 해제된다.
--
-- 적용: 2026-09-12 운영 DB 반영 완료
--   적용 파일 apply-cover-transition-2026-09-12.sql
--   SHA-256  93461db0226de049617f2219c41e1ea8367bfee766c4930f9461907b5fe92f35
--   이 파일의 아래 DDL 은 그 파일과 동일하다.
-- ============================================================


begin;

-- ── 1. 출처 기록 컬럼 ────────────────────────────────────────
alter table public.shop_images
  add column storage_bucket text,
  add column storage_path   text;

alter table public.shop_images
  add constraint shop_images_storage_ref_valid
  check (
    (storage_bucket is null and storage_path is null)
    or (
      storage_bucket = 'shop-images'
      and storage_path is not null
      and btrim(storage_path) <> ''
      and storage_path !~ '^/'
      and storage_path !~ '(^|/)\.\.(/|$)'
      and storage_path !~ '://'
      and storage_path !~ '^shop-images/'
      and strpos(storage_path, chr(92)) = 0
      and storage_path !~ '[[:cntrl:]]'
    )
  );

comment on column public.shop_images.storage_bucket is
  '업로드 결과가 돌려준 버킷명. 기존 행은 NULL. URL 파싱으로 채우지 않는다. 클라이언트가 보내는 값이므로 권한 근거로 신뢰하지 않는다.';
comment on column public.shop_images.storage_path is
  '업로드 결과가 돌려준 객체 경로. 기존 행은 NULL. NULL 이면 Storage 삭제를 시도하지 않는다. 삭제 시 형식·실제 객체·shop_id 대응·현재 참조 여부·삭제 권한을 다시 검증할 것.';

-- ── 2. 샵당 대표 최대 1개 ────────────────────────────────────
-- "최소 1개"는 강제하지 않는다. 사진이 없는 샵 5개가 정상 상태다.
create unique index shop_images_one_cover_per_shop
  on public.shop_images (shop_id)
  where is_cover is true;

-- ── 3. 대표 전환 RPC ────────────────────────────────────────
-- {ok:false} 로 반환되는 모든 경로는 SELECT 만 수행한다 = DB 무변경.
-- 변경을 시작한 뒤 실패하면 예외로 전체 트랜잭션을 되돌린다.
-- 클라이언트에는 고정된 실패 코드만 전달한다. 내부 SQL 상세를 노출하지 않는다.
create function public.shop_images_set_cover(
  p_shop_id  uuid,
  p_image_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_uid      uuid;
  v_shop_id  uuid;
  v_is_cover boolean;
  v_allowed  boolean;
  v_covers   integer;
begin
  -- 1단계 · 변경 없는 검증 (SELECT 만). 여기서 나가는 경로는 DB 무변경이다.
  if p_shop_id is null or p_image_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_args');
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    4271, pg_catalog.hashtext(p_shop_id::text));

  select shop_id, is_cover
    into v_shop_id, v_is_cover
    from public.shop_images
   where id = p_image_id;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_shop_id <> p_shop_id then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'shop_mismatch');
  end if;

  select exists (
    select 1
      from public.shops s
     where s.id = p_shop_id
       and (
         s.owner_id = v_uid
         or exists (
           select 1 from public.profiles p
            where p.id = v_uid and p.role = 'admin'
         )
       )
  ) into v_allowed;

  if not v_allowed then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  -- 2단계 · 실제 변경. 여기서부터 실패는 전부 예외다.
  update public.shop_images
     set is_cover = false
   where shop_id = p_shop_id
     and is_cover
     and id <> p_image_id;

  if not v_is_cover then
    update public.shop_images
       set is_cover = true, sort_order = 0
     where id = p_image_id;

    if not found then
      raise exception 'set_cover_failed' using errcode = '42501';
    end if;
  end if;

  select count(*) into v_covers
    from public.shop_images
   where shop_id = p_shop_id and is_cover;

  if v_covers <> 1 then
    raise exception 'cover_invariant' using errcode = 'P0001';
  end if;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$fn$;

revoke all     on function public.shop_images_set_cover(uuid, uuid) from public;
revoke all     on function public.shop_images_set_cover(uuid, uuid) from anon;
grant  execute on function public.shop_images_set_cover(uuid, uuid) to authenticated;

commit;

-- PostgREST 스키마 캐시 갱신 — Storage 정책과 달리 신규 함수는 캐시 대상이다.
--   notify pgrst, 'reload schema';


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- 2026-09-12 실제 결과 (운영 pg_catalog 정의와 위 DDL 대조 완료)
--
--   함수    owner=postgres / prosecdef=false
--           proconfig={"search_path=pg_catalog, public, pg_temp"}
--   ACL     {postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--           → PUBLIC 없음, anon 없음. service_role 은 Supabase 기본 권한이다.
--   인덱스  CREATE UNIQUE INDEX shop_images_one_cover_per_shop
--             ON public.shop_images USING btree (shop_id) WHERE (is_cover IS TRUE)
--   CHECK   shop_images_storage_ref_valid — 위 정의와 동일 (9개 조건 전부)
--   컬럼    storage_bucket text null / storage_path text null
--           authenticated 가 INSERT·SELECT·UPDATE·REFERENCES 자동 상속
--   데이터  137행 / cover 47행 / 신규 출처값 0건 — 적용 전후 동일
--
-- 실제 사용자 세션 테스트 (SQL Editor 아님 — elevated 역할이라 RLS 검증 근거가 안 된다)
--   소유자 f5885168 · 관리자 e1ffdf30 두 세션에서 전 항목 통과
--     대표 전환 / 기존 대표 행 유지(is_cover=false) / 멱등 재호출
--     bad_args / shop_mismatch / 무관 사용자 forbidden(소유자 세션)
--     실패 경로 후 대표 불변 / 유니크 인덱스 23505 거부 / 동시 RPC 2건 → cover 1건
--     신규 행에 bucket/path 저장
--   화면 회귀: 새 대표 표시, 이전 대표가 갤러리에 그대로 남음, 중복 카드 없음, 콘솔 오류 없음
--   더블클릭: Storage POST 1회 / DB insert 1회 — useRef 잠금으로 중복 제출 차단
--   테스트 후 164건 / 596,398,039 bytes 기준값 완전 복귀


-- ============================================================
-- [롤백 · 안전한 운영 롤백]  ← 기본은 이것이다
-- ============================================================
-- 컬럼과 그 안의 데이터를 유지한다. 신규 업로드의 출처 기록을 지우지 않는다.
--
-- 순서가 중요하다. 코드를 먼저 이전 버전으로 되돌린 뒤 실행한다.
-- 구 setShopCoverImage 는 update 2회 방식이라 함수 없이도 동작하고,
-- 항상 cover 를 1개로 유지하므로 부분 유니크 인덱스와도 충돌하지 않는다.
--
--   begin;
--   revoke execute on function public.shop_images_set_cover(uuid, uuid) from authenticated;
--   -- 완전히 제거하려면 revoke 대신:
--   -- drop function if exists public.shop_images_set_cover(uuid, uuid);
--   commit;
--
-- 인덱스는 보통 남긴다. 문제가 될 때만:
--   drop index if exists public.shop_images_one_cover_per_shop;
--
-- storage_bucket / storage_path 컬럼과 CHECK 는 유지한다.
-- nullable 이고 구 코드가 값을 넣지 않으므로 영향이 없다.


-- ============================================================
-- [롤백 · 파괴적 전체 롤백]  ⚠ 일반 절차로 권장하지 않는다
-- ============================================================
-- 컬럼을 DROP 하면 그 안에 쌓인 출처 기록이 복구 불가능하게 사라진다.
-- 신규 값이 하나도 없을 때만 가능하다. 반드시 먼저 확인한다.
--
--   select count(*) as 신규출처값_기대0
--     from public.shop_images
--    where storage_bucket is not null or storage_path is not null;
--
-- 0 일 때만:
--
--   begin;
--   drop function if exists public.shop_images_set_cover(uuid, uuid);
--   drop index    if exists public.shop_images_one_cover_per_shop;
--   alter table public.shop_images
--     drop constraint if exists shop_images_storage_ref_valid;
--   alter table public.shop_images
--     drop column if exists storage_path,
--     drop column if exists storage_bucket;
--   commit;


-- ============================================================
-- [이 migration 이 해결하지 못하는 것 — 별도 백로그]
-- ============================================================
-- 1. 클라이언트 직접 업로드와 DB insert 사이에는 원자성 공백이 있다.
--    업로드 완료 후 페이지 이탈·새로고침·프로세스 종료가 발생하면
--    클라이언트의 롤백 코드도 실행되지 못한다.
--    현재 롤백은 일반적인 DB 실패에는 대응하지만
--    브라우저 생명주기 중단까지는 보장하지 않는다.
--    완전한 해결은 서버 중계 업로드 또는 임시 업로드 상태 + cleanup queue 가 필요하다.
--    (2026-09-12 테스트 중 원인 미상의 고아 1건이 실제로 발생했다. 확인 불가로 기록.)
-- 2. PhotosManage.saveCrop 은 여전히 기존 행을 삭제해 원본 객체를 고아로 만든다.
--    deleteShopImage 도 행만 지우고 Storage 객체를 남긴다.
--    기존 행은 storage_path 가 NULL 이라 안전한 삭제 경로가 없다.
--    크롭·삭제·교체를 하나의 이미지 생명주기로 함께 고쳐야 한다. 우선순위 높음.
-- 3. exhibit_storage_cleanup_queue 테이블이 이미 존재한다(전시관 이미지용).
--    이미지 생명주기 작업에서 이 구조를 재사용할 수 있는지 검토한다.
-- 4. shop_images 의 INSERT·UPDATE 정책은 owner OR admin 뿐이라 is_claimed 개념이 없다.
--    반면 Storage INSERT 정책은 미인증 샵을 누구에게나 열어뒀다.
--    미인증 샵에서 비소유자가 올리면 Storage 는 통과하고 DB 가 막아 고아가 된다.
--    두 계층의 권한 모델을 맞춰야 한다.
-- 5. anon 이 shop_images 에 INSERT·UPDATE·DELETE 테이블 권한을 갖고 있다.
--    auth.uid() 가 NULL 이라 정책에서 걸리지만 정책이 유일한 방어선이다.
