-- ============================================================
-- shop-images Storage DELETE 정책 교체
--
-- 증상:
--   사장님도 관리자도 shop-images 버킷의 객체를 지울 수 없다.
--   goodsService 의 업로드 롤백 2곳(524·539행)이 조용히 실패하고 있었고,
--   고아 파일이 쌓이는 구조적 원인이었다.
--
-- 원인:
--   기존 정책 shop_images_delete_owner 가 storage.foldername(shops.name) 을 본다.
--   인자가 objects.name(객체 경로)이 아니라 shops.name(샵 표시명)이다.
--   EXISTS 안쪽 FROM 이 shops 라서 수식어 없는 name 이 shops.name 으로 잡혔다.
--   shops.name 은 '애니메이트 홍대점' 같은 표시명이라 '/' 가 없고,
--   storage.foldername() 은 빈 배열을 돌려준다 → [1] 이 NULL
--   → shops.slug = NULL → NULL → EXISTS 가 어떤 행에서도 true 가 되지 않는다.
--   같은 프로젝트의 review_images_delete_own 은 objects.name 으로 올바르게 수식돼 있다.
--
-- 조치:
--   잘못된 정책을 제거하고, 사진 관리 화면의 서버 접근 검사와 같은 조건으로 다시 만든다.
--   경로 조각 판정은 storage.foldername() 대신 storage.objects.path_tokens 컬럼을 쓴다
--   (함수 호출 0회, 같은 값).
--
-- ✅ 사전 확인 (2026-09-11, 실제 조회 결과)
--   1. 화면 권한  src/app/shop/[slug]/manage/photos/page.tsx
--        허용 = profiles.role='admin'
--               OR (shops.is_claimed=true AND shops.owner_id=auth.uid())
--        added_by 는 쓰이지 않는다.
--   2. owner_id   52개 샵 전부 채워져 있고 is_claimed 는 2건뿐이다.
--        is_claimed 조건을 빼면 미청구 샵 50건까지 열린다 → 반드시 포함한다.
--   3. path_tokens  shop-images 164건 중 NULL 0건,
--        storage.foldername 첫 조각과 불일치 0건, array_lower = 1 (1-based).
--   4. 경로 구조  샵 사진은 {slug}/{main|highlights|events}/{파일} 3조각.
--        2번째 폴더가 없는 객체 0건.
--   5. 예약 프리픽스  community · community-appeal · routes · banners ·
--        notices · works · avatars 는 샵 사진이 아니다. 같은 이름의 slug 0건.
--   6. anon·authenticated 에게 storage.objects DELETE 가 테이블 권한으로
--        부여돼 있다 → 정책이 유일한 방어선이다. TO authenticated 를 명시한다.
--
-- 의존 관계 (이것들이 바뀌면 이 정책도 깨진다)
--   - profiles_select_public (USING true) : 관리자 판정 EXISTS 가 여기 의존한다.
--     같은 EXISTS 를 쓰는 shops_delete_admin · places_delete ·
--     shops_update_tiered 도 함께 깨진다. 장기적으로는 관리자 판정을
--     JWT claim 이나 최소 권한 함수로 분리해야 한다.
--   - profiles 컬럼 grant (id, role)
--   - shops_select_public / shops_select_own : EXISTS 서브쿼리는 호출자 권한으로
--     실행되므로 shops RLS 가 적용된다. status='deleted' 샵은 소유자가 아닌
--     관리자에게 보이지 않아 그 샵 사진은 삭제되지 않는다.
--     사진 관리 화면도 같은 이유로 막히므로 화면과 정책이 일치한다. 의도된 동작이다.
--   - storage.objects.path_tokens 컬럼
--
-- 이 파일은 정책만 바꾼다. 데이터·Storage 객체를 변경하는 문장이 없다.
--
-- 적용: 2026-09-11 운영 DB 반영 완료
-- ============================================================


begin;

-- ── 1. 잘못된 기존 정책 제거 ────────────────────────────────
-- shop_images_delete_owner [DELETE] roles={public}
--   USING ( bucket_id = 'shop-images'
--           AND EXISTS (SELECT 1 FROM shops
--                       WHERE shops.slug = (storage.foldername(shops.name))[1]
--                         AND (shops.owner_id = auth.uid()
--                              OR EXISTS (SELECT 1 FROM profiles
--                                         WHERE profiles.id = auth.uid()
--                                           AND profiles.role = 'admin'))) )
-- 누구에게도 DELETE 를 허용하지 않았다. 복원하지 않는다.
drop policy if exists shop_images_delete_owner on storage.objects;


-- ── 2. 화면 권한과 동일한 조건으로 재작성 ───────────────────
create policy shop_images_delete_shop_manager
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'shop-images'
    and auth.uid() is not null
    -- 경로는 {slug}/{kind}/{파일} 3조각 이상
    and array_length(objects.path_tokens, 1) >= 3
    -- 샵 사진 용도의 하위 폴더만
    and objects.path_tokens[2] in ('main', 'highlights', 'events')
    -- 샵 사진이 아닌 용도의 첫 폴더는 fail-closed 로 차단
    and objects.path_tokens[1] not in (
      'community', 'community-appeal', 'routes', 'banners',
      'notices', 'works', 'avatars'
    )
    -- 첫 폴더가 실제 shops.slug 와 일치하고, 그 샵을 현재 사용자가 관리할 수 있어야 한다.
    -- EXISTS 내부에서는 반드시 objects.path_tokens 로 수식한다 —
    -- 수식을 생략하면 FROM 의 shops 쪽으로 잡힐 수 있다. 기존 정책이 그래서 죽었다.
    and exists (
      select 1
      from public.shops s
      where s.slug = objects.path_tokens[1]
        and (
          (s.is_claimed is true and s.owner_id = auth.uid())
          or exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'admin'
          )
        )
    )
  );

commit;

-- PostgREST 스키마 캐시 reload 는 하지 않는다.
-- storage.objects 의 RLS 정책은 PostgREST 스키마 캐시 대상이 아니다.


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select
--   exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
--             and policyname='shop_images_delete_owner')              as 구정책_존재_기대false,
--   (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
--             and policyname='shop_images_delete_shop_manager')       as 신정책_개수_기대1,
--   (select roles::text from pg_policies where schemaname='storage' and tablename='objects'
--             and policyname='shop_images_delete_shop_manager')       as roles_기대authenticated,
--   (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
--             and cmd='DELETE' and coalesce(qual,'') like '%shop-images%') as delete정책_기대1,
--   (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
--             and cmd='UPDATE' and coalesce(qual,'') like '%shop-images%') as update정책_기대0;
--
-- 2026-09-11 실제 검증 결과
--   구정책 존재 = false / 신정책 1개 / roles = {authenticated} / cmd = DELETE
--   shop-images 언급: DELETE 1 · INSERT 4 · SELECT 3 · UPDATE 0
--   적용 전후 정책지문·권한지문·객체 수·바이트 전부 동일 (164건 / 596,398,039 bytes)
--   실제 Storage API DELETE 로 인증 샵 소유자(비관리자) 삭제 성공 확인


-- ============================================================
-- [롤백]
-- ============================================================
-- 잘못된 기존 정책 shop_images_delete_owner 를 복원하지 않는다.
-- 그 정책은 어떤 조건에서도 true 가 되지 않아 "DELETE 불가"와 같았고,
-- 되살리면 죽은 정책만 다시 남는다.
-- 안전한 이전 상태는 "shop-images DELETE 정책 0건 = 전원 불허"이다.
--
--   begin;
--   drop policy if exists shop_images_delete_shop_manager on storage.objects;
--   commit;
--
-- 롤백 후 확인:
--   select count(*) from pg_policies
--    where schemaname='storage' and tablename='objects'
--      and cmd='DELETE' and coalesce(qual,'') like '%shop-images%';
--   -- 기대 0
--
-- 롤백은 정책만 제거한다. Storage 객체와 DB 행은 건드리지 않는다.


-- ============================================================
-- [남은 과제 — 이 파일 범위 밖]
-- ============================================================
-- work_img_upload [INSERT] check = (bucket_id = 'shop-images') 뿐이라
-- 로그인한 아무 사용자가 shop-images 아무 경로에나 업로드할 수 있다.
-- 다만 community/ · community-appeal/ · notices/ · avatars/ 경로가
-- 이 정책에만 의존하고 있어, 대체 정책을 같은 트랜잭션에서 먼저 만들어야 한다.
-- 자세한 내용은 별도 보안 과제로 분리했다.
