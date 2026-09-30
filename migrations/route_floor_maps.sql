-- 루트 층 지도 이미지 — 루트 순서의 층별 묶음(같은 건물·같은 층)마다 참고용 지도 이미지 1장
-- floor_maps: [{ "key": "p:<place_id>|5", "label": "AK플라자 수원점 · 5층", "url": "https://…/route-photos/…" }]
-- 이미지는 기존 공개 버킷 route-photos 의 내 폴더({userId}/floormaps/…)에 올린다 (route_reviews.sql 의 정책 그대로)
alter table public.routes add column if not exists floor_maps jsonb not null default '[]'::jsonb;
select pg_notify('pgrst', 'reload schema');
