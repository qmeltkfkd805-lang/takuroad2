-- 가입 동의 기록 — 이용약관 · 개인정보 수집·이용 · 국외이전 · 만 14세 이상(필수) + 이벤트·새 소식 알림(선택)
-- Supabase SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
--
--   · 동의 시각은 서버(now())가 찍는다. 브라우저는 이 칸들을 직접 쓸 수 없고 record_my_consents() 로만 남긴다.
--   · 기존 회원은 consent_version 이 비어 있어 다음 접속 때 동의 화면을 한 번 거친다.
--   · 동의할 때마다 user_consent_logs 에 한 줄씩 남는다 (언제 어떤 버전에 동의했는지 증빙).

-- 1) profiles 에 동의 칸
alter table public.profiles
  add column if not exists consent_version     text,
  add column if not exists terms_agreed_at     timestamptz,
  add column if not exists privacy_agreed_at   timestamptz,
  add column if not exists overseas_agreed_at  timestamptz,
  add column if not exists age14_confirmed_at  timestamptz,
  add column if not exists marketing_agreed_at timestamptz;

-- 2) 동의 이력
create table if not exists public.user_consent_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  version     text not null,
  terms       boolean not null,
  privacy     boolean not null,
  overseas    boolean not null,
  age14       boolean not null,
  marketing   boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists user_consent_logs_user_idx on public.user_consent_logs (user_id, created_at desc);

alter table public.user_consent_logs enable row level security;
revoke all on public.user_consent_logs from public, anon, authenticated;
-- 정책 없음 → 아래 함수(security definer)와 관리자(Service Role)만 읽고 쓴다

-- 3) 내 동의 남기기 (필수 4개는 이 함수를 부르는 것 자체가 동의. 선택은 p_marketing)
create or replace function public.record_my_consents(p_version text, p_marketing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_version is null or length(p_version) = 0 or length(p_version) > 20 then
    raise exception 'bad_version' using errcode = '22023';
  end if;

  update public.profiles set
    consent_version     = p_version,
    terms_agreed_at     = now(),
    privacy_agreed_at   = now(),
    overseas_agreed_at  = now(),
    age14_confirmed_at  = now(),
    marketing_agreed_at = case when coalesce(p_marketing, false) then coalesce(marketing_agreed_at, now()) else null end
  where id = uid;
  if not found then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;

  insert into public.user_consent_logs (user_id, version, terms, privacy, overseas, age14, marketing)
  values (uid, p_version, true, true, true, true, coalesce(p_marketing, false));

  return jsonb_build_object('ok', true);
end;
$$;

-- 4) 내 동의 상태 (어느 버전에 동의했는지 · 알림 수신 여부)
create or replace function public.my_consent_status()
returns jsonb
language sql
security definer
stable
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'version',   p.consent_version,
    'marketing', p.marketing_agreed_at is not null
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.record_my_consents(text, boolean) from public, anon;
revoke all on function public.my_consent_status() from public, anon;
grant execute on function public.record_my_consents(text, boolean) to authenticated;
grant execute on function public.my_consent_status() to authenticated;

select pg_notify('pgrst', 'reload schema');

-- 확인용
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('consent_version','terms_agreed_at','privacy_agreed_at','overseas_agreed_at','age14_confirmed_at','marketing_agreed_at')
order by column_name;
