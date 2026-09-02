-- ============================================================
-- 🚨 보안 수정 — 회원이 스스로 관리자가 되는 것을 막는다
--
-- 문제 (2026-09-02 확인):
--   profiles_update_own | UPDATE | {public} | using (id = auth.uid()) | with check: null
--
--   Postgres는 UPDATE 정책에 WITH CHECK가 없으면 USING 표현식을 검사에도 쓴다.
--   따라서 검사 조건이 "자기 행인가" 뿐이고, 어떤 컬럼을 바꾸든 통과한다.
--   로그인한 사람이면 누구나 브라우저에서 이렇게 관리자가 될 수 있었다:
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', <자기 id>)
--
--   앱의 모든 관리자 검사가 profiles.role = 'admin' 을 보기 때문에,
--   관리자가 되면 회원 정보 조회·샵 삭제·배지 지급·문의 열람이 전부 열린다.
--   profiles에 role을 보호하는 트리거도 없었다.
--
-- 조치:
--   RLS의 WITH CHECK로 막으려면 같은 테이블을 서브쿼리로 읽어야 해서 재귀 위험이 있다.
--   트리거는 OLD를 직접 보므로 서브쿼리가 필요 없고 확실하다.
--   기존 정책(profiles_update_own)은 건드리지 않는다 — 닉네임·아바타 수정은 그대로 동작해야 한다.
--
-- 범위:
--   권한·제재와 관련된 컬럼만 잠근다. 평범한 프로필 수정은 영향받지 않는다.
--   (when 절 덕분에 그런 수정에서는 트리거 함수가 호출조차 되지 않는다)
-- ============================================================


-- ── 1) 관리자 판정 함수 ─────────────────────────────────────
-- 지금까지 정책·함수마다 exists(select 1 from profiles ... role='admin')를 인라인으로
-- 반복해 왔다. 여기서 한 곳으로 모은다. 기존 정책·함수는 이번에 건드리지 않는다.
--   security definer  — profiles의 RLS와 무관하게 판정하기 위해
--   set search_path   — 스키마 가로채기 방지
--   public.profiles   — 스키마 명시
--   stable            — 같은 트랜잭션 안 재호출 절감
--   동적 SQL 없음. 실행 권한은 authenticated에만.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $is_admin$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$is_admin$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- ── 2) 권한 컬럼 변경 차단 트리거 ───────────────────────────
-- 통과시키는 경우는 셋뿐이다:
--   (a) Service Role  — 관리자 API(/api/admin/upsert)가 이 경로로 회원 권한을 바꾼다.
--                       Service Role 키는 서버에만 있어 브라우저에서는 탈 수 없다.
--   (b) 관리자 본인    — 관리자 화면에서 직접 바꾸는 경우
--   (c) JWT 자체가 없는 접속 — SQL Editor·마이그레이션 같은 직접 DB 연결.
--                       이미 DB 전체 권한이 있는 주체라 새로 열어주는 게 없다.
--                       (이 예외가 없으면 나중에 SQL Editor로 권한을 못 고친다)
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $guard$
declare
  claims text := current_setting('request.jwt.claims', true);
begin
  -- (c) PostgREST 요청이 아니다 = 직접 DB 연결
  if claims is null or claims = '' then
    return new;
  end if;

  -- (a) Service Role
  if coalesce(claims::jsonb ->> 'role', '') = 'service_role' then
    return new;
  end if;

  -- (b) 관리자
  if public.is_admin() then
    return new;
  end if;

  -- 조용히 되돌리면 공격을 못 본 채 넘어간다. 명시적으로 거부한다.
  raise exception '권한·제재 관련 값은 본인이 변경할 수 없습니다'
    using errcode = '42501';   -- insufficient_privilege
end;
$guard$;

revoke all on function public.profiles_guard_privileged() from public, anon, authenticated;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row
  when (new.role            is distinct from old.role
     or new.status          is distinct from old.status
     or new.suspended_until is distinct from old.suspended_until
     or new.is_beta         is distinct from old.is_beta
     or new.admin_note      is distinct from old.admin_note
     -- 여권 번호는 가입 때 trg_assign_passport_number가 부여한다.
     -- 앱 코드에는 읽는 곳만 있고 쓰는 곳이 없다 → 사용자가 바꿀 이유가 없다.
     or new.passport_number is distinct from old.passport_number)
  execute function public.profiles_guard_privileged();


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- -- 1) 트리거가 붙었는가
-- select tgname, pg_get_triggerdef(oid) from pg_trigger
-- where tgrelid = 'public.profiles'::regclass and not tgisinternal;
--
-- -- 2) 관리자 목록이 그대로인가 (규땡 / 죤죠니 2명)
-- select id, nickname, role, created_at from public.profiles
-- where role <> 'user' order by created_at desc;
--
-- -- 3) 일반 계정 브라우저 콘솔에서 (반드시 관리자가 아닌 계정으로)
-- --    await supabase.from('profiles').update({ role: 'admin' }).eq('id', <자기 id>)
-- --      → 42501 에러가 나야 정상
-- --    await supabase.from('profiles').update({ nickname: '테스트' }).eq('id', <자기 id>)
-- --      → 그대로 성공해야 정상 (트리거가 안 걸림)
-- --
-- -- 4) 관리자 화면 → 회원 → 등급 변경 저장이 되는가
-- --    (/api/admin/upsert = Service Role 경로)


-- ============================================================
-- [남은 과제] 이번 파일에서 다루지 않았다
-- ============================================================
-- (1) profiles SELECT가 전면 공개다. 같은 정책이 셋 중복돼 있고 전부 qual=true라
--     비로그인(anon)도 admin_note·status·suspended_until·signup_* 를 읽을 수 있다.
--     RLS는 행 단위라 컬럼을 못 가리므로 컬럼 권한 회수가 필요하다:
--       revoke select (admin_note, status, suspended_until,
--                      signup_channel, signup_referrer, signup_landing_path,
--                      signup_utm_source, signup_utm_medium, signup_utm_campaign)
--         on public.profiles from anon, authenticated;
--     ⚠️ 클라이언트가 그 컬럼을 직접 select하는 곳이 있으면 깨진다. 코드 조사 후 별도 진행.
--     중복 SELECT 정책 3개(profiles_public_read / _select_all / _select_public) 정리도 함께.
--
-- (2) 경험치·레벨은 profiles가 아니라 별도 테이블 public.user_exp(total_exp, level)에 있다.
--     2026-09-02 점검 결과 user_exp는 RLS가 켜져 있고 정책이 SELECT 하나뿐이라
--     클라이언트 INSERT/UPDATE/DELETE가 전부 거부된다 → 자기 레벨 조작 불가. 조치 불필요.
--     (RLS가 켜진 테이블에서 정책이 없는 명령은 거부되는 규칙을 이용한 형태다)


-- ============================================================
-- [롤백]
-- ============================================================
-- drop trigger if exists profiles_guard_privileged on public.profiles;
-- drop function if exists public.profiles_guard_privileged();
-- -- is_admin()은 shop_review.sql 등 다른 곳에서 쓰기 시작했다면 남겨둘 것
-- drop function if exists public.is_admin();
-- select pg_notify('pgrst', 'reload schema');
