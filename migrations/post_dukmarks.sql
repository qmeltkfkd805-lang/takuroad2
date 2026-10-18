-- ============================================================
-- 덕마크 — 덕질 노하우 글에 붙이는 '덕질 북마크' 표시 (2026-10-18)
--
-- 유저가 덕질 노하우(tips) 글을 쓸 때 '덕마크에 올리기'를 켜면 이 표에 한 줄이 생긴다.
-- 글 자체는 그대로 게시판에 있고, 덕마크 탭·홈 추천은 이 표를 보고 카드로 모아 보여준다.
--   · 글 하나 = 덕마크 하나 (post_id 가 기본키). 글이 지워지면 같이 지워진다.
--   · 관련 작품은 글의 tag_ids 를 그대로 쓴다 (작품 없음 = 전체 공통). 여기엔 따로 두지 않는다.
--   · 덕질 노하우 글만 올릴 수 있다. 다른 게시판으로 옮기면 덕마크는 자동으로 빠진다.
--
-- community_posts 에 열을 더하지 않고 따로 표를 둔다 (community_post_events.sql 과 같은 이유:
-- 열 단위 insert/update 권한과 community_posts_visible 뷰가 얽혀 있다).
--
-- 저장 수(save_count)
--   saved_posts 는 본인 행만 보이는 표라 남이 몇 번 저장했는지 셀 수 없다.
--   → 덕마크 줄에 저장 수를 들고, saved_posts 에 넣고 뺄 때 트리거(소유자 권한)가 맞춘다.
--     덕마크를 켜는 순간 그때까지의 저장 수로 채운다.
--
-- 홈 추천(featured_at) — 관리자만 RPC(set_dukmark_featured)로 켜고 끈다. 작성자는 못 쓴다.
--
-- 기존 데이터는 건드리지 않는다(새 표·트리거·함수만 만든다).
-- 적용: Supabase SQL Editor 에 아래 전체 실행. 롤백은 맨 아래.
-- ============================================================


-- ── 1) 표 — post_id 형식은 community_posts.id 와 똑같이 맞춘다 ──
do $$
declare
  post_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into post_id_type
  from pg_attribute a
  where a.attrelid = 'public.community_posts'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.post_dukmarks (
      post_id     %s primary key references public.community_posts(id) on delete cascade,
      uses        text[] not null,
      cover_url   text,
      summary     text,
      site_urls   text[] not null default '{}',
      save_count  integer not null default 0,
      featured_at timestamptz,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now(),

      -- 용도 1~3개, 정해진 값만 (화면 이름은 types/community-post.ts 의 DUKMARK_USES)
      constraint post_dukmarks_uses_chk check (
        cardinality(uses) between 1 and 3
        and uses <@ array['shopping','info','translate','collection','meme','authentic','waiting','map']::text[]
      ),
      -- 대표 이미지: 비우면 본문 첫 이미지
      constraint post_dukmarks_cover_chk check (
        cover_url is null or (char_length(cover_url) <= 2000 and cover_url ~* '^https?://')
      ),
      -- 카드 한 줄 소개: 비우면 본문 앞부분
      constraint post_dukmarks_summary_chk check (summary is null or char_length(summary) <= 80),
      -- 본문 링크 카드에서 모은 사이트 주소 (나중에 같은 사이트 묶기·검색용)
      constraint post_dukmarks_site_urls_chk check (cardinality(site_urls) <= 30),
      constraint post_dukmarks_save_count_chk check (save_count >= 0)
    )$f$, post_id_type);
end $$;

-- 홈 추천 / 용도 필터 / 저장순
create index if not exists post_dukmarks_featured_idx on public.post_dukmarks (featured_at desc) where featured_at is not null;
create index if not exists post_dukmarks_uses_idx     on public.post_dukmarks using gin (uses);
create index if not exists post_dukmarks_saves_idx    on public.post_dukmarks (save_count desc, created_at desc);

comment on table public.post_dukmarks is
  '덕마크 — 덕질 노하우 글에 붙는 북마크 표시 (글 하나에 하나). 작성자만 켜고 끔, 홈 추천은 관리자 RPC.';


-- ── 2) RLS ──
alter table public.post_dukmarks enable row level security;

-- 보기: 글이 보이는 사람만 (community_posts 의 RLS 가 호출자 기준으로 같이 걸린다)
drop policy if exists pdm_select on public.post_dukmarks;
create policy pdm_select on public.post_dukmarks
  for select
  using (exists (select 1 from public.community_posts p where p.id = post_id));

-- 켜기·고치기·끄기: 그 글의 작성자, 그리고 덕질 노하우 글일 때만
drop policy if exists pdm_insert on public.post_dukmarks;
create policy pdm_insert on public.post_dukmarks
  for insert to authenticated
  with check (exists (
    select 1 from public.community_posts p
     where p.id = post_id and p.author_id = auth.uid() and p.board = 'tips'
  ));

drop policy if exists pdm_update on public.post_dukmarks;
create policy pdm_update on public.post_dukmarks
  for update to authenticated
  using (exists (
    select 1 from public.community_posts p
     where p.id = post_id and p.author_id = auth.uid() and p.board = 'tips'
  ))
  with check (exists (
    select 1 from public.community_posts p
     where p.id = post_id and p.author_id = auth.uid() and p.board = 'tips'
  ));

drop policy if exists pdm_delete on public.post_dukmarks;
create policy pdm_delete on public.post_dukmarks
  for delete to authenticated
  using (exists (select 1 from public.community_posts p where p.id = post_id and p.author_id = auth.uid()));


-- ── 3) 권한 — 작성자는 내용 열만. save_count·featured_at·시각은 못 쓴다 ──
revoke all on table public.post_dukmarks from public, anon, authenticated;
grant select on table public.post_dukmarks to anon, authenticated;
grant insert (post_id, uses, cover_url, summary, site_urls) on table public.post_dukmarks to authenticated;
grant update (uses, cover_url, summary, site_urls)          on table public.post_dukmarks to authenticated;
grant delete on table public.post_dukmarks to authenticated;


-- ── 4) 켤 때 저장 수 채우기 + 내용 고칠 때 시각 갱신 ──
-- 소유자 권한으로 돈다 — saved_posts 는 본인 행만 보이므로 호출자 권한으로는 전체를 못 센다.
create or replace function public.post_dukmarks_before_write()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if tg_op = 'INSERT' then
    new.save_count  := (select count(*) from public.saved_posts s where s.post_id = new.post_id);
    new.featured_at := null;
    new.created_at  := now();
    new.updated_at  := now();
  elsif (new.uses, new.cover_url, new.summary, new.site_urls)
        is distinct from (old.uses, old.cover_url, old.summary, old.site_urls) then
    -- 내용이 바뀔 때만. 저장 수·추천 갱신(트리거·RPC)은 updated_at 을 건드리지 않는다.
    -- 작성자가 save_count·featured_at 을 직접 못 쓰는 건 3) 의 열 단위 권한이 막는다.
    new.updated_at := now();
  end if;
  return new;
end;
$fn$;

revoke all on function public.post_dukmarks_before_write() from public, anon, authenticated;

drop trigger if exists post_dukmarks_before_write on public.post_dukmarks;
create trigger post_dukmarks_before_write
  before insert or update on public.post_dukmarks
  for each row execute function public.post_dukmarks_before_write();


-- ── 5) 저장 수 맞추기 (saved_posts 에 넣고 뺄 때) ──
create or replace function public.sync_dukmark_save_count()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if tg_op = 'INSERT' then
    update public.post_dukmarks set save_count = save_count + 1 where post_id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.post_dukmarks set save_count = greatest(save_count - 1, 0) where post_id = old.post_id;
  end if;
  return null;
end;
$fn$;

revoke all on function public.sync_dukmark_save_count() from public, anon, authenticated;

drop trigger if exists trg_sync_dukmark_save_count on public.saved_posts;
create trigger trg_sync_dukmark_save_count
  after insert or delete on public.saved_posts
  for each row execute function public.sync_dukmark_save_count();


-- ── 6) 덕질 노하우가 아닌 게시판으로 옮기면 덕마크를 뺀다 ──
create or replace function public.drop_dukmark_on_board_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if new.board is distinct from 'tips' then
    delete from public.post_dukmarks where post_id = new.id;
  end if;
  return null;
end;
$fn$;

revoke all on function public.drop_dukmark_on_board_change() from public, anon, authenticated;

drop trigger if exists trg_drop_dukmark_on_board_change on public.community_posts;
create trigger trg_drop_dukmark_on_board_change
  after update of board on public.community_posts
  for each row
  when (old.board is distinct from new.board)
  execute function public.drop_dukmark_on_board_change();


-- ── 7) 홈 추천 켜고 끄기 (관리자 전용) ──
-- 반환: true = 바뀜 / false = 그 글에 덕마크가 없음. 관리자가 아니면 예외.
do $$
declare
  post_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into post_id_type
  from pg_attribute a
  where a.attrelid = 'public.community_posts'::regclass and a.attname = 'id';

  execute format($f$
    create or replace function public.set_dukmark_featured(p_post_id %s, p_on boolean)
    returns boolean
    language plpgsql
    security definer
    set search_path to 'public', 'pg_temp'
    as $body$
    begin
      if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
        raise exception 'admin only' using errcode = '42501';
      end if;
      update public.post_dukmarks
         set featured_at = case when p_on then now() else null end
       where post_id = p_post_id;
      return found;
    end;
    $body$
  $f$, post_id_type);   -- ⚠️ $body$ 와 $f$ 를 붙여 쓰면 '$$' 가 생겨 바깥 do $$ 블록이 거기서 끝나 버린다

  execute format('revoke all on function public.set_dukmark_featured(%s, boolean) from public, anon', post_id_type);
  execute format('grant execute on function public.set_dukmark_featured(%s, boolean) to authenticated', post_id_type);
end $$;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 확인]
-- ============================================================
-- -- 1) 권한: anon SELECT / authenticated SELECT·DELETE + 열 단위 INSERT·UPDATE
-- select grantee, privilege_type from information_schema.table_privileges
-- where table_schema = 'public' and table_name = 'post_dukmarks' order by 1, 2;
-- select grantee, column_name, privilege_type from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'post_dukmarks' and grantee = 'authenticated'
--   and privilege_type in ('INSERT','UPDATE') order by 3, 2;
-- -- 기대 INSERT: cover_url, post_id, site_urls, summary, uses / UPDATE: cover_url, site_urls, summary, uses
--
-- -- 2) 트리거 3개
-- select tgname, tgrelid::regclass from pg_trigger
-- where tgname in ('post_dukmarks_before_write','trg_sync_dukmark_save_count','trg_drop_dukmark_on_board_change');
--
-- [동작 테스트 — 사이트에서]
--   1. 내 덕질 노하우 글에 덕마크 켜기 → 행 생김, save_count = 그 글의 기존 저장 수
--   2. 다른 사람이 그 글 저장 / 해제 → save_count +1 / -1
--   3. 내 자유게시판 글에 덕마크 켜기 → 거부 (RLS)
--   4. 덕마크 켠 글을 자유게시판으로 옮기기 → 덕마크 행 사라짐
--   5. 작성자 토큰으로 PATCH {"save_count":999} 또는 {"featured_at":"..."} → 42501
--   6. 일반 사용자가 set_dukmark_featured 호출 → 'admin only'
--   7. 숨김 처리된 글의 덕마크 → 남에게 안 보임 (pdm_select)


-- ============================================================
-- [롤백]
-- ============================================================
-- drop trigger if exists trg_drop_dukmark_on_board_change on public.community_posts;
-- drop trigger if exists trg_sync_dukmark_save_count on public.saved_posts;
-- drop function if exists public.drop_dukmark_on_board_change();
-- drop function if exists public.sync_dukmark_save_count();
-- drop function if exists public.set_dukmark_featured;
-- drop table if exists public.post_dukmarks;   -- post_dukmarks_before_write 트리거도 같이 사라진다
-- drop function if exists public.post_dukmarks_before_write();
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
