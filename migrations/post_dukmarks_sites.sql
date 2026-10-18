-- ============================================================
-- 덕마크: 사이트별 정보 + 참고한 출처 (2026-10-18)
--   post_dukmarks.sites   [{ url, name?, desc?, maker?, maker_links: [{ label, url }] }]  (최대 30곳)
--   post_dukmarks.sources [{ label, url? }]                                              (최대 10개)
--   덕마크 글 상세 화면의 '소개하는 사이트' 카드(사이트 열기·제작자 링크)와 '참고한 출처'에 쓴다.
--
-- site_urls 는 그대로 두고 sites 에서 자동으로 만든다(카드의 '사이트 N곳', 검색이 계속 쓴다).
-- 예전 코드가 site_urls 만 보내도 sites 가 따라 맞춰진다 (배포 사이에 깨지지 않게).
-- 기존 덕마크는 site_urls 로 sites 를 채운다(주소만, 나머지는 비어 있음).
-- post_dukmarks.sql, post_dukmarks_by_maker.sql 다음에 실행. 롤백은 맨 아래.
-- ============================================================

alter table public.post_dukmarks add column if not exists sites   jsonb not null default '[]'::jsonb;
alter table public.post_dukmarks add column if not exists sources jsonb not null default '[]'::jsonb;

grant insert (sites, sources), update (sites, sources) on table public.post_dukmarks to authenticated;


-- ── 정리 트리거: 모양·길이 맞추고 site_urls 만들기 ──
-- (BEFORE 트리거는 이름순으로 돈다: post_dukmarks_before_write → post_dukmarks_normalize)
create or replace function public.post_dukmarks_normalize()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  s jsonb; l jsonb; out_sites jsonb := '[]'::jsonb; out_links jsonb; out_src jsonb := '[]'::jsonb; u text;
begin
  -- 예전 코드 호환: sites 는 그대로인데 site_urls 만 바뀌었으면 site_urls 로 sites 를 다시 만든다(있던 정보는 주소가 같으면 살림)
  if tg_op = 'UPDATE' and new.sites is not distinct from old.sites and new.site_urls is distinct from old.site_urls then
    new.sites := coalesce((
      select jsonb_agg(coalesce(
               (select o from jsonb_array_elements(old.sites) o where o->>'url' = t.u limit 1),
               jsonb_build_object('url', t.u)) order by t.ord)
      from unnest(new.site_urls) with ordinality as t(u, ord)), '[]'::jsonb);
  elsif tg_op = 'INSERT' and coalesce(jsonb_array_length(new.sites), 0) = 0 and cardinality(new.site_urls) > 0 then
    new.sites := coalesce((
      select jsonb_agg(jsonb_build_object('url', t.u) order by t.ord)
      from unnest(new.site_urls) with ordinality as t(u, ord)), '[]'::jsonb);
  end if;

  -- sites: 배열만, http(s) 주소만, 글자 수 제한, 최대 30곳
  if jsonb_typeof(new.sites) is distinct from 'array' then new.sites := '[]'::jsonb; end if;
  for s in select e from jsonb_array_elements(new.sites) e loop
    exit when jsonb_array_length(out_sites) >= 30;
    continue when jsonb_typeof(s) <> 'object';
    u := btrim(s->>'url');
    continue when u is null or u !~* '^https?://' or char_length(u) > 2000;
    out_links := '[]'::jsonb;
    if jsonb_typeof(s->'maker_links') = 'array' then
      for l in select e from jsonb_array_elements(s->'maker_links') e loop
        exit when jsonb_array_length(out_links) >= 5;
        continue when jsonb_typeof(l) <> 'object' or coalesce(l->>'url', '') !~* '^https?://' or char_length(l->>'url') > 2000;
        out_links := out_links || jsonb_build_array(jsonb_build_object(
          'label', coalesce(nullif(left(btrim(l->>'label'), 20), ''), '링크'),
          'url', btrim(l->>'url')));
      end loop;
    end if;
    out_sites := out_sites || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'url', u,
      'name', nullif(left(btrim(s->>'name'), 60), ''),
      'desc', nullif(left(btrim(s->>'desc'), 120), ''),
      'maker', nullif(left(btrim(s->>'maker'), 40), ''),
      'maker_links', out_links)));
  end loop;
  new.sites := out_sites;
  new.site_urls := array(select e->>'url' from jsonb_array_elements(out_sites) e);

  -- sources: 문구는 꼭, 링크는 있으면 http(s)만, 최대 10개
  if jsonb_typeof(new.sources) is distinct from 'array' then new.sources := '[]'::jsonb; end if;
  for s in select e from jsonb_array_elements(new.sources) e loop
    exit when jsonb_array_length(out_src) >= 10;
    continue when jsonb_typeof(s) <> 'object' or coalesce(btrim(s->>'label'), '') = '';
    u := nullif(btrim(s->>'url'), '');
    if u is not null and (u !~* '^https?://' or char_length(u) > 2000) then u := null; end if;
    out_src := out_src || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'label', left(btrim(s->>'label'), 100),
      'url', u)));
  end loop;
  new.sources := out_src;

  if tg_op = 'UPDATE' and (new.sites, new.sources) is distinct from (old.sites, old.sources) then
    new.updated_at := now();
  end if;
  return new;
end;
$fn$;

revoke all on function public.post_dukmarks_normalize() from public, anon, authenticated;

drop trigger if exists post_dukmarks_normalize on public.post_dukmarks;
create trigger post_dukmarks_normalize
  before insert or update on public.post_dukmarks
  for each row execute function public.post_dukmarks_normalize();


-- ── 기존 덕마크: site_urls 로 sites 채우기 ──
update public.post_dukmarks
   set sites = coalesce((
     select jsonb_agg(jsonb_build_object('url', t.u) order by t.ord)
     from unnest(site_urls) with ordinality as t(u, ord)), '[]'::jsonb)
 where jsonb_array_length(sites) = 0 and cardinality(site_urls) > 0;

select pg_notify('pgrst', 'reload schema');


-- [확인] 치이카와 글: sites 15개, site_urls 15개
-- select post_id, jsonb_array_length(sites), cardinality(site_urls) from public.post_dukmarks;

-- [롤백]
-- drop trigger if exists post_dukmarks_normalize on public.post_dukmarks;
-- drop function if exists public.post_dukmarks_normalize();
-- alter table public.post_dukmarks drop column if exists sites, drop column if exists sources;
-- select pg_notify('pgrst', 'reload schema');
