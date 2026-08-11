-- 홈 히어로 — 관리자 수동 슬롯 (자동 추천은 저장하지 않고 요청 시 계산)
-- 실행: Supabase SQL Editor 에 붙여넣고 실행.

create table if not exists public.home_hero_slots (
  id               uuid primary key default gen_random_uuid(),
  source_type      text not null check (source_type in ('event','shop','notice')),
  source_id        uuid not null,
  label            text,
  custom_headline  text,
  custom_description text,
  custom_image_url text,
  cta_text         text,
  cta_href         text,
  starts_at        timestamptz,
  ends_at          timestamptz,
  slot_position    int  not null default 0,
  priority         int  not null default 0,
  is_pinned        boolean not null default false,
  status           text not null default 'draft' check (status in ('draft','scheduled','published','ended')),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 같은 콘텐츠 중복 등록 방지
  unique (source_type, source_id)
);

create index if not exists home_hero_slots_pub_idx
  on public.home_hero_slots (status, slot_position, priority);

-- updated_at 자동 갱신
create or replace function public.touch_home_hero_slots()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_home_hero_slots on public.home_hero_slots;
create trigger trg_touch_home_hero_slots
  before update on public.home_hero_slots
  for each row execute function public.touch_home_hero_slots();

-- RLS
alter table public.home_hero_slots enable row level security;

-- 공개: 게시중(published) + 노출기간 유효한 슬롯만 일반 사용자에게 보임
drop policy if exists home_hero_public_read on public.home_hero_slots;
create policy home_hero_public_read on public.home_hero_slots
  for select
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- 관리자: 전체 조회/쓰기 (초안·예약·종료 포함). 서버 라우트는 service role 이라 RLS 무관하지만 방어선으로 둔다.
drop policy if exists home_hero_admin_all on public.home_hero_slots;
create policy home_hero_admin_all on public.home_hero_slots
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
