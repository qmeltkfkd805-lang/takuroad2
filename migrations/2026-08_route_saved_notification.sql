-- 누군가 내가 올린 루트를 "저장"하면 루트 주인에게 알림을 보낸다.
--   · route_saves 에 INSERT(=저장) 될 때만 발동. 저장 해제(DELETE)는 알림 없음.
--   · 자기 루트를 자기가 저장한 경우는 제외.
--   · 알림 생성이 실패해도 "저장" 자체는 막지 않도록 예외를 삼킨다(AFTER INSERT라 트리거 오류가 나면
--     route_saves INSERT까지 롤백될 수 있어서, 반드시 예외 처리로 감싼다).
--   · notifications 행은 RLS를 우회해야 하므로 SECURITY DEFINER 로 만든다.

create or replace function public.notify_route_saved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid;
  v_title    text;
  v_token    text;
  v_nickname text;
begin
  -- 루트 주인 · 제목 · 공유 토큰
  select user_id, title, share_token
    into v_owner, v_title, v_token
    from public.routes
   where id = new.route_id;

  -- 루트가 없거나, 자기 루트를 자기가 저장했으면 알림 안 보냄
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  -- 저장한 사람 닉네임
  select nickname
    into v_nickname
    from public.profiles
   where id = new.user_id;

  begin
    insert into public.notifications (user_id, type, title, body, link, related_type, related_id, is_read)
    values (
      v_owner,
      'route_saved',
      coalesce(nullif(trim(v_nickname), ''), '누군가') || '님이 루트를 저장했습니다.',
      v_title,
      '/route/' || v_token,
      'route',
      new.route_id,
      false
    );
  exception when others then
    -- 알림 실패가 루트 저장 자체를 막지 않도록 무시
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_route_saved on public.route_saves;
create trigger trg_notify_route_saved
  after insert on public.route_saves
  for each row
  execute function public.notify_route_saved();
