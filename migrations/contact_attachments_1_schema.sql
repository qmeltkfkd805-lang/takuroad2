-- ============================================================
-- 문의 첨부 — 서버 승인 기반 업로드 (1/2: 스키마)
--
-- 왜
--   contact-files 버킷의 INSERT 정책이 {public} 에 조건은 버킷 이름뿐이었다.
--   비로그인 상태에서 anon 키만으로 아무 파일이나 올릴 수 있었고,
--   크기·형식 제한도 없었으며 DELETE 정책이 없어 지울 수도 없었다.
--   공개 버킷이라 올린 파일에 즉시 공개 URL 이 붙는다 — 누구나 쓸 수 있는
--   공개 파일 호스팅이었다.
--
-- 이 변경이 보장하는 것
--   · 초안 하나당 첨부 최대 5개 (누적. 슬롯 재사용 불가) — DB 가 강제
--   · 파일당 10 MiB — 버킷이 강제
--   · 업로드 경로를 서버가 정한다 — 클라이언트가 고를 수 없다
--   · 제출 시 객체 존재와 실제 크기를 재검증
--   · 미제출 첨부를 만료 처리하고 정리 대상으로 기록·추적
--
-- 이 변경이 보장하지 않는 것
--   **총사용량은 제한되지 않는다.** 로그인 사용자가 초안을 계속 새로 만들면
--   상한이 없다 (초안당 최대 50 MiB × 무제한 초안).
--   사용자별 초안 생성 빈도 제한과 기간별 업로드 총량 제한은 후속 과제다.
--   contact_attachments 가 user_id·reserved_at·actual_size 를 들고 있으므로
--   나중에 그 한도를 붙일 자리는 생기지만, 지금은 없다.
-- ============================================================


-- ============================================================
-- 1. 초안
--
--   reserved_count 가 누적 예약 수다. 단조 증가만 하고 줄지 않는다.
--   슬롯을 지워도 카운터는 안 줄기 때문에 초안당 누적 5개가 보장된다.
--   (부분 유니크 인덱스만으로는 '활성 5개' 만 보장되고, 만료된 슬롯을
--    재사용하면 누적은 5개를 넘을 수 있다)
--
--   user_id 에 FK 를 걸지 않는다
--     contact_messages.user_id 도 FK 가 없다 (확인함).
--     더 중요한 이유는 탈퇴 cascade 다 — 사용자가 지워질 때 이 행이 같이
--     사라지면 Storage 에 객체만 남고 무엇을 지워야 하는지 알 수 없게 된다.
--     탈퇴한 사용자의 초안은 만료 처리를 거쳐 정리된다.
-- ============================================================
create table if not exists public.contact_drafts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  status         text not null default 'open'
                   check (status in ('open', 'submitted', 'expired')),
  -- 누적 예약 수. 감소하지 않는다
  reserved_count smallint not null default 0
                   check (reserved_count between 0 and 5),
  message_id     uuid references public.contact_messages(id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '1 hour',
  submitted_at   timestamptz,
  expired_at     timestamptz
);

comment on table public.contact_drafts is
  '문의 작성 초안. 첨부 예약을 묶는 단위. 만료 1시간. reserved_count 가 누적 5개를 강제한다.';
comment on column public.contact_drafts.reserved_count is
  '누적 예약 수. 단조 증가. 슬롯 재사용으로 5개를 넘지 못하게 한다.';

/* 호출 계약 — 예약·제출·만료 세 동작 모두 지켜야 한다
     1) select ... from contact_drafts where id = ? for update   (초안 행 잠금)
     2) status 와 expires_at 을 다시 확인                        (잠근 뒤 재확인)
     3) 카운터 증가와 contact_attachments INSERT 를 같은 트랜잭션에서
   카운터 UPDATE 하나로 나머지 동작까지 직렬화되지는 않는다.
   잠금을 먼저 잡고 상태를 재확인하는 것이 직렬화의 실체다.

   취소해도 예약 횟수는 복구되지 않는다
     reserved_count 는 줄지 않으므로, 사용자가 파일을 뺐다가 다시 올리면
     남은 횟수가 줄어든 채로 남는다. 화면에서 이 동작을 안내해야 한다. */

create index if not exists ix_contact_drafts_user
  on public.contact_drafts (user_id, created_at desc);
create index if not exists ix_contact_drafts_expiry
  on public.contact_drafts (expires_at) where status = 'open';


-- ============================================================
-- 2. 첨부 예약
--
--   서명 업로드 URL 은 2시간이고 조정할 수 없다
--     https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
--     "Signed upload URLs ... They are valid for 2 hours."
--
--   그래서 cleanup_eligible_at = signed_at + 2시간 15분 이다.
--   초안 만료(생성 +1시간)와는 별개다 — 초안이 만료돼도 이미 발급된 URL 로는
--   그 뒤에도 올릴 수 있다. 그 전에 객체를 지우면 늦게 업로드된 파일이
--   다시 고아가 된다.
--
--   기준은 '마지막 발급 시각' 이다. 재발급하면 signed_at 과
--   cleanup_eligible_at 을 함께 갱신하되, 줄어들지 않게 greatest() 로 연장만 한다.
--   초안 생성 기준으로 보면 보호 구간은 2시간 15분 ~ 3시간 15분 사이이고
--   항상 3시간 15분인 것이 아니다 (발급이 초안 생성 직후일 수도,
--   만료 직전일 수도 있다).
--
--   두 컬럼 다 not null 이라 '발급 시각이 불명확한 행' 은 생기지 않는다.
--   그래도 정리 쪽에서 한 번 더 확인한다 (아래 3번 뷰와 정리 함수).
-- ============================================================
create table if not exists public.contact_attachments (
  id            uuid primary key default gen_random_uuid(),
  -- cascade 를 걸지 않는다. 초안이 지워질 때 추적 행이 사라지면
  -- Storage 에 무엇이 남았는지 알 수 없다
  draft_id      uuid not null references public.contact_drafts(id),
  user_id       uuid not null,
  bucket_id     text not null default 'contact-files',
  -- 서버가 정한다. 클라이언트는 고를 수 없다
  object_path   text not null,
  -- 초안의 reserved_count 에서 나온다. 재사용되지 않는다
  slot_index    smallint not null check (slot_index between 1 and 5),
  status        text not null default 'reserved'
                  check (status in ('reserved', 'attached', 'expired')),
  -- 클라이언트가 신고한 크기. 사전 검사용이고 신뢰하지 않는다
  declared_size bigint,
  -- 제출 시 실제 객체에서 읽은 크기
  actual_size   bigint,
  content_type  text,
  message_id    uuid references public.contact_messages(id) on delete set null,
  reserved_at   timestamptz not null default now(),
  -- 마지막 서명 URL 발급 시각. 업로드 가능 시간의 기준
  signed_at     timestamptz not null default now(),
  -- signed_at + 2시간 15분. 이 전에는 삭제 대상으로 보지 않는다
  cleanup_eligible_at timestamptz not null default now() + interval '2 hours 15 minutes',
  attached_at   timestamptz,
  expired_at    timestamptz,
  -- 만료 행은 지우지 않고 남긴다. 무엇을 지웠는지 추적할 수 있어야 한다
  cleanup_state text not null default 'none'
                  check (cleanup_state in ('none', 'queued', 'done', 'skipped')),
  cleanup_note  text
);

comment on table public.contact_attachments is
  '문의 첨부 예약. 경로는 서버가 정하고, 초안당 누적 5개를 DB 가 강제한다. 만료 행은 추적용으로 남긴다.';
comment on column public.contact_attachments.cleanup_eligible_at is
  '마지막 서명 URL 발급 + 2시간 15분. 서명 URL 2시간이 끝나기 전에는 삭제하지 않는다.';
comment on column public.contact_attachments.declared_size is
  '클라이언트 신고값. 사전 검사용이며 신뢰하지 않는다. 실제 크기는 actual_size.';

-- 같은 객체를 두 예약이 가리킬 수 없다
create unique index if not exists uq_contact_attachments_object
  on public.contact_attachments (bucket_id, object_path);

-- 슬롯은 재사용되지 않으므로 조건 없는 유니크다.
-- (부분 유니크로 두면 만료 슬롯이 재사용돼 누적이 5개를 넘는다)
create unique index if not exists uq_contact_attachments_slot
  on public.contact_attachments (draft_id, slot_index);

-- 정리 대상 조회용
create index if not exists ix_contact_attachments_cleanup
  on public.contact_attachments (cleanup_state, cleanup_eligible_at)
  where message_id is null;


-- ============================================================
-- 3. 참조 보호용 뷰
--
--   아직 어느 문의에도 연결되지 않은 첨부는 REF_SOURCES 기준으로 참조가 없다
--   — 삭제 후보 탐지기가 그대로 후보로 찍는다. 다음 셋을 전부 보호한다.
--
--     · 유효한 예약            아직 업로드 가능 시간이 남은 reserved
--     · 제출된 첨부            attached 이고 message_id 가 있는 것
--     · 만료됐지만 정리 전     expired 인데 cleanup_eligible_at 이 아직 안 지난 것
--
--   정리 워커도 같은 기준을 써야 한다. 여기 나오는 객체는 지우지 않는다.
--
--   문의가 삭제되면 message_id 가 null 이 되고, 보호 구간이 지나면
--   자연히 후보로 넘어간다 — 그게 맞는 동작이다.
-- ============================================================
create or replace view public.contact_attachments_protected as
select id, bucket_id, object_path, status, draft_id, user_id,
       message_id, signed_at, cleanup_eligible_at
from public.contact_attachments
where (status = 'attached' and message_id is not null)
   or cleanup_eligible_at > now()
   -- 보호 시각이 불분명한 행은 절대 삭제 후보로 넘기지 않는다.
   -- 지금은 두 컬럼 다 not null 이라 걸리지 않지만, 그 제약이 나중에
   -- 풀리더라도 이 가드는 남아야 한다.
   or cleanup_eligible_at is null
   or signed_at is null;

comment on view public.contact_attachments_protected is
  '삭제해서는 안 되는 첨부. 유효 예약 + 제출된 첨부 + 만료됐지만 정리 시점 전. canonicalRef.ts 의 REF_SOURCES 와 정리 워커가 같은 기준으로 쓴다.';


-- ============================================================
-- 4. 권한
--
--   브라우저는 이 테이블·뷰에 직접 접근하지 않는다. 모든 읽기·쓰기는
--   서버 라우트(service_role)를 거친다.
--
--   ⚠️ 뷰는 소유자 권한으로 실행된다 (security_invoker 기본 off).
--      기반 테이블에 RLS 를 켰다고 뷰 접근이 막히는 것이 아니다.
--      뷰의 grant 를 따로 회수해야 한다.
--   ⚠️ pg_default_acl 때문에 PUBLIC 에 권한이 붙을 수 있다.
--      grantee 를 anon·authenticated 로 좁혀 보면 PUBLIC 권한을 놓친다.
--      확인은 has_table_privilege() 로 한다 (아래 [적용 후 확인]).
-- ============================================================
alter table public.contact_drafts      enable row level security;
alter table public.contact_attachments enable row level security;
-- 정책을 만들지 않는다 = anon·authenticated 는 RLS 에서 전부 막힌다

revoke all on public.contact_drafts                from public, anon, authenticated;
revoke all on public.contact_attachments           from public, anon, authenticated;
revoke all on public.contact_attachments_protected from public, anon, authenticated;

grant select, insert, update on public.contact_drafts      to service_role;
grant select, insert, update on public.contact_attachments to service_role;
grant select                 on public.contact_attachments_protected to service_role;

-- ============================================================
-- 5. 버킷 제한
--    이 버킷만 크기·형식 제한이 비어 있었다. 다른 버킷은 걸려 있다
--    (verify-documents 5 MiB·4종, exhibit-images 8 MiB·4종).
--
--    MIME 은 이번에 걸지 않는다. PartnerForm 이 accept 없이 아무 형식이나
--    받고 있어서, 형식 정책을 정하기 전에 제한하면 기존 동작이 깨진다.
--    MIME 제한은 클라이언트가 contentType 을 속일 수 있어 약한 방어이기도 하다
--    — 실질 방어는 서버 승인(위 RPC)과 경로 통제다.
-- ============================================================
update storage.buckets
set file_size_limit = 10485760          -- 10 MiB. RPC 의 c_max_bytes 와 같은 값
where id = 'contact-files';

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 확인]
-- ============================================================
-- -- (1) 권한이 실제로 닫혔는가. information_schema 가 아니라 has_table_privilege 로 본다
-- select c.relname as "대상", r.rolname as "역할",
--        has_table_privilege(r.rolname, c.oid, 'SELECT') as sel,
--        has_table_privilege(r.rolname, c.oid, 'INSERT') as ins,
--        has_table_privilege(r.rolname, c.oid, 'UPDATE') as upd,
--        has_table_privilege(r.rolname, c.oid, 'DELETE') as del
-- from pg_class c
-- cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
-- where c.relname in ('contact_drafts', 'contact_attachments', 'contact_attachments_protected')
-- order by c.relname, r.rolname;
--   → anon·authenticated 는 네 컬럼 전부 false
--   → service_role 은 뷰 SELECT, 테이블 SELECT/INSERT/UPDATE true, DELETE false
--
-- -- (2) 브라우저가 실제로 못 읽는가
-- begin; set local role authenticated;
-- select * from public.contact_attachments limit 1;
-- rollback;   -- → 42501
--
-- begin; set local role authenticated;
-- select * from public.contact_attachments_protected limit 1;
-- rollback;   -- → 42501
--
-- -- (3) 누적 5개 제약이 걸리는가 (rollback 이라 반영 안 됨)
-- begin;
-- insert into public.contact_drafts (user_id, reserved_count)
--   values ('58717f88-113f-4298-9553-538b3204ac15', 5) returning id;
-- update public.contact_drafts set reserved_count = reserved_count + 1
--   where user_id = '58717f88-113f-4298-9553-538b3204ac15';
-- rollback;   -- → 23514 check constraint "contact_drafts_reserved_count_check"
