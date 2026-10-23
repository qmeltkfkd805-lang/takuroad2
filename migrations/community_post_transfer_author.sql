-- ============================================================
-- 커뮤니티 글 작성자 바꾸기 (2026-10-23) — 타쿠로드 공식 계정만
--   transfer_post_author(글 id, 새 작성자 id) → true = 바뀜 / false = 그런 글 없음
--   · 부를 수 있는 사람: 타쿠로드 계정(e1ffdf30-345a-42c0-8e85-48eb1f9d915d) 하나뿐. 다른 관리자도 안 된다
--     (앱 쪽 같은 값: src/lib/constants/takuroadAccount.ts)
--   · author_id 는 열 단위 권한으로 막혀 있어서(community_posts_write_privileges.sql) 소유자 권한 함수로만 바꾼다
-- 데이터는 건드리지 않는다(함수만 만든다). 롤백은 맨 아래.
-- ============================================================

do $$
declare
  post_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into post_id_type
  from pg_attribute a
  where a.attrelid = 'public.community_posts'::regclass and a.attname = 'id';

  execute format($f$
    create or replace function public.transfer_post_author(p_post_id %s, p_new_author uuid)
    returns boolean
    language plpgsql
    security definer
    set search_path to 'public', 'pg_temp'
    as $body$
    begin
      if auth.uid() is distinct from 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'::uuid then
        raise exception 'takuroad account only' using errcode = '42501';
      end if;
      if p_new_author is null or not exists (select 1 from public.profiles p where p.id = p_new_author) then
        raise exception 'no such user' using errcode = '22023';
      end if;
      update public.community_posts set author_id = p_new_author where id = p_post_id;
      return found;
    end;
    $body$
  $f$, post_id_type);

  execute format('revoke all on function public.transfer_post_author(%s, uuid) from public, anon', post_id_type);
  execute format('grant execute on function public.transfer_post_author(%s, uuid) to authenticated', post_id_type);
end $$;

select pg_notify('pgrst', 'reload schema');

-- [롤백]
-- drop function if exists public.transfer_post_author;
-- select pg_notify('pgrst', 'reload schema');
