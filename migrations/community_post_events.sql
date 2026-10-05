-- 덕메게시판 글 ↔ 이벤트 연결 — "어떤 이벤트에 같이 갈지" 글쓰기에서 고를 수 있게.
--
-- community_posts 에 열을 더하지 않고 따로 표를 둔다.
--   · community_posts 는 열 단위 insert/update 권한(community_posts_write_privileges.sql)과
--     community_posts_visible 뷰가 얽혀 있어서, 열을 더하면 권한·뷰를 같이 손봐야 한다.
--   · 글 하나에 이벤트 하나 (post_id 가 기본키).
--
-- 보기 권한: 글이 보이는 사람만 연결도 보인다 — 정책 안에서 community_posts 를 참조하면
--           그 표의 RLS(숨긴 글 등)가 호출자 기준으로 같이 걸린다. (community_visibility_policies.sql 과 같은 방식)
-- 쓰기 권한: 그 글의 작성자만 연결·해제.
-- 기존 데이터는 건드리지 않는다(새 표만 만든다).


-- ── 1) 표 — post_id 형식은 community_posts.id 와 똑같이 맞춘다 ──
do $$
declare
  post_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into post_id_type
  from pg_attribute a
  where a.attrelid = 'public.community_posts'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.community_post_events (
      post_id    %s primary key references public.community_posts(id) on delete cascade,
      event_id   uuid not null references public.events(id) on delete cascade,
      created_at timestamptz not null default now()
    )$f$, post_id_type);
end $$;

create index if not exists community_post_events_event_idx
  on public.community_post_events (event_id);

comment on table public.community_post_events is
  '덕메게시판 글에 연결한 이벤트 (글 하나에 이벤트 하나). 작성자만 연결·해제.';


-- ── 2) RLS ──
alter table public.community_post_events enable row level security;

drop policy if exists cpe_select on public.community_post_events;
create policy cpe_select on public.community_post_events
  for select
  using (exists (select 1 from public.community_posts p where p.id = post_id));

drop policy if exists cpe_insert on public.community_post_events;
create policy cpe_insert on public.community_post_events
  for insert to authenticated
  with check (exists (select 1 from public.community_posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists cpe_delete on public.community_post_events;
create policy cpe_delete on public.community_post_events
  for delete to authenticated
  using (exists (select 1 from public.community_posts p where p.id = post_id and p.author_id = auth.uid()));


-- ── 3) 권한 (수정은 지우고 다시 넣는 방식이라 update 는 주지 않는다) ──
revoke all on table public.community_post_events from public, anon, authenticated;
grant select on table public.community_post_events to anon, authenticated;
grant insert, delete on table public.community_post_events to authenticated;


select pg_notify('pgrst', 'reload schema');
