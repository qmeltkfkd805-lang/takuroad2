-- 관리자 회원 상세 — 활동 타일(체크인·최애·후기·저장 샵·만든 루트·완주 루트)을 눌렀을 때
-- 그 사람이 실제로 뭘 했는지 목록으로 보여주기 위한 조회 함수.
-- ⚠️ 기존 get_member_detail(개수)은 건드리지 않는다. 여기서는 "목록"만 돌려준다.
-- 여섯 종류를 한 가지 모양(item_id/title/subtitle/badge/at/href)으로 맞춰 UI 하나로 렌더한다.

drop function if exists public.get_member_items(uuid, text, int);

create function public.get_member_items(uid uuid, kind text, page_limit int default 200)
returns table (
  item_id  text,
  title    text,
  subtitle text,
  badge    text,
  at       timestamptz,
  href     text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- 관리자만
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception '권한이 없습니다';
  end if;

  if kind = 'checkins' then
    return query
    select c.id::text,
           coalesce(s.name, '(삭제된 샵)'),
           s.addr,
           null::text,
           c.created_at,
           case when s.slug is not null then '/shop/' || s.slug end
    from public.check_ins c
    left join public.shops s on s.id = c.shop_id
    where c.user_id = uid
    order by c.created_at desc
    limit page_limit;

  elsif kind = 'favorites' then
    return query
    select f.tag_id::text,
           coalesce(t.name, '(삭제된 작품)'),
           null::text,
           case when f.tier = 'favorite' then '최애' else '관심' end,
           null::timestamptz,
           case when t.slug is not null then '/work/' || t.slug end
    from public.user_favorite_tags f
    left join public.tags t on t.id = f.tag_id
    where f.user_id = uid
    order by (f.tier = 'favorite') desc, t.name
    limit page_limit;

  elsif kind = 'reviews' then
    return query
    select r.id::text,
           coalesce(s.name, '(삭제된 샵)'),
           left(coalesce(r.content, ''), 120),
           '★' || r.stars::text || case when r.is_deleted then ' · 삭제됨' else '' end,
           r.created_at,
           case when s.slug is not null then '/shop/' || s.slug end
    from public.reviews r
    left join public.shops s on s.id = r.shop_id
    where r.user_id = uid
    order by r.created_at desc
    limit page_limit;

  elsif kind = 'saved_shops' then
    return query
    select ss.shop_id::text,
           coalesce(s.name, '(삭제된 샵)'),
           s.addr,
           null::text,
           ss.created_at,
           case when s.slug is not null then '/shop/' || s.slug end
    from public.saved_shops ss
    left join public.shops s on s.id = ss.shop_id
    where ss.user_id = uid
    order by ss.created_at desc
    limit page_limit;

  elsif kind = 'routes' then
    return query
    select r.id::text,
           coalesce(r.title, '(제목 없음)'),
           null::text,
           case when r.is_official then '공식'
                when r.is_shared then '공개'
                else '비공개' end,
           r.created_at,
           case when r.share_token is not null then '/route/' || r.share_token end
    from public.routes r
    where r.user_id = uid
    order by r.created_at desc
    limit page_limit;

  elsif kind = 'route_completions' then
    return query
    select rc.id::text,
           coalesce(ro.title, '(삭제된 루트)'),
           null::text,
           null::text,
           rc.completed_at,
           case when ro.share_token is not null then '/route/' || ro.share_token end
    from public.route_completions rc
    left join public.routes ro on ro.id = rc.route_id
    where rc.user_id = uid
    order by rc.completed_at desc
    limit page_limit;

  else
    raise exception '알 수 없는 종류: %', kind;
  end if;
end;
$$;

revoke all on function public.get_member_items(uuid, text, int) from public, anon;
grant execute on function public.get_member_items(uuid, text, int) to authenticated;

select pg_notify('pgrst', 'reload schema');
