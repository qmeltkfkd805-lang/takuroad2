-- ============================================================
-- 탈퇴 사유 (선택) — 2026-10-12
--
-- 탈퇴 마지막 단계에서 고른 사유를 모아 서비스 개선에 쓴다. 고르지 않아도 탈퇴된다.
-- 누가 남겼는지는 저장하지 않는다(회원 id·닉네임·이메일 없음) — 탈퇴한 사람의 개인정보를 남기지 않기 위해.
-- 쓰기는 서버(/api/account/delete, service_role)만. 브라우저에서는 읽기·쓰기 모두 불가.
-- ============================================================

begin;

create table if not exists public.account_deletion_reasons (
  id         bigint generated always as identity primary key,
  reason     text not null check (reason in
               ('lack_features','no_info','hard_to_use','too_many_alerts','other_account','privacy','etc')),
  detail     text check (detail is null or char_length(detail) <= 300),
  created_at timestamptz not null default now()
);

alter table public.account_deletion_reasons enable row level security;
revoke all on public.account_deletion_reasons from public, anon, authenticated;
grant select, insert on public.account_deletion_reasons to service_role;

commit;

-- [확인] 1행
-- select relname, relrowsecurity from pg_class where relname = 'account_deletion_reasons';
--
-- [모아 보기] 사유별 건수
-- select reason, count(*) from public.account_deletion_reasons group by 1 order by 2 desc;
-- 기타 내용
-- select created_at at time zone 'Asia/Seoul' as 시각, reason, detail
--   from public.account_deletion_reasons where detail is not null order by created_at desc;
