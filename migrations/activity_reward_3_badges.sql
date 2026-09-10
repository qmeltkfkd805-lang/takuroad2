-- ============================================================
-- 활동 보상 서버 이전 — 3/4  검증 불가 활동 기반 배지 비활성화
--
-- ⚠️ 코드 배포(4단계 A~D) 후에 적용한다. 먼저 적용하면 아직 지급되던 배지가
--    갑자기 멈춘 것처럼 보인다.
--
-- 원칙
--   · is_active=false 로 내리기만 한다. user_badge_tiers 행은 손대지 않는다.
--     이미 받은 사람은 그대로 보유한다. 회수 없음.
--   · evaluateBadgeTiers* 는 .eq('is_active', true) 로 거르므로 새로 안 나간다.
--   · countActivity 는 건드리지 않는다.
--
-- 근거
--   shop_visit / event_visit 은 현장 증명이 없다. check_ins·event_visits 는
--   버튼을 누르면 생기는 자기 주장이라, 서버가 대조해도 "눌렀다"까지만 확인된다.
--   보상(EXP)을 끊는 것과 같은 이유로 배지도 끊는다.
--   work_register 는 사용자가 새 이름·slug 로 무제한 생성할 수 있어
--   검수 정책이 생길 때까지 보상하지 않기로 했다.
-- ============================================================

update public.badge_tiers set is_active = false
where id in (
  -- ── shop_visit 기반 (activity_logs 를 읽는다) ──
  'f38918da-ecf9-4d6c-a09d-33e8c8557688',  -- shop-series   lv1  첫 탐험      1곳    보유 1
  '92a85d62-c80f-4bf8-a61e-a8bac3becf51',  -- shop-series   lv2  샵 탐험가    10곳   보유 1
  '56107440-4be1-4f45-83f1-60a0e9ee6130',  -- shop-series   lv3  샵 마스터    50곳   보유 1
  '056e7ba0-afb4-4fc9-b5e8-67d272c39c33',  -- shop-series   lv4  성지순례자   100곳  보유 1
  'a69d4acc-3ad3-4d48-a03e-5db6f002a223',  -- region-series lv2  전국 탐험가  지역 3 보유 1
  '96689cd9-4397-44ad-898b-d08ef094330a',  -- region-series lv3  전국 정복자  지역 10 보유 0

  -- ── event_visit 기반 ──
  '3ad354ae-e43c-49c0-836e-6f6f1d9a105b',  -- event-series  lv1  이벤트 첫걸음  1회  보유 2
  'f80cef8a-46af-4e05-9dc9-f2a55a6003d4',  -- event-series  lv2  이벤트 러버   10회  보유 0
  '2b50ba04-7bc3-4190-a95d-066f391ce858',  -- event-series  lv3  이벤트 헌터   30회  보유 0
  '7a9fec14-eccf-4fde-9f3b-20229389ada8',  -- event-series  lv4  이벤트 마스터 50회  보유 0

  -- ── work_register 기반 (작품 등록 보상 중단) ──
  '6c237ed5-e9da-4180-820b-feed7cfbf197',  -- work-series   lv1  컬렉터        1개   보유 2
  '5eb6e9e8-7120-422b-a1bd-b5ead52a871d',  -- work-series   lv2  타쿠컬렉터    10개  보유 1
  '8c1ef149-2767-4c4e-a980-eaf7dcde69ef',  -- work-series   lv3  전설의 컬렉터 50개  보유 0
  'bb9a4c2a-d3d2-452f-b256-9d4d23f2e9c7',  -- work-series   lv4  수집 마스터   100개 보유 0

  -- ── all_masters 파생 ──
  --   전설의 타쿠는 "growth 그룹의 활성 자동 배지 최상위 티어를 전부 보유" 조건이다.
  --   위 시리즈들이 비활성이 되면 계산에서 통째로 빠져 조건이 크게 쉬워진다.
  --   보유자가 0명이라 손해 보는 사람은 없지만, legendary 배지가 의도치 않게
  --   헐값이 되므로 성장 체계를 다시 짤 때까지 같이 내린다.
  '564eaef5-bd46-4673-9289-39571004f710'   -- legend  전설의 타쿠  all_masters  보유 0
);
-- 기대: UPDATE 15


-- ============================================================
-- 손대지 않는 것
-- ============================================================
--   route-series (루트 초보 1b19687e / 루트 탐험가 16a31e73 / 루트 마스터 d2007554)
--     → GPS 세션 완주는 계속 activity_logs 를 남기고 EXP 도 받는다.
--       즉 이 배지들은 "검증된 완주"로만 진행된다. 끄면 정상 GPS 사용자가 손해다.
--       (route-finisher 시리즈와 루트 전설 f38cd23d 는 이미 is_active=false 다)
--
--   contrib-series (제보 첫걸음·모험가·전문가·마스터)
--     → activity_types = [shop_register, event_submit, route_created].
--       셋 다 계속 보상·기록되는 활동이다.
--
--   review-series / photo-series
--     → 검증 가능한 콘텐츠 활동이라 유지한다.
--
--   tag_visit_percent · region_visit_count · category_visit_count
--     (홍대 3종 / 원피스·블루아카이브 성지순례 / 굿즈 헌터 / 피규어 마스터)
--     → check_ins 를 직접 읽어 같은 문제를 갖지만 전부 이미 is_active=false 다.
--
--   consecutive_days (출석체크·성실한 타쿠·타쿠 왕)
--     → visit_logs(사이트 접속 로그)를 읽는다. 샵 방문과 무관하다.
--
--   comment_count / community_starter / likes_received
--     → 커뮤니티 활동 기반이라 무관하다.


-- ============================================================
-- [적용 후 확인]
-- ============================================================
-- select bt.name, bt.is_active,
--        (select count(*) from public.user_badge_tiers u where u.badge_tier_id = bt.id) as 보유자
-- from public.badge_tiers bt
-- where bt.id in ('f38918da-ecf9-4d6c-a09d-33e8c8557688','92a85d62-c80f-4bf8-a61e-a8bac3becf51',
--                 '56107440-4be1-4f45-83f1-60a0e9ee6130','056e7ba0-afb4-4fc9-b5e8-67d272c39c33',
--                 'a69d4acc-3ad3-4d48-a03e-5db6f002a223','96689cd9-4397-44ad-898b-d08ef094330a',
--                 '3ad354ae-e43c-49c0-836e-6f6f1d9a105b','f80cef8a-46af-4e05-9dc9-f2a55a6003d4',
--                 '2b50ba04-7bc3-4190-a95d-066f391ce858','7a9fec14-eccf-4fde-9f3b-20229389ada8',
--                 '6c237ed5-e9da-4180-820b-feed7cfbf197','5eb6e9e8-7120-422b-a1bd-b5ead52a871d',
--                 '8c1ef149-2767-4c4e-a980-eaf7dcde69ef','bb9a4c2a-d3d2-452f-b256-9d4d23f2e9c7',
--                 '564eaef5-bd46-4673-9289-39571004f710')
-- order by bt.name;
--   → 15행 전부 is_active = false, 보유자 수는 그대로


-- ============================================================
-- [롤백]  — 보유 배지는 어차피 그대로이므로 되돌려도 데이터 손실이 없다
-- ============================================================
-- update public.badge_tiers set is_active = true
-- where id in ( ...위와 같은 목록... );
