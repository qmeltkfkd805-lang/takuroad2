-- ============================================================
-- 최애 새소식(/my-news) 읽음 상태
-- 파생 피드(events 실시간 집계)는 그대로 두고, "이 사용자가 어떤 소식을 읽었는가"만
-- 경량 키로 저장한다. news_key 예: 'event:{event_id}'  (소스가 늘면 접두사만 추가)
--   · 처음 노출만으로 읽음 처리하지 않음 → 상세 열람/모두읽음 시에만 INSERT
--   · (user_id, news_key) 복합 PK → 중복 안전
--   · RLS: 본인 행만 접근
-- 적용: Supabase SQL Editor에 아래 전체 실행. 롤백은 맨 아래 참고.
-- ============================================================

create table if not exists public.user_news_reads (
  user_id  uuid        not null references auth.users(id) on delete cascade,
  news_key text        not null,
  read_at  timestamptz not null default now(),
  primary key (user_id, news_key)
);

-- 사용자별 조회 최적화 (본인 읽음 키 일괄 로드)
create index if not exists user_news_reads_user_idx on public.user_news_reads (user_id);

alter table public.user_news_reads enable row level security;

-- 본인 행만 select/insert/delete (update는 필요 없음 — 읽음은 존재/부재로만 판단)
drop policy if exists "own_news_reads_select" on public.user_news_reads;
create policy "own_news_reads_select" on public.user_news_reads
  for select using (auth.uid() = user_id);

drop policy if exists "own_news_reads_insert" on public.user_news_reads;
create policy "own_news_reads_insert" on public.user_news_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_news_reads_delete" on public.user_news_reads;
create policy "own_news_reads_delete" on public.user_news_reads
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 롤백 (necessary 시에만)
--   drop table if exists public.user_news_reads;
-- ------------------------------------------------------------
