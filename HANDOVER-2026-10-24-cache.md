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
| `/event/[id]` | ❌ 쿠키 클라이언트 — **다음 작업** |
| `/place/[slug]` | ❌ 쿠키 클라이언트 — **다음 작업** |
| `/route/[token]` | ❌ 쿠키 클라이언트 + `auth.getUser()` — ⚠️주의 필요 |
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

## 다음 할 일
1. **`/event/[id]`** — `getEvent`를 `createPublicClient()`로, `revalidate = 300` + `generateStaticParams` 빈 배열.
   이벤트 수정·삭제·공개 시 비우는 함수가 없으므로 `src/lib/cache/`에 `purgeEventPages()`(예: `revalidatePath('/event/[id]','page')`) 추가하고,
   이벤트 저장 경로(서버 API — `api/admin/approve-submission`, 이벤트 위저드 저장 등)에서 호출. 브라우저에서 저장하는 경로면 `/api/revalidate/shops`처럼 로그인 확인 + 스로틀 API를 하나 만든다.
2. **`/place/[slug]`** — 같은 방식. 장소 변경 시 비우기 연결.
3. **`/route/[token]`** ⚠️ — `auth.getUser()`로 `author_blocked`(차단한 작성자) 처리를 서버에서 함 → 이 부분을 브라우저로 옮겨야 캐시 가능.
   또 비공개 루트를 share_token으로 여는 구조인지 RLS 확인 필요(anon으로 못 읽으면 캐시 전환 시 깨짐). 사용자와 상의 후 진행.
4. **`/community/[id]`** ⚠️ — `community_posts_visible` 뷰 + visibility. 팔로워 공개 글 등 로그인별로 보이는 글이 있으면 anon 전환 시 안 보이게 됨. RLS·뷰 정의 확인 후 진행.
5. `/work/[slug]`, `/user/[nickname]`의 `force-dynamic`은 의도된 것 — 바꾸기 전 사용자에게 확인.

## 작업 규칙 (사용자 선호)
- 답변은 한국어. 커밋·푸시·배포·`npm run build`·SQL 실행은 **사용자가 직접**, Claude는 하지 말 것. 끝에 한 줄짜리 `git add …; git commit -m "…"`만 제시.
- 파일의 원래 줄바꿈·BOM 유지 (이번 파일들은 LF, BOM 없음).
- 목업용 예시 데이터 넣지 말 것. 데이터 삭제·공개 범위 확대 임의로 하지 말 것.
- PC/데스크톱 레이아웃은 건드리지 말 것.
- Next 16.2 (`revalidateTag(tag, { expire: 0 })` 형태 사용 중), `next.config.ts`에 `cacheComponents` 없음 → 기존 `export const revalidate` 방식 사용.
- `unstable_cache`는 항목당 2MB 제한 — 큰 목록은 감싸지 말 것(`shopListCache.ts` 주석 참고).
