-- 루트 완주 기록·보상 분리 (2026-09-22)
--
-- 왜
--   비GPS 완주도 연대기에 남겨야 하는데, record_activity_reward 의 route_completed 분기가
--   verification_source = gps_session 인 행만 찾아 비GPS 완주는 기록 자체가 안 됐다.
--   기록은 본인 완주 행이면 남기고, EXP 15 는 서버가 검증한 GPS 완주에만 준다.
--
-- activity_reward_2_rpc.sql 의 함수를 그대로 가져와 두 군데만 바꿨다.
--   (1) v_gps 선언 추가
--   (2) route_completed 분기 - 완주 행 조회에서 gps 조건을 빼고, v_xp 를 조건부로
--
-- 멱등은 그대로다. 지급 키가 (user, route_completed, route_id, once=true) 라
-- 기존 grant_exp 로 이미 받은 완주는 재지급되지 않는다.

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
  v_gps          boolean := false;  -- 완주 행이 서버가 검증한 GPS 완주인가
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
    -- 완주 기록은 GPS 여부와 무관하게 남긴다 (연대기).
    -- 보상은 서버가 검증한 GPS 완주에만 준다.
    -- verification_source 는 service_role 만 쓸 수 있다 (authenticated 는 INSERT 권한 없음, UPDATE 정책 없음).
    select rc.route_id, coalesce(rc.verification_source, '') = 'gps_session'
      into v_related, v_gps
      from public.route_completions rc
     where rc.id = p_source_id and rc.user_id = p_user;
    v_related_type := 'route';
    v_xp := case when v_gps then 15 else 0 end;

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

select pg_notify('pgrst', 'reload schema');
