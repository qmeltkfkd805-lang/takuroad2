-- ============================================================
-- shop-images Storage INSERT 정책 재작성
--
-- 증상:
--   로그인한 아무 사용자가 shop-images 버킷의 아무 경로에나 업로드할 수 있었다.
--   남의 샵 폴더, banners/, notices/, works/, 남의 uid community/ 전부 포함.
--   버킷이 public 이라 올린 즉시 공개 URL 도 얻는다.
--
-- 원인:
--   work_img_upload [INSERT] {authenticated}
--     CHECK ( bucket_id = 'shop-images' )
--   경로 조건이 없다. RLS 는 PERMISSIVE 정책의 OR 합집합이므로
--   나머지 정책이 아무리 엄격해도 이 하나가 전부 통과시킨다.
--
--   auth upload banners and works [INSERT] {authenticated}
--     첫 폴더가 banners 또는 works 이기만 하면 통과. 관리자 조건이 없다.
--
--   shop_images_insert_owner [INSERT] {public}
--     is_claimed 를 보지 않는다. 경로 깊이 제한도 없다.
--
-- 조치:
--   세 정책을 제거하고 경로별로 최소 권한 정책 5건을 만든다.
--   경로 깊이는 실제 코드가 만드는 형식에 정확히 맞춘다.
--   경로 조각 판정은 storage.objects.path_tokens 컬럼을 쓴다(함수 호출 0회).
--
-- ✅ 사전 확인 (2026-09-12, 실제 조회·코드 전수 조사)
--   1. 업로드 호출부 10곳 전수 추적 — .from('shop-images').upload( 기준
--        {slug}/main/{ts}-{uuid}.{ext}            3단  shopService.uploadShopImage
--        {slug}/highlights/{ts}.{ext}             3단  shopHighlightService
--        {slug}/events/{ts}.{ext}, video-{ts}     3단  shopEventService
--        community/{uid}/{ts}-{rand}.{ext}        3단  communityPostService
--        community/{uid}/{uuid}.webp              3단  goodsService.createSharedGoods
--        community-appeal/{uid}/{ts}-{rand}.{ext} 3단  communityPostService
--        routes/{uid}/{key}/{ts}.{ext}            4단  routeService (기존 정책 유지)
--        banners/{ts}.{ext}                       2단  featuredBannerService
--        notices/{ts}.{ext}                       2단  noticeService
--        works/{slug}/{cover|banner}/{ts}.{ext}   4단  workAdminService
--        avatars/{uid}-{ts}.{ext}                 2단  shopService.uploadAvatar → 도달 불가(아래)
--   2. 화면 권한
--        /shop/[slug]/edit        미인증 샵이면 검사 없음(위키형), 인증 샵이면 owner/admin
--        /shop/[slug]/manage/*    admin OR (is_claimed AND owner)
--        AdminPage                profile.role <> 'admin' 이면 홈으로
--        NoticeWritePage          if (!isAdmin) 차단
--        WorkRegister 대표이미지   isAdmin 분기 안에만 있음
--      → 샵 3폴더의 INSERT 조건은 shops_update_tiered 와 동일해야 한다.
--        DELETE 정책(is_claimed AND owner)과 조건이 반대인 것이 정상이다.
--   3. avatars/ 는 도달 불가 경로다. uploadAvatar 를 부르는 두 모달
--      (ProfileCustomizationModal, ProfileEditModal)이 어디에서도 렌더되지 않는다.
--      PassportCard 에 isOwner={true} 를 넘기는 곳이 코드 전체에 없고,
--      ProfilePage 주석이 "여권 테마·프로필 꾸미기 화면은 제거됨"이라고 적고 있다.
--      → INSERT 정책을 만들지 않는다. 새 권한을 열 이유가 없다.
--   4. works 의 kind 는 uploadWorkImage 의 타입이 'cover' | 'banner' 로 고정.
--   5. path_tokens  shop-images 164건 중 NULL 0건, foldername 첫 조각 불일치 0건,
--      array_lower = 1 (1-based).
--
-- 의존 관계 (DELETE 정책과 동일)
--   - profiles_select_public (USING true) 와 profiles 컬럼 grant(id, role)
--     → 관리자 판정 EXISTS 가 여기 의존한다. 이 정책을 조이면 함께 깨진다.
--   - shops RLS (shops_select_public / shops_select_own)
--     → EXISTS 서브쿼리는 호출자 권한으로 실행된다.
--   - storage.objects.path_tokens 컬럼
--
-- 이 파일은 INSERT 정책만 바꾼다. DELETE·SELECT·UPDATE·GRANT·데이터를 건드리지 않는다.
--
-- 적용: 2026-09-12 운영 DB 반영 완료
-- ============================================================


begin;

-- ── 제거 3건 ────────────────────────────────────────────
drop policy if exists "work_img_upload" on storage.objects;
drop policy if exists "auth upload banners and works" on storage.objects;
drop policy if exists "shop_images_insert_owner" on storage.objects;

-- ── 1. 샵 사진 — {slug}/{main|highlights|events}/{file} 정확히 3단 ──
--    조건은 shops_update_tiered 와 동일 (미인증 위키형 편집 모델 유지)
create policy shop_images_insert_shop_editor
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-images'
    and auth.uid() is not null
    and array_length(objects.path_tokens, 1) = 3
    and objects.path_tokens[2] in ('main', 'highlights', 'events')
    and objects.path_tokens[1] not in (
      'community', 'community-appeal', 'routes', 'banners',
      'notices', 'works', 'avatars'
    )
    and exists (
      select 1 from public.shops s
      where s.slug = objects.path_tokens[1]
        and (
          s.is_claimed is not true
          or s.owner_id = auth.uid()
          or exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

-- ── 2. 커뮤니티 — community|community-appeal/{uid}/{file} 정확히 3단 ──
create policy shop_images_insert_community_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-images'
    and auth.uid() is not null
    and array_length(objects.path_tokens, 1) = 3
    and objects.path_tokens[1] in ('community', 'community-appeal')
    and objects.path_tokens[2] = (auth.uid())::text
  );

-- ── 3. 배너 — banners/{file} 정확히 2단, 관리자만 ──
create policy shop_images_insert_banner_admin
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-images'
    and array_length(objects.path_tokens, 1) = 2
    and objects.path_tokens[1] = 'banners'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
  );

-- ── 4. 공지 — notices/{file} 정확히 2단, 관리자만 ──
create policy shop_images_insert_notice_admin
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-images'
    and array_length(objects.path_tokens, 1) = 2
    and objects.path_tokens[1] = 'notices'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
  );

-- ── 5. 작품 — works/{slug}/{cover|banner}/{file} 정확히 4단, 관리자만 ──
create policy shop_images_insert_work_admin
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-images'
    and array_length(objects.path_tokens, 1) = 4
    and objects.path_tokens[1] = 'works'
    and objects.path_tokens[3] in ('cover', 'banner')
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
  );

commit;

-- route cover insert own 은 그대로 둔다. 이미 올바르게 설계돼 있다:
--   첫 폴더 'routes' + 둘째 폴더 = auth.uid()


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select policyname, roles::text, with_check
--   from pg_policies
--  where schemaname='storage' and tablename='objects' and cmd='INSERT'
--    and coalesce(with_check,'') like '%shop-images%'
--  order by policyname;
--
-- 기대: 6건 — route cover insert own + 신규 5건, 전부 roles={authenticated}
--
-- 2026-09-12 실제 검증 결과
--   정책 총수 32 → 34 (INSERT 12 → 14)
--   적용 전후 지문 전부 동일:
--     정책지문(변경대상 제외) 87a759d3f2bc92073a4d9f78e5ae1d12
--     권한지문               75f8c44465f0b72bf7bd911aaebc1ca1
--     테이블권한지문          c26ef76c4ff11ade2afc3dff42fe0762
--     DELETE·SELECT·UPDATE   c6eba734888aebff396252e9969b4dfc
--   Storage 164건 / 596,398,039 bytes 무변경, shop_images 137행 무변경
--   dry-run: 저장된 with_check 로 후보경로 25 × 주체 4 = 100칸 전부 기대 일치
--            (정책 6건 평가, 실행 오류 0건, auth.uid() 주입 4/4 확인)
--   실제 Storage API 거부 테스트 4건 전부 거부 (RLS violation), 생성 객체 0건
--     인증샵 타인 / 남의 uid community / 일반사용자 banners / 일반사용자 works
--   실제 Storage API 허용·정리 테스트 4건 전부 통과, 기준값 복귀
--     teseuteu-syap main·highlights·events (소유자) / 미인증샵 main (관리자)


-- ============================================================
-- [롤백]
-- ============================================================
-- 취약한 이전 정책을 복원하지 않는다.
-- work_img_upload / 관리자 확인 없는 auth upload banners and works /
-- 잘못된 shop_images_insert_owner 는 되살리지 않는다.
-- 안전 상태는 "신규 정책만 제거" = routes/{uid}/ 외 shop-images 업로드 전면 불가다.
-- 업로드 장애가 나더라도 취약점을 다시 열지 않는다. 고쳐서 재배포한다.
--
--   begin;
--   drop policy if exists shop_images_insert_shop_editor   on storage.objects;
--   drop policy if exists shop_images_insert_community_own on storage.objects;
--   drop policy if exists shop_images_insert_banner_admin  on storage.objects;
--   drop policy if exists shop_images_insert_notice_admin  on storage.objects;
--   drop policy if exists shop_images_insert_work_admin    on storage.objects;
--   commit;
--
-- 롤백 후 확인:
--   select count(*) from pg_policies
--    where schemaname='storage' and tablename='objects' and cmd='INSERT'
--      and coalesce(with_check,'') like '%shop-images%';
--   -- 기대 1 (route cover insert own 만)


-- ============================================================
-- [이 정책이 해결하지 못하는 것 — 별도 백로그]
-- ============================================================
-- 1. community·community-appeal·routes·banners·notices·works 에는 DELETE 정책이 없다.
--    업로드 후 DB 저장이 실패해도 되돌릴 수 없고 고아 파일이 남는다.
-- 2. 미인증 샵은 위키형 편집 모델이라 로그인 사용자가 유효한 slug 아래에
--    미참조 파일을 반복 업로드해 용량을 소모할 수 있다.
-- 3. setShopMainImage 가 기존 is_cover 행을 먼저 삭제해 원본 Storage 를 고아로 만든다. (우선순위 높음)
-- 4. manage/events/new 와 [id]/edit 에 admin 우회가 빠져 있다.
-- 5. 업로드와 DB 저장이 원자적이지 않다.
-- 6. 서버 중계 업로드와 cleanup queue 가 필요하다.
