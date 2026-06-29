import { FeedItem } from '@/lib/feed/types'
import { toEventFeed } from '@/lib/feed/toEventFeed'
import type { WorkEvent } from '@/services/eventService'

// 작품 하나의 "지금 가장 중요한 소식" 한 개를 고른다. (정책)
// 항상 유효한 FeedItem 반환 — 소식 없으면 'none'(빈 상태도 1급 결과).
// 후보를 모아 우선순위로 선택. 새 소스 생기면 후보 배열에 추가만 하면 됨.

const NONE: FeedItem = {
  kind: 'none',
  title: '오늘은 새로운 소식이 없어요',
  icon: 'star',
  tone: 'gray',
}

export function pickWorkNews(
  work: { name: string; slug: string },
  events: WorkEvent[],
  affinity?: 'favorite' | 'interest' | null
): FeedItem {
  // 후보 모으기 (지금은 이벤트만. 나중에 굿즈·루트·컬렉션 등 추가)
  const candidates: FeedItem[] = events.map(toEventFeed)

  // 가장 중요한 하나 선택 — 지금은 "가장 최근"(events가 이미 최신순) = 첫 번째
  const picked = candidates[0] ?? NONE

  // 작품 맥락 붙이기 (어떤 작품의 소식인지)
  return {
    ...picked,
    contextLabel: work.name,
    contextAffinity: affinity ?? undefined,
  }
}
