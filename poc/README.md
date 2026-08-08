# ORS 도보 경로 PoC 실행 가이드

수원·홍대·용산 실제 루트 20개로 OpenRouteService(foot-walking) 경로 품질을 실측하고 이상 사례를 기록합니다.

## 준비물
- Node 18+ (내장 fetch 사용)
- ORS API 키 — https://openrouteservice.org 무료 가입 → dev 대시보드에서 발급
- (선택) TMap appKey — 품질 비교까지 할 경우

## 순서
1. `export-routes.sql` 을 Supabase SQL Editor에서 실행 → 결과의 `poc_routes` JSON 셀을 복사해 이 폴더에 **`poc-routes.json`** 으로 저장.
2. 실행:
   ```bash
   ORS_API_KEY=발급키 node ors-poc.mjs
   # TMap 비교까지:
   ORS_API_KEY=발급키 TMAP_APP_KEY=티맵키 node ors-poc.mjs
   ```
3. 생성물 확인:
   - `poc-report.html` — 브라우저로 열어 루트별 ORS 실선 경로를 OSM 지도 위에서 육안 검수
   - `poc-이상사례.md` — 건물 관통/골목/횡단보도 등 이상 사례 기록(수기)
   - `poc-results.json` — 루트별 원자료(거리/시간/지연/에러)

## 검수 포인트
- 건물 관통, 골목 누락·우회, 횡단보도 무시, 강·철로·대로 비정상 횡단, 스팟 스냅 실패
- ORS 거리 ÷ 직선 거리 배율이 비정상적으로 크거나(과도한 우회) 1에 가까운데 경로가 직선적인 경우(도로망 미인식)

## 참고
- ORS는 좌표를 [경도, 위도] 순서로 받습니다(스크립트가 자동 변환).
- ORS 무료 한도 약 2,000건/일·40건/분 → 스크립트는 호출 간 1.6초 간격.
- 경유지 50점 초과 루트는 자동 분할(경계 1점 겹침). 18스팟은 1회 호출.
