# 아직 안 돌린 마이그레이션

> 코드는 커밋됐지만 DB에 반영이 안 된 것들. 돌리고 나면 이 목록에서 지운다.
> **배포(`git push`) 전에 반드시 여기가 비어 있어야 한다.**

## 없음 ✅

2026-09-02 기준으로 밀린 마이그레이션 없음.

---

## ⚠️ 다음 보안 과제 — `shops` 쓰기 권한 (마이그레이션 미작성)

`shops`는 `anon`·`authenticated` 모두 **테이블 단위** INSERT/UPDATE/DELETE 권한을 갖고 있고
컬럼 제한이 없다. 여기에 `shops_update_tiered` 정책이
`(is_claimed IS NOT TRUE) OR owner_id = auth.uid() OR admin` 이라,
**로그인한 사용자가 `is_claimed`가 아닌 모든 샵을 수정할 수 있다.**

브라우저에서 직접 `status='deleted'`(사이트에서 사라짐), `is_verified=true`(공식 샵 자칭),
`owner_id` 변경(사장님 인증 우회), 평점·방문수 조작이 전부 된다.
`/api/admin/shop-status`·`shop-field`의 admin 게이트가 PostgREST 직접 호출로 우회된다.
(`anon`은 UPDATE 정책이 `{authenticated}` 전용이라 RLS가 막는다)

`profiles`처럼 단순히 컬럼 권한으로 못 나눈다 — 관리자 작업 다수가 클라이언트에서
`authenticated` 역할로 돌고(`approveShop`은 status+is_verified,
`approveVerifyRequest`는 is_claimed+owner_id), 게다가 `publishShop`은 **일반 사용자**가
`status`를 `active`로 바꾼다. 트리거 방식이 맞되 `status`는
"본인이 만든 hidden → active"만 허용하는 조건부 로직이 필요하다.

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
| 2026-09-02 | `shop_review.sql` | 신규 샵 검수 — `shops.review_status`/`reviewed_at`/`reviewed_by` + INSERT 기본값·UPDATE 차단 트리거. 기존 50건 NULL 유지 확인 |
| 2026-09-02 | `profiles_column_privileges.sql` | 🚨 보안 — `admin_note`·`signup_*` 읽기 차단(anon 포함), 가입 INSERT로 `role='admin'` 심는 경로 차단. **테이블 권한을 걷고 컬럼만 재허용**하는 순서가 핵심 |
| 2026-09-02 | `profiles_privilege_guard.sql` | 🚨 보안 — 회원이 스스로 `role='admin'`으로 바꿀 수 있던 구멍 차단. `is_admin()` + `profiles` UPDATE 트리거 |
| 2026-09-02 | `visit_analytics.sql` | 방문 경로 분석 RPC 5개 + `normalize_visit_path` + `visit_window_start` + 인덱스 2개 |
| 2026-09-01 | `event_link_series.sql` | `link_event_series()` RPC — 위저드에서 남의 이벤트와 묶을 때 |
| 2026-09-01 | `event_series_key.sql` | `events.series_key` 컬럼 + 부분 인덱스. 11묶음 / 24건 배정 |
| 2026-09-01 | `shop_images_select_owner.sql` | 등록 중(hidden) 샵 사진을 소유자가 볼 수 있게 하는 SELECT 정책 |
| 2026-08-31 | `signup_source.sql` | 가입 유입 경로 |
| 2026-08-31 | `member_items.sql` | 관리자 회원 활동 상세 |
