-- 작품(tags) 신규 생성을 관리자 전용으로 제한 (2026-09-22)
--
-- 왜
--   tags_user_insert 가 로그인한 누구에게나 작품 생성을 허용하고 있었다.
--   보상을 없애도 중복·오등록·무제한 생성은 그대로다. 검수와 중복 병합 절차가
--   생길 때까지 생성을 관리자에게 한정한다.
--
-- 삭제 전 정책 전체 정의 (2026-09-22 pg_policies 조회, 롤백용 보존)
--   policyname : tags_user_insert
--   permissive : PERMISSIVE
--   roles      : {authenticated}
--   cmd        : INSERT
--   qual       : null
--   with_check : ((auth.uid() IS NOT NULL) AND (created_by = auth.uid()))
--   되돌리는 SQL : migrations/tags_insert_admin_only_ROLLBACK.sql
--
-- 남는 정책 (변경 없음)
--   tags_select_public  SELECT {public}        qual: true
--   tags_owner_update   UPDATE {authenticated} qual/check: (auth.uid() = created_by)
--   tags_admin_update   UPDATE {public}        qual: EXISTS(profiles.id = auth.uid() AND role = admin)
--   tags_write_admin    ALL    {public}        qual: EXISTS(profiles.id = auth.uid() AND role = admin)
--     ⭐ ALL 정책에 with_check 가 없으면 Postgres 는 using 식을 INSERT 검사에도 쓴다.
--        그래서 이 정책 하나로 관리자 생성이 계속 허용된다.
--
-- 영향
--   · 기존 작품 1,992건 그대로. 삭제·회수 없음
--   · 조회(SELECT)와 소유자 수정(UPDATE)은 그대로
--   · src/scripts/*.mjs 임포트 스크립트는 service_role 이라 RLS 우회 (영향 없음)
--   · 앱에서 작품을 만드는 코드는 workRegisterService.createWork 하나뿐
--   · 서버에서 service_role 로 tags 를 INSERT 할 수 있는 경로는 /api/admin/upsert 하나이며,
--     그 라우트는 profiles.role = 'admin' 을 서버에서 먼저 확인한다
--     (RLS 밖이라 이 정책 삭제로는 막히지 않는다 — 라우트의 검사가 유일한 방어선)

drop policy if exists tags_user_insert on public.tags;

-- 확인
select policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'tags'
 order by policyname;
