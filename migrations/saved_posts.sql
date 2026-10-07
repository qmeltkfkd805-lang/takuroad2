-- 커뮤니티 글 저장 (마이페이지 › 저장함 › 글 탭)
--
-- 글 상세의 '저장' 버튼으로 담고, 저장함에서 모아 본다.
--   · (user_id, post_id) 복합 기본키 → 같은 글을 두 번 저장해도 한 줄
--   · 본인 행만 보고·넣고·지운다 (다른 사람이 뭘 저장했는지는 아무도 못 본다)
--   · 넣을 때는 그 글이 나한테 보이는 글이어야 한다 — 정책 안에서 community_posts 를 참조하면
--     그 표의 RLS(숨긴 글·비공개 글 등)가 호출자 기준으로 같이 걸린다 (community_post_events.sql 과 같은 방식)
--   · 글이 지워지면 저장도 같이 지워진다 (on delete cascade)
-- 기존 데이터는 건드리지 않는다(새 표만 만든다).
-- 적용: Supabase SQL Editor 에 아래 전체 실행. 롤백은 맨 아래.


-- ── 1) 표 — post_id 형식은 community_posts.id 와 똑같이 맞춘다 ──
do $$
declare
  post_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into post_id_type
  from pg_attribute a
  where a.attrelid = 'public.community_posts'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.saved_posts (
      user_id    uuid not null references auth.users(id) on delete cascade,
      post_id    %s   not null references public.community_posts(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, post_id)
    )$f$, post_id_type);
end $$;

-- 내 저장 목록을 최신순으로
create index if not exists saved_posts_user_created_idx
  on public.saved_posts (user_id, created_at desc);

comment on table public.saved_posts is
  '커뮤니티 글 저장 (마이페이지 저장함). 본인 행만 접근.';


-- ── 2) RLS ──
alter table public.saved_posts enable row level security;

drop policy if exists saved_posts_select on public.saved_posts;
create policy saved_posts_select on public.saved_posts
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists saved_posts_insert on public.saved_posts;
create policy saved_posts_insert on public.saved_posts
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.community_posts p where p.id = post_id)
  );

drop policy if exists saved_posts_delete on public.saved_posts;
create policy saved_posts_delete on public.saved_posts
  for delete to authenticated
  using (auth.uid() = user_id);


-- ── 3) 권한 (schema_default_privileges.sql 이후라 직접 줘야 한다. 수정은 없음 → update 안 줌) ──
revoke all on table public.saved_posts from public, anon, authenticated;
grant select, insert, delete on table public.saved_posts to authenticated;


select pg_notify('pgrst', 'reload schema');


-- ------------------------------------------------------------
-- 확인
--   select grantee, privilege_type from information_schema.table_privileges
--   where table_schema = 'public' and table_name = 'saved_posts' order by 1, 2;
--   → authenticated : DELETE · INSERT · SELECT 세 줄만
--
-- 롤백 (필요할 때만)
--   drop table if exists public.saved_posts;
-- ------------------------------------------------------------
