# 레벨 시스템 설계 (level-system.md)

> v1.5 확정 설계 — 구현 전 기준. 새 테이블은 `level_rewards` 하나뿐이고, **그마저도 마지막 단계**에서
> (실제 코스메틱을 다 만든 뒤) 만든다. 나머지는 기존 `exp_logs / user_exp / level_thresholds / activity_logs` 재사용.
>
> 팬아트 시스템이 "작품을 살아 움직이게" 한다면, 레벨 시스템은 "**사용자를 살아 움직이게**" 하는 기반이다.
> 특정 기능(체크인 등)에 의존하지 않는, 오래 유지될 축.
>
> **🔒 Design Freeze — v1.5 = 1차 확정본.** 이후로는 구현 중 발견된 버그·명백한 설계 문제만 수정한다.
> 새 기능 아이디어는 구현 완료 후 **v2.0**에서 검토. 구현은 §11 순서대로, 아래 원칙 준수:
> 1. 문서에 없는 구조를 임의로 추가하지 않는다.
> 2. 새 테이블은 `level_rewards` 하나만 허용하고, 그것도 마지막 단계에서 만든다.
> 3. 기존 시스템(`exp_logs`·`user_exp`·`activity_logs`·`createActivity`)을 최대한 재사용한다.
> 4. XP는 반드시 `createActivity`를 중심으로 흐른다.
> 5. 더 좋은 구조가 보여도 먼저 제안하고, 승인 없이 설계를 변경하지 않는다.
> 6. 각 단계가 끝날 때마다 동작 검증 후 다음 단계로.

## 0. 목표 & 핵심 흐름
```
행동
  ↓
createActivity()
  ↓
XP
  ↓
배지
  ↓
레벨업
  ↓
보상 해금
  ↓
프로필 꾸미기
  ↓
다음 목표
```
- **중심 파이프라인 = `createActivity()`.** Activity → XP → 배지 → 성장센터 → 연대기가 전부 하나로 묶인다.
- **평소엔 꾸준히, 배지·레벨업에서 크게.** 기본 활동 XP는 재미있을 만큼 주되, 배지 보너스로 한 번 더 크게.
- **체크인 비의존 원칙:** 레벨은 `shop_visit` **Activity**만 바라본다. 방문 인증을 GPS·QR·NFC·도장·사장님 인증 뭘로 바꿔도 `shop_visit` Activity만 나오면 레벨 코드는 안 바뀐다. 체크인 재설계는 레벨 완성 후 별도.

---

## 1. 현재 코드 구조 분석

### 이미 있는 것 (그대로)
| 자산 | 내용 |
|---|---|
| `user_exp`, `exp_logs`, `level_thresholds` | XP 상태 / XP 원장 / 레벨 곡선 |
| `expService.addExp(...)` | 유일한 XP 진입점 — 로그+상태+레벨 재계산 완결 |
| `getMyLevelInfo`, `getExpLogs`, `levelTier()` | 레벨 조회 / XP 로그 / 레벨 티어 |
| `activity_logs` + `createActivity()` | 모든 덕질 활동의 단일 파이프라인 |
| `evaluateBadgeTiersForUser()` | 새로 딴 tier id 배열 반환 → 보너스 XP 훅 |
| `announceUnlock` + `takuroad:unlock` + 해금 모달 | "보상 순간" UX → 레벨업 축하에 복제 |
| 코스메틱 해금 = 배지 티어에서 파생(별도 테이블 없음) | 레벨 해금도 같은 파생 방식 |

### 핵심 발견 (= 미완성 이유)
- **`addExp`는 체크인 한 곳에서만** 호출(그것도 `check_ins` 중복방지 후). → "각 서비스가 중복방지 후 지급" 패턴은 정립됨. 배선만 늘리면 됨.
- 레벨업 축하 없음 / 레벨 해금 경로 없음 / 배지 보너스 XP 없음 / 레벨 자체의 의미(칭호) 없음.

### 새로 필요 (최소)
- **테이블 1개**: `level_rewards` — **마지막 단계에** 생성.
- **컬럼 1개**: `badge_tiers.reward_exp` (int, null · 선택).
- 헬퍼: `addExpOnce`, `addExpDailyCapped`.
- 코드 상수: `XP_RULES`(객체형), `REASON_LABEL`, `LEVEL_RANKS`.
- 레벨업 축하: `takuroad:levelup` + `LevelUpModal`(보상 상자 연출).

---

## 2. XP — 어디서 계산하고 무엇이 주나

### 2-1. 지급 아키텍처
**(A) `activity_logs`를 지나는 활동 → `createActivity()`에서 일괄 지급**
- 타입별 XP를 `addExpOnce(reason=type, related_id=refId)`. 리뷰 refId=대상이라 같은 곳 반복은 1회.
- **체크인의 개별 `addExp`는 제거·통합** → 지급 지점 한 곳(체크인 비의존 실현).
- 예외 `work_progress`: 멱등 키에 pct 포함(`workId:pct`)해 25/50/75/100 각각 지급.

**(B) `activity_logs`에 없는 소스 → 개별 지급**
- 팬아트 업로드: `addExpOnce('fanart', postId)`.
- 대표 팬아트 선정: 선정 SQL에서 exp_logs insert + user_exp 갱신 (featured당 1회). reason=`featured_fanart`.
- 좋아요·댓글: **XP 없음**.

### 2-2. XP 규칙표 (`XP_RULES` · 객체형)
> XP를 너무 깎으면 재미가 떨어진다 → 값은 넉넉히, 페이싱은 **레벨 곡선**으로 조절.

`XP_RULES`는 단순 숫자가 아니라 **객체**로 관리해 확장성을 확보한다:
> ```ts
> review:          { baseXp: 10, once: true, category: "community", visible: true },
> route_completed: { baseXp: 15, once: true, category: "explore",  visible: true },
> ```
> `category`(탐험 explore / 커뮤니티 community / 창작 creative / 기여 contribute)는 지금 안 써도 나중에 성장센터·XP 히스토리 분류에 쓴다. **`visible`은 히스토리 노출 여부** — `visible:false`면 XP는 지급하되 히스토리엔 숨긴다(`daily_goal`·`admin_reward`·`migration`·`event_bonus` 같은 것). `dailyCap` · `cooldown` 옵션도 필드로 추가 가능. (category 매핑은 구현 시 확정)

| 소스 | reason | XP | 멱등/상한 |
|---|---|---|---|
| 샵 방문 | `shop_visit` | 5 | 샵당 1회 |
| 이벤트 참여 | `event_visit` | 10 | 이벤트당 1회 |
| 루트 완주 | `route_completed` | 15 | 루트당 1회 |
| 리뷰 작성 | `review` | 10 | 대상당 1회 |
| 사진 등록 | `photo_upload` | 3 | 샵당 1회 |
| 샵 등록 | `shop_register` | 15 | 샵당 1회(활성만) |
| 이벤트 제보 채택 | `event_submit` | 15 | 이벤트당 1회 |
| 루트 제작 | `route_created` | 15 | 루트당 1회 |
| 작품 등록 | `work_register` | 10 | 작품당 1회 |
| 작품 진행률 | `work_progress` | 10 / 20 / 30 / 50 | 작품×마일스톤당 1회 |
| 팬아트 업로드 | `fanart` | 10 | 글당 1회 |
| **좋아요** | — | **0** | — |
| **댓글** | — | **0** | — |
| 대표 팬아트 선정 | `featured_fanart` | **50** | featured당 1회 |
| 배지 획득 보너스 | `badge` | 등급별(§5) | tier당 1회 |

- **대표 팬아트 50** (100→50): 대표 선정은 이미 명예·작품대표·알림·프로필기록을 준다. XP까지 너무 크면 레벨이 팬아트에 쏠린다. 50이 적정.
- **reason 네이밍 규칙**: 대표 선정류는 `featured_*` 접두사로 통일 — 지금은 `featured_fanart`, 앞으로 `featured_route`·`featured_shop`이 생겨도 규칙 일치.
- **좋아요·댓글 0** 확정 — 좋아요는 대표/인기글/랭킹에서만 쓰고, 댓글 동기는 배지(커뮤니티 스타터·소통왕)로만. 스팸 벡터를 XP에서 제외.

### 2-3. XP 배율 (확장 대비)
XP는 항상 `finalXp = baseXp × multiplier`(최종 = 기본 × 배율)로 지급한다. **배율은 현재 항상 1.0.** 나중에 "팬아트 주간·오픈 이벤트·특별 이벤트"에서 2배 등을 전역/기간 설정만으로 켜도록 확장성 확보. 배율을 곱한 최종값이 `exp_logs.amount`에 기록되어 히스토리에도 그대로 보인다.

---

## 3. 레벨 계산 방식
`level_thresholds(level, min_exp)` 테이블 주도. "초반 빨리, 후반 천천히". XP를 넉넉히 준 만큼 곡선으로 페이싱:
```
min_exp(L) = round(60 * (L-1)^1.5)
```
| L | 필요 누적 XP |
|---|---|
| 2 | 60 |
| 3 | 170 |
| 5 | 480 |
| 10 | 1,620 |
| 20 | 4,970 |
| 50 | 20,600 |
| 100 | 58,900 |
- 시드값이라 언제든 재조정 — 플레이 밸런스 보고 계수(60)·지수(1.5) 튜닝. **XP는 유지하고 곡선으로 난이도를 잡는다.**

---

## 4. 레벨 칭호 (레벨의 "의미" — 중요)
레벨이 숫자로만 끝나면 아쉽다. 레벨마다 **자동 칭호**를 붙인다.

> **코스메틱 칭호 ≠ 레벨 칭호**
> - 코스메틱 칭호 = 내가 골라 꾸미는 것 ("덕질 장인") — equipped.title
> - **레벨 칭호 = 현재 레벨을 나타내는 자동 칭호** — 레벨에서 파생, 선택 불가

`LEVEL_RANKS` 코드 상수 — **기존 `levelTier()`의 일타쿠~십타쿠 체계를 그대로 유지**(10레벨 단위). 각 항목이 `title` 외에 `icon` · `color`도 담도록 객체형:
> ```ts
> { level: 30, title: "삼타쿠", icon: "30lv", color: "..." }
> ```
| 레벨 | 칭호 |
|---|---|
| 1~9 | 입문 타쿠 |
| 10 | 일타쿠 |
| 20 | 이타쿠 |
| 30 | 삼타쿠 |
| 40 | 사타쿠 |
| 50 | 오타쿠 |
| 60 | 육타쿠 |
| 70 | 칠타쿠 |
| 80 | 팔타쿠 |
| 90 | 구타쿠 |
| 100 | 십타쿠 |

- 기존 `levelTier()`의 칭호·아이콘(10레벨 버킷 `/icons/level/*lv.png`)을 그대로 쓴다. `LEVEL_RANKS`는 거기에 `color` 정도만 얹는다(선택).
- `getMyLevelInfo.title`이 이 자동 칭호를 반환하도록 연결.
- 프로필 표시: `LV27 · 이타쿠` (자동) + `[선택 칭호] 덕질 장인` (코스메틱). 둘 다 보여주거나, 레벨 칭호는 성장센터/여권에만 — UI 단계 결정.

---

## 5. 배지 ↔ 레벨 (보너스 XP)
- 배지 = 목표, 레벨 = 성장. 활동 XP + 배지 보너스의 이중 리듬.
- 지급: `evaluateBadgeTiersForUser` 반환 tier마다 `addExpOnce('badge', tierId)`.
- 중복 불가: `user_badge_tiers` tier당 1행 + `addExpOnce` 이중 방어.
- 티어 XP: `badge_tiers.reward_exp`(신규 컬럼)로 개별 지정, 비면 등급 기본값:
  - common **15** / rare **30** / epic **60** / legendary **120**.
- 예: 리뷰 +10 → "리뷰 Lv2" 배지 +30.

---

## 6. 성장센터 연동
`GrowthCenter`에 추가:
- `levelInfo` (레벨/XP 진행바 + 레벨 칭호).
- **성장 요약(오늘 / 이번 주 / 총 XP) + 일일 목표** (아래).
- **최근 레벨업 기록** — `activity_logs`의 `level_up` 항목으로 "LV28(07-20)·LV29(07-24)·LV30(07-27)"처럼. 새 테이블 없이 연대기 재사용.
- `nextReward`를 `level_rewards` 기반으로 확장(마지막 단계).
- 흐름: `레벨/칭호 → 오늘 XP·일일목표 → 최근 레벨업 → 다음 레벨 보상 → 현재 도전(배지) → 최근 해금`.

### 성장 요약: 오늘 / 이번 주 / 총 XP + 일일 목표 (신규)
`exp_logs` 집계만으로 3개 지표를 보여준다(새 테이블 없음):
> ```
> 오늘    +35 XP
> 이번 주  +210 XP
> 총 XP   18,520
> ```
> - 오늘 = `created_at >= 오늘 0시` / 이번 주 = `created_at >= 이번 주 시작` / 총 = `user_exp.total_exp`.

그리고 **일일 목표** 진행 (오늘분 reason별 합산):
```
오늘  35 / 50 XP
████████░░
  +10 리뷰 작성
  +10 팬아트 등록
  +15 배지 획득
```
- 일일 목표(초안 50 XP)는 고정값(코드 상수, 튜닝 가능).
- **일일 목표 계산 기준**: 오늘 exp_logs 중 **Activity 기반 XP만** 합산. **제외: 배지 보너스(`badge`) · 대표 팬아트(`featured_fanart`) · 일일 목표 보너스(`daily_goal`).** 목표는 "오늘 얼마나 **활동**했는지"만 의미. (구현: `reason NOT IN ('badge','featured_fanart','daily_goal')` 합산)
- **목표 달성 시 소소한 보상 (하루 1회)**: 위 기준으로 목표(50)에 처음 도달하면 보너스 XP 1회(예 +5). `addExpOnce(reason='daily_goal', related_id='2026-07-27'`처럼 날짜)로 같은 날 재지급 차단. 순서는 **활동 XP → 목표 판정 → 보너스 지급**이고, 보너스는 목표 계산에 되먹임되지 않는다. exp_logs에 남아 XP 히스토리에도 표시.
- 확장(후순위): 연속 달성 스트릭 = `exp_logs`의 `daily_goal` 로그 연속일로 파생(새 테이블 없이).

---

## 7. XP 히스토리 — "왜 +15?"
`exp_logs`가 있으니 UI만. `getExpLogs`(존재) + `REASON_LABEL`:
```
오늘  +10 리뷰 작성 · ○○샵
      +15 루트 완주 · △△코스
      +30 배지 획득 · 리뷰 Lv2
어제  +5  샵 방문 · □□
```
- 진입: 성장센터 "오늘 +XP" 클릭 → 전체 히스토리(페이지 or 모달, UI 단계 결정).

---

## 8. 레벨업 축하 (보상 상자 연출)
- `addExp`가 레벨 상승 감지(old<new) 시 `takuroad:levelup` 발사 (`{ from, to, rewards: 그 사이 레벨의 level_rewards[] }`).
- `LevelUpModal`: 축하 → 새 레벨·레벨 칭호 → **보상이 있으면 🎁 상자 연출**(탭하면 열려서 프레임/칭호/배경 여러 개가 튀어나옴) → 바로 착용 → **다음 목표**.
  - 보상 여러 개를 한 번에 여는 재미 = `level_rewards`(한 레벨 다중 보상)와 짝.
  - 보상 없는 레벨은 축하 + 칭호만.
  - **다음 목표 표시 — 보상 우선**: 사람은 레벨보다 **보상**을 더 궁금해한다. 다가오는 `level_rewards`를 크게, 랭크는 그 아래 작게 —
> ```
> LV30 달성!
> 다음 보상 · 🎨 벚꽃 프레임 (LV35)
> ██████░░░░ 63%   남은 XP 840
> 다음 랭크 · LV40 사타쿠
> ```
> 진행바 %는 `getMyLevelInfo`(현재/다음 임계치), 다음 보상은 `level_rewards`에서 내 레벨보다 높은 가장 가까운 것, 다음 랭크는 `LEVEL_RANKS`. 다음 보상이 없으면 랭크를 메인으로.
- 코스메틱 해금 모달과 동시 발생 시 큐: **레벨업 → 코스메틱**.
- **레벨업 기록 (역할 분리)**: 둘 다 남기되 목적이 다르다.
  - `activity_logs` = **영구 성장 이력** — 연대기에서 언제든 되짚음. (type `level_up` 신설 또는 `achievement_unlock` 재사용)
  - `notifications` = **일시적 최근 알림** — "🎉 LV.30 달성 — 삼타쿠가 되었어요", 시간 지나면 정리될 수 있음.
- SQL 지급(대표 선정)은 클라 이벤트 없음 → 축하 생략, 레벨은 다음 접속 반영.

---

## 9. 악용 방지 (`exp_logs` 근거, 중앙화)
- `addExpOnce(user, amount, reason, relatedType, relatedId)` — 동일 `(user, reason, related_id)` 있으면 스킵(멱등). 일회성 전부.
- `addExpDailyCapped(user, amount, reason, perDay)` — 오늘 그 reason 합이 상한 미만일 때만. (v1.0엔 좋아요·댓글 0이라 상시 사용처 없음 — 향후 대비 헬퍼만.)
- 구조적 방어: 활동 refId=대상→반복 1회 / 카운트는 활성 행만 / 삭제 후 재업로드는 새 id라도 일회성·소액이라 실익 없음.
- **가장 큰 방어 = 스팸 벡터(좋아요·댓글)를 XP에서 제외.**

---

## 10. DB 변경 요약
- **새 테이블 1개**: `level_rewards(id, level, reward_type, reward_id, unique(level, reward_type, reward_id))` — **마지막 단계에** 생성. 지금은 `reward_type='cosmetic'`만, 향후 배지·슬롯·재화로 확장. (레벨→보상 다중 매핑, 여전히 상태 파생이라 이중 진실 없음)
- **새 컬럼 1개**: `badge_tiers.reward_exp int null` (선택).
- `level_thresholds` 시드: L1~100 (§3) — 데이터.
- `cosmetics.unlock_level`은 안 만든다(테이블 방식 채택).
- `exp_logs`는 이미 충분.

---

## 11. 구현 순서 (⚠️ `level_rewards`는 맨 마지막)
> 코스메틱이 계속 늘어나는 중이라, 보상 매핑을 먼저 채우면 계속 수정하게 된다. **코스메틱을 충분히 만든 뒤** Lv별 배치.

1. **XP 엔진** — `level_thresholds` 곡선 시드 + `expService`(`addExpOnce`/`addExpDailyCapped`/`XP_RULES`(객체형)/`REASON_LABEL`/배율) + `createActivity` 훅(+체크인 개별 addExp 제거) + 비활동 소스(팬아트, 대표선정) + 배지 보너스 XP(`reward_exp` 컬럼).
2. **레벨업 & 칭호** — `LEVEL_RANKS` + `getMyLevelInfo` 연결 + `takuroad:levelup` + `LevelUpModal`(보상 없으면 축하+칭호만) + **레벨업 기록**(notifications + activity_logs). XP 엔진이 레벨업까지 제대로 도는지 눈으로 검증.
3. **성장센터** — 레벨 헤더 + 성장 요약(오늘/이번주/총) + 일일 목표(+소소한 보상) + 최근 레벨업.
4. **XP 히스토리 UI** — "왜 +N?". 단순 조회 화면이라 언제든 붙일 수 있어 뒤로.
5. **레벨 보상(마지막)** — `level_rewards` 테이블 생성 + 실제 보유 코스메틱 보며 Lv별 배치 + `getMyCosmetics` 해금 반영 + 레벨업 모달 🎁 상자 연출 완성.

각 단계 끝에 테스트: 지급·멱등·레벨업·칭호·오늘XP/일일목표·해금.

---

## 12. 미결정 / 튜닝
- XP 값(§2-2)·곡선 계수(§3)·일일 목표값(§6) 밸런스 — 플레이 후 조정.
- 레벨 칭호 표(§4) 문구·중간 레벨 추가 여부.
- 레벨 칭호를 프로필에 항상 노출 vs 성장센터/여권 한정.
- `level_rewards` Lv↔코스메틱 매핑(§11-5) — 인벤토리 확정 후.
- 일일 목표 스트릭 도입 시점.
