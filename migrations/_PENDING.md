# 아직 안 돌린 마이그레이션

> 코드는 이미 커밋됐지만 DB에 반영이 안 된 것들. 돌리고 나면 이 목록에서 지운다.
> **배포(`git push`) 전에 반드시 여기가 비어 있어야 한다.**

## [ ] `event_link_series.sql` — 2026-09-01 작성, 미실행

**막힌 이유:** Supabase 대시보드 장애 (2026-08-31 ~ , ERR_TOO_MANY_REDIRECTS / API Gateway).
서비스 롤 REST로는 함수 생성(DDL)을 못 해서 대시보드나 psql이 필요하다.

**없으면 뭐가 안 되나:** 이벤트 등록 위저드 3단계의
"같은 이벤트가 이미 등록돼 있어요 → **[네, 같은 이벤트예요]**" 버튼이 실패한다.
(감지해서 카드를 띄우는 것까지는 되고, 누르면 RPC 없음 에러)

- 스크립트 경로(`src/scripts/lib/seriesKey.mjs`)는 서비스 롤이라 **이 RPC 없이도 동작한다.**
- 급하면 위저드의 "같은 이벤트 묶기" 칸에 키를 직접 넣어도 된다.

**확인 쿼리**

```sql
select proname from pg_proc
 where proname = 'link_event_series' and pronamespace = 'public'::regnamespace;
```

**대시보드 없이 돌리는 법**

```powershell
psql "postgresql://postgres:<비밀번호>@db.<프로젝트ref>.supabase.co:5432/postgres" -f migrations/event_link_series.sql
```

---

## [?] `shop_images_select_owner.sql` — 실행 여부 불확실

등록 중(`status = 'hidden'`)인 샵의 사진을 소유자가 볼 수 있게 하는 추가 SELECT 정책.
없으면 샵 등록할 때 넣은 사진이 저장 후 다시 들어가야 보인다.

```sql
select policyname from pg_policies
 where tablename = 'shop_images' and policyname = 'shop_images_select_owner';
```

---

## 실행 완료 (참고)

- `event_series_key.sql` — 2026-09-01 완료. 11묶음 / 24건에 `series_key` 배정.
- `signup_source.sql` — 완료.
- `member_items.sql` — 완료.
