-- ============================================================
-- 신규 샵 검수 (선등록 후검수)
--
-- 정책: 사용자가 등록한 샵은 지금처럼 바로 공개(status='active')하되,
--       관리자 검수 대기열에 올린다. 관리자가 정보를 채운 뒤 '검수 완료'를 누른다.
--
-- 축을 섞지 않는다 — 세 필드는 서로 독립이다:
--   status        공개 여부 (active / hidden / closed …)  ← 이 마이그레이션은 안 건드린다
--   is_verified   공식 인증                                ← 이 마이그레이션은 안 건드린다
--   review_status 운영 검수 진행도                          ← 여기서 추가
--
-- 기존 데이터는 backfill 하지 않는다. 기존 샵의 review_status는 NULL로 남고,
-- NULL = "검수 기능 도입 이전 데이터, 대기열 대상 아님" 을 뜻한다.
--
-- ✅ 사전 점검 완료 (2026-09-02): profiles의 role 변경 경로를 먼저 막았다.
--    - UPDATE는 컬럼 권한에 role이 없어 원래 불가 + profiles_guard_privileged 트리거 추가
--    - INSERT는 테이블 권한을 걷고 안전한 컬럼만 재허용 (profiles_column_privileges.sql)
--    따라서 아래 is_admin()의 판정을 신뢰할 수 있다.
-- ============================================================


-- ── 1) 컬럼 추가 ────────────────────────────────────────────
-- 순서가 중요하다. DEFAULT를 같이 주면 Postgres가 기존 46건을 그 값으로 채워버린다.
-- 그래서 "기본값 없이 추가" → "그 다음 기본값 설정" 두 단계로 나눈다.

alter table public.shops add column if not exists review_status text;
alter table public.shops add column if not exists reviewed_at   timestamptz;

-- 검수한 관리자. 프로필이 지워져도 샵과 검수 시각은 남아야 하므로 on delete set null.
-- (reviewed_at은 그대로 보존된다 — "누가"는 잃어도 "언제 검수했다"는 사실은 유효하다.
--  대안인 on delete cascade는 샵 행을 지워버려서 절대 쓰면 안 되고,
--  restrict는 관리자 계정 삭제를 막아버린다.)
alter table public.shops add column if not exists reviewed_by uuid
  references public.profiles(id) on delete set null;

-- 이 시점 이후의 INSERT부터 적용된다. 기존 행은 건드리지 않는다.
alter table public.shops alter column review_status set default 'pending';


-- ── 2) 값 제약 ──────────────────────────────────────────────
-- in 목록은 대소문자를 구분하므로 'Pending'은 거부된다. 빈 문자열도 목록에 없어 거부된다.
alter table public.shops drop constraint if exists shops_review_status_chk;
alter table public.shops add constraint shops_review_status_chk
  check (review_status is null
         or review_status in ('pending', 'reviewed', 'needs_attention'));


-- ── 3) 대기열 조회용 부분 인덱스 ─────────────────────────────
-- 전체가 아니라 pending 행만 담는다. 대기열이 비면 인덱스도 비어 비용이 거의 없다.
create index if not exists shops_review_pending_idx
  on public.shops (created_at desc)
  where review_status = 'pending';

create index if not exists shops_review_attention_idx
  on public.shops (created_at desc)
  where review_status = 'needs_attention';


-- ── 4) 관리자 판정 함수 ─────────────────────────────────────
-- 지금까지는 정책·함수마다 exists(select 1 from profiles ... role='admin')를 인라인으로
-- 반복해 왔다. 여기서 한 곳으로 모은다. 기존 정책은 이번에 건드리지 않는다.
--
-- 보안:
--   security definer — profiles의 RLS와 무관하게 판정하기 위해. 소유자는 이 SQL을
--                      실행하는 역할(Supabase SQL Editor = postgres)이 된다.
--   set search_path  — 검색 경로를 고정해 스키마 가로채기를 막는다.
--   public.profiles  — 스키마를 명시한다.
--   stable           — 같은 트랜잭션 안에서 재호출을 줄인다.
--   동적 SQL 없음.
--   실행 권한은 authenticated에만. anon·public은 회수한다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $is_admin$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$is_admin$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- ── 5) INSERT: 검수 기본값 강제 ─────────────────────────────
-- 클라이언트가 뭘 보내든 무시하고 서버에서 정한다.
--   관리자가 만든 샵  → reviewed (본인이 만들었으니 검수 대기에 올릴 이유가 없다)
--   그 외(일반 사용자, EventReviewPage, Service Role) → pending
--
-- ⚠️ Service Role은 auth.uid()가 NULL이라 '관리자 아님'으로 판정되어 pending이 된다.
--    현재 샵을 Service Role로 INSERT하는 경로는 없다(2026-09-02 확인:
--    /api/admin/upsert의 ALLOWED에 shops가 없고, shop-status·shop-field는 UPDATE만 한다).
--    향후 관리자 API가 Service Role로 샵을 만들면 pending으로 들어온다는 점을 기억할 것.
--    Service Role을 무조건 관리자로 간주하지 않는다 — 그렇게 하면 키가 새는 순간 끝이다.
--
-- 트리거 함수 자체는 security invoker(기본)로 둔다. 권한이 필요한 판정은
-- is_admin() 한 곳에만 맡겨 definer 표면을 최소화한다.
create or replace function public.shops_review_set_on_insert()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $ins_fn$
begin
  if public.is_admin() then
    new.review_status := 'reviewed';
    new.reviewed_at   := now();
    new.reviewed_by   := auth.uid();
  else
    new.review_status := 'pending';
    new.reviewed_at   := null;
    new.reviewed_by   := null;
  end if;
  return new;
end;
$ins_fn$;

revoke all on function public.shops_review_set_on_insert() from public, anon, authenticated;

drop trigger if exists shops_review_set_on_insert on public.shops;
create trigger shops_review_set_on_insert
  before insert on public.shops
  for each row execute function public.shops_review_set_on_insert();


-- ── 6) UPDATE: 검수 컬럼 변경만 가로챈다 ────────────────────
-- when 절이 핵심이다. 샵 이름·주소·사진을 고치는 평범한 수정에서는 트리거 함수가
-- 아예 호출되지 않아 profiles 조회가 발생하지 않는다.
-- 세 컬럼 중 하나라도 실제로 값이 바뀔 때만 실행된다.
create or replace function public.shops_review_guard_on_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $upd_fn$
begin
  if not public.is_admin() then
    -- 조용히 되돌리면 공격을 못 본 채 넘어간다. 명시적으로 거부한다.
    raise exception '검수 상태는 관리자만 변경할 수 있습니다'
      using errcode = '42501';   -- insufficient_privilege
  end if;

  -- 관리자라도 reviewed_at·reviewed_by를 임의로 정할 수 없다. 서버가 강제한다.
  -- 의미: "검수 상태를 마지막으로 바꾼 사람과 시각".
  new.reviewed_at := now();
  new.reviewed_by := auth.uid();
  return new;
end;
$upd_fn$;

revoke all on function public.shops_review_guard_on_update() from public, anon, authenticated;

drop trigger if exists shops_review_guard_on_update on public.shops;
create trigger shops_review_guard_on_update
  before update on public.shops
  for each row
  when (new.review_status is distinct from old.review_status
     or new.reviewed_at   is distinct from old.reviewed_at
     or new.reviewed_by   is distinct from old.reviewed_by)
  execute function public.shops_review_guard_on_update();


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [알아둘 것] shops의 다른 컬럼은 아직 넓게 열려 있다
-- ============================================================
-- shops는 anon·authenticated 모두 테이블 단위 INSERT/UPDATE/DELETE 권한을 갖고 있고,
-- shops_update_tiered 정책이 "is_claimed가 아니면 누구나 수정"이라 컬럼 제한이 없다.
-- 즉 로그인한 사용자가 status·is_verified·owner_id 같은 값을 직접 바꿀 수 있다.
-- (2026-09-02 확인. 별도 보안 작업으로 분리)
--
-- 다만 이 마이그레이션이 추가하는 review_status·reviewed_at·reviewed_by는
-- 위 트리거가 관리자 외의 변경을 42501로 거부하므로 그 문제의 영향을 받지 않는다.


-- ============================================================
-- [적용 후 검증] 기존 데이터가 그대로인지
-- ============================================================
-- -- 1) 기존 46건이 전부 NULL로 남았는가 (pending/reviewed가 0이어야 한다)
-- select coalesce(review_status, '(null)') as review_status, count(*)
-- from public.shops group by 1 order by 2 desc;
--
-- -- 2) status와 is_verified가 그대로인가 (active 46 / hidden 2 / deleted 1, 공식 0)
-- select coalesce(status,'(null)') as status, count(*) from public.shops group by 1;
-- select count(*) from public.shops where is_verified = true and status <> 'deleted';
--
-- -- 3) 기본값·제약·트리거가 붙었는가
-- select column_name, column_default, is_nullable
-- from information_schema.columns
-- where table_schema='public' and table_name='shops'
--   and column_name in ('review_status','reviewed_at','reviewed_by');
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'public.shops'::regclass and conname = 'shops_review_status_chk';
--
-- select tgname, pg_get_triggerdef(oid) from pg_trigger
-- where tgrelid = 'public.shops'::regclass and not tgisinternal;


-- ============================================================
-- [롤백] 되돌리기 — 컬럼을 지우면 검수 기록도 함께 사라진다
-- ============================================================
-- drop trigger if exists shops_review_guard_on_update on public.shops;
-- drop trigger if exists shops_review_set_on_insert  on public.shops;
-- drop function if exists public.shops_review_guard_on_update();
-- drop function if exists public.shops_review_set_on_insert();
-- drop index if exists public.shops_review_attention_idx;
-- drop index if exists public.shops_review_pending_idx;
-- alter table public.shops drop constraint if exists shops_review_status_chk;
-- alter table public.shops drop column if exists reviewed_by;
-- alter table public.shops drop column if exists reviewed_at;
-- alter table public.shops drop column if exists review_status;
-- -- is_admin()은 다른 곳에서 쓰기 시작했다면 남겨둘 것
-- drop function if exists public.is_admin();
-- select pg_notify('pgrst', 'reload schema');
