-- ============================================================
-- security definer RPC 호출자 검증 — 1단계
--
-- ⚠️ 확인 전에는 적용하지 말 것.
--
-- ============================================================
-- 무엇이 문제였나
-- ============================================================
--   pg_default_acl 의 함수 기본 권한이 새 함수마다 anon 에게 EXECUTE 를 붙인다.
--     postgres / f : {postgres=X, anon=X, authenticated=X, service_role=X}
--   그래서 public 의 security definer 함수 대부분이 anon·PUBLIC 에 열려 있다.
--   대부분은 무해하지만(트리거 함수·RLS 헬퍼·공개 조회), **대상과 값을 인자로 받으면서
--   호출자를 확인하지 않는 함수**는 그대로 뚫린다.
--
--   확인된 것 (2026-09-10):
--     grant_exp(p_user_id, p_amount, ...)      비로그인 포함 누구나 아무에게나 EXP
--                                              무한 지급·차감. 검증 한 줄도 없었다.
--                                              어제 admin_grant_exp 에 넣은 검증도
--                                              이 함수가 열려 있으면 우회된다.
--     claim_daily_goal(p_user_id)              남의 일일 목표 보상 수령
--     claim_daily_quests(p_user_id)            남의 일일 퀘스트 보상 수령
--     cast_poll_vote(p_poll, p_options, p_user) 남 명의 투표.
--                                              본문에 delete from poll_votes
--                                              where user_id = p_user 가 있어
--                                              남의 기존 투표를 지우고 바꿔치기까지 된다.
--     increment_route_likes(rid, delta)        delta 가 임의값. 좋아요 수 조작.
--                                              search_path 설정도 아예 없었다.
--     get_dashboard_stats()                    비로그인이 관리자 대시보드 수치 조회
--
--   관리자 확인이 이미 있어 실제로는 막히던 것 (방어 심화로 실행 권한만 회수):
--     get_member_detail, get_timeseries, get_visit_summary
--
--   손대지 않는 것:
--     트리거 함수 20여 개 — 인자가 없고 트리거로만 호출된다. 직접 호출은 에러.
--     RLS 헬퍼 7개 (can_view_goods, can_view_post, is_blocked_between,
--       is_blocked_pair, is_follower_of, goods_profile_scope, object_ref_count)
--       — 정책 식이 호출자 권한으로 평가되므로 회수하면 사이트가 통째로 막힌다.
--     공개 조회 RPC (get_exhibit_*, get_goods_*, get_shared_route, get_post_goods,
--       get_active_works, get_favorite_count) — 비로그인도 봐야 한다.
--     increment_post_view / increment_fan_art_view / increment_visit_count
--       — 비로그인 조회수도 올라가야 한다.
--     close_expired_poll — 본문이 end_mode='date' and now() >= end_at 일 때만 닫는다.
--       이미 만료된 것을 정리할 뿐 앞당겨 마감할 수 없다. 문제 없음.
--
-- ============================================================
-- ✅ 가드 설계 (2026-09-10 확인)
-- ============================================================
--   grant_exp 를 부르는 SQL 함수는 4개이고 전부 definer 다.
--     admin_grant_exp, claim_daily_goal, claim_daily_quests, run_fanart_selection
--   definer 는 **권한**만 바꾸고 JWT 는 그대로다. 즉 이 함수들 안에서도
--   auth.uid() 는 원래 호출자를 가리킨다. 그래서 아래 가드가 안전하다.
--
--     auth.uid() 가 null        → 통과  (service_role·cron 경로.
--                                       anon 은 EXECUTE 회수로 애초에 못 온다)
--     본인에게 지급             → 통과  (expService.addExp, claim_daily_*)
--     관리자                    → 통과  (admin_grant_exp, run_fanart_selection)
--     로그인 사용자가 남에게     → 거부  ← 지금 뚫려 있는 부분
--
--   앱 호출부도 전수 확인했다. 전부 로그인 사용자가 자기 id 로만 부른다.
--     expService.ts:104         grant_exp
--       ← activityService.createActivity 가 유일한 외부 호출자(activityService.ts:107,112).
--         input.userId 는 그 활동을 한 본인이다. 진입점 11개
--         (recordShopVisit / recordEventVisit / recordRouteComplete / recordReview /
--          recordPhoto / recordShopRegister / recordEventSubmit / recordRouteCreated /
--          recordWorkMilestone / checkWorkMilestone / workRegisterService)
--         전부 마찬가지다. 남에게 주는 경로는 없다.
--     lib/routeRun/rewardService.ts:11  grant_exp (grantCompletionRewards)
--       ← sessionService 에서 루트를 완주한 본인에게만 지급한다.
--     growthCenterService.ts:163,171  claim_daily_quests / claim_daily_goal
--     pollService.ts:73         cast_poll_vote
--     routeService.ts:381,385   increment_route_likes
--       ← toggleRouteSave 안에서만 부르고 userId 를 요구한다 = 이미 로그인 전용.
--         delta 는 -1 과 1 뿐이다.
--     adminDashboardService.ts:50  get_dashboard_stats (관리자 화면 전용)
--     adminMemberService.ts:252 / suggestionService.ts:86  admin_grant_exp 경유
--   is_trusted_reporter 는 클라이언트 호출부가 없고, 참조하는 RLS 정책도 없다.
--
--   비로그인이 부르는 RPC 도 대조했다. 전부 anon EXECUTE 가 남아 있다 —
--     get_goods_list/item/counts/collections, get_exhibit_list/item/count,
--     get_active_works, get_post_goods, get_favorite_count, get_shared_route,
--     increment_post_view, increment_visit_count, increment_tag_collection_visit,
--     close_expired_poll, is_blocked_between, link_community_goods_image
--
-- ============================================================
-- ⚠️ 이 파일로 막지 못하는 것
-- ============================================================
--   **로그인한 사용자가 자기에게 EXP 를 주는 것**은 여전히 가능하다.
--   EXP 적립 로직이 브라우저에 있어서(expService.addExp) authenticated 의
--   EXECUTE 를 회수하면 정상 적립이 전부 멈춘다.
--   자동 배지 지급(evaluateBadgeTiersForUser)도 같은 구조다.
--   둘 다 서버(API 라우트 + service_role)로 옮기는 2단계에서 함께 막는다.
--   금액 상한은 제품 기준이 없어 여기서 임의로 만들지 않는다.
-- ============================================================


-- ============================================================
-- 1. grant_exp — 호출자 가드
--    본문은 기존과 동일하다. 맨 앞 가드와 search_path 만 추가했다.
-- ============================================================
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
begin
  -- ── 호출자 가드 (신규) ──
  -- 로그인한 사용자는 자기 자신에게만 줄 수 있다. 관리자는 예외.
  -- auth.uid() 가 null 인 경로(service_role·cron)는 EXECUTE 권한으로 통제한다.
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

  insert into exp_logs (user_id, amount, reason, related_type, related_id)
    values (p_user_id, v_gain, p_reason, p_related_type, p_related_id);

  v_new_total := v_old_total + v_gain;
  select lt.level into v_new_level from level_thresholds lt
    where lt.min_exp <= v_new_total order by lt.level desc limit 1;
  v_new_level := coalesce(v_new_level, 1);

  insert into user_exp (user_id, total_exp, level)
    values (p_user_id, v_new_total, v_new_level)
    on conflict (user_id) do update set total_exp = excluded.total_exp, level = excluded.level;

  -- ⭐ 레벨업 기록 (영구 연대기 + 일시 알림)
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


-- ============================================================
-- 2. claim_daily_goal — 본인 확인
-- ============================================================
create or replace function public.claim_daily_goal(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare v_activity int; v_bonus int := 5; v_goal int := 50;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception '본인만 수령할 수 있습니다' using errcode = '42501';
  end if;

  -- 오늘 이미 받았으면 0
  if exists (select 1 from exp_logs
             where user_id = p_user_id and reason = 'daily_goal'
               and created_at >= date_trunc('day', now())) then
    return 0;
  end if;
  -- 오늘 '활동' XP만 합산 (배지·대표팬아트·일일목표 제외)
  select coalesce(sum(amount), 0) into v_activity from exp_logs
    where user_id = p_user_id and created_at >= date_trunc('day', now())
      and reason not in ('badge', 'featured_fanart', 'daily_goal');
  if v_activity < v_goal then return 0; end if;
  perform grant_exp(p_user_id, v_bonus, 'daily_goal', 'daily', null, false, null);
  return v_bonus;
end;
$fn$;

revoke execute on function public.claim_daily_goal(uuid) from public, anon;
grant execute on function public.claim_daily_goal(uuid) to authenticated, service_role;


-- ============================================================
-- 3. claim_daily_quests — 본인 확인
-- ============================================================
create or replace function public.claim_daily_quests(p_user_id uuid)
returns table(quest text, done boolean, xp integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  d timestamptz := date_trunc('day', now());
  q record; v_done boolean; v_claimed boolean; v_all boolean := true;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception '본인만 수령할 수 있습니다' using errcode = '42501';
  end if;

  for q in select * from (values
    ('attendance', 5), ('comment', 5), ('like', 3), ('post', 5)
  ) as t(key, xp)
  loop
    if q.key = 'attendance' then v_done := true;
    elsif q.key = 'comment' then v_done := exists(select 1 from post_comments where author_id = p_user_id and status = 'active' and created_at >= d);
    elsif q.key = 'like' then v_done := exists(select 1 from post_likes where user_id = p_user_id and created_at >= d);
    elsif q.key = 'post' then v_done := exists(select 1 from community_posts where author_id = p_user_id and status = 'active' and created_at >= d);
    else v_done := false; end if;

    if not v_done then v_all := false; end if;

    v_claimed := exists(select 1 from exp_logs where user_id = p_user_id and reason = 'quest_' || q.key and created_at >= d);
    if v_done and not v_claimed then
      perform grant_exp(p_user_id, q.xp, 'quest_' || q.key, 'quest', null, false, null);
    end if;

    quest := q.key; done := v_done; xp := q.xp; return next;
  end loop;

  -- 전부 완료 보너스 +15 (하루 1회)
  if v_all and not exists(select 1 from exp_logs where user_id = p_user_id and reason = 'quest_all' and created_at >= d) then
    perform grant_exp(p_user_id, 15, 'quest_all', 'quest', null, false, null);
  end if;
  quest := 'all'; done := v_all; xp := 15; return next;
end;
$fn$;

revoke execute on function public.claim_daily_quests(uuid) from public, anon;
grant execute on function public.claim_daily_quests(uuid) to authenticated, service_role;


-- ============================================================
-- 4. cast_poll_vote — 본인 확인 + 로그인 필수
--    본문에 delete from poll_votes where user_id = p_user 가 있어서
--    남의 기존 투표를 지우고 바꿔치기까지 가능했다.
-- ============================================================
create or replace function public.cast_poll_vote(p_poll uuid, p_options uuid[], p_user uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v post_polls%rowtype;
  v_participants int;
  v_closed boolean;
  oid uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_user <> auth.uid() then
    raise exception '본인 명의로만 투표할 수 있습니다' using errcode = '42501';
  end if;

  select * into v from post_polls where id = p_poll;
  if not found then return 'not_found'; end if;

  select count(distinct user_id) into v_participants from poll_votes where poll_id = p_poll;
  v_closed := v.closed
    or (v.end_mode = 'date'  and v.end_at is not null and now() >= v.end_at)
    or (v.end_mode = 'count' and v.max_participants is not null and v_participants >= v.max_participants
        and not exists (select 1 from poll_votes where poll_id = p_poll and user_id = p_user));

  if v_closed then return 'closed'; end if;
  if array_length(p_options, 1) is null then return 'empty'; end if;
  if not v.multi and array_length(p_options, 1) > 1 then return 'single_only'; end if;

  -- 기존 투표 제거 후 재삽입 (재투표 = 교체)
  delete from poll_votes where poll_id = p_poll and user_id = p_user;
  foreach oid in array p_options loop
    if exists (select 1 from poll_options where id = oid and poll_id = p_poll) then
      insert into poll_votes (poll_id, option_id, user_id) values (p_poll, oid, p_user)
      on conflict do nothing;
    end if;
  end loop;

  -- 참여자 수 조건 충족 시 자동 마감
  select count(distinct user_id) into v_participants from poll_votes where poll_id = p_poll;
  if v.end_mode = 'count' and v.max_participants is not null and v_participants >= v.max_participants then
    update post_polls set closed = true where id = p_poll;
  end if;

  return 'ok';
end;
$fn$;

revoke execute on function public.cast_poll_vote(uuid, uuid[], uuid) from public, anon;
grant execute on function public.cast_poll_vote(uuid, uuid[], uuid) to authenticated, service_role;


-- ============================================================
-- 5. increment_route_likes — 로그인 필수 + delta 를 ±1 로 제한
--    원래는 search_path 설정조차 없었다.
--    앱에서 부르는 값은 -1 과 1 뿐이다(routeService.ts:381,385).
-- ============================================================
create or replace function public.increment_route_likes(rid uuid, delta integer)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if delta is null or delta not in (-1, 1) then
    raise exception 'delta 는 -1 또는 1 이어야 합니다: %', delta using errcode = '22023';
  end if;

  update public.routes set likes = greatest(0, coalesce(likes, 0) + delta) where id = rid;
end;
$fn$;

revoke execute on function public.increment_route_likes(uuid, integer) from public, anon;
grant execute on function public.increment_route_likes(uuid, integer) to authenticated, service_role;


-- ============================================================
-- 6. get_dashboard_stats — 관리자 확인
--    본문은 그대로다. language sql → plpgsql 로 바꾼 것은 raise 를 쓰기 위해서다.
-- ============================================================
create or replace function public.get_dashboard_stats()
returns json
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception '관리자만 조회할 수 있습니다' using errcode = '42501';
  end if;

  return (
    select json_build_object(
      'works',             (select count(*) from tags),
      'shops',             (select count(*) from shops where status = 'active'),
      'events',            (select count(*) from events),
      'banners',           (select count(*) from featured_banners where is_active = true),
      'members',           (select count(*) from profiles),
      'favorites',         (select count(*) from user_favorite_tags),
      'new_members_today', (select count(*) from profiles where created_at >= date_trunc('day', now())),
      'shops_total',       (select count(*) from shops where status <> 'deleted'),
      'shops_active',      (select count(*) from shops where status = 'active'),
      'shops_temp',        (select count(*) from shops where status = 'temporary_closed'),
      'shops_closed',      (select count(*) from shops where status = 'closed'),
      'shops_official',    (select count(*) from shops where is_verified = true and status <> 'deleted')
    )
  );
end;
$fn$;

revoke execute on function public.get_dashboard_stats() from public, anon;
grant execute on function public.get_dashboard_stats() to authenticated, service_role;


-- ============================================================
-- 7. 이미 관리자 확인이 있는 함수들 — 실행 권한만 회수 (방어 심화)
--    본문은 손대지 않는다.
-- ============================================================
revoke execute on function public.get_member_detail(uuid)   from public, anon;
revoke execute on function public.get_timeseries(text, integer) from public, anon;
revoke execute on function public.get_visit_summary()       from public, anon;

-- 클라이언트 호출부가 없고 참조하는 RLS 정책도 없다.
-- post_report_autohide 트리거가 부르는데, 그 함수도 definer 라 소유자 권한으로 실행된다.
revoke execute on function public.is_trusted_reporter(uuid) from public, anon;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select p.proname::text as 함수,
--        coalesce((select string_agg(distinct r.grantee, ', ')
--                  from information_schema.routine_privileges r
--                  where r.routine_schema='public' and r.routine_name=p.proname
--                    and r.grantee in ('anon','PUBLIC')), '없음') as 열린_실행권한,
--        coalesce(array_to_string(p.proconfig, ','), 'search_path 없음') as search_path
-- from pg_proc p
-- where p.pronamespace='public'::regnamespace
--   and p.proname in ('grant_exp','claim_daily_goal','claim_daily_quests','cast_poll_vote',
--                     'increment_route_likes','get_dashboard_stats','get_member_detail',
--                     'get_timeseries','get_visit_summary','is_trusted_reporter')
-- order by 1;
--
-- 기대: 10개 모두 열린_실행권한 = '없음',
--       search_path = pg_catalog, public, extensions, pg_temp


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- begin; set local role anon;
-- select * from public.grant_exp('00000000-0000-0000-0000-000000000000', 999999, 'x');
-- rollback;
--   → 42501 permission denied for function grant_exp
--     (적용 전에는 실제로 EXP 가 들어갔다)
--
-- begin; set local role anon;
-- select public.cast_poll_vote('00000000-0000-0000-0000-000000000000',
--                              array[]::uuid[], '00000000-0000-0000-0000-000000000000');
-- rollback;   → 42501 permission denied for function
--
-- begin; set local role anon;
-- select public.increment_route_likes('00000000-0000-0000-0000-000000000000', 999999);
-- rollback;   → 42501 permission denied for function
--
-- begin; set local role anon;
-- select public.get_dashboard_stats();
-- rollback;   → 42501 permission denied for function
--
-- -- 로그인 사용자가 남에게 지급 (앱 콘솔에서 일반 회원 계정으로)
-- --   supabase.rpc('grant_exp', { p_user_id: '<남의 id>', p_amount: 100, p_reason: 'x' })
-- --   → 42501 다른 사용자에게 지급할 수 없습니다
-- --
-- --   supabase.rpc('claim_daily_goal', { p_user_id: '<남의 id>' })
-- --   → 42501 본인만 수령할 수 있습니다
-- --
-- --   supabase.rpc('increment_route_likes', { rid: '<루트 id>', delta: 9999 })
-- --   → 22023 delta 는 -1 또는 1 이어야 합니다


-- ============================================================
-- [회귀 테스트] — 앱에서 확인
--   1. 로그인 후 활동으로 EXP 가 오르는지 (체크인·댓글·좋아요)
--   2. 레벨업 시 알림 + 연대기 기록
--   3. 성장 센터 — 일일 퀘스트·일일 목표 수령
--   4. 커뮤니티 투표 — 투표, 재투표(교체), 마감된 투표
--   5. 루트 좋아요 — 눌렀다 취소, 숫자가 맞는지
--   6. 관리자 대시보드 — 통계 카드가 그대로 뜨는지
--   7. 관리자 회원 관리 — 요약 2칸(전체 회원·오늘 가입)
--   8. 관리자 EXP 지급 — 지급 + 알림
--   9. 비로그인으로 홈·샵·커뮤니티·루트 둘러보기 (콘솔에 42501 이 없어야 함)
--  10. 만료된 투표가 있는 글을 비로그인으로 열기 (close_expired_poll 은 그대로 열려 있다)
--  11. 게시글 신고 (post_report_autohide → is_trusted_reporter 경로)


-- ============================================================
-- [롤백]
--   ⚠️ 호출자 가드와 실행 권한 회수를 되돌리면 취약점이 그대로 살아난다.
--      되돌려야 한다면 원인을 특정한 함수 하나만, 가드는 남기고
--      실행 권한만 임시로 부여하는 쪽을 먼저 검토할 것.
--
--   각 함수의 적용 전 정의는 이 세션에서 pg_get_functiondef 로 확보해 두었다.
--   개별 복원이 필요하면 그 정의를 그대로 create or replace 하면 된다.
--   단 anon·PUBLIC EXECUTE 는 복원하지 않는다.
-- ============================================================
