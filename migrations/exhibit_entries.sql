-- ============================================================
-- 전시관: "내 굿즈 글을 연결"하는 새 전시 방식 (exhibit_entries)
--
-- 왜:
--   기존 전시(exhibit_items)는 굿즈 사진을 exhibit-images 로 복사하고
--   소개글·공개범위를 따로 가진 "복사본"이라, 원본 글을 나만보기/숨김/삭제해도
--   전시에는 반영되지 않는다. 새 전시는 원본 글을 가리키기만 한다.
--
-- 규칙:
--   - 추가: 내가 쓴 board='goods' + status='active' 글만. 글 1개당 전시 1개(unique).
--   - 표시: 사진·본문·작품은 원본 글에서 실시간으로 읽는다.
--   - 공개범위: 따로 없다. can_view_post 를 그대로 따른다
--       (active 이고 public 이면 모두 / 아니면 작성자 본인만 / 차단 관계는 안 보임)
--     → 구조상 원본 글보다 넓게 공개될 수 없다.
--   - 빼기: exhibit_entries 행만 지운다. 원본 글·사진은 그대로.
--   - 원본 글 삭제: ON DELETE CASCADE 로 전시 연결도 같이 사라진다.
--   - 스토리지 파일이 없으므로 정리 큐와 무관하다.
--
-- 기존 테이블(exhibit_items / exhibit_images / 정리 큐)은 건드리지 않는다.
-- get_exhibit_count 만 새 전시 개수를 더하도록 바꾼다(시그니처·반환형 동일).
--
-- 사전 확인 (2026-09-26 조회 결과)
--   - can_view_post(p_post, p_viewer): status='active' and (public or 작성자) and not 차단
--   - community_posts.visibility: public | private,  status: active | hidden
--   - 기존 전시 4개 모두 source_post_id 없음 → 자동 이전 대상 없음
-- ============================================================


-- ── 1. 테이블 ─────────────────────────────────────────────
create table if not exists public.exhibit_entries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint exhibit_entries_post_unique unique (post_id)
);

create index if not exists exhibit_entries_owner_created_idx
  on public.exhibit_entries (owner_id, created_at desc);

-- 클라이언트 직접 접근 금지 — RLS 켜고 정책 없음(deny-all) + 권한 회수.
alter table public.exhibit_entries enable row level security;
revoke all on public.exhibit_entries from public, anon, authenticated;


-- ── 2. 추가 ───────────────────────────────────────────────
-- 이미 전시 중이면 새로 만들지 않고 기존 id 를 돌려준다(중복 클릭·동시 요청 안전).
create or replace function public.add_exhibit_entry(p_post uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v    uuid := auth.uid();
  v_id uuid;
begin
  if v is null then raise exception '로그인이 필요합니다'; end if;

  if not exists (
    select 1 from public.community_posts p
     where p.id = p_post
       and p.author_id = v
       and p.board = 'goods'
       and p.status = 'active'
  ) then
    raise exception '전시할 수 없는 글이에요';
  end if;

  insert into public.exhibit_entries (owner_id, post_id)
  values (v, p_post)
  on conflict (post_id) do nothing
  returning id into v_id;

  if v_id is null then
    select e.id into v_id from public.exhibit_entries e where e.post_id = p_post;
  end if;
  return v_id;
end $$;


-- ── 3. 빼기 (연결만 해제) ─────────────────────────────────
create or replace function public.remove_exhibit_entry(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.exhibit_entries where id = p_id and owner_id = v;
  if not found then raise exception '권한이 없습니다'; end if;
end $$;


-- ── 4. 목록 ───────────────────────────────────────────────
-- 굿즈 종류는 연결된 굿즈가 공개이거나 본인일 때만 보여준다.
create or replace function public.get_exhibit_entry_list(p_owner uuid)
returns table (
  id uuid, post_id uuid, title text, content text, images jsonb, visibility text,
  work_name text, goods_type_name text, created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select e.id, e.post_id, p.title, p.content,
         coalesce(to_jsonb(p.images), '[]'::jsonb),
         coalesce(p.visibility, 'public'),
         (select t.name from public.tags t where t.id = p.tag_id),
         (select gt.name
            from public.post_goods_links l
            join public.goods_items g  on g.id = l.goods_item_id
            join public.goods_types gt on gt.id = g.goods_type_id
           where l.post_id = p.id
             and (g.visibility = 'public' or g.owner_id = auth.uid())
           order by l.created_at
           limit 1),
         e.created_at
    from public.exhibit_entries e
    join public.community_posts p on p.id = e.post_id
   where e.owner_id = p_owner
     and public.can_view_post(e.post_id, auth.uid())
   order by e.created_at desc;
$$;


-- ── 5. 상세 ───────────────────────────────────────────────
create or replace function public.get_exhibit_entry(p_id uuid)
returns table (
  id uuid, owner_id uuid, post_id uuid, title text, content text, images jsonb, visibility text,
  work_id uuid, work_name text, goods_type_name text, created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select e.id, e.owner_id, e.post_id, p.title, p.content,
         coalesce(to_jsonb(p.images), '[]'::jsonb),
         coalesce(p.visibility, 'public'),
         p.tag_id,
         (select t.name from public.tags t where t.id = p.tag_id),
         (select gt.name
            from public.post_goods_links l
            join public.goods_items g  on g.id = l.goods_item_id
            join public.goods_types gt on gt.id = g.goods_type_id
           where l.post_id = p.id
             and (g.visibility = 'public' or g.owner_id = auth.uid())
           order by l.created_at
           limit 1),
         e.created_at
    from public.exhibit_entries e
    join public.community_posts p on p.id = e.post_id
   where e.id = p_id
     and public.can_view_post(e.post_id, auth.uid());
$$;


-- ── 6. 추가 화면용: 내 굿즈 글 + 전시 중 여부 ─────────────
create or replace function public.get_my_exhibit_post_options()
returns table (
  post_id uuid, title text, excerpt text, cover text, image_count integer, visibility text,
  work_name text, created_at timestamptz, entry_id uuid
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id, p.title, left(p.content, 120),
         to_jsonb(p.images) ->> 0,
         coalesce(jsonb_array_length(to_jsonb(p.images)), 0),
         coalesce(p.visibility, 'public'),
         (select t.name from public.tags t where t.id = p.tag_id),
         p.created_at,
         (select e.id from public.exhibit_entries e where e.post_id = p.id)
    from public.community_posts p
   where p.author_id = auth.uid()
     and p.board = 'goods'
     and p.status = 'active'
   order by p.created_at desc
   limit 200;
$$;


-- ── 7. 전시 개수 = 기존 전시 + 새 전시 (시그니처 동일) ───
create or replace function public.get_exhibit_count(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    (select count(*)::int from public.exhibit_items e
      where e.owner_id = p_owner
        and public.can_view_exhibit(e.owner_id, e.visibility, auth.uid()))
  + (select count(*)::int from public.exhibit_entries x
      where x.owner_id = p_owner
        and public.can_view_post(x.post_id, auth.uid()));
$$;


-- ── 8. 실행 권한 ──────────────────────────────────────────
revoke all on function public.add_exhibit_entry(uuid)           from public, anon, authenticated;
revoke all on function public.remove_exhibit_entry(uuid)        from public, anon, authenticated;
revoke all on function public.get_exhibit_entry_list(uuid)      from public, anon, authenticated;
revoke all on function public.get_exhibit_entry(uuid)           from public, anon, authenticated;
revoke all on function public.get_my_exhibit_post_options()     from public, anon, authenticated;

grant execute on function public.add_exhibit_entry(uuid)        to authenticated;
grant execute on function public.remove_exhibit_entry(uuid)     to authenticated;
grant execute on function public.get_my_exhibit_post_options()  to authenticated;
grant execute on function public.get_exhibit_entry_list(uuid)   to anon, authenticated;
grant execute on function public.get_exhibit_entry(uuid)        to anon, authenticated;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 전부 읽기 전용
-- ============================================================
-- select '1.테이블' as 구분, count(*)::text as 값 from public.exhibit_entries
-- union all
-- select '2.RLS', relrowsecurity::text from pg_class where oid = 'public.exhibit_entries'::regclass
-- union all
-- select '3.함수', string_agg(proname, ', ' order by proname) from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and proname in ('add_exhibit_entry','remove_exhibit_entry','get_exhibit_entry_list',
--                    'get_exhibit_entry','get_my_exhibit_post_options','get_exhibit_count');
--
-- 기대: 1.테이블 = 0 / 2.RLS = true / 3.함수 = 6개 이름


-- ============================================================
-- [롤백] — 새 전시 데이터가 함께 지워진다. 기존 전시(exhibit_items)는 영향 없음.
-- ============================================================
-- drop function if exists public.add_exhibit_entry(uuid);
-- drop function if exists public.remove_exhibit_entry(uuid);
-- drop function if exists public.get_exhibit_entry_list(uuid);
-- drop function if exists public.get_exhibit_entry(uuid);
-- drop function if exists public.get_my_exhibit_post_options();
-- drop table if exists public.exhibit_entries;
-- create or replace function public.get_exhibit_count(p_owner uuid)
-- returns integer language sql stable security definer
-- set search_path to 'public', 'pg_temp' as $$
--   select count(*)::int from public.exhibit_items e
--   where e.owner_id = p_owner and public.can_view_exhibit(e.owner_id, e.visibility, auth.uid());
-- $$;
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
