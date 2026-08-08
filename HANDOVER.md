# 타쿠로드 인수인계 (HANDOVER)

> 새 채팅에서 이 파일을 읽고 **바로 이어서** 작업하기 위한 문서.
> 마지막 갱신: 2026-08 / 진행자: 사용자(박지현) + Claude

---

## 0. 작업 방식 (제일 중요)

- 이 세션은 **클라우드 + 사용자 컴퓨터 브리지**(`mcp__remote-devices__*`)로 동작.
- **실제 코드 위치는 사용자 PC의 `C:\dev\takuroad`**. 클라우드의 `/mnt/user-data/uploads/takuroad/`는 편집용 스테이징 사본.
- **수정 흐름**: `uploads`에서 편집 → esbuild 문법검사 → `SendUserFile` → `device_commit_files(force:true)`로 `C:\dev\takuroad`에 반영.
- 파일이 `uploads`에 없으면 `device_stage_files`로 PC에서 가져온 뒤 편집.
- **빌드/배포는 사용자가 직접**: `npm run build` → `git add -A && git commit && git push` (Vercel 자동 배포).
- 클라우드에선 `takuroad.kr` / `localhost` 접속 불가 → **렌더링·GPS 확인은 사용자가 폰/PC에서** 함.
- 사용자는 "Claude가 알아서 내 컴퓨터를 직접 조작해주는 방식"을 선호함 → 파일 수정·커밋까지 알아서 진행하고, build/push만 사용자에게 요청.

### 문법 검사 커맨드
```
cat <file> | npx --yes esbuild --loader=tsx   # (.ts는 --loader=ts)
```
순수 로직 유닛테스트: `npx esbuild <f> --bundle --format=esm` → `node --input-type=module`.

---

## 1. 스택 / 인프라

- Next.js 16 (Turbopack), React, TypeScript, CSS Modules, Kakao Maps JS SDK, OpenRouteService(foot-walking).
- Supabase project ref: `ouhlwmtwgxewrktgrzkd`.
- 배포: Vercel (git push 자동).

### Vercel 환경변수 (7개)
등록됨: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(**Production만**), `NEXT_PUBLIC_KAKAO_APP_KEY`, `NEXT_PUBLIC_APP_URL`, `ORS_API_KEY`.
- ⚠️ 프리뷰 URL로 테스트하려면 `SUPABASE_SERVICE_ROLE_KEY`를 **Preview에도** 추가해야 세션 API가 동작.
- `NEXT_PUBLIC_KAKAO_REST_KEY`는 현재 코드에서 미사용(선택).

---

## 2. 절대 규칙

- **PC/데스크톱 레이아웃은 절대 건드리지 말 것.** 모바일만 수정.
- 기기 구분: `useIsDesktop()` (`hover:hover and pointer:fine` = PC). 모바일 CSS 스코프: `@media (hover:none) and (pointer:coarse)`.
- Supabase **service role 키는 서버 전용** — 클라이언트 번들/응답/로그에 절대 노출 금지.
- 경로 API 실패 시 직선 금지(번호 핀만).

---

## 3. 『루트 방문하기』(GPS 루트 방문) — 이번에 만든 기능

### 3-1. 정책 (사용자 확정)
- 사용자는 **버튼 2개만**: `루트 시작하기` / `오늘 루트 종료`. 샵마다 방문 버튼 없음.
- **완주는 항상 허용**(정상 유저가 GPS 오류로 실패하면 안 됨). 기본 완주 EXP는 GPS와 무관하게 지급.
- **현장 확인 보너스만 분리** — 자동 확인(GPS 근접·체류)된 **체크포인트 비율**로만 지급. 가짜 체크는 보너스 제외.
- `인증 완주 / 일반 완주` 2종류로 **절대 표시 금지**. 항상 "루트 완주" 하나. 부가정보만 "현장 확인 n/m · 직접 기록 k".
- 체크포인트 = **같은 건물(place_id) 샵 묶음**. 건물 도착만으론 내부 샵 자동 방문 처리 안 함(실제 방문은 종료 화면에서 직접 체크).
- 서버가 판정(클라 신뢰 안 함). 원시 GPS 좌표 **영구 저장 안 함**(판정 후 폐기, 계산값만).
- VisitStatus: `pending | proximity_verified | checkpoint_verified | qr_verified | manual_recorded | skipped` (qr은 v1 인터페이스만).

### 3-2. DB (Supabase에 **이미 적용 완료**)
- 마이그레이션 `migrations/2026-08_route_sessions.sql` 실행됨:
  - `route_sessions`, `route_session_visits`, `route_verify_config` (설정 10개 시드).
  - RLS: 본인 것만 select, 쓰기는 service role만.
- place_id는 건물 그룹으로 안전(진단 통과, 건물 span 최대 87m). 기존 `route_progress`/`route_completions`/EXP/배지는 안 건드림.

### 3-3. 서버
- `src/lib/routeRun/`: `types.ts`, `config.ts`, `checkpoints.ts`(유닛테스트 통과), `verification.ts`(테스트 통과), `configServer.ts`(60s 캐시), `rewardService.ts`, `sessionService.ts`, `apiAuth.ts`.
- `src/lib/supabase/service.ts`: service role 클라이언트(서버 전용).
- API `src/app/api/route-session/{start,active,ping,pause,resume,manual,undo,end}/route.ts` + `src/app/api/route-verify-config/route.ts`. 모두 `runtime='nodejs'`, `requireUser` 인증.
- 체크포인트 도출: 연속 같은 place 묶기, 재방문은 `place:{id}:seq:{n}`, 외부 단독샵 `shop:{id}`, ≤7개(초과 시 first+last 고정+누적거리 선택). 세션 시작 시 동결.
- ping: 정확도/근접(반경)/체류(minSamples·minDwell) 판정, 속도이상 리스크플래그. 서버 시각 사용.
- end: **멱등**(finalized_at 가드). `later`=세션만 유지, `complete/partial`만 route_progress 반영, `complete`만 완주기록+EXP. 보너스는 hasRisk 없고 fieldRatio≥설정일 때만.

### 3-4. 클라이언트 훅 `src/lib/routeRun/useRouteRun.ts`
- 시작/이어가기/일시중지/재개/종료, **포그라운드 12초 폴링** ping, `visibilitychange` 복귀 시 재동기화.
- ⚠️ **위치 권한**: `requestLocationNow()`는 반드시 **사용자 탭(제스처)**에서 호출해야 iOS 사파리 팝업이 뜸. 타이머 호출은 조용히 무시/타임아웃됨.
- `hasExistingSession`: 남은 세션이 있으면 자동 진입 안 하고 CTA를 "이어서 따라가기"로.
- `confirmedShopIds`(보상용 — 건물 내부 샵 제외), `arrivedShopIds`(안내 커서용 — 건물 도착 시 내부 샵 포함).
- `skip`(로컬).

### 3-5. 모바일 UI (신규)
- `src/components/route/RouteMapMobile.tsx` + `.module.css`: **전체화면 지도 레이어**(`fixed inset:0; z-index:35` — 전역 상단바 z30을 덮음, 하단탭 z40은 위에 남음). 컴팩트 앱바(뒤로/루트명/공유/더보기). `RouteMap`(forwardRef, myLocation, bottomPadding). 우측 플로팅(전체맞춤/현재위치).
- `src/components/route/run/RouteSheet.tsx` + `.module.css`: **드래그 3단**(collapsed/half/expanded, 핸들 탭=순환).
  - idle: 요약+`루트 시작하기`/`이어서 따라가기`, 선택 스팟 상세, 코스목록(expanded).
  - running: `현장 확인 n/m` + `방문 기록 n/총` + **다음(전체 샵 순서 커서)** + 길안내/건너뛰기/일시중지/`오늘 루트 종료` + 코스목록.
- **다음 안내 커서 = 전체 샵 순서**(RouteMapMobile에서 계산): `arrivedShopIds`·`visited`·로컬 `skippedShops` 제외한 첫 샵. 건너뛰기는 샵 1개씩, 건물 도착 시 그 건물 샵 자동 통과.
- `run/ArrivalToast`(도착 확인+되돌리기), `run/RouteEndSheet`(자동 미확인 샵만 체크 · **현장확인 0곳이면 완주 전 부드러운 확인** · 완주/부분/나중에), `run/RouteRunComplete`(방문/현장확인/직접기록 카운트, `/taku/taku-checkin.png`).
- ⚠️ `src/components/route/RouteMap.tsx`는 이제 **forwardRef**(`RouteMapRef`: `fit(bottomPad)`, `panTo`). **`next/dynamic`으로 forwardRef를 부르면 "Component is not a function"으로 터짐** → RouteMapMode·RouteMapMobile 모두 **정적 import**로 바꿔둠. 지도 subtree가 이미 ssr:false라 안전.

### 3-6. 데스크톱 / 연결
- `src/components/route/RouteMapMode.tsx`: 기존 2단 레이아웃 그대로. run 기능은 `runEnabled=!isDesktop`이라 데스크톱에선 비활성(레거시 `루트 완주` 버튼).
- `src/components/map/MapPage.tsx`: `routeId` 있으면 `isDesktop ? <RouteMapMode/> : <RouteMapMobile/>`.
- `src/components/route/RouteDetailPage.tsx`: `루트 시작하기` → `/map?routeId={token}&run=1`. 섹션 순서 **루트 소개 → 여행 전 tip → 방문 코스**, `방문 코스`는 접기/펴기(`courseOpen`, 기본 펴짐).

---

## 4. 현재 상태 / 주의

- 사용자가 `localhost:3000` 및 배포본에서 확인하며 반복 조정 중. UI는 잘 동작 확인됨.
- **예전 테스트로 안 끝난 세션**이 사용자 계정에 남아 있을 수 있음 → 지도 진입 시 "이어서 따라가기"로 보임. 한 번 종료하면 정리됨.
- 실제 폰에서 GPS 도착 감지 end-to-end는 현장에서만 검증 가능(집/사무실에선 "현장 확인 0" 정상).

## 5. 다음 후보 (미정)
- 시트 높이/문구/거리 미세조정(사용자 피드백 기반).
- 필요 시: 배지/스탬프(v1엔 EXP `route_field_verified`만), QR 실제 구현, 관리자용 route_verify_config 조정 UI.

## 6. 핵심 파일 트리 (루트 방문 관련)
```
src/lib/routeRun/{types,config,checkpoints,verification,configServer,rewardService,sessionService,apiAuth,useRouteRun}.ts
src/lib/supabase/service.ts
src/app/api/route-session/{start,active,ping,pause,resume,manual,undo,end}/route.ts
src/app/api/route-verify-config/route.ts
src/components/route/RouteMapMobile.tsx(.module.css)
src/components/route/run/{RouteSheet,ArrivalToast,RouteEndSheet,RouteRunComplete,RouteRunSheet}.tsx(.module.css)
src/components/route/RouteMap.tsx   # forwardRef
src/components/route/RouteMapMode.tsx  # 데스크톱
src/components/map/MapPage.tsx      # 분기
src/components/route/RouteDetailPage.tsx
migrations/2026-08_route_sessions.sql  # (Supabase 적용 완료)
```
