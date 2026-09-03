-- ============================================================
-- shops 를 갱신하는 트리거 함수 3개를 security definer 로
--
-- 🔴 장애 대응으로 적용한 건이다. shops_write_privileges.sql 의 후속.
--
-- 무슨 일이 있었나:
--   shops_write_privileges.sql 에서 shops 의 테이블 단위 UPDATE 를 회수하고
--   29개 컬럼만 허용했다. 그런데 **다른 테이블의 트리거**가 shops 를 갱신하고
--   있었고, 그 함수들이 security invoker(호출자 권한)라 전부 막혔다.
--
--     POST /rest/v1/reviews → 403
--     {"code":"42501","message":"permission denied for table shops"}
--
--   그래서 아래가 조용히 깨져 있었다:
--     후기 작성·수정·삭제        (reviews → update_shop_rating)
--     샵 저장/해제               (saved_shops → update_bookmark_count)
--     샵 사진·태그·카테고리 변경  (shop_images / shop_tags / shop_categories
--                                 → touch_shop_updated_at)
--
--   영업시간 수정은 shops 컬럼을 직접 UPDATE 하는 경로라 멀쩡했고, 그래서
--   적용 직후에는 드러나지 않았다.
--
-- 왜 이 해법인가:
--   평점·저장수·updated_at 은 시스템이 유지하는 집계값이지 사용자가 쓰는 값이
--   아니다. 사용자에게 그 컬럼들의 UPDATE 권한을 주는 것은 애초에 막으려던 것을
--   다시 여는 셈이다. 집계 트리거를 소유자 권한으로 돌리는 것이 맞다.
--
-- ✅ 사전 확인 (2026-09-03)
--   shops / reviews / notifications  owner=postgres, rls=true, force=false
--   세 함수 모두 owner=postgres
--   → definer 로 바꾸면 postgres 권한으로 돌고, force=false 라 RLS 도 우회한다.
--   (앞서 함수 소유자를 확인하지 않고 다른 함수를 definer 로 바꿨다가 원인을
--    잘못 짚은 적이 있다. 소유자 확인이 이 작업의 전제다.)
--
--   search_path 에 extensions 를 포함한다. 순수 public 만 두면 확장 스키마의
--   함수를 스키마 없이 부르는 코드가 있을 때 깨진다.
-- ============================================================

alter function public.update_shop_rating()    security definer;
alter function public.update_shop_rating()    set search_path to 'public', 'extensions', 'pg_temp';

alter function public.update_bookmark_count() security definer;
alter function public.update_bookmark_count() set search_path to 'public', 'extensions', 'pg_temp';

alter function public.touch_shop_updated_at() security definer;
alter function public.touch_shop_updated_at() set search_path to 'public', 'extensions', 'pg_temp';

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- -- 잠근 테이블에 쓰면서 호출자 권한으로 도는 함수가 남아있는지 훑는다.
-- -- 결과가 비어 있어야 한다.
-- select (p.proname || '  ->  ' || t.tbl)::text as "definer 아닌 함수 / 쓰는 테이블"
-- from pg_proc p
-- cross join lateral (values
--   ('shops'),('community_posts'),('post_comments'),('review_comments'),
--   ('post_reports'),('notifications'),('shop_verify_requests'),('profiles'),('reviews')
-- ) as t(tbl)
-- where p.pronamespace = 'public'::regnamespace
--   and p.prosecdef = false
--   and p.prosrc ~* ('(insert\s+into\s+|update\s+|delete\s+from\s+)(public\.)?' || t.tbl || '\y')
-- order by 1;


-- ============================================================
-- [회귀 테스트]
--   1. 후기 작성 → 저장되고 샵 평점·후기 수가 갱신되는지
--   2. 후기 삭제 → 평점이 다시 계산되는지
--   3. 샵 저장/해제 → 저장 수가 오르내리는지
--   4. 샵 수정에서 사진 추가·삭제 → 저장되는지
--   5. 샵 수정에서 태그·카테고리 변경 → 저장되는지


-- ============================================================
-- [교훈 — 다음에 테이블 권한을 좁힐 때]
-- 그 테이블의 트리거만 보면 부족하다. **다른 테이블의 트리거가 그 테이블에
-- 쓰는 경우**가 진짜 지뢰다. 위 검증 쿼리를 권한 회수 **전에** 돌려서
-- security invoker 함수를 먼저 전부 definer 로 바꿔야 한다.
-- ============================================================
