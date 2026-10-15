-- 커뮤니티 조회수: 같은 사람은 같은 글을 3일에 한 번만 (2026-10-15)
-- 예전: 브라우저 메모리에서만 막아서 새로고침하면 또 올라갔다.
-- 이제: 서버가 "누가 언제 봤는지"를 기록하고, 3일이 지나야 다시 센다.
--   로그인 회원 = 회원 id, 비회원 = 브라우저마다 만든 임의 표시(viewer)
--   표시가 없으면(아주 옛날 화면) 세지 않는다.
-- 기록은 3일만 의미가 있어서, 가끔(호출 50번에 한 번꼴) 3일 지난 기록을 지운다
--   → 탈퇴한 회원의 기록도 3일 안에 사라진다.

create table if not exists public.post_view_logs (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  viewer_key text not null,
  viewed_at  timestamptz not null default now(),
  primary key (post_id, viewer_key)
);
create index if not exists post_view_logs_viewed_at_idx on public.post_view_logs (viewed_at);
alter table public.post_view_logs enable row level security;
revoke all on table public.post_view_logs from anon, authenticated;
-- (정책 없음 — 아래 함수만 소유자 권한으로 읽고 쓴다)

drop function if exists public.increment_post_view(uuid);

create or replace function public.increment_post_view(post uuid, viewer text default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  k text;
  n int;
begin
  if auth.uid() is not null then
    k := 'u:' || auth.uid()::text;
  elsif viewer ~ '^[A-Za-z0-9-]{8,64}$' then
    k := 'a:' || viewer;
  else
    return;
  end if;

  if not exists (select 1 from community_posts where id = post) then return; end if;

  with up as (
    insert into post_view_logs (post_id, viewer_key) values (post, k)
    on conflict (post_id, viewer_key) do update set viewed_at = now()
      where post_view_logs.viewed_at < now() - interval '3 days'
    returning 1
  )
  select count(*) into n from up;

  if n > 0 then
    update community_posts set view_count = coalesce(view_count, 0) + 1 where id = post;
  end if;

  if random() < 0.02 then
    delete from post_view_logs where viewed_at < now() - interval '3 days';
  end if;
end
$fn$;

revoke all on function public.increment_post_view(uuid, text) from public;
grant execute on function public.increment_post_view(uuid, text) to anon, authenticated;

-- [확인] 1행: increment_post_view | post uuid, viewer text DEFAULT NULL::text
select p.proname, pg_get_function_arguments(p.oid)
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
 where s.nspname = 'public' and p.proname = 'increment_post_view';
