-- 작품 계층(프랜차이즈) 2차 — 닌텐도 신설 + 프리큐어
-- 2026-09-21 실행 완료. tags_parent.sql 의 후속.
--
-- 판단 기록
--   쥬얼펫 -> 산리오        : 하지 않음 (산리오·세가토이즈 공동 IP이나 보류)
--   프로젝트 세카이 -> 보컬로이드 : 하지 않음 (소유는 세가/컬러풀팔레트, 주역은 게임 오리지널)
--   포켓몬 -> 닌텐도        : 하지 않음 (닌텐도·게임프리크·크리처스 3사 공동 소유)
--   전대대실격 -> 전대 시리즈  : 하지 않음 (전대물 패러디 작품)
--   울트라맨 / 전대 시리즈     : 등록된 하위 작품 없음

begin;

-- 1) 닌텐도 부모 태그 신설 (디즈니=브랜드, 지브리=제작사 규격에 맞춤)
insert into public.tags (name, slug, ip_type)
select '닌텐도', 'nintendo', '제작사,브랜드'
 where not exists (select 1 from public.tags where slug = 'nintendo');

-- 2) 닌텐도 직속 6개
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'nintendo')
 where slug in ('super-mario','kirby','pikmin','splatoon','animal-crossing','legend-of-zelda')
   and parent_tag_id is null;

-- 3) 동키콩 -> 슈퍼마리오 (2단)
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'super-mario')
 where slug = 'donkey-kong'
   and parent_tag_id is null;

-- 4) 검색은 부모를 1단만 훑으므로 동키콩은 "닌텐도" 로 안 잡힌다. keywords 로 보완.
--    keywords 컬럼은 jsonb.
do $$
declare ty text;
begin
  select udt_name into ty from information_schema.columns
   where table_schema = 'public' and table_name = 'tags' and column_name = 'keywords';
  if ty = '_text' then
    update public.tags
       set keywords = coalesce(keywords, '{}'::text[]) || array['닌텐도']::text[]
     where slug = 'donkey-kong'
       and not (coalesce(keywords, '{}'::text[]) @> array['닌텐도']::text[]);
  elsif ty = 'jsonb' then
    update public.tags
       set keywords = coalesce(keywords, '[]'::jsonb) || '["닌텐도"]'::jsonb
     where slug = 'donkey-kong'
       and not (coalesce(keywords, '[]'::jsonb) @> '["닌텐도"]'::jsonb);
  else
    raise exception 'keywords 컬럼 타입이 예상 밖입니다: %', ty;
  end if;
end $$;

-- 5) 프리큐어 하위 1개
update public.tags
   set parent_tag_id = (select id from public.tags where slug = 'precure')
 where slug = 'power-of-hope-precure-full-bloom-anime'
   and parent_tag_id is null;

commit;

-- 검증
select t.name, t.slug, p.name as parent, t.keywords
  from public.tags t
  left join public.tags p on p.id = t.parent_tag_id
 where t.slug in ('nintendo','super-mario','kirby','pikmin','splatoon','animal-crossing',
                  'legend-of-zelda','donkey-kong','power-of-hope-precure-full-bloom-anime')
 order by coalesce(p.name, '0'), t.name;