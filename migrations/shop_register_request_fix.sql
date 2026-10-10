-- ============================================================
-- shop_register_request.sql 후속 (2026-10-10) — 바로 공개는 관리자만
--
-- 처음 설계: 관리자 + '사장님 인증을 받은 사람'은 새 샵을 등록 즉시 공개.
-- 문제: 사장님 인증은 그 매장 하나에 대한 것인데, 인증 1곳만 있으면 그 사람이
--       올리는 모든 새 샵이 검토 없이 공개됐다(테스트 인증이 남아 있던 일반 계정
--       '마로롱'의 테스트 샵2가 바로 공개됨). → 바로 공개는 관리자만.
--
-- 바뀌는 것
--   INSERT 트리거: 일반 사용자는 항상 hidden(임시)로만 만든다.
--   status 트리거: 일반 사용자(본인 등록 샵)는 hidden ↔ pending 만. → active 는 관리자·서버 경로만.
-- 사장님 인증 매장 정보 수정(영업시간·휴무 등)은 그대로 된다 — status 를 건드리지 않는다.
-- is_verified_shop_owner() 는 이제 쓰지 않지만, 지우지 않고 기준만 바로잡아 둔다
-- (승인된 인증 요청이 있어야 true).
-- ============================================================

begin;

create or replace function public.shops_guard_on_insert()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $ins_guard$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  new.added_by := auth.uid();
  new.owner_id := auth.uid();
  -- 공개는 '등록 요청' → 관리자 확인(/api/admin/shop-request)을 거친다
  new.status := 'hidden';
  return new;
end;
$ins_guard$;

create or replace function public.shops_guard_status_on_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $status_guard$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    -- 본인이 등록한 샵의 등록 요청(hidden → pending) / 요청 취소(pending → hidden)만
    if old.added_by = auth.uid()
       and ((old.status = 'hidden'  and new.status = 'pending')
         or (old.status = 'pending' and new.status = 'hidden')) then
      return new;
    end if;
    raise exception '샵 공개 상태는 변경할 수 없습니다' using errcode = '42501';
  end if;

  return new;
end;
$status_guard$;

create or replace function public.is_verified_shop_owner(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $vso$
  select p_uid is not null and exists (
    select 1
      from public.shop_verify_requests v
      join public.shops s on s.id = v.shop_id
     where v.user_id  = p_uid
       and v.status   = 'approved'
       and s.owner_id = p_uid
       and s.is_claimed is true
       and s.status <> 'deleted'
  );
$vso$;

commit;

select pg_notify('pgrst', 'reload schema');

-- [확인] 둘 다 false 여야 한다 (함수 본문이 새 것인지)
-- select proname,
--        prosrc like '%is_verified_shop_owner%' as 아직_사장님_예외가_있음
--   from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('shops_guard_on_insert', 'shops_guard_status_on_update');
