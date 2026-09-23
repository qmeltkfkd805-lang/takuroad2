-- ============================================================
-- 문의 첨부 정리 (3/3)
--
-- 큐는 기존 exhibit_storage_cleanup_queue 를 그대로 쓴다. 이름은 exhibit
-- 전용이지만 스키마는 범용이고, cron 경로(/api/exhibit/cleanup)와의 결합 때문에
-- rename 은 별도 과제로 남아 있다.
--
-- 워커에 문의 전용 로직을 넣지 않는다
--   cleanupWorker.runCleanup 은 remove() 직전에 전 출처 참조 스냅샷을 다시
--   만든다. REF_SOURCES 에 contact_attachments_protected 뷰가 들어 있으므로
--   유효 예약·제출된 첨부·보호 구간 내 만료 건은 isReferenced 에 걸려
--   blocked 로 빠진다. ALLOWED_BUCKETS 에 contact-files 를 더하는 것으로 충분하다.
--
-- 큐 테이블 사실 (확인함)
--   컬럼   id · bucket_id · object_path · reason · status · attempts ·
--          claimed_at · lease_until · last_error · created_at · done_at
--   제약   PK(id), status check ('pending','processing','done','failed')
--   (bucket_id, object_path) 유니크는 없다 → 중복 적재는 cleanup_state 전이로 막는다
-- ============================================================


-- ============================================================
-- 1. 만료 첨부를 큐에 적재
--
--   보호 뷰에 남아 있으면 절대 넣지 않는다. 서명 업로드 URL 이 2시간이라
--   초안이 만료(생성 +1시간)돼도 그 뒤에 업로드가 들어올 수 있고,
--   그 전에 지우면 늦게 올라온 객체가 다시 고아가 된다.
-- ============================================================
create or replace function public.contact_enqueue_expired_attachments(
  p_limit integer default 200
)
returns table (enqueued integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_n integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 2000 then
    raise exception 'p_limit 은 1..2000 이어야 합니다' using errcode = '22023';
  end if;

  with pick as (
    select a.id, a.bucket_id, a.object_path
    from public.contact_attachments a
    where a.status = 'expired'
      and a.message_id is null
      and a.cleanup_state = 'none'
      -- 발급 시각이 불분명하면 손대지 않는다
      and a.signed_at is not null
      and a.cleanup_eligible_at is not null
      and a.cleanup_eligible_at <= now()
      -- 워커와 같은 기준. 보호 뷰에 있으면 제외
      and not exists (
        select 1 from public.contact_attachments_protected p where p.id = a.id
      )
    order by a.cleanup_eligible_at
    limit p_limit
    for update skip locked
  ),
  ins as (
    insert into public.exhibit_storage_cleanup_queue (bucket_id, object_path, reason)
    select p.bucket_id, p.object_path, '문의 첨부 미제출 만료'
    from pick p
    returning 1
  ),
  upd as (
    update public.contact_attachments a
    set cleanup_state = 'queued'
    from pick p
    where a.id = p.id
    returning 1
  )
  select count(*)::integer into v_n from upd;

  return query select v_n;
end;
$fn$;

comment on function public.contact_enqueue_expired_attachments(integer) is
  '보호 구간이 지난 미제출 첨부만 Storage 정리 큐에 넣는다. 중복 적재는 cleanup_state 전이로 막는다.';


-- ============================================================
-- 2. 워커 처리 결과를 첨부 행에 되돌려 기록
--
--   만료 행은 지우지 않고 남긴다. 무엇을 지웠고 무엇이 실패했는지
--   추적할 수 있어야 한다. 큐는 done 을 30일 뒤 purge 하므로
--   그 전에 이 함수가 돌아야 한다 (크론이 매 회차 부른다).
-- ============================================================
create or replace function public.contact_sync_cleanup_state()
returns table (done integer, skipped integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_done integer := 0;
  v_skip integer := 0;
begin
  -- 같은 경로가 여러 번 큐에 들어갔을 수 있다. 가장 최근 것을 본다
  update public.contact_attachments a
  set cleanup_state = 'done'
  from (
    select distinct on (bucket_id, object_path) bucket_id, object_path, status
    from public.exhibit_storage_cleanup_queue
    where status = 'done'
    order by bucket_id, object_path, id desc
  ) q
  where a.cleanup_state = 'queued'
    and a.bucket_id = q.bucket_id
    and a.object_path = q.object_path;
  get diagnostics v_done = row_count;

  update public.contact_attachments a
  set cleanup_state = 'skipped',
      cleanup_note = left(coalesce(q.last_error, '정리 실패'), 500)
  from (
    select distinct on (bucket_id, object_path) bucket_id, object_path, status, last_error
    from public.exhibit_storage_cleanup_queue
    where status = 'failed'
    order by bucket_id, object_path, id desc
  ) q
  where a.cleanup_state = 'queued'
    and a.bucket_id = q.bucket_id
    and a.object_path = q.object_path;
  get diagnostics v_skip = row_count;

  return query select v_done, v_skip;
end;
$fn$;

comment on function public.contact_sync_cleanup_state() is
  '큐 처리 결과를 contact_attachments.cleanup_state 에 반영한다. 큐 purge 전에 돌아야 한다.';


-- ============================================================
-- 권한 — service_role 전용
-- ============================================================
revoke execute on function public.contact_enqueue_expired_attachments(integer) from public, anon, authenticated;
revoke execute on function public.contact_sync_cleanup_state()                 from public, anon, authenticated;

grant execute on function public.contact_enqueue_expired_attachments(integer) to service_role;
grant execute on function public.contact_sync_cleanup_state()                 to service_role;

select pg_notify('pgrst', 'reload schema');
