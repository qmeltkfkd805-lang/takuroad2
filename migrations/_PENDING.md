# 아직 안 돌린 마이그레이션

> 코드는 커밋됐지만 DB에 반영이 안 된 것들. 돌리고 나면 이 목록에서 지운다.
> **배포(`git push`) 전에 반드시 여기가 비어 있어야 한다.**

## 없음 ✅

2026-09-03 기준으로 밀린 마이그레이션 없음.

---

## 새 마이그레이션을 만들 때

1. `migrations/<이름>.sql` 로 파일을 만든다.
2. 아직 안 돌렸으면 **이 문서 맨 위에** 항목을 추가한다 — 무엇이 안 되는지, 확인 쿼리와 함께.
3. Supabase SQL Editor에서 실행하고, 확인 쿼리로 검증한 뒤 항목을 지운다.

확인 쿼리 형태:

```sql
-- 컬럼
select column_name from information_schema.columns
 where table_name = '<테이블>' and column_name = '<컬럼>';

-- 함수(RPC)
select proname from pg_proc
 where proname = '<함수명>' and pronamespace = 'public'::regnamespace;

-- RLS 정책
select policyname from pg_policies
 where tablename = '<테이블>' and policyname = '<정책명>';
```

⚠️ Supabase SQL Editor는 **텍스트가 선택돼 있으면 선택한 부분만** 실행한다.
붙여넣은 뒤 아무 데나 클릭해 선택을 풀고 Run 할 것. 함수가 몇 개 안 생겼으면 대개 이 문제다.
적용 여부는 개수만 세지 말고 본문까지 확인하는 게 확실하다:

```sql
select proname, prosrc like '%<본문에 있어야 할 문자열>%' as ok
  from pg_proc where pronamespace = 'public'::regnamespace and proname = '<함수명>';
```

DDL은 서비스 롤 REST로는 못 돌린다. 대시보드가 죽었으면 psql이 필요하다.

```powershell
psql "postgresql://postgres:<비밀번호>@db.<프로젝트ref>.supabase.co:5432/postgres" -f migrations/<이름>.sql
```

---

## 실행 완료 기록

| 날짜 | 파일 | 내용 |
| --- | --- | --- |
| 2026-09-22 | `work_requests.sql` | 작품 추가 요청 테이블 — 일반 사용자가 작품을 직접 만들 수 없게 된 대신 요청을 남기면 관리자가 검토해 등록한다. RLS 4개(본인 조회·관리자 조회·본인 등록·관리자 수정), 같은 사람이 같은 작품을 중복 대기시키지 못하는 부분 유니크 인덱스. 보상 없음. 화면: `/work/request` 폼 + 관리자 `작품 추가 요청` 탭 |
| 2026-09-22 | `tags_insert_admin_only.sql` | 🚨 보안 — 작품 신규 생성을 관리자 전용으로 제한. `tags_user_insert`(로그인한 누구나 INSERT) 삭제, 관리자 생성은 기존 `tags_write_admin`(ALL, using 식이 INSERT 검사에도 적용)이 담당. 기존 1,992건·조회·소유자 수정은 그대로. 롤백은 `tags_insert_admin_only_ROLLBACK.sql`. 검증: 관리자 폼 등록 1건 성공(활동 0·EXP 0) 후 정확한 id로 삭제, `relrowsecurity=true` 확인. ⚠️ 일반 계정 JWT 실거부(42501)는 미검증 — 정책 검사로만 확인 |
| 2026-09-21 | `tags_parent_nintendo.sql` | 작품 계층 2차 — `닌텐도`(제작사,브랜드) 신설 + 직속 6개(슈퍼마리오·별의 커비·피크민·스플래툰·동물의 숲·젤다의 전설), `동키콩`→슈퍼마리오(2단, keywords에 `닌텐도` 추가로 보완), `희망의 힘 어른 프리큐어 23`→프리큐어. 누적 하위 106개. 미채택: 쥬얼펫→산리오, 프로젝트 세카이→보컬로이드, 포켓몬→닌텐도, 전대대실격→전대 |
| 2026-09-20 | `tags_parent.sql` | 취급 작품 검색 프랜차이즈 계층 — `tags.parent_tag_id` 컬럼 + 자기참조 CHECK + 부분 인덱스, `라코`→`랏코` 이름 수정(slug rako), 하위 98개 지정: 보컬로이드 40·디즈니 18·산리오 18·스튜디오 지브리 8·건담 7·치이카와 6·라인프렌즈 1. 샵 취급 작품 검색이 name/english_name/aliases/keywords/부모명까지 매칭 |
| 2026-09-12 | `shop_images_storage_cleanup_trigger.sql` | 사진 삭제·크롭 교체 시 Storage 객체가 고아가 되던 것을 차단. `shop_images` AFTER DELETE / AFTER UPDATE OF(image_url, storage_bucket, storage_path) 트리거가 기존 `exhibit_storage_cleanup_queue` 에 적재(SECURITY DEFINER, 직접 EXECUTE 권한 전부 회수). `storage_path` 가 NULL 인 기존 137행은 적재하지 않음. 실제 삭제는 워커가 전 출처 참조 재확인 후 수행 |
| 2026-09-12 | `shop_images_cover_transition.sql` | 대표 사진 교체를 행 삭제 → `is_cover` 강등으로 전환. `setShopMainImage` 가 기존 대표 행을 지워 원본 Storage 를 고아로 만들던 구조 제거. 원자적 전환 RPC `shop_images_set_cover`(SECURITY INVOKER, authenticated 전용), 샵당 대표 1개 부분 유니크 인덱스, 출처 기록 컬럼 `storage_bucket`·`storage_path`(nullable, backfill 없음) |
| 2026-09-12 | `storage_shop_images_insert_policies.sql` | 🚨 보안 — 샵 이미지 INSERT 정책 최소 권한화. `work_img_upload`(버킷만 검사 → 로그인한 누구나 shop-images 아무 경로에 업로드 가능) 등 3개를 제거하고 용도별 5개로 분리. 경로 깊이 고정·2번째 폴더 허용 목록·예약 프리픽스 차단·`banners`/`notices`/`works` 관리자 전용 |
| 2026-09-11 | `storage_shop_images_delete_policy.sql` | 샵 이미지 DELETE 정책 수정 — `storage.foldername(shops.name)` 인자 오류로 아무도 삭제 못 하던 것을 `path_tokens` 기준으로 재작성. 인증 샵 소유자 또는 관리자, `main`·`highlights`·`events` 경로만 |
| 2026-09-03 | `shop_verify_requests_cleanup.sql` | 🚨 보안 — 쓰기 권한 회수(`TRUNCATE`·`TRIGGER`·`UPDATE`·`DELETE`), INSERT는 5개 컬럼만. `reject_reason` 컬럼 분리(기존 7건 backfill 안 함) |
| 2026-09-03 | `shops_write_privileges.sql` | 🚨 보안 — `shops` 테이블 쓰기 권한을 걷고 안전한 컬럼만 재허용. `TRUNCATE`·`TRIGGER` 회수, `anon` 쓰기 전면 차단, INSERT 값 강제·`status` 전이·정보확인 시각 트리거 3개 |
| 2026-09-02 | `shop_review.sql` | 신규 샵 검수 — `shops.review_status`/`reviewed_at`/`reviewed_by` + INSERT 기본값·UPDATE 차단 트리거. 기존 50건 NULL 유지 확인 |
| 2026-09-02 | `profiles_column_privileges.sql` | 🚨 보안 — `admin_note`·`signup_*` 읽기 차단(anon 포함), 가입 INSERT로 `role='admin'` 심는 경로 차단. **테이블 권한을 걷고 컬럼만 재허용**하는 순서가 핵심 |
| 2026-09-02 | `profiles_privilege_guard.sql` | 🚨 보안 — 회원이 스스로 `role='admin'`으로 바꿀 수 있던 구멍 차단. `is_admin()` + `profiles` UPDATE 트리거 |
| 2026-09-02 | `visit_analytics.sql` | 방문 경로 분석 RPC 5개 + `normalize_visit_path` + `visit_window_start` + 인덱스 2개 |
| 2026-09-01 | `event_link_series.sql` | `link_event_series()` RPC — 위저드에서 남의 이벤트와 묶을 때 |
| 2026-09-01 | `event_series_key.sql` | `events.series_key` 컬럼 + 부분 인덱스. 11묶음 / 24건 배정 |
| 2026-09-01 | `shop_images_select_owner.sql` | 등록 중(hidden) 샵 사진을 소유자가 볼 수 있게 하는 SELECT 정책 |
| 2026-08-31 | `signup_source.sql` | 가입 유입 경로 |
| 2026-08-31 | `member_items.sql` | 관리자 회원 활동 상세 |
