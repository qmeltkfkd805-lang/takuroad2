-- 이벤트 영상 미리보기 — events 에 영상 URL 컬럼 추가
-- 실행: Supabase SQL Editor 에 붙여넣고 실행.
alter table public.events add column if not exists video_url text;
