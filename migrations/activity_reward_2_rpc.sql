-- ============================================================
-- 활동 보상 서버 이전 — 2/4  RPC
--
-- ⚠️ 아직 적용하지 말 것. 1/4 (스키마) 적용 후에 적용한다.
--    이 파일을 적용해도 동작은 안 바뀐다. 새 함수를 아무도 안 부른다.
--
-- 두 가지를 한다
--   (1) grant_exp 의 중복 방지를 DB 제약에 맡긴다 (경쟁 조건 제거)
--   (2) record_activity_reward 신설 — 검증·기록·지급을 한 트랜잭션으로
-- ============================================================


-- ============================================================
-- 1. grant_exp — 중복 방지를 uq_exp_logs_once 에 맡긴다
-- ============================================================
--   기존 once 처리는 "select exists → insert" 였다. 원자적이지 않아서
--   동시 요청 둘이 양쪽 다 '없음'으로 읽고 둘 다 넣을 수 있었다.
--   exists 검사는 그대로 두되(정상 경로에서 불필요한 insert 시도를 줄인다),
--   실제 보장은 부분 유니크 인덱스가 한다.
--
--   related_id 가 null 인 지급(daily_goal, quest_*, 관리자 지급)은
--   인덱스 대상이 아니므로 insert 문을 분기한다. on conflict 추론이
--   걸리지 않도록 하기 위한 것이고, 관리자 지급의 반복은 정상 동작이다.
--
--   호출자 가드(rpc_caller_guards.sql)와 search_path 는 그대로 유지한다.
create or replace function public.grant_exp(
  p_user_id      uuid,
  p_amount       integer,
  p_reason       text,
  p_related_type text default null,
  p_related_id   uuid default null,
  p_once         boolean default false,
  p_daily_cap    integer default null
)
returns table(from_level integer, to_level integer, gained integer, total_exp integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_gain int := p_amount; v_used int;
  v_old_total int; v_old_level int; v_new_total int; v_new_level int;
  v_log_id uuid;
begin
  -- ── 호출자 가드 ──
  if auth.uid() is not null
     and p_user_id <> auth.uid()
     and not exists (
       select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
     )
  then
    raise exception '다른 사용자에게 지급할 수 없습니다' using errcode = '42501';
  end if;

  select ue.total_exp, ue.level into v_old_total, v_old_level
    from user_exp ue where ue.user_id = p_user_id;
  v_old_total := coalesce(v_old_total, 0);
  v_old_level := coalesce(v_old_level, 1);

  if p_once and p_related_id is not null then
    if exists (select 1 from exp_logs e
               where e.user_id = p_user_id and e.reason = p_reason and e.related_id = p_related_id) then
      return query select v_old_level, v_old_level, 0, v_old_total; return;
    end if;
  end if;

  if p_daily_cap is not null then
    select coalesce(sum(e.amount), 0) into v_used from exp_logs e
      where e.user_id = p_user_id and e.reason = p_reason and e.created_at >= date_trunc('day', now());
    v_gain := least(p_amount, p_daily_cap - v_used);
    if v_gain <= 0 then
      return query select v_old_level, v_old_level, 0, v_old_total; return;
    end if;
  end if;

  if p_related_id is null then
    -- 인덱스 대상이 아니다. 반복 지급이 정상인 경로(관리자 지급·일일 보상).
    insert into exp_logs (user_id, amount, reason, related_type, related_id)
      values (p_user_id, v_gain, p_reason, p_related_type, p_related_id)
      returning id into v_log_id;
  else
    insert into exp_logs (user_id, amount, reason, related_type, related_id)
      values (p_user_id, v_gain, p_reason, p_related_type, p_related_id)
      on conflict (user_id, reason, related_id) where related_id is not null do nothing
      returning id into v_log_id;

    -- 동시 요청이 먼저 넣었다. 이미 지급된 것으로 보고 현재 상태를 돌려준다.
    if v_log_id is null then
      select ue.total_exp, ue.level into v_new_total, v_new_level
        from user_exp ue where ue.user_id = p_user_id;
      return query select v_old_level,
                          coalesce(v_new_level, v_old_level),
                          0,
                          coalesce(v_new_total, v_old_total);
      return;
    end if;
  end if;

  v_new_total := v_old_total + v_gain;
  select lt.level into v_new_level from level_thresholds lt
    where lt.min_exp <= v_new_total order by lt.level desc limit 1;
  v_new_level := coalesce(v_new_level, 1);

  insert into user_exp (user_id, total_exp, level)
    values (p_user_id, v_new_total, v_new_level)
    on conflict (user_id) do update set total_exp = excluded.total_exp, level = excluded.level;

  -- 레벨업 기록 (영구 연대기 + 일시 알림)
  if v_new_level > v_old_level then
    insert into notifications (user_id, type, title, body, link, is_read, created_at)
      values (p_user_id, 'level_up', 'LV.' || v_new_level || ' 달성',
              '레벨 ' || v_new_level || '에 올랐어요!', '/growth', false, now());
    insert into activity_logs (user_id, type, title, snapshot, occurred_at)
      values (p_user_id, 'level_up', 'LV.' || v_new_level || ' 달성',
              jsonb_build_object('level', v_new_level), now());
  end if;

  return query select v_old_level, v_new_level, v_gain, v_new_total;
end;
$fn$;

revoke execute on function
  public.grant_exp(uuid, integer, text, text, uuid, boolean, integer) from public, anon;
grant execute on function
  public.grant_exp(uuid, integer, text, text, uuid, boolean, integer) to authenticated, service_role;
-- ⚠️ authenticated 회수는 4/4 에서 한다. 여기서 미리 끊으면 정상 적립이 멈춘다.


-- ============================================================
-- 2. record_activity_reward — 검증 · 기록 · 지급을 한 트랜잭션으로
-- ============================================================
--   설계 원칙
--     · 클라이언트는 type 과 source_id 만 보낸다.
--       userId 는 세션에서, amount·related_id·once 는 이 함수가 정한다.
--     · type 은 아래 허용 목록에 없으면 거부한다.
--     · 원본 행이 실제로 있고, 소유자가 본인이고, 삭제·비공개 상태가 아닐 때만 기록한다.
--     · activity_logs insert 와 EXP 지급이 같은 함수 = 같은 트랜잭션이다.
--       "기록은 됐는데 EXP 만 빠짐" 같은 부분 실패가 구조적으로 불가능하다.
--     · 같은 source_id 로 다시 부르면 uq_activity_logs_source 에 걸려
--       아무것도 새로 만들지 않고 현재 상태를 돌려준다.
--
--   호출자
--     오직 /api/activity (service_role) 와 /api/admin/approve-submission.
--     브라우저에는 EXECUTE 를 주지 않는다.
--
--   p_snapshot / p_title 은 서버 라우트가 만든다(주소→덕질지역 변환 같은 TS 유틸이
--   필요하기 때문이다). 클라이언트에서 받은 값을 그대로 넘기면 안 된다.
--
--   지급하지 않는 것 — 허용 목록에 아예 넣지 않았다
--     work_register   작품을 무제한으로 만들 수 있어 검수 정책 전까지 보상 없음
--     badge           배지 평가 경로가 따로 처리
--     featured_fanart run_fanart_selection(DB)이 이미 처리
--     daily_goal/quest claim_daily_* RPC 가 이미 처리
--
--   EXP 0 으로 기록만 하는 것
--     shop_visit / event_visit — 현장 증명이 없어 보상하지 않는다.
--     다만 연대기(storyBuilder)가 이 기록으로 만들어지므로 기록은 남긴다.
create or replace function public.record_activity_reward(
  p_user      uuid,
  p_type      text,
  p_source_id uuid,
  p_snapshot  jsonb default '{}'::jsonb,
  p_title     text  default null,
  p_work_id   uuid  default null
)
returns table(
  recorded   boolean,
  rewarded   boolean,
  gained     integer,
  from_level integer,
  to_level   integer,
  total_exp  integer
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_related      uuid;
  v_related_type text;
  v_xp           int := 0;
  v_activity_id  uuid;
  v_res          record;
  v_title        text;
  v_log_activity boolean := true;   -- fanart 만 false. 아래 주석 참고.
  s              jsonb;
begin
  if p_user is null or p_type is null or p_source_id is null then
    raise exception '입력이 부족합니다' using errcode = '22023';
  end if;
  s := coalesce(p_snapshot, '{}'::jsonb);

  -- ── 허용 목록 + 원본 검증 ──
  if p_type = 'review' then
    select r.shop_id into v_related from public.reviews r
      where r.id = p_source_id and r.user_id = p_user
        and coalesce(r.is_deleted, false) = false;
    if v_related is not null then
      v_related_type := 'shop';
    else
      select er.event_id into v_related from public.event_reviews er
        where er.id = p_source_id and er.user_id = p_user
          and coalesce(er.is_deleted, false) = false;
      v_related_type := 'event';
    end if;
    v_xp := 10;

  elsif p_type = 'photo_upload' then
    -- 원본은 리뷰다. 사진이 실제로 붙어 있어야 한다.
    select r.shop_id into v_related from public.reviews r
      where r.id = p_source_id and r.user_id = p_user
        and coalesce(r.is_deleted, false) = false
        and exists (select 1 from public.review_images ri where ri.review_id = r.id);
    v_related_type := 'shop';
    v_xp := 3;

  elsif p_type = 'shop_register' then
    select s.id into v_related from public.shops s
      where s.id = p_source_id and s.added_by = p_user and s.status = 'active';
    v_related_type := 'shop';
    v_xp := 15;

  elsif p_type = 'route_created' then
    select r.id into v_related from public.routes r
      where r.id = p_source_id and r.user_id = p_user;
    v_related_type := 'route';
    v_xp := 15;

  elsif p_type = 'fanart' then
    -- ⚠️ 팬아트는 activity_logs 행을 만들지 않는다.
    --    지금도 communityPostService 가 addExpOnce 만 부르고 활동 기록은 안 남긴다.
    --    ActivityType union 에 'fanart' 가 없고 ACTIVITY_SENTENCE 에도 없어서,
    --    행을 만들면 연대기·활동 기록에 문구 없는 항목이 새로 생긴다.
    --    멱등은 uq_exp_logs_once (user_id, 'fanart', post_id) 가 보장한다.
    select p.id into v_related from public.community_posts p
      where p.id = p_source_id and p.author_id = p_user
        and p.board = 'fanart' and p.status = 'active';
    v_related_type := 'post';
    v_xp := 10;
    v_log_activity := false;

  elsif p_type = 'event_submit' then
    -- 보상 대상은 제보자다. 승인된 제보만.
    select es.event_id into v_related from public.event_submissions es
      where es.id = p_source_id and es.submitted_by = p_user
        and es.status = 'approved' and es.event_id is not null;
    v_related_type := 'event';
    v_xp := 15;

  elsif p_type = 'route_completed' then
    -- GPS 세션이 검증한 완주만 보상한다. 브라우저가 직접 넣은 행은 여기 안 걸린다.
    select rc.route_id into v_related from public.route_completions rc
      where rc.id = p_source_id and rc.user_id = p_user
        and rc.verification_source = 'gps_session';
    v_related_type := 'route';
    v_xp := 15;

  elsif p_type = 'shop_visit' then
    -- 기록만. 현장 증명이 없어 EXP 는 주지 않는다.
    select c.shop_id into v_related from public.check_ins c
      where c.id = p_source_id and c.user_id = p_user;
    v_related_type := 'shop';
    v_xp := 0;

  elsif p_type = 'event_visit' then
    select ev.event_id into v_related from public.event_visits ev
      where ev.id = p_source_id and ev.user_id = p_user;
    v_related_type := 'event';
    v_xp := 0;

  else
    raise exception '허용되지 않은 활동 유형입니다: %', p_type using errcode = '22023';
  end if;

  if v_related is null then
    raise exception '원본 활동을 찾을 수 없거나 본인의 것이 아닙니다' using errcode = '42501';
  end if;

  -- ── 제목 ──
  --   activity_logs.title 은 NOT NULL 이다. 호출자가 빠뜨리면 활동 기록이
  --   통째로 실패하므로, 호출자에게 맡기지 않고 여기서 만든다.
  --   문구는 activityService.buildLegacyTitle 과 같은 규칙이다.
  --   p_title 은 덮어쓰기용이며 보통은 넘기지 않는다.
  if v_log_activity then
    v_title := nullif(btrim(coalesce(p_title, '')), '');
    if v_title is null then
      v_title := case p_type
        when 'shop_visit'      then coalesce(s->>'shop_name', '샵') || ' 방문'
        when 'event_visit'     then coalesce(s->>'event_name', '이벤트') || ' 참여'
        when 'route_completed' then coalesce(s->>'route_name', '루트') || ' 완주'
        when 'review'          then coalesce(s->>'shop_name', s->>'event_name', '') || ' 리뷰 작성'
        when 'photo_upload'    then '사진 ' || coalesce(s->>'photo_count', '1') || '장 등록'
        when 'shop_register'   then coalesce(s->>'shop_name', '샵') || ' 등록'
        when 'event_submit'    then coalesce(s->>'event_name', '이벤트') || ' 제보 채택'
        when 'route_created'   then coalesce(s->>'route_name', '루트') || ' 제작'
        else '활동'
      end;
    end if;

    -- ── 기록 ──
    insert into public.activity_logs
      (user_id, type, snapshot, related_type, related_id, work_id, occurred_at, title, source_id)
    values
      (p_user, p_type, s, v_related_type, v_related,
       p_work_id, now(), v_title, p_source_id)
    on conflict (user_id, type, source_id) where source_id is not null do nothing
    returning id into v_activity_id;

    if v_activity_id is null then
      -- 이미 기록된 활동이다. EXP 도 이미 처리됐다.
      select ue.total_exp, ue.level into v_res
        from public.user_exp ue where ue.user_id = p_user;
      return query select false, false, 0,
                          coalesce(v_res.level, 1), coalesce(v_res.level, 1),
                          coalesce(v_res.total_exp, 0);
      return;
    end if;
  end if;

  -- ── 지급 ──
  if v_xp > 0 then
    select * into v_res
      from public.grant_exp(p_user, v_xp, p_type, v_related_type, v_related, true, null);
    return query select v_activity_id is not null, coalesce(v_res.gained, 0) > 0,
                        coalesce(v_res.gained, 0),
                        v_res.from_level, v_res.to_level, v_res.total_exp;
    return;
  end if;

  select ue.total_exp, ue.level into v_res
    from public.user_exp ue where ue.user_id = p_user;
  return query select v_activity_id is not null, false, 0,
                      coalesce(v_res.level, 1), coalesce(v_res.level, 1),
                      coalesce(v_res.total_exp, 0);
end;
$fn$;

revoke execute on function
  public.record_activity_reward(uuid, text, uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function
  public.record_activity_reward(uuid, text, uuid, jsonb, text, uuid) to service_role;


-- ============================================================
-- 3. record_gps_route_completion — 완주 저장 + 기록 + 지급을 한 트랜잭션으로
-- ============================================================
--   /api/route-session/end 는 supabase-js(REST)라 트랜잭션이 없다.
--   완주 insert 와 보상 호출을 따로 보내면 "완주는 저장됐는데 EXP 는 빠짐"이
--   생길 수 있다. 셋을 이 함수 안에 넣어 경계를 하나로 만든다.
--
--   ⚠️ 이미 완주 행이 있는 경우
--     route_completions 는 (route_id, user_id) 유니크다. 사용자가 먼저
--     브라우저 버튼으로 완주를 눌러둔 루트를 나중에 GPS 세션으로 완주하면
--     insert 가 막혀 정당한 GPS 완주가 보상을 못 받는다.
--     그래서 이 경우에 한해 기존 행의 verification_source 를 'gps_session' 으로
--     올린다. 실제 GPS 세션이 방금 끝난 시점에만 일어나며,
--     기존 행 일괄 backfill 과는 다르다. 배치로 이 함수를 돌리지 말 것.
--
--   호출자: /api/route-session/end (service_role) 전용.
create or replace function public.record_gps_route_completion(
  p_user     uuid,
  p_route    uuid,
  p_snapshot jsonb default '{}'::jsonb,
  p_title    text  default null
)
returns table(
  recorded   boolean,
  rewarded   boolean,
  gained     integer,
  from_level integer,
  to_level   integer,
  total_exp  integer
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_completion uuid;
begin
  if p_user is null or p_route is null then
    raise exception '입력이 부족합니다' using errcode = '22023';
  end if;
  if not exists (select 1 from public.routes r where r.id = p_route) then
    raise exception '루트를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  insert into public.route_completions (route_id, user_id, verification_source)
  values (p_route, p_user, 'gps_session')
  on conflict (route_id, user_id) do nothing
  returning id into v_completion;

  if v_completion is null then
    -- 이미 완주 행이 있다. 브라우저 경로로 먼저 눌러둔 경우를 위해
    -- 이번 GPS 검증 결과로 올려준다 (일괄 backfill 아님).
    update public.route_completions
       set verification_source = 'gps_session'
     where route_id = p_route and user_id = p_user
       and verification_source is distinct from 'gps_session'
    returning id into v_completion;

    if v_completion is null then
      select rc.id into v_completion from public.route_completions rc
       where rc.route_id = p_route and rc.user_id = p_user;
    end if;
  end if;

  return query
    select * from public.record_activity_reward(
      p_user, 'route_completed', v_completion, p_snapshot, p_title, null);
end;
$fn$;

revoke execute on function
  public.record_gps_route_completion(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function
  public.record_gps_route_completion(uuid, uuid, jsonb, text) to service_role;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 확인]
-- ============================================================
-- -- 브라우저는 못 부른다
-- begin; set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<테스트계정>","role":"authenticated"}';
-- select * from public.record_activity_reward('<테스트계정>','review','<리뷰 id>');
-- rollback;   -- → 42501 permission denied for function record_activity_reward
--
-- -- service_role 로 정상 기록 (rollback 이라 반영 안 됨)
-- begin; set local role service_role;
-- select * from public.record_activity_reward('<작성자 id>','review','<그 사람 리뷰 id>');
-- rollback;   -- → recorded=true
--
-- -- 남의 원본은 거부
-- begin; set local role service_role;
-- select * from public.record_activity_reward('<다른 사람 id>','review','<남의 리뷰 id>');
-- rollback;   -- → 42501 원본 활동을 찾을 수 없거나 본인의 것이 아닙니다
--
-- -- 허용 목록에 없는 유형은 거부
-- begin; set local role service_role;
-- select * from public.record_activity_reward('<id>','work_register','<tag id>');
-- rollback;   -- → 22023 허용되지 않은 활동 유형입니다: work_register


-- ============================================================
-- [롤백]
--   drop function if exists public.record_activity_reward(uuid, text, uuid, jsonb, text, uuid);
--   grant_exp 는 rpc_caller_guards.sql 의 정의로 되돌린다
--   (on conflict 분기만 빼면 동일하다).
--   ⚠️ 되돌리면 동시 요청 중복 지급 가능성이 다시 생긴다.
-- ============================================================
