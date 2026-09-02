# 아직 안 돌린 마이그레이션

> 코드는 커밋됐지만 DB에 반영이 안 된 것들. 돌리고 나면 이 목록에서 지운다.
> **배포(`git push`) 전에 반드시 여기가 비어 있어야 한다.**

## `shop_review.sql` — 검토만 끝났고 아직 안 돌림

신규 샵 검수(선등록 후검수)용. `shops`에 `review_status` / `reviewed_at` / `reviewed_by` 추가 +
INSERT 기본값 트리거 + UPDATE 변조 차단 트리거.

**⚠️ 적용 순서 주의**: `ADD COLUMN`을 default 없이 먼저 하고 그다음 `SET DEFAULT`를 해야
기존 샵 49건이 `pending`으로 backfill되지 않는다. 파일 안에 그 순서로 되어 있으니 순서를 바꾸지 말 것.

아직 서비스·UI는 구현 전이다. DB만 먼저 넣어도 동작에는 영향이 없다(새 컬럼을 아무도 안 읽음).
단 트리거가 붙는 순간부터 **모든 샵 INSERT를 가로채므로**, 적용 직후 일반 계정으로
샵 등록이 되는지 반드시 한 번 확인할 것.

```sql
-- 적용 확인
select column_name, column_default from information_schema.columns
 where table_name = 'shops' and column_name like 'review%' or column_name like 'reviewed%';

-- 기존 데이터가 NULL로 남았는지 ((null) 49 만 나와야 정상)
select coalesce(review_status,'(null)') as review_status, count(*)
  from public.shops group by 1 order by 2 desc;
```

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
| 2026-09-02 | `profiles_column_privileges.sql` | 🚨 보안 — `admin_note`·`signup_*` 읽기 차단(anon 포함), 가입 INSERT로 `role='admin'` 심는 경로 차단. **테이블 권한을 걷고 컬럼만 재허용**하는 순서가 핵심 |
| 2026-09-02 | `profiles_privilege_guard.sql` | 🚨 보안 — 회원이 스스로 `role='admin'`으로 바꿀 수 있던 구멍 차단. `is_admin()` + `profiles` UPDATE 트리거 |
| 2026-09-02 | `visit_analytics.sql` | 방문 경로 분석 RPC 5개 + `normalize_visit_path` + `visit_window_start` + 인덱스 2개 |
| 2026-09-01 | `event_link_series.sql` | `link_event_series()` RPC — 위저드에서 남의 이벤트와 묶을 때 |
| 2026-09-01 | `event_series_key.sql` | `events.series_key` 컬럼 + 부분 인덱스. 11묶음 / 24건 배정 |
| 2026-09-01 | `shop_images_select_owner.sql` | 등록 중(hidden) 샵 사진을 소유자가 볼 수 있게 하는 SELECT 정책 |
| 2026-08-31 | `signup_source.sql` | 가입 유입 경로 |
| 2026-08-31 | `member_items.sql` | 관리자 회원 활동 상세 |
