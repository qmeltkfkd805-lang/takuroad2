-- 루트 출처 — 다른 분의 인스타·블로그 코스를 참고해 만든 루트에 출처를 남긴다 (루트 소개에 링크로 표시)
-- source_credits: [{ "name": "@계정 / OO 블로그", "url": "https://…" }]  (url 은 http(s) 만, 비워도 됨)
alter table public.routes add column if not exists source_credits jsonb not null default '[]'::jsonb;
select pg_notify('pgrst', 'reload schema');
