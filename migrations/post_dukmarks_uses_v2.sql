-- ============================================================
-- 덕마크 용도 바꾸기 (2026-10-19) — 사이트 분류 기준 → 덕질 노하우 게시판에서 실제로 찾는 주제
--   buy 굿즈 구매·직구 / popup 팝업·콜라보카페 / care 굿즈 보관·관리 / storage 수납·장식장
--   itabag 이타백·꾸미기 / photo 굿즈 촬영 / authentic 정품 구별 / sites 덕질 사이트·앱 / travel 성지순례·여행
-- 예전 값은 가까운 새 값으로 옮긴다 (shopping→buy, waiting→popup, map→travel, authentic 그대로, 나머지→sites).
-- 화면 이름은 src/types/community-post.ts 의 DUKMARK_USES.
-- ============================================================

alter table public.post_dukmarks drop constraint if exists post_dukmarks_uses_chk;

update public.post_dukmarks d
   set uses = coalesce((
     select array_agg(s.x order by s.first_ord)
       from (
         select case t.u
                  when 'shopping' then 'buy'
                  when 'waiting' then 'popup'
                  when 'map' then 'travel'
                  when 'authentic' then 'authentic'
                  when 'info' then 'sites'
                  when 'translate' then 'sites'
                  when 'collection' then 'sites'
                  when 'meme' then 'sites'
                  else t.u
                end as x,
                min(t.ord) as first_ord
           from unnest(d.uses) with ordinality as t(u, ord)
          group by 1
       ) s
   ), array['sites']::text[]);

update public.post_dukmarks set uses = array['sites']::text[] where cardinality(uses) = 0;

alter table public.post_dukmarks add constraint post_dukmarks_uses_chk check (
  cardinality(uses) between 1 and 3
  and uses <@ array['buy','popup','care','storage','itabag','photo','authentic','sites','travel']::text[]
);

select pg_notify('pgrst', 'reload schema');

-- [확인] select post_id, uses from public.post_dukmarks;   → 치이카와 글: {sites}
