-- ============================================================
-- 샵 등록 요청 + 샵 수정 권한 좁히기 (2026-10-10)
--
-- 바뀌는 정책
--   1) 일반 사용자가 등록한 샵은 바로 공개되지 않는다.
--        위저드 '등록 요청' → status = 'pending' (사용자 화면: 등록 요청 중)
--        관리자가 [샵 등록 요청]에서 확인 → status = 'active' + 경험치 지급
--        (/api/admin/shop-request, service_role)
--      예외: 관리자, 그리고 사장님 인증을 받은 사람(인증된 샵이 1곳 이상)은
--            지금처럼 '등록 완료' 즉시 공개된다.
--   2) 샵 정보를 직접 고칠 수 있는 사람
--        관리자 / 인증된 샵의 사장님(owner_id) / 미인증 샵을 처음 등록한 사람(added_by)
--      그 외 사용자는 '정보 수정 제안'(shop_suggestions)으로 보낸다.
--
-- 이 SQL이 하는 일
--   A. is_verified_shop_owner(uid) 도우미 함수
--   B. UPDATE 정책 shops_update_tiered → shops_update_scoped 교체
--   C. INSERT 트리거: 일반 사용자는 active로 바로 만들 수 없게
--   D. status 전이 트리거: hidden ↔ pending 은 등록자, →active 는 관리자·인증 사장님만
--   E. 검수 상태 트리거: service_role(서버 경로)도 바꿀 수 있게
--
-- ⚠️ 코드(이 커밋)를 먼저 배포하고 나서 이 SQL을 돌릴 것.
--    순서가 바뀌면, 배포 전 옛 위저드의 '등록 완료'(hidden→active)가 42501로 막힌다.
--    반대로 SQL 없이 새 코드만 있으면 '등록 요청'이 pending 대신 그대로 동작해
--    (트리거가 hidden→pending 을 아직 모른다 → 지금 트리거는 hidden→active 만 허용)
--    등록 요청이 실패한다. 배포 직후 바로 돌리는 게 맞다.
-- ⚠️ SELECT 정책은 건드리지 않는다.
-- ============================================================


-- ── 0) 적용 전 확인 — 지금 shops 에 걸린 UPDATE 정책 이름·내용 ──
--   기대값: shops_update_tiered 하나.
--   다른 이름의 UPDATE 정책이 더 있으면 여기서 멈추고 알려줄 것
--   (정책은 OR 로 합쳐져서, 하나라도 넓으면 B가 의미 없어진다).
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname = 'public' and tablename = 'shops' order by cmd, policyname;


begin;

-- ── A) 사장님 인증을 받은 사람인가 ────────────────────────────
-- security definer: 호출자에게 안 보이는 행(숨김 샵 등)이 있어도 정확히 센다.
create or replace function public.is_verified_shop_owner(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $vso$
  select p_uid is not null and exists (
    select 1 from public.shops s
     where s.owner_id = p_uid
       and s.is_claimed is true
       and s.status <> 'deleted'
  );
$vso$;

revoke all on function public.is_verified_shop_owner(uuid) from public, anon;
grant execute on function public.is_verified_shop_owner(uuid) to authenticated;


-- ── B) UPDATE 정책 교체 ───────────────────────────────────────
-- 예전: (is_claimed is not true) or owner_id = auth.uid() or admin
--       → 로그인한 누구나 미인증 샵(사실상 전부)의 정보를 고칠 수 있었다.
-- 이제: 관리자 / 인증 샵의 사장님 / 미인증 샵의 등록자
-- owner_id 는 등록 때 등록자로 채워지므로(shops_guard_on_insert), 미인증 샵에서는
-- owner_id 가 아니라 added_by 로 본다 — 인증 승인으로 owner_id 가 사장님에게 넘어가면
-- 등록자는 자연히 빠진다.
drop policy if exists shops_update_tiered on public.shops;
drop policy if exists shops_update_scoped on public.shops;
create policy shops_update_scoped on public.shops
  for update to authenticated
  using (
    public.is_admin()
    or (is_claimed is true     and owner_id = auth.uid())
    or (is_claimed is not true and added_by = auth.uid())
  )
  with check (
    public.is_admin()
    or (is_claimed is true     and owner_id = auth.uid())
    or (is_claimed is not true and added_by = auth.uid())
  );


-- ── C) INSERT — 일반 사용자는 공개 상태로 바로 만들 수 없다 ────
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

  -- 인증 사장님은 예전처럼 active 로 바로 만들 수 있다.
  -- 그 외에는 hidden(임시)만 — 공개는 '등록 요청' → 관리자 확인을 거친다.
  if public.is_verified_shop_owner(auth.uid()) then
    if new.status is null or new.status not in ('active', 'hidden') then
      new.status := 'hidden';
    end if;
  else
    new.status := 'hidden';
  end if;

  return new;
end;
$ins_guard$;
-- 트리거는 기존 것(shops_guard_on_insert)이 이 함수를 그대로 부른다.


-- ── D) status 전이 ────────────────────────────────────────────
-- 일반 사용자에게 허용되는 전이 (전부 '본인이 등록한 샵'만, added_by 는 OLD 기준)
--   hidden  → pending   등록 요청
--   pending → hidden    등록 요청 취소(다시 임시저장으로)
--   hidden  → active    인증 사장님만 (예전 '등록 완료' 즉시 공개)
-- 그 밖의 전이(삭제·숨김·폐업 등)는 관리자 서버 경로(/api/admin/shop-status)만.
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
    if old.added_by is distinct from auth.uid() then
      raise exception '샵 공개 상태는 변경할 수 없습니다' using errcode = '42501';
    end if;

    if (old.status = 'hidden'  and new.status = 'pending')
       or (old.status = 'pending' and new.status = 'hidden') then
      return new;
    end if;

    if old.status = 'hidden' and new.status = 'active'
       and public.is_verified_shop_owner(auth.uid()) then
      return new;
    end if;

    raise exception '샵 공개 상태는 변경할 수 없습니다' using errcode = '42501';
  end if;

  return new;
end;
$status_guard$;


-- ── E) 검수 상태 — 서버 경로(service_role)도 허용 ─────────────
-- 예전 함수는 is_admin() 만 봐서, service_role(auth.uid() null)로 승인할 때 42501 이 났다.
-- 승인·보완 요청은 /api/admin/shop-request 가 관리자 확인 후 service_role 로 처리한다.
create or replace function public.shops_review_guard_on_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $review_guard$
begin
  if auth.uid() is null then
    return new;   -- service_role · 직접 DB 접속 — 서버 코드가 책임진다
  end if;

  if not public.is_admin() then
    raise exception '검수 상태는 관리자만 변경할 수 있습니다' using errcode = '42501';
  end if;

  new.reviewed_at := now();
  new.reviewed_by := auth.uid();
  return new;
end;
$review_guard$;

commit;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- 1) UPDATE 정책이 하나만 남았는가 (shops_update_scoped)
-- select policyname, qual from pg_policies
--  where schemaname='public' and tablename='shops' and cmd='UPDATE';
--
-- 2) 함수 본문이 새 것인가 (전부 true)
-- select proname,
--        case proname
--          when 'shops_guard_status_on_update' then prosrc like '%pending%'
--          when 'shops_guard_on_insert'        then prosrc like '%is_verified_shop_owner%'
--          when 'shops_review_guard_on_update' then prosrc like '%auth.uid() is null%'
--          when 'is_verified_shop_owner'       then true
--        end as ok
--   from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('shops_guard_status_on_update','shops_guard_on_insert',
--                    'shops_review_guard_on_update','is_verified_shop_owner');
--
-- 3) 기존 데이터 그대로인가 (적용 전후 같아야 한다)
-- select status, count(*) from public.shops group by 1 order by 1;
--
-- [회귀 테스트 — 실제 계정으로]
--  1. 일반 계정: 위저드 신규 등록 → '등록 요청' → 내 샵에 '등록 요청 중', 지도·목록엔 안 보임
--  2. 관리자: [샵 등록 요청]에서 확인하고 공개 → 지도에 보임, 등록자 경험치 +15, 알림
--  3. 관리자: 보완 요청 → 등록자 내 샵에 '보완 필요', 다시 고쳐서 '등록 요청' 가능
--  4. 일반 계정 B: 남이 등록한 미인증 샵 수정 화면 → 막힘 안내, 정보 수정 제안은 가능
--  5. 일반 계정 A: 본인이 등록한 샵 수정 → 성공
--  6. 인증 사장님: 본인 매장 영업시간·휴무 수정 → 성공, 새 샵 등록 → 즉시 공개
--  7. 관리자: 아무 샵 수정 → 성공
--
-- [롤백] — 예전 정책으로 (누구나 미인증 샵 수정 + 등록 즉시 공개)
-- drop policy if exists shops_update_scoped on public.shops;
-- create policy shops_update_tiered on public.shops for update to authenticated
--   using ((is_claimed is not true) or owner_id = auth.uid() or public.is_admin());
-- 그리고 shops_write_privileges.sql 의 5)·6) 함수 본문, shop_review.sql 의 검수 트리거 함수를 다시 실행.
-- ============================================================
