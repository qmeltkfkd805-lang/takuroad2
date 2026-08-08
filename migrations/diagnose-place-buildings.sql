-- place_id가 실제 '건물 단위'를 정확히 의미하는지 점검 (구현 전 확인용)
-- Supabase SQL Editor에서 실행 후 결과를 알려주세요.

-- 1) place별 소속 샵 수 / 좌표 분산(같은 place인데 좌표가 많이 벌어지면 '서로 다른 건물이 한 place로 묶임' 의심)
select
  p.id as place_id, p.name,
  count(s.id) as shop_count,
  round((max(s.lat) - min(s.lat))::numeric, 6) as lat_spread,
  round((max(s.lng) - min(s.lng))::numeric, 6) as lng_spread,
  -- 대략적 대각 거리(m) 근사 (위도1도≈111km)
  round(sqrt(power((max(s.lat)-min(s.lat))*111000, 2) + power((max(s.lng)-min(s.lng))*88000, 2))::numeric, 0) as approx_span_m
from places p
join shops s on s.place_id = p.id
group by p.id, p.name
having count(s.id) > 1
order by approx_span_m desc nulls last
limit 40;

-- 2) 같은 건물인데 place가 나뉜 의심 사례: place는 다른데 좌표가 거의 동일한 샵 쌍
--    (place_id가 서로 다르면서 좌표가 30m 이내인 샵 그룹 = 같은 건물이 분리됐을 가능성)
select
  round(s.lat::numeric, 4) as lat4, round(s.lng::numeric, 4) as lng4,
  count(distinct s.place_id) as distinct_places,
  count(*) as shop_count,
  string_agg(distinct coalesce(pl.name, '(무)'), ' | ') as places
from shops s
left join places pl on pl.id = s.place_id
where s.lat is not null and s.lng is not null
group by round(s.lat::numeric, 4), round(s.lng::numeric, 4)
having count(distinct s.place_id) > 1
order by shop_count desc
limit 40;

-- 3) place_id 없는 단독 샵 비율(외부 단독 체크포인트로 처리될 대상 규모 파악)
select
  count(*) filter (where place_id is null) as solo_shops,
  count(*) filter (where place_id is not null) as placed_shops,
  count(*) as total
from shops where lat is not null and lng is not null;
