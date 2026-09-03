-- ============================================================
-- 🚨 보안 — shops 쓰기 권한 정리
--
-- 문제: anon·authenticated 모두 shops에 **테이블 단위** INSERT/UPDATE/DELETE/
--       TRUNCATE/REFERENCES/TRIGGER 권한을 갖고 있고 컬럼 제한이 없다.
--       거기에 shops_update_tiered 정책이
--         (is_claimed is not true) or owner_id = auth.uid() or admin
--       이라, 로그인한 사용자가 **미인증 샵(현재 사실상 전부)의 모든 컬럼**을
--       브라우저에서 직접 바꿀 수 있다.
--         status='deleted'  → 사이트에서 사라짐
--         is_verified=true  → 공식 샵 자칭
--         owner_id 변경     → 사장님 인증 우회
--         평점·방문수 조작
--       /api/admin/shop-status·shop-field의 admin 게이트가 PostgREST 직접 호출로
--       통째로 우회된다.
--
-- 원칙은 profiles와 같다 — **테이블 권한을 걷고 안전한 컬럼만 다시 준다.**
-- 컬럼 REVOKE는 테이블 권한이 남아 있으면 아무 효과가 없다(테이블 권한이
-- 앞으로 추가될 컬럼까지 전부 덮는다). 순서가 핵심이다.
-- 목록에 없는 컬럼은 자동으로 막히고, 앞으로 추가되는 컬럼도 기본이 '금지'가 된다.
--
-- ⚠️ 선행 조건 (2026-09-03 배포 완료)
--    인증 승인이 클라이언트에서 shops.is_claimed·owner_id를 직접 UPDATE하고
--    있었다. /api/admin/shop-verify (service_role)로 옮긴 코드가 **먼저**
--    배포돼 있어야 한다. 안 그러면 이 SQL 직후 인증 승인이 42501로 깨진다.
--    확인: 관리자 페이지 > 인증 심사에서 승인이 정상 동작하는지.
--
-- ⚠️ SELECT는 건드리지 않는다. 이번 작업은 쓰기 권한만이다.
-- ⚠️ RLS 정책도 건드리지 않는다. 정책은 '행'을, 권한은 '컬럼'을 나눈다.
-- ============================================================


-- ── 1) RLS를 우회하는 권한부터 즉시 회수 ─────────────────────
-- TRUNCATE는 RLS를 완전히 무시한다. 통과하면 shops가 통째로 비고,
-- shops를 참조하는 25개 FK 중 CASCADE인 것들(reviews, check_ins, route_shops,
-- shop_images 등)이 연쇄로 지워진다. PostgREST가 직접 쏘지는 못하지만
-- SECURITY INVOKER 함수 하나만 잘못 만들어도 열린다.
-- TRIGGER는 이 테이블에 트리거를 붙일 수 있는 권한이다 —
-- 남의 UPDATE 시점에 자기 함수를 실행시킬 수 있는 통로다.
revoke truncate, references, trigger on table public.shops from anon, authenticated;

-- DELETE: authenticated는 유지한다. shops_delete_admin(USING admin)이 게이트고,
-- 관리자도 authenticated 역할이라 회수하면 샵 상세의 관리자 삭제가 깨진다.
-- (사장님은 지금도 이 정책 때문에 삭제가 안 된다 — 동작 변화 없음)
revoke delete on table public.shops from anon;


-- ── 2) 테이블 쓰기 권한 회수 ────────────────────────────────
revoke insert, update on table public.shops from anon, authenticated;
-- anon은 여기까지. 쓰기 권한을 하나도 돌려주지 않는다.
-- (원래도 INSERT 정책의 auth.uid() is not null과 UPDATE 정책의 {authenticated}
--  때문에 RLS가 막고 있었지만, 방어선을 하나로 두지 않는다)


-- ── 3) INSERT 허용 컬럼 ─────────────────────────────────────
-- 근거: createShop의 payload + slug (2026-09-03 코드 전수 확인).
--   added_by  RLS with_check가 이미 = auth.uid()를 강제한다 (사칭 등록 불가)
--   owner_id  아래 트리거가 auth.uid()로 덮어쓴다
--   status    아래 트리거가 active/hidden으로 제한한다
-- review_status·reviewed_at·reviewed_by는 주지 않는다 —
-- shops_review_set_on_insert가 서버에서 정한다(shop_review.sql).
grant insert (
  name, slug, description, addr, lat, lng,
  hours, parking, parking_note, shop_link, sns_links, phone, floor_info,
  start_date, end_date, event_info,
  temporary_holiday_start, temporary_holiday_end, temporary_holiday_message,
  place_id, floor, unit, cats,
  added_by, owner_id, status
) on public.shops to authenticated;


-- ── 4) UPDATE 허용 컬럼 ─────────────────────────────────────
-- 근거: shops를 UPDATE하는 클라이언트 코드 전수 (2026-09-03)
--   updateShop            콘텐츠 22개 + info_last_confirmed_at·info_confirmed_by_type
--   updateShopFields      hours / temporary_holiday_* (사장님 관리)
--   updateShopCustomGoods custom_goods (기타 취급 굿즈)
--   publishShop           status (일반 사용자가 hidden → active)
--   setShopReviewStatus   review_status (관리자, 클라이언트에서 돈다)
--
-- 관리자 작업 다수가 클라이언트에서 authenticated 역할로 돈다는 게 이 테이블의
-- 함정이다. review_status를 빼면 '검수 완료'가 깨진다. 대신 안전하다 —
-- shops_review_guard_on_update가 관리자 외의 변경을 42501로 거부한다.
--
-- 빠진 것(=차단): is_verified, is_claimed, owner_id, added_by, slug,
--   rating_avg, rating_count, visit_count, bookmark_count,
--   featured_order, admin_recommend_note,
--   deleted_at, deleted_by, delete_reason,
--   country, region, city, district, google_place_id,
--   created_at, updated_at, relocated_to_shop_id,
--   website_url·nearest_station·visit_tip·one_line_feature·has_elevator 등
--   코드에서 쓰기가 0건인 컬럼 전부.
-- 관리자 화면은 이것들을 service_role 서버 경로로 바꾼다
-- (/api/admin/shop-status, /api/admin/shop-field, /api/admin/shop-verify).
grant update (
  name, description, addr, lat, lng,
  hours, parking, parking_note, shop_link, sns_links, phone, floor_info,
  start_date, end_date, event_info,
  temporary_holiday_start, temporary_holiday_end, temporary_holiday_message,
  place_id, floor, unit, cats, custom_goods,
  info_last_confirmed_at, info_confirmed_by_type,   -- 아래 트리거가 값을 강제
  status,                                            -- 아래 트리거가 전이를 제한
  review_status, reviewed_at, reviewed_by            -- 기존 트리거가 관리자 강제
) on public.shops to authenticated;


-- ── 5) INSERT 값 강제 ──────────────────────────────────────
-- BEFORE 트리거가 NEW에 대입하는 건 컬럼 권한 검사를 받지 않는다.
-- 권한은 '문장이 지정한 컬럼'에만 걸리기 때문에, 서버는 권한 없는 컬럼도 채울 수 있다.
--
-- ⚠️ shops.status의 DB 기본값은 'active'가 아니라 'pending'이다.
--    status를 생략하고 INSERT하면 기본값이 들어오는데, pending을 만드는 경로가
--    코드 어디에도 없어(승인제는 폐기) 아무 데도 안 보이는 죽은 상태가 된다.
--    그래서 active/hidden이 아닌 값은 전부 hidden으로 눕힌다.
create or replace function public.shops_guard_on_insert()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $ins_guard$
begin
  -- service_role·직접 DB 접속(auth.uid() null)과 관리자는 그대로 둔다.
  -- Service Role을 무조건 신뢰하는 게 아니라, 서버 코드가 책임지는 영역으로 넘긴다.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  new.added_by := auth.uid();
  new.owner_id := auth.uid();

  -- 위저드는 'hidden'으로 만들고 '등록 완료' 때 공개한다.
  -- 이벤트 리뷰 경로는 'active'로 바로 만든다. 그 둘 외에는 받지 않는다.
  if new.status is null or new.status not in ('active', 'hidden') then
    new.status := 'hidden';
  end if;

  return new;
end;
$ins_guard$;

revoke all on function public.shops_guard_on_insert() from public, anon, authenticated;

drop trigger if exists shops_guard_on_insert on public.shops;
create trigger shops_guard_on_insert
  before insert on public.shops
  for each row execute function public.shops_guard_on_insert();
-- 실행 순서: 같은 시점의 트리거는 이름순이다.
--   shops_guard_on_insert → shops_review_set_on_insert ('g' < 'r')
-- 서로 다른 컬럼을 건드려서 충돌하지 않는다.


-- ── 6) status 전이 제한 ────────────────────────────────────
-- `before update of status` — SET 목록에 status가 있을 때만 함수가 호출된다.
-- 이름·주소만 고치는 평범한 수정에서는 아예 실행되지 않아 profiles 조회도 없다.
--
-- status와 is_verified를 결합하지 않는다. 공개 상태와 공식 인증은 독립된 축이다.
create or replace function public.shops_guard_status_on_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $status_guard$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    -- 일반 사용자에게 허용되는 전이는 하나뿐이다:
    -- "본인이 등록한 샵의 hidden → active" (위저드 등록 완료 = publishShop).
    -- added_by는 OLD를 본다 — 같은 문장에서 바꿔치기해도 소용없게.
    -- (애초에 added_by는 UPDATE 권한이 없어 못 바꾸지만, 방어선을 겹쳐 둔다)
    if not (old.added_by = auth.uid()
            and old.status = 'hidden'
            and new.status = 'active') then
      raise exception '샵 공개 상태는 변경할 수 없습니다'
        using errcode = '42501';   -- insufficient_privilege
    end if;
  end if;

  return new;
end;
$status_guard$;

revoke all on function public.shops_guard_status_on_update() from public, anon, authenticated;

drop trigger if exists shops_guard_status_on_update on public.shops;
create trigger shops_guard_status_on_update
  before update of status on public.shops
  for each row execute function public.shops_guard_status_on_update();


-- ── 7) 정보 확인 시각·주체 강제 ─────────────────────────────
-- 이 두 컬럼은 관리자 대시보드의 '정보 갱신 필요' 목록을 움직인다
-- (info_last_confirmed_at < 90일). 열어두면 미래 시각을 넣어 운영 검토에서
-- 영구히 빠지거나, 'admin'이 확인한 것처럼 위장할 수 있다.
--
-- 권한을 빼면 updateShop·updateShopFields가 통째로 실패하므로(부분 실패가 아니다)
-- 권한은 주되 값을 서버가 덮어쓴다. 클라이언트 코드는 한 줄도 안 고친다.
create or replace function public.shops_force_info_confirm()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $info_guard$
begin
  if auth.uid() is null then
    return new;   -- service_role은 서버 코드가 책임진다
  end if;

  new.info_last_confirmed_at := now();
  new.info_confirmed_by_type := case when public.is_admin() then 'admin' else 'owner' end;
  return new;
end;
$info_guard$;

revoke all on function public.shops_force_info_confirm() from public, anon, authenticated;

drop trigger if exists shops_force_info_confirm on public.shops;
create trigger shops_force_info_confirm
  before update of info_last_confirmed_at, info_confirmed_by_type on public.shops
  for each row execute function public.shops_force_info_confirm();


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- -- 1) 테이블 권한: anon은 SELECT만, authenticated는 SELECT+DELETE만 남아야 한다
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='shops' and grantee in ('anon','authenticated')
-- order by grantee, privilege_type;
--
-- -- 2) 보호 컬럼이 실제로 막혔는가 (전부 false여야 한다)
-- select column_name,
--        has_column_privilege('authenticated','public.shops',column_name,'INSERT') as ins,
--        has_column_privilege('authenticated','public.shops',column_name,'UPDATE') as upd
-- from information_schema.columns
-- where table_schema='public' and table_name='shops'
--   and column_name in ('is_verified','is_claimed','rating_avg','rating_count',
--                       'visit_count','bookmark_count','featured_order',
--                       'admin_recommend_note','deleted_at','deleted_by','delete_reason','slug')
-- order by column_name;
-- -- slug는 INSERT만 true(등록 시 필요), UPDATE는 false여야 한다.
-- -- owner_id·added_by도 INSERT true / UPDATE false.
--
-- -- 3) 트리거가 붙었는가 (6개: guard_on_insert, guard_status_on_update,
-- --    force_info_confirm, review_set_on_insert, review_guard_on_update, + 기존 것)
-- select tgname from pg_trigger
-- where tgrelid='public.shops'::regclass and not tgisinternal order by tgname;
--
-- -- 4) 기존 데이터가 그대로인가
-- select coalesce(status,'(null)') as status, count(*) from public.shops group by 1;
-- select count(*) from public.shops where is_verified = true and status <> 'deleted';


-- ============================================================
-- [REST 직접 우회 테스트]
-- 브라우저 콘솔이 아니라 curl/Postman에서 **일반 사용자 액세스 토큰**으로.
-- (콘솔에는 supabase 전역이 없다)
--
--   PATCH /rest/v1/shops?id=eq.<샵> {"is_verified":true}         → 42501
--   PATCH /rest/v1/shops?id=eq.<샵> {"owner_id":"<나>"}          → 42501
--   PATCH /rest/v1/shops?id=eq.<샵> {"rating_avg":5}             → 42501
--   PATCH /rest/v1/shops?id=eq.<샵> {"status":"deleted"}         → 42501 (트리거)
--   PATCH /rest/v1/shops?id=eq.<남의 active 샵> {"status":"hidden"} → 42501 (트리거)
--   PATCH /rest/v1/shops?id=eq.<샵> {"info_last_confirmed_at":"2030-01-01"}
--                                     → 통과하되 저장값은 now()
--   POST  /rest/v1/shops {"name":"x","is_verified":true}          → 42501
--   POST  /rest/v1/shops {"name":"x","added_by":"<남>"}           → RLS with_check 위반
--   POST  /rest/v1/shops {"name":"x","owner_id":"<남>"}           → 통과하되 owner_id는 내 uid
--
-- [회귀 테스트] 실제 계정으로
--   1. 위저드 신규 등록      → hidden 생성, owner_id=나, review_status=pending
--   2. 위저드 등록 완료      → active 전환 + 경험치 1회
--   3. 이벤트 리뷰 경로 등록  → status active 직행 정상
--   4. 커뮤니티 편집(등록자 아닌 계정으로 미인증 샵 수정) → 성공, 확인 시각 갱신
--   5. 사장님 관리 영업시간·임시휴무 수정 → 성공
--   6. 기타 취급 굿즈(custom_goods) 저장 → 성공
--   7. 인증 승인(/api/admin/shop-verify) → 소유권 이전 정상
--   8. 관리자 검수 완료 토글 → 정상
--   9. 관리자 상태 변경·삭제(/api/admin/shop-status) → service_role이라 무영향
--  10. 관리자 변경 롤백(/api/admin/shop-field) → 무영향
--  11. 샵 상세에서 관리자 하드 삭제 → 정상 (DELETE 권한 유지 확인)


-- ============================================================
-- [롤백] ⚠️ 취약한 상태로 되돌리는 것이다
-- 거의 항상 "인증 승인 서버 경로만 남기고 권한은 유지"하는 부분 롤백이 낫다.
-- ============================================================
-- drop trigger if exists shops_force_info_confirm     on public.shops;
-- drop trigger if exists shops_guard_status_on_update on public.shops;
-- drop trigger if exists shops_guard_on_insert        on public.shops;
-- drop function if exists public.shops_force_info_confirm();
-- drop function if exists public.shops_guard_status_on_update();
-- drop function if exists public.shops_guard_on_insert();
--
-- revoke insert, update on public.shops from authenticated;   -- 컬럼 GRANT 제거
-- grant insert, update, delete, truncate, references, trigger on table public.shops to authenticated;
-- grant insert, update, delete, truncate, references, trigger on table public.shops to anon;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - info_confirmed_by_type: 미인증 샵을 고친 제3자에게도 'owner'가 찍힌다.
--   'community' 값 추가는 대시보드 집계와 함께 검토.
-- - shop_verify_requests도 anon·authenticated에 TRUNCATE·TRIGGER·DELETE 권한이
--   열려 있고, INSERT 시 status='approved'를 직접 심을 수 있다(승인 효과는 없다 —
--   소유권은 service_role 경로만 옮긴다). 별도 마이그레이션으로 정리.
-- - 공식 샵 지정(is_verified) 기능은 정책 확정까지 보류. 공개 API를 만들지 않는다.
-- ============================================================
