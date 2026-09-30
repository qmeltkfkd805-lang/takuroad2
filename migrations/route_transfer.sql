-- 루트 작성자 넘기기 기록 (출처 주인이 가입하면 관리자가 넘김)
alter table public.routes add column if not exists transferred_from uuid references auth.users(id) on delete set null;
alter table public.routes add column if not exists transferred_at timestamptz;
