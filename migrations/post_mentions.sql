-- 커뮤니티 글 @멘션 알림 (2026-10-15)
-- 글쓰기에서 @닉네임을 고르면 본문에 <a data-mention="회원id"> 로 들어간다.
-- 글이 올라가거나(INSERT) 고쳐질 때(UPDATE) 새로 불린 회원에게만 알림을 보낸다.
--   - 고칠 때 원래 있던 멘션은 다시 보내지 않는다(같은 사람에게 두 번 X)
--   - 나 자신·탈퇴 회원·나를 차단했거나 내가 차단한 회원은 빼고, 한 번 저장에 최대 10명
--   - 공개 글(visibility='public')이고 active 일 때만
--   - 알림이 실패해도 글 저장은 막지 않는다
--
-- ⚠️ 알림 type 에 제약(check)이 걸려 있으면 'mention' 이 막힐 수 있다. 아래 0) 에서 먼저 확인하고,
--    막혀 있으면 이 파일을 실행하지 말고 결과를 알려줄 것.

-- 0) [먼저 확인] notifications.type 제약 — 0행이면 그대로 진행. 행이 나오면 결과를 알려줄 것
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.notifications'::regclass and contype = 'c';

do $chk$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.notifications'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%type%'
       and pg_get_constraintdef(oid) not ilike '%mention%'
  ) then
    raise exception 'notifications.type 에 제약이 있어 mention 이 막힙니다. 0) 쿼리 결과를 알려주세요.';
  end if;
end
$chk$;

create or replace function public.notify_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  new_ids uuid[];
  old_ids uuid[] := '{}';
  uid uuid;
  author_nick text;
  n int := 0;
begin
  if new.status is distinct from 'active' or coalesce(new.visibility, 'public') <> 'public' then return new; end if;
  if new.content is null or position('data-mention' in new.content) = 0 then return new; end if;

  select array_agg(distinct m[1]::uuid) into new_ids
    from regexp_matches(new.content, 'data-mention="([0-9a-fA-F-]{36})"', 'g') as m;
  if new_ids is null then return new; end if;

  if tg_op = 'UPDATE' and old.content is not null then
    select coalesce(array_agg(distinct m[1]::uuid), '{}') into old_ids
      from regexp_matches(old.content, 'data-mention="([0-9a-fA-F-]{36})"', 'g') as m;
  end if;

  select nickname into author_nick from profiles where id = new.author_id;

  foreach uid in array new_ids loop
    exit when n >= 10;
    continue when uid = new.author_id or uid = any(old_ids);
    continue when not exists (select 1 from profiles p where p.id = uid and coalesce(p.status, '') <> 'deleted');
    begin
      continue when exists (
        select 1 from user_blocks b
         where (b.blocker_id = uid and b.blocked_id = new.author_id)
            or (b.blocker_id = new.author_id and b.blocked_id = uid)
      );
    exception when undefined_table or undefined_column then null;   -- 차단 테이블 모양이 다르면 차단 확인만 건너뜀
    end;
    begin
      insert into notifications (user_id, type, title, body, link, related_type, related_id)
      values (uid, 'mention',
              coalesce(author_nick, '누군가') || '님이 글에서 회원님을 불렀어요',
              left(coalesce(nullif(new.title, ''), '커뮤니티 글'), 80),
              '/community/' || new.id, 'post', new.id);
      n := n + 1;
    exception when others then null;   -- 알림 실패는 글 저장을 막지 않는다
    end;
  end loop;
  return new;
end
$fn$;

drop trigger if exists trg_notify_post_mentions on public.community_posts;
create trigger trg_notify_post_mentions
  after insert or update of content, status, visibility on public.community_posts
  for each row execute function public.notify_post_mentions();

-- [확인] 1행이 나오면 성공
select tgname from pg_trigger where tgname = 'trg_notify_post_mentions';
