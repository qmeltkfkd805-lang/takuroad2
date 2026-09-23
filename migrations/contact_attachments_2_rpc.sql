-- ============================================================
-- 문의 첨부 — 서버 승인 기반 업로드 (2/2: RPC)
--
-- 공통 계약
--   예약·제출·만료 모두 같은 순서를 지킨다.
--     1) select ... from contact_drafts where id = ? for update
--     2) 잠근 뒤 status·expires_at 을 다시 확인
--     3) 카운터·첨부·문의를 같은 트랜잭션에서 처리
--   plpgsql 함수 하나가 한 트랜잭션이므로 3)은 자동으로 만족된다.
--   1)·2)를 빼먹으면 동시 요청에서 상태가 어긋난다 — UPDATE 하나만으로는
--   나머지 동작까지 직렬화되지 않는다.
--
-- 전부 service_role 전용이다. 브라우저에 EXECUTE 를 주지 않는다.
-- ============================================================


-- ============================================================
-- 1. 초안 열기
--
--   같은 사용자의 살아 있는 초안이 있으면 그것을 돌려준다.
--   매번 새로 만들면 초안이 무한정 쌓인다. 총사용량 제한의 대체물은 아니지만
--   (초안을 일부러 계속 만드는 것은 여전히 막지 못한다) 정상 사용에서
--   초안이 하나로 유지된다.
-- ============================================================
create or replace function public.contact_open_draft(p_user uuid)
returns table (draft_id uuid, remaining smallint, expires_at timestamptz)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_id uuid;
begin
  if p_user is null then
    raise exception '사용자가 필요합니다' using errcode = '22023';
  end if;

  select d.id into v_id
  from public.contact_drafts d
  where d.user_id = p_user
    and d.status = 'open'
    and d.expires_at > now()
    and d.reserved_count < 5
  order by d.created_at desc
  limit 1;

  if v_id is null then
    insert into public.contact_drafts (user_id) values (p_user) returning id into v_id;
  end if;

  return query
    select d.id, (5 - d.reserved_count)::smallint, d.expires_at
    from public.contact_drafts d where d.id = v_id;
end;
$fn$;


-- ============================================================
-- 2. 첨부 자리 예약
--
--   경로를 서버가 만든다. 클라이언트는 확장자만 제안할 수 있고 그것도 검증한다.
--   경로에 공백이나 한글이 들어가지 않으므로, 나중에 공개 URL 을 만들 때
--   퍼센트 인코딩 문제가 생기지 않는다 (badges.icon_url 에서 겪은 그 문제).
--
--   slot_index 는 reserved_count + 1 이다. 카운터는 줄지 않으므로 슬롯이
--   재사용되지 않고, 초안당 누적 5개가 보장된다.
-- ============================================================
create or replace function public.contact_reserve_attachment(
  p_user          uuid,
  p_draft         uuid,
  p_ext           text,
  p_declared_size bigint
)
returns table (
  attachment_id uuid,
  bucket_id     text,
  object_path   text,
  slot_index    smallint,
  remaining     smallint
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  c_max_bytes constant bigint := 10485760;   -- 10 MiB. 버킷 제한과 같은 값
  v_draft  public.contact_drafts%rowtype;
  v_slot   smallint;
  v_ext    text;
  v_path   text;
  v_id     uuid;
begin
  -- 1) 초안 행을 잠근다
  select * into v_draft from public.contact_drafts
  where id = p_draft for update;

  -- 2) 잠근 뒤 재확인
  if not found then
    raise exception '초안을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if v_draft.user_id <> p_user then
    raise exception '초안 소유자가 아닙니다' using errcode = '42501';
  end if;
  if v_draft.status <> 'open' then
    raise exception '이미 %된 초안입니다', v_draft.status using errcode = '22023';
  end if;
  if v_draft.expires_at <= now() then
    raise exception '초안이 만료되었습니다' using errcode = '22023';
  end if;
  if v_draft.reserved_count >= 5 then
    raise exception '첨부는 초안당 5개까지입니다' using errcode = '22023';
  end if;

  -- 클라이언트 신고 크기는 사전 검사용이다. 실제 크기는 제출 때 다시 읽는다.
  if p_declared_size is not null and p_declared_size > c_max_bytes then
    raise exception '파일당 10 MiB 까지입니다' using errcode = '22023';
  end if;

  -- 확장자 검증. 이상하면 붙이지 않는다
  v_ext := lower(coalesce(p_ext, ''));
  if v_ext !~ '^[a-z0-9]{1,8}$' then v_ext := ''; end if;

  v_slot := (v_draft.reserved_count + 1)::smallint;
  v_path := p_user::text || '/' || p_draft::text || '/'
            || v_slot::text || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10)
            || case when v_ext = '' then '' else '.' || v_ext end;

  -- 3) 카운터와 첨부를 같은 트랜잭션에서
  update public.contact_drafts
  set reserved_count = reserved_count + 1
  where id = p_draft;

  insert into public.contact_attachments
    (draft_id, user_id, object_path, slot_index, declared_size)
  values (p_draft, p_user, v_path, v_slot, p_declared_size)
  returning id into v_id;

  return query
    select v_id, 'contact-files'::text, v_path, v_slot, (5 - v_draft.reserved_count - 1)::smallint;
end;
$fn$;


-- ============================================================
-- 3. 서명 URL 재발급 시 보호 시간 연장
--
--   서명 업로드 URL 은 2시간이다. 다시 발급하면 그만큼 업로드 가능 시간이
--   늘어나므로 보호 시간도 같이 늘려야 한다. 줄어들지는 않게 greatest 로 연장만 한다.
--   이걸 안 하면 정리 후 늦게 업로드된 객체가 다시 고아가 된다.
-- ============================================================
create or replace function public.contact_resign_attachment(
  p_user uuid,
  p_attachment uuid
)
returns table (bucket_id text, object_path text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_a public.contact_attachments%rowtype;
  v_d public.contact_drafts%rowtype;
begin
  select * into v_a from public.contact_attachments where id = p_attachment;
  if not found then
    raise exception '첨부를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if v_a.user_id <> p_user then
    raise exception '첨부 소유자가 아닙니다' using errcode = '42501';
  end if;

  -- 초안을 잠그고 재확인 — 예약과 같은 잠금을 쓴다
  select * into v_d from public.contact_drafts where id = v_a.draft_id for update;
  if v_d.status <> 'open' or v_d.expires_at <= now() then
    raise exception '초안이 더 이상 열려 있지 않습니다' using errcode = '22023';
  end if;
  if v_a.status <> 'reserved' then
    raise exception '이미 처리된 첨부입니다' using errcode = '22023';
  end if;

  update public.contact_attachments
  set signed_at = now(),
      -- 연장만 한다. 앞당기지 않는다
      cleanup_eligible_at = greatest(cleanup_eligible_at, now() + interval '2 hours 15 minutes')
  where id = p_attachment;

  return query select v_a.bucket_id, v_a.object_path;
end;
$fn$;


-- ============================================================
-- 4. 제출
--
--   p_verified 는 라우트가 Storage 에서 실제로 확인한 객체 목록이다.
--     [{"id": "<attachment uuid>", "size": 12345, "content_type": "image/jpeg"}, ...]
--   존재 확인과 실제 크기 측정은 라우트가 하고, 여기서는 그 결과를 반영하면서
--   소유권·상태·개수를 DB 기준으로 다시 확인한다.
--
--   재요청하면 기존 문의를 돌려준다. 같은 초안으로 두 번 제출해도 문의는 하나다.
--
--   attachment_urls 는 서버가 경로에서 만든다. 클라이언트가 준 값을 쓰지 않는다.
-- ============================================================
create or replace function public.contact_submit_draft(
  p_user       uuid,
  p_draft      uuid,
  p_url_base   text,           -- 예: https://<project>.supabase.co
  p_type       text,
  p_title      text,
  p_content    text,
  p_extra      jsonb,
  p_email      text,
  p_page_url   text,
  p_page_label text,
  p_verified   jsonb           -- 라우트가 확인한 첨부들
)
returns table (message_id uuid, attached smallint, expired smallint, reused boolean)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  c_max_bytes constant bigint := 10485760;
  v_draft public.contact_drafts%rowtype;
  v_msg   uuid;
  v_urls  text[];
  v_att   smallint := 0;
  v_exp   smallint := 0;
begin
  -- 1) 초안 잠금
  select * into v_draft from public.contact_drafts where id = p_draft for update;

  -- 2) 재확인
  if not found then
    raise exception '초안을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if v_draft.user_id <> p_user then
    raise exception '초안 소유자가 아닙니다' using errcode = '42501';
  end if;

  -- 이미 제출됨 → 기존 문의를 돌려준다 (멱등)
  if v_draft.status = 'submitted' and v_draft.message_id is not null then
    return query
      select v_draft.message_id,
             (select count(*) from public.contact_attachments a
              where a.draft_id = p_draft and a.status = 'attached')::smallint,
             (select count(*) from public.contact_attachments a
              where a.draft_id = p_draft and a.status = 'expired')::smallint,
             true;
    return;
  end if;

  if v_draft.status <> 'open' then
    raise exception '초안이 %되어 제출할 수 없습니다', v_draft.status using errcode = '22023';
  end if;
  if v_draft.expires_at <= now() then
    raise exception '초안이 만료되었습니다. 다시 작성해주세요' using errcode = '22023';
  end if;

  -- 검증된 첨부가 이 초안의 것이고, 이 사용자 것이고, 아직 reserved 인지 확인
  if jsonb_typeof(p_verified) <> 'array' then
    raise exception 'p_verified 는 배열이어야 합니다' using errcode = '22023';
  end if;
  if jsonb_array_length(p_verified) > 5 then
    raise exception '첨부는 5개까지입니다' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_verified) v
    left join public.contact_attachments a on a.id = (v->>'id')::uuid
    where a.id is null
       or a.draft_id <> p_draft
       or a.user_id <> p_user
       or a.status <> 'reserved'
  ) then
    raise exception '이 초안의 첨부가 아니거나 이미 처리되었습니다' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_verified) v
    where (v->>'size')::bigint > c_max_bytes
  ) then
    raise exception '파일당 10 MiB 까지입니다' using errcode = '22023';
  end if;

  -- 3) 문의 생성. attachment_urls 를 서버가 만든다.
  --    경로는 서버가 정한 [0-9a-f-/.] 뿐이라 인코딩이 필요 없다.
  select coalesce(array_agg(
           rtrim(p_url_base, '/') || '/storage/v1/object/public/'
           || a.bucket_id || '/' || a.object_path
           order by a.slot_index), '{}')
    into v_urls
  from jsonb_array_elements(p_verified) v
  join public.contact_attachments a on a.id = (v->>'id')::uuid;

  insert into public.contact_messages
    (type, title, content, extra, email, user_id, page_url, page_label, attachment_urls)
  values
    (p_type, p_title, p_content, coalesce(p_extra, '{}'::jsonb), p_email,
     p_user, p_page_url, p_page_label, v_urls)
  returning id into v_msg;

  -- 검증된 첨부 → attached
  update public.contact_attachments a
  set status = 'attached',
      message_id = v_msg,
      attached_at = now(),
      actual_size = (v->>'size')::bigint,
      content_type = v->>'content_type'
  from jsonb_array_elements(p_verified) v
  where a.id = (v->>'id')::uuid;
  get diagnostics v_att = row_count;

  -- 나머지(업로드가 끝나지 않았거나 확인 안 된 것) → expired.
  -- 행은 남긴다. cleanup_eligible_at 이 지나야 정리 대상이 된다.
  update public.contact_attachments a
  set status = 'expired',
      expired_at = now(),
      cleanup_note = '제출 시 확인되지 않음'
  where a.draft_id = p_draft and a.status = 'reserved';
  get diagnostics v_exp = row_count;

  update public.contact_drafts
  set status = 'submitted', message_id = v_msg, submitted_at = now()
  where id = p_draft;

  return query select v_msg, v_att, v_exp, false;
end;
$fn$;


-- ============================================================
-- 5. 만료 처리 (크론)
--
--   만료된 초안과 그 예약 첨부를 expired 로 바꾼다.
--   객체는 여기서 지우지 않는다 — cleanup_eligible_at 이 지나야 정리 대상이다.
--   skip locked 로 다른 트랜잭션이 잡고 있는 초안은 건너뛴다.
-- ============================================================
create or replace function public.contact_expire_drafts(p_limit integer default 200)
returns table (drafts_expired integer, attachments_expired integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_ids uuid[];
  v_d integer := 0;
  v_a integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit 은 1..5000 이어야 합니다' using errcode = '22023';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from (
    select id from public.contact_drafts
    where status = 'open' and expires_at <= now()
    order by expires_at
    limit p_limit
    for update skip locked
  ) s;

  if array_length(v_ids, 1) is null then
    return query select 0, 0;
    return;
  end if;

  update public.contact_drafts
  set status = 'expired', expired_at = now()
  where id = any(v_ids);
  get diagnostics v_d = row_count;

  update public.contact_attachments
  set status = 'expired', expired_at = now(),
      cleanup_note = coalesce(cleanup_note, '초안 만료')
  where draft_id = any(v_ids) and status = 'reserved';
  get diagnostics v_a = row_count;

  return query select v_d, v_a;
end;
$fn$;


-- ============================================================
-- 권한 — service_role 전용
-- ============================================================
revoke execute on function public.contact_open_draft(uuid)                      from public, anon, authenticated;
revoke execute on function public.contact_reserve_attachment(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke execute on function public.contact_resign_attachment(uuid, uuid)         from public, anon, authenticated;
revoke execute on function public.contact_submit_draft(uuid, uuid, text, text, text, text, jsonb, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.contact_expire_drafts(integer)                from public, anon, authenticated;

grant execute on function public.contact_open_draft(uuid)                      to service_role;
grant execute on function public.contact_reserve_attachment(uuid, uuid, text, bigint) to service_role;
grant execute on function public.contact_resign_attachment(uuid, uuid)         to service_role;
grant execute on function public.contact_submit_draft(uuid, uuid, text, text, text, text, jsonb, text, text, text, jsonb) to service_role;
grant execute on function public.contact_expire_drafts(integer)                to service_role;

select pg_notify('pgrst', 'reload schema');
