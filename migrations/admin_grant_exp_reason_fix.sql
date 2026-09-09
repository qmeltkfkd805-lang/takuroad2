-- ============================================================
-- admin_grant_exp 마무리 — 사유 NOT NULL · 경로 통합 · 지급 알림
--
-- ⚠️ 이 파일은 세 번의 수정을 합친 최종본이다. 아래 SQL 하나만 실행하면 된다.
--    (admin_member_actions.sql 적용 뒤 이어서 나온 문제들을 정리한 것)
--
-- ============================================================
-- 1) exp_logs.reason 이 NOT NULL 이었다
-- ============================================================
--   admin_member_actions.sql 에서 "사유를 trim 후 빈 값이면 null" 로 만들었는데
--   컬럼이 NOT NULL 이라 사유를 비우고 지급하면 실패했다.
--     null value in column "reason" of relation "exp_logs" violates not-null constraint
--   예전 코드는 클라이언트에서 `expReason.trim() || '관리자 지급'` 으로 채워 보내서
--   이 제약에 걸린 적이 없었다. 서버로 옮기면서 드러났다.
--   => 컬럼 제약은 그대로 두고, 빈 사유는 '관리자 지급' 으로 기록한다(기존 동작과 같다).
--      trim 자체는 유지해서 공백만 넣은 사유가 그대로 저장되지 않게 한다.
--
-- ============================================================
-- 2) 관리자 지급이 레벨업 알림·연대기를 남기지 않았다
-- ============================================================
--   grant_exp(앱의 일반 EXP 적립 경로)와 admin_grant_exp 가 같은 로직을 두 벌로
--   갖고 있었다. 차이는 딱 둘이었다 —
--     grant_exp        레벨업 시 level_up 알림 + activity_logs 연대기 기록
--     admin_grant_exp  둘 다 없음
--   그래서 관리자가 EXP 를 줘서 레벨이 올라가도 알림도 연대기도 안 남았다.
--   같은 결과인데 경로에 따라 갈렸고, 로직이 두 벌이라 앞으로도 계속 어긋난다.
--   => 검증만 여기서 하고 적립은 grant_exp 에 맡긴다.
--      p_once=false, p_daily_cap=null 이라 중복 방지·일일 상한은 걸리지 않는다.
--      related_type='admin_grant', related_id=null 도 기존과 같다.
--
-- ============================================================
-- 3) 관리자 지급 사실 자체를 알리지 않았다
-- ============================================================
--   레벨이 안 오르면 회원은 EXP 가 왜 늘었는지 알 방법이 없다.
--   활동으로 쌓이는 EXP 와 달리 본인이 한 일이 아니기 때문이다.
--   => 지급할 때마다 exp_grant 알림을 보낸다. 본문은 지급 사유다.
--      레벨까지 올랐다면 grant_exp 가 넣는 level_up 알림이 하나 더 간다.
--      (서로 다른 사실이라 둘 다 보낸다)
--
--   notifications 의 INSERT 권한은 notifications_write_privileges.sql 에서
--   anon·authenticated 양쪽 다 회수했다. 이 함수는 security definer 라
--   소유자(postgres) 권한으로 넣는다.
--
--   ⚠️ 알림 아이콘은 종 모양(기본값)이다. NOTI_ICON 맵이 TopBar.tsx 와
--      NotificationsPage.tsx 두 곳에 중복으로 있고 둘 다 사용자 사이트 파일이라
--      이번에는 건드리지 않았다. level_up 도 지금 종 아이콘을 쓴다.
--      exp_grant·level_up 에 메달 아이콘을 붙이는 것은 후속 작업으로 남긴다.
--
-- ✅ 사전 확인
--   exp_logs.amount / user_exp.total_exp : integer (int4)
--   grant_exp(p_user_id, p_amount, p_reason, p_related_type, p_related_id,
--             p_once, p_daily_cap) returns table(from_level, to_level, gained, total_exp)
--   grant_exp 에는 양수·오버플로 검증이 없다 → 그 검증은 여기 남긴다.
-- ============================================================

create or replace function public.admin_grant_exp(uid uuid, amount integer, reason text)
returns json
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_cur    int;
  v_reason text;
  v_actor  uuid := auth.uid();
  v_res    record;
begin
  if v_actor is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles where id = v_actor and role = 'admin'
  ) then
    raise exception '관리자만 지급할 수 있습니다' using errcode = '42501';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'EXP 는 1 이상이어야 합니다' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception '회원을 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  -- user_exp.total_exp 는 integer(int4) 다. 넘치면 지급 자체를 막는다.
  select coalesce((select total_exp from public.user_exp where user_id = uid), 0)
    into v_cur;
  if amount > 2147483647 - v_cur then
    raise exception '지급 후 EXP 가 저장 가능한 범위를 넘습니다 (현재 %, 지급 %)', v_cur, amount
      using errcode = '22003';
  end if;

  -- exp_logs.reason 은 NOT NULL 이다. 빈 사유는 '관리자 지급' 으로 기록한다.
  v_reason := coalesce(nullif(btrim(coalesce(reason, '')), ''), '관리자 지급');

  -- 적립은 grant_exp 에 맡긴다. 레벨업 알림과 연대기 기록이 거기 들어 있다.
  select * into v_res
  from public.grant_exp(uid, amount, v_reason, 'admin_grant', null, false, null);

  -- 관리자 지급은 레벨이 안 올라도 본인에게 알린다.
  if coalesce(v_res.gained, 0) > 0 then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      uid, 'exp_grant',
      'EXP ' || v_res.gained || ' 획득',
      v_reason,
      '/growth'
    );
  end if;

  return json_build_object('total_exp', v_res.total_exp, 'level', v_res.to_level);
end;
$fn$;

revoke execute on function public.admin_grant_exp(uuid, integer, text) from public, anon;
grant execute on function public.admin_grant_exp(uuid, integer, text) to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 확인]
-- ============================================================
--   1. 사유를 비우고 EXP 10 지급          → 성공. 알림 본문이 '관리자 지급'
--   2. 사유를 적고 지급                   → 알림 본문이 그 문구
--   3. 레벨이 안 오르는 소액 지급          → 알림 1개 (EXP n 획득)
--   4. 레벨이 오르는 지급                 → 알림 2개 (EXP n 획득 + LV.n 달성)
--   5. 알림 클릭                         → /growth 로 이동
--   6. 대상 회원 프로필의 연대기           → 레벨업 시 'LV.n 달성' 기록
--
--   select amount, reason, related_type, related_id, created_at
--   from public.exp_logs order by created_at desc limit 5;
--   → related_type='admin_grant', related_id=null
--
--   select type, title, body, link, created_at
--   from public.notifications order by created_at desc limit 5;


-- ============================================================
-- [경계값 테스트] — 관리자 계정으로
-- ============================================================
--   amount = 0        → 22023 EXP 는 1 이상이어야 합니다
--   amount = -100     → 22023
--   amount = 1.5      → PostgREST 타입 변환에서 거부 (함수까지 오지 않음)
--   amount = 2147483647 (현재 EXP > 0)  → 22003 범위 초과


-- ============================================================
-- [롤백]
--   admin_member_actions.sql 의 admin_grant_exp 정의로 되돌린다.
--   ⚠️ 되돌리면 (a) 사유를 비운 지급이 다시 실패하고
--      (b) 레벨업 알림·연대기가 다시 빠지고 (c) 지급 알림이 사라진다.
--      권장하지 않는다.
-- ============================================================
