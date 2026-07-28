# 팬아트 시스템 설계 (fanart-system.md)

> 확정 설계 문서 (구현 전 기준). 기존 community_posts / post_likes / post_comments 구조를 최대한 재사용한다.
> 코드·마이그레이션은 이 문서 승인 후 단계별로 진행한다.

## 0. 목표 (우선순위)
1. 참여하고 싶어지는 구조
2. 작품 홈이 계속 살아 움직이는 느낌
3. 실력자만 독식하지 않는 구조
4. 운영 부담 최소 (완전 자동, 투표·상시 수동 없음)

## 1. 데이터 기반 (확인 완료)
- **community_posts**: board='fanart', tag_ids[], author_id, like_count, comment_count, created_at, status(active), images, show_on_work
- **post_likes**: post_id, user_id, created_at  → 시즌 좋아요 정확 집계 가능
- **post_comments**: id, post_id, author_id, created_at, status  → 시즌 댓글 정확 집계 가능
- 신규 필요: featured_fanart 테이블 1개 + 선정 SQL 함수 1개

## 2. 업로드 (한 번에 두 곳)
- 입력: 제목 · 이미지(여러 장) · 설명(선택) · **작품(필수)** · 태그(선택)
- 저장: board='fanart' + tag_ids=[선택 작품] + show_on_work=true
- 결과: 팬아트 게시판(board 기준) + 작품 홈(tag_ids 기준) 동시 노출. 사용자는 한 번만 업로드.

## 3. 작품 홈 팬아트 탭
- 정렬: 최신순 / 인기순 (getWorkPosts sort 재사용)

## 4. 시즌 주기 (고정 날짜, KST)
- 시즌 A: 매월 1일 00:00 ~ 14일 23:59:59
- 시즌 B: 매월 15일 00:00 ~ 월말 23:59:59
- 교체: 매월 1일, 15일
- season_start(그 시즌 시작일)이 시즌 식별자

## 5. 선정 점수 (초기 버전 - 단순)
score = (시즌 내 받은 좋아요 수) + (시즌 내 달린 댓글 수) + (업로드 최신성 소폭 가산)
- 시즌 좋아요 = post_likes(post_id=..., created_at ∈ [season_start, season_end])
- 시즌 댓글  = post_comments(post_id=..., status='active', created_at ∈ 시즌)
- 최신성    = 시즌 시작 대비 최근 업로드일수록 +소량 (예: 최대 +3, 선형 감쇠)
- **조회수 제외** (노출·새로고침 영향 큼)
- 가중치는 초기 1:1 + 최신성 소폭, 이후 튜닝

## 6. 후보 탐색 (단계적 — 팬아트 적은 작품 대비)
후보가 나오면 즉시 멈춤:
1. 최근 60일 내 업로드 팬아트
2. 없으면 최근 180일
3. 없으면 전체 팬아트 중 재선정 제한 통과분
4. 그래도 없으면 기존 대표 유지 (새 레코드 생성 안 함)
- 각 단계에서 아래 독식 방지 필터를 통과한 것만 후보

## 7. 독식 방지 (가장 중요)
- **같은 팬아트(post)**: 대표 선정 후 6개월간 재선정 불가 (featured_fanart의 최근 6개월 selected_at 존재 시 제외)
- **같은 작가(author)**: 선정 후 다음 2개 시즌 동안 후보 제외 (직전 2시즌 대표 작가 제외)
- **완화**: 후보가 끝까지 없을 때만 작가 쿨다운을 단계적으로 완화 (2시즌 → 1시즌 → 해제). 팬아트 6개월 잠금은 유지(최후 폴백에서만 완화 검토)
- **관리자 지정**: 해당 시즌 selection_type='admin' 레코드가 있으면 자동 선정 스킵

## 8. 동점 처리 (신인 우선 — 별도 가산점 없음)
- 점수 차이가 없거나 거의 없으면(≤ ε): 대표로 선정된 적 없는 작가 우선
- 그래도 같으면: 최신 업로드 우선

## 9. featured_fanart 테이블
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| tag_id | uuid | 작품 |
| post_id | uuid | community_posts |
| author_id | uuid | 작가 |
| season_start | date | 시즌 시작일 = 식별자 |
| season_end | timestamptz | 시즌 종료 |
| selection_type | text | 'auto' \| 'admin' |
| score_snapshot | jsonb | 선정 당시 점수 내역(likes/comments/recency/total) |
| selected_at | timestamptz | 선정 시각 |
| created_at | timestamptz | default now() |
- 제약: **UNIQUE(tag_id, season_start)** — 한 작품, 한 시즌, 대표 하나

## 10. 선정 실행 (자동)
- pg_cron으로 매월 1일·15일 00:05(KST) 실행하는 SQL 함수
- 함수 흐름: 팬아트 있는 작품마다 → 관리자 지정 있으면 스킵 → 단계적 후보 탐색 + 독식 필터 → 점수 계산 + 동점처리 → featured_fanart insert (UNIQUE로 중복 방지)
- 폴백: 후보 없으면 이전 시즌 대표 승계(UI 단계에서 최종 결정)

## 11. 명예 시스템
- 게시글 배지: 현재 시즌 대표 → "이번 시즌 대표 팬아트", 과거 → "역대 대표"
- 작가 프로필: featured_fanart의 author_id count = 대표 선정 횟수
- 명예의 전당: featured_fanart 이력 페이지 (작품별·시즌별)

## 12. 관리자
- 관리자 UI에서 특정 post를 그 시즌 대표로 지정 → selection_type='admin'으로 upsert
- 자동 함수는 admin 레코드 존재 시 스킵

## 13. 구현 순서
1. (완료) 구조·created_at 확인
2. (이 문서) 설계 확정
3. featured_fanart 테이블 + 제약
4. 시즌 대표 선정 SQL 함수
5. 테스트 데이터로 선정·쿨다운·폴백 검증
6. 작품 홈 대표 UI 연결
7. 대표 배지 + 작가 프로필 선정 횟수
8. 명예의 전당 페이지

## 14. 미결정 / 나중 튜닝
- 점수 가중치 (좋아요:댓글:최신성 비율), 최신성 가산 공식 상세
- 후보 없을 때 작품 홈 대표 폴백 UI (이전 대표 유지 vs 최근 인기 노출)
- ε(동점 판정 폭) 값

## 부록 A. 구현 결정

### FK
- tag_id → tags(id): FK 유지. 작품은 하드 삭제하지 않는다.
- author_id → profiles(id): FK 유지. 회원 탈퇴는 soft delete다.
- post_id → FK 없음. community_posts가 하드 삭제되므로 대표 선정 이력을 보존하기 위해 UUID 값만 유지한다.

### 대표 게시글 삭제
대표였던 community_post가 삭제 또는 비활성화되면 해당 featured_fanart 이력은 삭제하지 않고 status='invalidated' 처리한다.

### 시즌 키
- YYYY-MMA: 매월 1~14일
- YYYY-MMB: 매월 15일~월말

### 쓰기 권한
featured_fanart에 대한 클라이언트 직접 INSERT/UPDATE는 허용하지 않는다.
자동 선정 및 관리자 지정 모두 SECURITY DEFINER 함수(RPC)를 통해 수행한다.

### 상태
초기 상태는 active / invalidated만 사용한다.
추가 상태가 필요해질 경우 CHECK 제약을 명시적으로 변경한다.
