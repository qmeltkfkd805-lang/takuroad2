# 인수인계 — 상세 페이지 캐시(ISR) 작업 (2026-10-24)

## 배경 (왜 하는지)
- 2026-10-24 Vercel Hobby 플랜이 **Fair Use 한도 초과로 배포 정지**(503) → Pro로 업그레이드해서 복구함.
- 원인: **서버 함수 Active CPU**. 최근 30일 함수 호출 약 137K × 액티브 CPU P75 126ms ≈ **월 4.8시간** (Hobby 한도 월 4시간).
  - 요청 수(764K), 메모리(GB-시간 25.74), 전송량은 한도 안쪽이었음.
- Pro 포함량(CPU 월 16시간 수준)이라 지금은 추가 요금이 거의 없지만, 사용량이 늘면 과금되므로 **서버에서 매번 새로 그리는 페이지를 캐시로 돌린다.**
- Spend Management 예산 $20, 초과 시 정지는 OFF(알림만).

## 근본 원인 (코드)
- `src/lib/supabase/server.ts`의 `createClient()`가 `cookies()`를 읽는다.
  → 이걸 쓰는 페이지는 Next.js가 "사람마다 다른 페이지"로 보고 **캐시를 전혀 안 함**. 열 때마다(봇 포함) 서버 렌더.
- 사이트맵(`src/app/sitemap.ts`)에 샵·이벤트·루트·장소·태그 상세가 전부 들어 있어서 네이버·구글 봇 수집이 이쪽으로 몰림.

### 현재 캐시 상태
| 경로 | 상태 |
|---|---|
| `/` 홈 | ✅ `revalidate = 60` + `unstable_cache` |
| `/api/shops/all`, `/api/shops/home-items(+v2)` | ✅ 1800초, `purgeShopLists()`로 즉시 비움 |
| `/api/works/*`, `/api/events/popular`, `/api/routes/public` | ✅ 60~600초 |
| **`/shop/[slug]`** | ✅ **이번에 적용 (아래)** |
| **`/event/[id]`** | ✅ **적용 (아래 "2차")** |
| **`/place/[slug]`** | ✅ **적용 (아래 "3차")** |
| **`/route/[token]`** | ✅ **적용 (아래 "4차")** |
| `/community/[id]` | ❌ 쿠키 클라이언트 — ⚠️주의 필요 |
| `/work/[slug]`, `/user/[nickname]` | `force-dynamic` (일부러) — 손대기 전 사용자 확인 |

## 이번에 한 것 (커밋 전 상태일 수 있음 — `git status` 확인)
1. **새 파일 `src/lib/supabase/public.ts`** — `createPublicClient()`: 쿠키 안 읽는 anon 전용 supabase-js 클라이언트(`persistSession:false`).
   ⚠️ 비로그인 권한으로 읽으므로 로그인해야 보이는 정보에 쓰면 안 됨.
2. **`src/app/shop/[slug]/page.tsx`**
   - `createClient()`(서버/쿠키) → `createPublicClient()`
   - `export const revalidate = 300`
   - `export async function generateStaticParams() { return [] }` (빌드 때 안 만들고 첫 방문 때 만들어 캐시)
   - 화면은 `ShopDetailPageDesktop`('use client')이 그리고, 로그인별 정보(방문·찜 상태 등)는 브라우저가 따로 부름.
3. **`src/lib/cache/shopListCache.ts`의 `purgeShopLists()`**에 `revalidatePath('/shop/[slug]', 'page')` 추가
   → 샵 정보·사진·공개 상태 변경 시(`/api/revalidate/shops`, 30초 스로틀) 샵 상세 캐시도 전부 비움.
- 알려진 부작용: 상세 상단 **별점 평균·리뷰 수·찜 수(`shop.rating_*`, `bookmark_count`)가 최대 5분 늦게** 갱신될 수 있음.

### 검증 (사용자가 직접)
- `npm run build` 출력에서 `/shop/[slug]`가 `ƒ (Dynamic)`가 아니라 `● (SSG)` + revalidate 5m으로 나오는지.
- 배포 후 샵 정보 수정 → 상세에 바로 반영되는지.
- 며칠 뒤 Vercel 관측 가능성 → 기능 → 타쿠로드2 → 경로별 Active CPU 순위로 효과 확인.

## 2차 — `/event/[id]` (2026-10-24)
- `src/app/event/[id]/page.tsx`: `createPublicClient()` + `revalidate = 300` + `generateStaticParams() → []`.
  서버는 메타데이터·JSON-LD만 만들고 화면은 `EventDetailPage`(브라우저)라, 캐시 영향은 제목·설명·대표 이미지뿐.
  anon RLS(`events_soft_delete.sql`)상 삭제 요청된 이벤트는 못 읽어서 '찾을 수 없어요'(noindex)로 나감 — 검색엔 그게 맞음.
- 새 `src/lib/cache/eventPageCache.ts` — `purgeEventPage(id)`: `revalidatePath('/event/<id>')` (그 이벤트 한 페이지만, 그래서 스로틀 없음).
- 새 `src/app/api/revalidate/events/route.ts` — POST `{ id }`, 로그인 필요.
- 브라우저 쪽 `refreshEventPage(id)`(`services/eventDetailService.ts`)를 저장 성공 후 호출:
  `saveEventExtra`(위저드 등록·수정, 항상 `updateEventDraft` 뒤에 불림), `updateEvent`, `deleteEvent`, `setEventShop`.
  `createEventDraft`·`api/admin/approve-submission`은 새 id라 캐시가 없어서 안 붙임.
- 알려진 부작용: 연결된 **샵 이름·주소, 작품 커버** 변경은 이벤트 페이지 메타에 최대 5분 늦게 반영.
- 검증(사용자): `npm run build`에서 `/event/[id]`가 `●` + 5m. 배포 후 이벤트 제목 수정 → 공유 미리보기/탭 제목에 바로 반영되는지.

## 3차 — `/place/[slug]` (2026-10-24)
- `src/app/place/[slug]/page.tsx`: `createPublicClient()` + `revalidate = 300` + `generateStaticParams() → []`.
  `getPlaceBySlug`를 React `cache`로 감싸 메타데이터·화면이 한 번만 읽게 함(예전엔 장소·샵·이벤트를 요청마다 두 번 읽었음).
  anon으로 `places` 읽기 가능 확인(63곳). 입점 샵(active)·이벤트도 anon 공개.
- 이 페이지는 **장소 + 입점 샵 + 진행 중 이벤트**를 서버에서 통째로 넘기므로, 셋 중 뭐가 바뀌어도 비워야 함.
  새 `src/lib/cache/placePageCache.ts` — `purgePlacePages()`: `revalidatePath('/place/[slug]','page')` (60여 곳이라 전부 비워도 부담 적음).
  호출: `purgeShopLists()`(샵 변경), `/api/revalidate/events`(이벤트 변경), `/api/admin/upsert`의 `places` 수정·추가·삭제.
- 알려진 부작용: 날짜가 바뀌어 시작·종료되는 이벤트는 최대 5분 늦게 반영. `/api/admin/place-note`(access_note)는 장소 페이지에 안 나와서 연결 안 함.

### 2·3차 검증 (Claude, 2026-10-24 — 작업 폴더 복사본에서 빌드)
- `npm run build` 성공: `/event/[id]`·`/place/[slug]`·`/shop/[slug]` 모두 `●`.
- `next start`로 같은 페이지 두 번 요청 → `x-nextjs-cache: MISS → HIT`, `Cache-Control: s-maxage=300` 확인. 제목 메타 정상.
- `/api/revalidate/events` 비로그인 POST → 401.
- 참고(기존 동작): 없는 샵·장소 주소는 HTTP 200 + `noindex` + not-found 화면(샵 상세도 원래 그랬음). 검색 노출은 안 됨.
- 로그인 상태의 '저장 → 즉시 반영'은 배포 후 직접 확인 필요.

## 4차 — `/route/[token]` (2026-10-24)
- 새 `src/lib/route/routeDetailQuery.ts` — `ROUTE_DETAIL_SELECT` + `fetchRouteDetail(supabase, token)`. 서버·브라우저가 같은 모양으로 읽음.
- `src/app/route/[token]/page.tsx`: `createPublicClient()` + `revalidate = 300` + `generateStaticParams() → []`. `auth.getUser()`·차단 RPC 제거.
  공개·공식 루트만 서버가 읽음. 못 읽으면(비공개·없는 루트) `route=null`로 빈 화면만 캐시(메타: '덕질 루트', noindex). `notFound()`는 더 이상 안 부름.
- `src/components/route/RouteDetailGate.tsx`(브라우저):
  - `route=null`이고 로그인 상태면 그 세션으로 `fetchRouteDetail` 재조회 → RLS상 작성자 본인 비공개 루트만 읽힘. 탭 제목도 루트 이름으로 바꿈.
  - 못 읽으면 '루트를 볼 수 없어요(비공개로 바뀌었거나 없는 루트)', 읽었는데 비공개+남이면 '비공개 루트예요'(기존 문구).
  - 차단 확인: `is_blocked_between` RPC → true면 `profiles=null`, `author_blocked=true`(→ '사용자'). **확인되기 전 잠깐은 닉네임이 보임**(모든 로그인 사용자에게 깜빡임이 생기지 않게 확인 후에만 가림). 닉네임은 anon도 읽을 수 있어서 노출 수준은 예전과 같음.
- 새 `src/lib/cache/routePageCache.ts` — `purgeRoutePages()`: `revalidatePath('/route/[token]','page')` (루트 12개라 전체).
  새 `src/app/api/revalidate/routes/route.ts`(로그인 필요) + 브라우저 `refreshRoutePages()`(`services/routeService.ts`).
  호출: `deleteRoute`, `toggleRouteShare`, `updateRoute`, `updateRouteMeta`, `adminRouteService.approveOfficialRoute/revokeOfficialRoute`, `/api/admin/route-action`(양도·삭제·공개 전환).
  층 지도·출처는 상세에서 브라우저가 따로 읽으므로 연결 안 함. `createRoute`는 새 token이라 캐시 없음.
- 알려진 부작용: **좋아요 수(`likes`)**, 작성자 닉네임 변경, 경유 샵 정보는 최대 5분 늦게 반영.
- 검증(Claude, 복사본 빌드 + `next start`): `/route/[token]` `●`. 공개 루트 MISS→HIT·작성자 이름·index 정상.
  비공개 루트 2개·없는 token → 200, '덕질 루트' + noindex, **HTML에 비공개 루트 제목 없음**(누출 X), 비로그인 화면 '루트를 볼 수 없어요'.
  `/api/revalidate/routes` 비로그인 401. ⚠️ **작성자 로그인으로 비공개 루트 열기 / 차단 관계 가리기는 로그인이 필요해 미검증** — 배포 후 직접 확인.

## 다음 할 일
1. ~~`/event/[id]`~~ ✅ 완료 (위 "2차").
2. ~~`/place/[slug]`~~ ✅ 완료 (위 "3차").
3. ~~`/route/[token]`~~ ✅ 완료 (위 "4차") — 아래 원래 메모는 조사 기록으로 남김.
3. **`/route/[token]`** ⚠️ — `auth.getUser()`로 `author_blocked`(차단한 작성자) 처리를 서버에서 함 → 이 부분을 브라우저로 옮겨야 캐시 가능.
   또 비공개 루트를 share_token으로 여는 구조인지 RLS 확인 필요(anon으로 못 읽으면 캐시 전환 시 깨짐). 사용자와 상의 후 진행.
   **조사 결과 (2026-10-24, 코드 변경 없음)**
   - routes RLS(정책은 대시보드에서 만든 듯, migrations에 없음): anon은 `is_shared or is_official`만 읽힘 — 전체 12개 중 공개 10(공식 4), 비공개 2개는 안 보임.
     route_shops도 같은 기준(248개 중 비공개 루트 경유지 55개는 anon에 안 보임). `route_reviews` 정책(`r.is_shared or r.is_official or r.user_id = auth.uid()`)과 같은 모양.
   - ⇒ anon 클라이언트로 바꾸면 **작성자가 자기 비공개 루트를 열 때 404**가 남(서버가 못 읽음). 비공개 루트는 브라우저(작성자 세션)가 따로 읽는 대체 경로가 필요.
   - 차단: 서버가 `is_blocked_between` RPC로 확인 → `profiles=null`, `author_blocked=true`. 화면은 `RouteDetailPage`에서 `author_blocked ? '사용자' : nickname`만 씀.
     anon이 profiles 닉네임을 읽을 수 있어서(비로그인 방문자에겐 원래 보임) "닉네임이 브라우저로 안 간다"는 실질적 보호는 아님 → 브라우저에서 RPC 확인 후 가리는 방식으로 옮겨도 노출 수준은 같음.
   - 캐시 시 늦게 바뀌는 것: `likes`(increment_route_likes), 작성자 닉네임, 경유 샵 정보.
   - 비울 곳: `services/routeService.ts`(저장·경유지 교체·메타·공유 전환·삭제·층지도·출처), `app/api/admin/route-action`(양도·삭제·공유), `services/adminRouteService.ts`(공식 지정/해제). 루트가 12개뿐이라 `revalidatePath('/route/[token]','page')` 전체 비우기로 충분.
   - 공개 루트가 10개라 봇 트래픽 비중은 샵(1,100+)보다 훨씬 작음 → Vercel 경로별 CPU 확인 후 우선순위 정해도 됨.
4. **`/community/[id]`** ⚠️ — `community_posts_visible` 뷰 + visibility. 팔로워 공개 글 등 로그인별로 보이는 글이 있으면 anon 전환 시 안 보이게 됨. RLS·뷰 정의 확인 후 진행.
5. `/work/[slug]`, `/user/[nickname]`의 `force-dynamic`은 의도된 것 — 바꾸기 전 사용자에게 확인.

## 작업 규칙 (사용자 선호)
- 답변은 한국어. 커밋·푸시·배포·`npm run build`·SQL 실행은 **사용자가 직접**, Claude는 하지 말 것. 끝에 한 줄짜리 `git add …; git commit -m "…"`만 제시.
- 파일의 원래 줄바꿈·BOM 유지 (이번 파일들은 LF, BOM 없음).
- 목업용 예시 데이터 넣지 말 것. 데이터 삭제·공개 범위 확대 임의로 하지 말 것.
- PC/데스크톱 레이아웃은 건드리지 말 것.
- Next 16.2 (`revalidateTag(tag, { expire: 0 })` 형태 사용 중), `next.config.ts`에 `cacheComponents` 없음 → 기존 `export const revalidate` 방식 사용.
- `unstable_cache`는 항목당 2MB 제한 — 큰 목록은 감싸지 말 것(`shopListCache.ts` 주석 참고).
