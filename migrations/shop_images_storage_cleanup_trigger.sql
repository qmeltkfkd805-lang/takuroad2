-- ============================================================
-- shop_images → Storage 정리 큐 적재 트리거
--
-- 증상:
--   사진을 지우거나 크롭으로 교체할 때마다 Storage 객체가 참조 없이 남았다.
--   화면은 정상이지만 지울 방법이 없어 용량만 쌓였다.
--
-- 원인:
--   deleteShopImage 는 shop_images 행만 지운다. Storage 는 손대지 않는다.
--   PhotosManage.saveCrop 은 새 행을 만들고 구 행을 지우는 방식이라
--   구 객체를 가리키는 참조가 사라졌다.
--   클라이언트가 직접 지우게 하려면 Storage DELETE 권한을 넓혀야 하는데,
--   그건 남의 사진을 지울 수 있게 되는 길이라 택하지 않는다.
--
-- 조치:
--   1) 행이 사라지거나 출처가 바뀌면 트리거가 정리 큐에 적재한다.
--      DELETE·UPDATE 와 같은 트랜잭션이라 "행만 사라지고 기록은 없는" 상태가 없다.
--   2) 크롭은 새 행 생성이 아니라 기존 행 in-place UPDATE 로 바꿨다.
--      id·is_cover·sort_order·uploaded_by·created_at 이 유지되므로
--      대표 사진을 크롭해도 cover 전환 RPC 가 필요 없다.
--   3) 실제 삭제는 워커(/api/exhibit/cleanup)가 remove() 직전에
--      전 출처 참조를 canonical {bucket, path} 로 다시 확인한 뒤 수행한다.
--
-- 큐 테이블은 exhibit_storage_cleanup_queue 를 그대로 재사용한다.
--   스키마가 이미 범용이다 (bucket_id · object_path · reason · status · attempts ·
--   lease_until · last_error · done_at). exhibit 전용 컬럼·FK 가 없다.
--   이름만 exhibit 전용이라 부채로 남는다. rename 은 cron 경로(/api/exhibit/cleanup)와
--   기존 exhibit_image_cleanup 함수에 걸려 배포 공백을 만들기 때문에 별도 작업으로 미뤘다.
--   출처는 reason 으로 구분한다:
--     exhibit_image_deleted (기존) / shop_image_deleted / shop_image_replaced
--
-- ✅ 사전 확인 (2026-09-12, 실제 조회)
--   1. exhibit_image_cleanup 이 SECURITY DEFINER · owner=postgres 다.
--      큐 테이블은 RLS 켜짐 + 정책 0건 + 클라이언트 권한 0건이라 완전히 닫혀 있는데,
--      트리거가 owner 권한으로 적재한다. 같은 방식이 shop_images 에도 쓸 수 있다.
--   2. 부분 유니크 인덱스 exhibit_cleanup_active_uq
--        (bucket_id, object_path) WHERE status in ('pending','processing')
--      ON CONFLICT 술어가 이 인덱스와 맞는지 임시 행 2회 삽입으로 실증했다(1건만 생성).
--   3. shop_images 기존 트리거는 trg_shop_images_touch 하나뿐. 이름 충돌 없음.
--   4. 동명 함수 없음. 큐 0건.
--   5. shop_images 137행 전부 storage_path NULL — 적재 대상이 아니다.
--
-- 의존 관계
--   - exhibit_storage_cleanup_queue 테이블과 exhibit_cleanup_active_uq 인덱스
--   - shop_images_storage_ref_valid CHECK (2026-09-12 적용)
--   - 워커 코드 src/lib/storage/cleanupWorker.ts · canonicalRef.ts (커밋 811b868)
--     워커가 shop-images 를 허용 버킷에 갖고 있어야 한다. 811b868 이전 워커는
--     이 큐 행을 "허용되지 않은 대상"으로 판정해 failed 로 격리한다.
--     그래서 워커 배포가 이 트리거보다 먼저다.
--
-- 오류 처리 방침
--   예상한 충돌(exhibit_cleanup_active_uq)만 ON CONFLICT 로 무시한다.
--   그 외 오류는 삼키지 않는다 → 원본 DELETE/UPDATE 트랜잭션이 함께 롤백된다.
--   가용성 대가: 큐 테이블이 망가지면 사진 삭제·크롭이 실패한다. 의도된 선택이다.
--   정리 기록 없이 DB 행만 사라지는 것이 더 나쁘다.
--
-- 이 트리거가 해결하는 범위
--   · storage_path 가 기록된 shop_images 행의 DELETE
--   · storage_path 가 기록된 행의 출처 교체(UPDATE)
--   · shops 삭제의 ON DELETE CASCADE 로 지워지는 기록된 행
--
-- 해결하지 못하는 범위 (별도 과제)
--   · Storage 업로드 성공 후 shop_images INSERT 실패 — 행이 없어 트리거가 없다
--   · 페이지 이탈·새로고침으로 DB 저장 전 중단 — 같은 이유
--   · 미인증 샵 비소유자의 업로드/DB 권한 불일치
--     (Storage 업로드 가능 · DB INSERT 불가 · Storage DELETE 불가 → 고아 확정)
--   · 기존 storage_path NULL 행 137건의 객체.
--     재인코딩 배치가 canonical 파서로 image_url 을 정규화해 실제 객체와
--     정확히 대조한 뒤 따로 처리해야 한다. 이 트리거는 그것들을 추적하지 않는다.
--
-- 적용: 2026-09-12 운영 DB 반영 완료
--   적용 파일 apply-shop-images-cleanup-trigger-2026-09-12.sql
--   SHA-256  1e2ae36897d790a135eacd5ceacc7acb2b64e328f6d0e99d800b3d38faa6bf2d
--   아래 DDL 은 그 파일과 동일하다.
-- ============================================================


begin;

create or replace function public.shop_images_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_bucket text;
  v_path   text;
  v_reason text;
begin
  -- AFTER 트리거라 반환값은 무시된다. 일관되게 null 을 돌려준다.

  if TG_OP = 'DELETE' then
    v_bucket := OLD.storage_bucket;
    v_path   := OLD.storage_path;
    v_reason := 'shop_image_deleted';

  elsif TG_OP = 'UPDATE' then
    -- 출처가 실제로 달라진 경우만 구 객체를 정리 대상으로 본다.
    -- image_url 만 바뀌고 bucket/path 가 같으면 적재하지 않는다.
    if OLD.storage_bucket is not distinct from NEW.storage_bucket
       and OLD.storage_path is not distinct from NEW.storage_path then
      return null;
    end if;

    -- bucket/path 만 바뀌고 image_url 이 그대로면 비정상 UPDATE 다.
    -- image_url 이 여전히 구 객체를 가리킬 수 있으므로 적재하지 않는다.
    -- 누수는 남지만 화면이 깨지는 것보다 낫다.
    if OLD.image_url is not distinct from NEW.image_url then
      return null;
    end if;

    v_bucket := OLD.storage_bucket;
    v_path   := OLD.storage_path;
    v_reason := 'shop_image_replaced';

  else
    return null;
  end if;

  -- 출처 미기록 행(기존 137건)은 아무것도 하지 않는다. URL 파싱으로 경로를 만들지 않는다.
  -- 비어 있지 않은 (bucket, path) 쌍은 shop_images_storage_ref_valid CHECK 를
  -- 이미 통과한 값이다. 아래 확인은 방어용 중복이다.
  if v_bucket is distinct from 'shop-images'
     or v_path is null
     or btrim(v_path) = '' then
    return null;
  end if;

  -- 남은 행이 같은 객체를 참조하면 적재하지 않는다(비용 절감).
  -- 권위 판정은 워커가 remove() 직전에 전 출처를 대상으로 다시 한다.
  if exists (
    select 1 from public.shop_images i
     where i.storage_bucket = v_bucket
       and i.storage_path   = v_path
  ) then
    return null;
  end if;

  insert into public.exhibit_storage_cleanup_queue (bucket_id, object_path, reason)
  values (v_bucket, v_path, v_reason)
  on conflict (bucket_id, object_path)
    where status = any (array['pending'::text, 'processing'::text])
    do nothing;

  return null;
end;
$fn$;

-- 트리거를 통해서만 실행된다. 직접 호출 권한은 누구에게도 주지 않는다.
revoke all on function public.shop_images_storage_cleanup() from public;
revoke all on function public.shop_images_storage_cleanup() from anon;
revoke all on function public.shop_images_storage_cleanup() from authenticated;
revoke all on function public.shop_images_storage_cleanup() from service_role;

drop trigger if exists shop_images_storage_cleanup_del on public.shop_images;
drop trigger if exists shop_images_storage_cleanup_upd on public.shop_images;

create trigger shop_images_storage_cleanup_del
  after delete on public.shop_images
  for each row execute function public.shop_images_storage_cleanup();

create trigger shop_images_storage_cleanup_upd
  after update of image_url, storage_bucket, storage_path on public.shop_images
  for each row execute function public.shop_images_storage_cleanup();

commit;


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- 2026-09-12 실제 결과
--
--   함수    owner=postgres / prosecdef=true
--           proconfig={"search_path=pg_catalog, public, pg_temp"}
--   ACL     {postgres=X/postgres}
--           → PUBLIC · anon · authenticated · service_role 전부 없음
--   트리거  shop_images_storage_cleanup_del  AFTER DELETE  enabled=O
--           shop_images_storage_cleanup_upd  AFTER UPDATE  enabled=O
--           UPDATE 대상 컬럼 = image_url, storage_bucket, storage_path
--   기존    trg_shop_images_touch 보존, exhibit_images_cleanup 보존
--   데이터  137행 / cover 47 / 출처값 0 / 큐 0 — 적용 전후 동일
--
-- 실측 (테스트 행 1건만 사용, 기존 137행 무변경)
--   ① 갤러리 사진 1장 추가 → storage_path 가 기록된 행 1건 생성
--   ② 대표 지정 → cover 전환 RPC 1회 (정상), 기존 대표는 행 유지 + is_cover=false
--   ③ 크롭 교체 → PATCH shop_images 1회, Storage POST 1회,
--      rpc/shop_images_set_cover **0회**
--      id · created_at · uploaded_by · is_cover 전부 유지, storage_path 만 변경
--      큐에 shop_image_replaced 1건(구 경로) 적재
--   ④ 화면 삭제 → 큐에 shop_image_deleted 1건(신 경로) 적재
--      삭제 후 load() 가 남은 사진을 자동으로 대표로 복원
--   ⑤ storage_path NULL 인 테스트 행 삽입 후 삭제 → 큐 적재 0건
--   ⑥ 워커 실행 → claimed 2 / deleted 2 / blocked 0 / failed 0 /
--      referenceCheckFailed 0
--   ⑦ 기준값 완전 복귀 — 164건 / 596,398,039 bytes / 137행 / cover 47 / 큐 0


-- ============================================================
-- [롤백 · 안전한 운영 롤백]
-- ============================================================
-- 트리거만 떼면 즉시 이전 동작으로 돌아간다.
-- 큐에 이미 쌓인 행은 지우지 않는다. 워커가 정상 처리하면 그만이다.
--
--   begin;
--   drop trigger if exists shop_images_storage_cleanup_upd on public.shop_images;
--   drop trigger if exists shop_images_storage_cleanup_del on public.shop_images;
--   commit;
--
-- 함수는 남겨도 무해하다. 완전히 없애려면:
--   drop function if exists public.shop_images_storage_cleanup();
--
-- 코드도 되돌린다면 PhotosManage.saveCrop 이 in-place UPDATE 를 하지 않게 되므로
-- 구 동작(새 행 + 구 행 삭제)으로 돌아간다. 데이터 손상은 없다.
--
-- 파괴적 롤백은 없다. 이 migration 은 데이터·컬럼·큐를 지우지 않는다.


-- ============================================================
-- [남은 과제]
-- ============================================================
-- 1. 큐 테이블·인덱스·함수·라우트 이름 범용화 (storage_cleanup_queue) — 별도 migration
-- 2. status 에 blocked 추가 — 현재는 failed + last_error='blocked:' 로 대체.
--    자동 재처리되지 않으므로 운영자가 재검사·재큐잉해야 한다.
-- 3. 업로드 성공 후 DB 저장 전 중단 경로 — 서버 중계 업로드 또는 임시 업로드 상태 필요
-- 4. 미인증 샵의 Storage/DB 권한 모델 불일치
-- 5. 기존 storage_path NULL 행 137건 — 재인코딩 배치에서 canonical 파서로 처리
-- 6. 참조 0건인 기존 고아 객체 9건
