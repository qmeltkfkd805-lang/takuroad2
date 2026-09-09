-- ============================================================
-- 관리자 회원 관리 — RPC 정비 (최종안)
--
--   1) get_admin_members 확장 + 관리자 게이트 + 실행 권한 정리
--   2) admin_set_member_role 신설 — 역할 변경
--   3) admin_grant_exp 검증 강화
--
--   이번 범위에서 제외: admin_set_member_status(정지), admin_actions(감사 로그),
--   user_badge_tiers 권한, profiles role CHECK 변경, 정지 강제 RLS
--
-- ⚠️ 확인 전에는 적용하지 말 것.
--
-- ============================================================
-- 🔴 이 파일이 같이 막는 취약점
-- ============================================================
--   get_admin_members 는 security definer 인데
--     (a) 함수 본문에 관리자 확인이 없고
--     (b) anon 과 PUBLIC 에 EXECUTE 가 부여돼 있었다.
--   => 비로그인 상태에서 anon 키만으로 전체 회원 목록
--      (id, 닉네임, 아바타, 역할, 가입일, 전체 인원수)을 조회할 수 있었다.
--      anon 키는 브라우저 번들에 들어 있어 누구나 안다.
--
--   admin_grant_exp 도 anon·PUBLIC 실행 권한이 열려 있었다. 본문에 관리자 확인이
--   있어 실제 지급은 막혔지만 실행 권한 자체가 과했다.
--
--   원인은 pg_default_acl 의 **함수 기본 권한**이다.
--     postgres / f : {postgres=X, anon=X, authenticated=X, service_role=X}
--   새로 만드는 함수마다 anon 에게 EXECUTE 가 자동으로 붙는다. 그래서 이 저장소의
--   RPC 들은 전부 `revoke all on function ... from public, anon` 을 직접 쓰고 있고,
--   이 두 함수만 그게 빠져 있었다.
--   (테이블 기본 권한은 schema_default_privileges.sql 에서 이미 정리했다.
--    함수 기본 권한도 같이 정리할지는 별도 결정 사항으로 남긴다)
--
-- ============================================================
-- ✅ 사전 확인 (2026-09-09, 실제 조회 결과)
-- ============================================================
--   role   : text, CHECK (role in ('user','manager','admin'))
--            실제 값 admin 3 / user 11. manager 0건.
--            'owner'(사장님)는 DB 가 거부하는 값인데 현재 UI 가 제공하고 있었다(버그).
--            사장님은 shops.owner_id / is_claimed 로 관리되는 별개 개념이다.
--   status : text, CHECK 없음. 실제 값 active 14. suspended 0건, 만료 정지 0건.
--   exp_logs.amount / user_exp.total_exp : integer (int4, 최대 2,147,483,647)
--   admin_note : text (길이 제약 없음)
--   기존 두 함수 : owner=postgres / definer=true / search_path=public
--   get_admin_members 를 참조하는 다른 함수 없음
--
-- ============================================================
-- 기존 대비 의도적 차이 2가지 (그 외는 동일하게 복원)
-- ============================================================
--   (1) anon·PUBLIC 의 EXECUTE 를 복원하지 않는다 — 위 취약점을 유지하게 되므로.
--   (2) search_path 를 'public' → 'public','extensions','pg_temp' 로 바꾼다.
--       이 저장소의 다른 모든 definer 함수와 같은 값이다.
--       원본 그대로 'public' 만 원하면 세 함수의 set search_path 줄만 바꾸면 된다.
--
--   owner(postgres), security definer(true),
--   postgres·service_role·authenticated 의 EXECUTE 는 기존과 동일하다.
--
-- ============================================================
-- 정지(status)를 이번 범위에서 뺀 이유
-- ============================================================
--   status='suspended' 를 참조하는 코드가 관리자 화면 밖에 한 줄도 없다.
--   middleware 는 /profile/settings 의 로그인 여부만 보고, RLS 정책에도 status
--   조건이 없다. 즉 정지해도 로그인·글쓰기가 그대로 된다.
--   실제 강제가 없는 상태에서 정지 버튼을 두면 관리자가 조치했다고 오해한다.
--   => 정지 RPC 를 만들지 않고, /api/admin/upsert 의 status·suspended_until 도
--      이번에는 건드리지 않는다. 실제 제재는 별도 후속 작업이다.
--
--   같은 이유로 "마지막 관리자" 판정에서 status 를 뺐다.
--   정지된 관리자도 관리자 RPC 를 그대로 통과하므로, 실제 권한은 role 로만 결정된다.
--   판정에 status 를 넣으면 "정지된 관리자 1명만 남은 상태"를 관리자 0명으로 오판해
--   실제로는 관리자가 살아 있는데 강등을 막는 부정확한 보호가 된다.
--   정지 강제가 생기는 시점에 함께 재검토한다.
-- ============================================================


-- ============================================================
-- 1. get_admin_members 확장
-- ============================================================
-- 반환 타입이 바뀌므로 create or replace 로는 안 되고 drop 후 create 해야 한다.
-- 아래 전체를 한 번에 실행하면 하나의 암묵적 트랜잭션이라 중간 공백이 없고,
-- 어느 문장이든 실패하면 전체가 롤백된다.
--
-- 인자를 3개 → 6개로 늘리되 뒤 3개에 기본값을 준다. 오버로드가 아니라 함수 하나이므로
-- 기존 3개 인자 호출(search, page_limit, page_offset)이 모호성 없이 그대로 동작한다.
-- 반환 컬럼이 2개 늘지만 기존 클라이언트는 쓰는 필드만 읽으므로 영향이 없다.

drop function if exists public.get_admin_members(text, int, int);

create function public.get_admin_members(
  search        text default '',
  page_limit    int  default 20,
  page_offset   int  default 0,
  role_filter   text default null,    -- 'user' | 'admin'
  status_filter text default null,    -- 'active' | 'suspended'
  sort          text default 'recent' -- 'recent' | 'oldest' | 'nickname'
)
returns table (
  id              uuid,
  nickname        text,
  avatar_url      text,
  role            text,
  created_at      timestamptz,
  status          text,
  suspended_until timestamptz,
  total_count     bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
begin
  -- 기존 함수에는 이 확인이 없었다. anon 실행 권한과 합쳐져 회원 목록이 공개돼 있었다.
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception '관리자만 조회할 수 있습니다' using errcode = '42501';
  end if;

  -- 허용 목록. 알 수 없는 값을 조용히 기본값으로 넘기지 않고 오류로 돌려준다.
  -- UI 버그가 "결과 0건"으로 위장되면 안 되기 때문이다.
  if role_filter is not null and role_filter not in ('user', 'admin') then
    raise exception '알 수 없는 역할 필터: %', role_filter using errcode = '22023';
  end if;
  if status_filter is not null and status_filter not in ('active', 'suspended') then
    raise exception '알 수 없는 상태 필터: %', status_filter using errcode = '22023';
  end if;
  if sort is null or sort not in ('recent', 'oldest', 'nickname') then
    raise exception '알 수 없는 정렬: %', sort using errcode = '22023';
  end if;

  -- sort 를 SQL 문자열로 이어붙이지 않는다. order by 안에서 case 로 분기한다.
  -- 고르지 않은 분기는 전 행이 null 이라 정렬에 영향을 주지 않는다.
  return query
  with filtered as (
    select p.id, p.nickname, p.avatar_url, p.role,
           p.created_at,
           coalesce(p.status, 'active') as status,
           p.suspended_until
      from public.profiles p
     where (coalesce(search, '') = '' or p.nickname ilike '%' || search || '%')
       and (role_filter is null or p.role = role_filter)
       and (status_filter is null
            or (status_filter = 'suspended' and coalesce(p.status, 'active') = 'suspended')
            or (status_filter = 'active'    and coalesce(p.status, 'active') = 'active'))
  )
  select f.id, f.nickname, f.avatar_url, f.role, f.created_at,
         f.status, f.suspended_until,
         count(*) over() as total_count   -- limit 전에 계산된다 = 필터 적용 후 전체 건수
    from filtered f
   order by
     case when sort = 'recent'   then f.created_at end desc,
     case when sort = 'oldest'   then f.created_at end asc,
     case when sort = 'nickname' then f.nickname   end asc,
     f.id   -- 동점일 때 페이지 사이 순서가 흔들리지 않게 고정 tiebreak
   limit page_limit offset page_offset;
end;
$fn$;

revoke all on function public.get_admin_members(text, int, int, text, text, text)
  from public, anon;
grant execute on function public.get_admin_members(text, int, int, text, text, text)
  to authenticated;


-- ============================================================
-- 2. admin_set_member_role — 역할 변경
-- ============================================================
-- 왜 API 라우트가 아니라 RPC 인가:
--   "마지막 관리자 보호"는 [관리자 수 세기] → [UPDATE] 두 단계다.
--   supabase-js 는 REST 라 트랜잭션을 열 수 없어서, API 라우트에서 두 번 호출하면
--   그 사이의 경쟁 조건을 원천적으로 막을 수 없다. 관리자 2명이 남은 상태에서
--   두 세션이 동시에 서로를 강등하면 둘 다 통과해 관리자가 0명이 된다.
--   그러면 role='admin' 을 요구하는 모든 RPC·API·정책이 전부 막히고
--   DB 직접 접속 외에는 복구가 불가능하다.
--   RPC 안은 한 트랜잭션이라 잠금으로 직렬화할 수 있다.
--
--   행 단위 FOR UPDATE 는 두 세션이 반대 순서로 잠글 때 교착이 난다.
--   advisory lock 하나로 역할 변경 전체를 직렬화한다. 역할 변경은 극히 드문
--   작업이라 전역 직렬화의 비용이 없다.
--   (정지 강제가 생겨 정지 RPC 를 만들 때도 같은 키를 쓰면 서로에 대해서도 안전하다)

create or replace function public.admin_set_member_role(
  target_id uuid,
  next_role text
)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_actor  uuid := auth.uid();
  v_before text;
  v_left   int;
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = v_actor and p.role = 'admin'
  ) then
    raise exception '관리자만 변경할 수 있습니다' using errcode = '42501';
  end if;

  -- 허용 목록. profiles_role_check 는 manager 도 허용하지만 실제 데이터가 0건이고
  -- 제품에서 의미가 정의된 적이 없어 UI·RPC 양쪽에서 제외한다.
  -- CHECK 제약 자체는 건드리지 않는다.
  if next_role is null or next_role not in ('user', 'admin') then
    raise exception '허용되지 않은 역할입니다: %', next_role using errcode = '22023';
  end if;

  -- 자기 자신은 못 바꾼다. 스스로 강등하면 되돌릴 경로가 없다.
  if target_id = v_actor then
    raise exception '자기 자신의 역할은 변경할 수 없습니다' using errcode = '42501';
  end if;

  -- 여기부터 커밋까지 역할 변경이 직렬화된다
  perform pg_advisory_xact_lock(hashtext('takuroad:admin_guard'));

  -- 잠금을 잡은 뒤에 다시 읽는다. 클라이언트가 보낸 before 값은 쓰지 않는다.
  select p.role into v_before from public.profiles p where p.id = target_id;
  if not found then
    raise exception '회원을 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if v_before = next_role then
    return json_build_object('changed', false, 'before', v_before, 'after', next_role);
  end if;

  -- 관리자를 내리는 경우: 내리고 나서도 관리자가 남아야 한다.
  -- 실제 관리자 권한은 role 로만 결정되므로 status 는 보지 않는다.
  if v_before = 'admin' and next_role <> 'admin' then
    select count(*) into v_left
      from public.profiles p
     where p.role = 'admin' and p.id <> target_id;
    if v_left < 1 then
      raise exception '마지막 관리자는 강등할 수 없습니다' using errcode = '23514';
    end if;
  end if;

  update public.profiles set role = next_role where id = target_id;

  return json_build_object('changed', true, 'before', v_before, 'after', next_role);
end;
$fn$;

revoke all on function public.admin_set_member_role(uuid, text) from public, anon;
grant execute on function public.admin_set_member_role(uuid, text) to authenticated;


-- ============================================================
-- 3. admin_grant_exp 검증 강화
-- ============================================================
-- 기존 동작(exp_logs 기록 → user_exp upsert → {total_exp, level} 반환)은 유지하고
-- 입력 검증만 추가한다. EXP 지급은 증가 전용이다.
--
-- amount 는 이미 integer 파라미터다. 소수·NaN·문자열은 PostgREST 의 타입 변환에서
-- 걸러져 함수 본문까지 오지 않는다. 여기서는 범위만 본다.
--
-- ⚠️ 동작 변화: 지금은 음수가 통과해 EXP 를 깎을 수 있다. 이제 거부된다.
--    차감이 필요하면 지급과 분리된 별도 기능으로 설계한다.
--
-- 운영상 최대 지급량은 만들지 않는다. int4 오버플로만 막는다.
-- 기술적 상한 = 2,147,483,647 - 현재 total_exp

create or replace function public.admin_grant_exp(uid uuid, amount integer, reason text)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_cur    int;
  v_total  int;
  v_level  int;
  v_reason text;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception '관리자만 지급할 수 있습니다' using errcode = '42501';
  end if;

  if amount is null or amount <= 0 then
    raise exception 'EXP 는 1 이상이어야 합니다' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = uid) then
    raise exception '회원을 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  select coalesce((select total_exp from public.user_exp where user_id = uid), 0)
    into v_cur;

  -- user_exp.total_exp 는 integer(int4) 다. 넘치면 지급 자체를 막는다.
  if amount > 2147483647 - v_cur then
    raise exception '지급 후 EXP 가 저장 가능한 범위를 넘습니다 (현재 %, 지급 %)', v_cur, amount
      using errcode = '22003';
  end if;

  v_total  := v_cur + amount;
  v_reason := nullif(btrim(coalesce(reason, '')), '');

  select coalesce(max(level), 1) into v_level
    from public.level_thresholds where min_exp <= v_total;

  insert into public.exp_logs(user_id, amount, reason, related_type)
  values (uid, amount, v_reason, 'admin_grant');

  insert into public.user_exp(user_id, total_exp, level)
  values (uid, v_total, v_level)
  on conflict (user_id) do update set total_exp = v_total, level = v_level;

  return json_build_object('total_exp', v_total, 'level', v_level);
end;
$fn$;

revoke all on function public.admin_grant_exp(uuid, integer, text) from public, anon;
grant execute on function public.admin_grant_exp(uuid, integer, text) to authenticated;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 함수' as 구분,
--        (p.proname || ' / owner=' || pg_get_userbyid(p.proowner) ||
--         ' / definer=' || p.prosecdef::text || ' / ' ||
--         coalesce(array_to_string(p.proconfig, ','), 'search_path 없음'))::text as 값
-- from pg_proc p
-- where p.pronamespace='public'::regnamespace
--   and p.proname in ('get_admin_members','admin_set_member_role','admin_grant_exp')
-- union all
-- select '2. 실행 권한', (grantee || ' : ' || routine_name)::text
-- from information_schema.routine_privileges
-- where routine_schema='public'
--   and routine_name in ('get_admin_members','admin_set_member_role','admin_grant_exp')
-- order by 1, 2;
--
-- 기대:
--   1. 3개 모두 owner=postgres / definer=true / search_path=public, extensions, pg_temp
--   2. postgres · service_role · authenticated 만.
--      anon 과 PUBLIC 이 한 줄도 없어야 한다  ← 이번 취약점 차단의 핵심


-- ============================================================
-- [테스트 1] 기존 3인자 호출 회귀 — 코드 배포 전에 확인
-- ============================================================
-- 현재 화면(adminMemberService.getAdminMembers)이 그대로 도는지 본다.
-- 관리자 계정으로 앱에서 회원 관리 탭을 연다. 목록·검색·페이지가 그대로여야 한다.
--
-- SQL 로도 형태만 확인할 수 있다(관리자 JWT 가 없어 42501 이 나는 것이 정상이다):
--   select * from public.get_admin_members('', 20, 0);
--   → 42501 관리자만 조회할 수 있습니다
--   중요한 건 "함수를 찾을 수 없다"가 아니라 권한 오류가 난다는 점이다.
--   인자 3개 호출이 여전히 유효하다는 뜻이다.


-- ============================================================
-- [테스트 2] 일반 사용자·비로그인 차단
-- ============================================================
-- begin; set local role anon;
-- select * from public.get_admin_members();
-- rollback;
--   → 42501 permission denied for function get_admin_members
--     (적용 전에는 회원 목록이 그대로 나왔다)
--
-- begin; set local role anon;
-- select public.admin_grant_exp('00000000-0000-0000-0000-000000000000', 10, 'x');
-- rollback;
--   → 42501 permission denied for function
--
-- begin; set local role authenticated;
-- select * from public.get_admin_members();
-- rollback;
--   → 42501 관리자만 조회할 수 있습니다 (auth.uid() 가 null)
--
-- begin; set local role authenticated;
-- select public.admin_set_member_role('00000000-0000-0000-0000-000000000000','admin');
-- rollback;
--   → 42501 관리자만 변경할 수 있습니다


-- ============================================================
-- [테스트 3] 허용 목록
-- ============================================================
-- 관리자 계정으로 앱 콘솔에서:
--   supabase.rpc('get_admin_members', { role_filter: 'owner' })      → 22023
--   supabase.rpc('get_admin_members', { sort: 'created_at; drop table profiles' }) → 22023
--   supabase.rpc('admin_set_member_role', { target_id: '...', next_role: 'manager' }) → 22023
--   supabase.rpc('admin_set_member_role', { target_id: '<본인>', next_role: 'user' }) → 42501
-- sort 문자열은 SQL 로 들어가지 않는다. order by 안에서 case 로만 비교한다.


-- ============================================================
-- [테스트 4] 역할 동시 강등 — 세션 2개
-- ============================================================
-- ⚠️ 운영 DB 의 관리자는 현재 3명이다. 이 테스트는 관리자를 2명으로 만들어야 하므로
--    운영에서 하지 말고 스테이징이나 별도 프로젝트에서 한다.
--    (부득이 운영에서 한다면 세 번째 관리자 계정을 미리 확보해 둘 것)
--
-- 관리자가 정확히 2명(A, B)인 상태에서 SQL 에디터 두 탭으로:
--   탭1: begin;
--        select public.admin_set_member_role('<A>', 'user');   -- 성공. 커밋하지 않는다
--   탭2: begin;
--        select public.admin_set_member_role('<B>', 'user');   -- 여기서 멈춘다(잠금 대기)
--   탭1: commit;
--   탭2: → 23514 마지막 관리자는 강등할 수 없습니다
--        rollback;
--
-- advisory lock 이 없으면 두 탭이 각각 "나 말고 관리자 1명 남음"을 보고
-- 둘 다 통과해 관리자가 0명이 된다.
--
-- (SQL 에디터에서 auth.uid() 가 null 이라 관리자 확인에서 먼저 막힌다.
--  실제로는 앱에서 관리자 두 계정으로 동시에 눌러 확인하는 편이 현실적이다.
--  잠금 동작 자체는 아래로 확인할 수 있다)
--   탭1: begin; select pg_advisory_xact_lock(hashtext('takuroad:admin_guard'));
--   탭2: begin; select pg_advisory_xact_lock(hashtext('takuroad:admin_guard'));  -- 멈춤
--   탭1: commit;  → 탭2 가 즉시 풀린다


-- ============================================================
-- [테스트 5] EXP 경계값 — 관리자 계정으로
-- ============================================================
--   amount = 0        → 22023 EXP 는 1 이상이어야 합니다
--   amount = -100     → 22023
--   amount = 1.5      → PostgREST 타입 변환에서 거부 (함수까지 오지 않음)
--   amount = 'abc'    → 같음
--   amount = 2147483647 (현재 EXP > 0 인 회원) → 22003 범위 초과
--   amount = 50       → 성공. exp_logs 에 reason 이 들어갔는지,
--                       user_exp.total_exp 가 정확히 +50 됐는지 확인
--   reason = '   '    → exp_logs.reason 이 null 로 들어가야 한다


-- ============================================================
-- [배포 순서]
-- ============================================================
--   1. 이 migration 적용            ← 기존 3인자 호출이 그대로 동작해 현재 화면이 안 깨진다
--   2. 기존 회원 관리 화면 회귀 확인
--   3. 새 UI 코드 배포
--   4. 새 UI 확인
--   5. /api/admin/upsert 의 ALLOWED.profiles 에서 'role' 만 제거하고 배포
--      → 남는 값: admin_note, status, suspended_until, is_beta
--      (status·suspended_until 은 정지 강제 설계가 끝날 때까지 유지한다)


-- ============================================================
-- [롤백]
-- ============================================================
-- -- get_admin_members 를 원래 정의로. 단, anon·PUBLIC 실행 권한은 복원하지 않는다
-- -- (복원하면 회원 목록이 다시 공개된다)
-- drop function if exists public.get_admin_members(text, int, int, text, text, text);
--
-- create function public.get_admin_members(
--   search text default '', page_limit integer default 20, page_offset integer default 0)
-- returns table(id uuid, nickname text, avatar_url text, role text,
--               created_at timestamptz, total_count bigint)
-- language sql
-- security definer
-- set search_path to 'public'
-- as $$
--   select p.id, p.nickname, p.avatar_url, p.role::text, p.created_at,
--          count(*) over() as total_count
--   from profiles p
--   where (search = '' or p.nickname ilike '%' || search || '%')
--   order by p.created_at desc
--   limit page_limit offset page_offset;
-- $$;
-- revoke all on function public.get_admin_members(text, int, int) from public, anon;
-- grant execute on function public.get_admin_members(text, int, int) to authenticated;
--
-- drop function if exists public.admin_set_member_role(uuid, text);
--
-- -- admin_grant_exp 를 검증 없던 버전으로 (권장하지 않는다 — 음수 지급이 다시 열린다)
-- create or replace function public.admin_grant_exp(uid uuid, amount integer, reason text)
-- returns json
-- language plpgsql
-- security definer
-- set search_path to 'public'
-- as $$
-- declare new_total int; new_level int;
-- begin
--   if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
--     raise exception 'admin only';
--   end if;
--   insert into exp_logs(user_id, amount, reason, related_type)
--     values (uid, amount, reason, 'admin_grant');
--   select coalesce((select total_exp from user_exp where user_id = uid), 0) + amount
--     into new_total;
--   select coalesce(max(level),1) into new_level
--     from level_thresholds where min_exp <= new_total;
--   insert into user_exp(user_id, total_exp, level) values (uid, new_total, new_level)
--     on conflict (user_id) do update set total_exp = new_total, level = new_level;
--   return json_build_object('total_exp', new_total, 'level', new_level);
-- end;
-- $$;
-- revoke all on function public.admin_grant_exp(uuid, integer, text) from public, anon;
-- grant execute on function public.admin_grant_exp(uuid, integer, text) to authenticated;
--
-- select pg_notify('pgrst', 'reload schema');
--
-- ⚠️ 새 UI 가 배포된 뒤에는 롤백하면 회원 관리 화면이 깨진다. 코드를 먼저 되돌릴 것.
-- ============================================================
