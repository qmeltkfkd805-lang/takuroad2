/**
 * 이벤트 커버 이미지 정책 — 한 곳.
 *
 * 지금은 events 테이블에 포스터 컬럼이 없어서 작품 커버(tags.cover_url)를 빌려 쓴다.
 * 나중에 events.cover_url(전용 포스터)이 생기면 이 함수 안만 고치면 되고,
 * 카드/페이지는 아무것도 몰라도 된다.
 */
export interface EventCoverSource {
  /** events 전용 포스터 (아직 없음 — 컬럼 추가되면 채워짐) */
  eventCoverUrl?: string | null
  /** 작품 커버 (tags.cover_url) */
  workCoverUrl?: string | null
}

export function resolveEventCover(src: EventCoverSource): string | null {
  return src.eventCoverUrl ?? src.workCoverUrl ?? null
}
