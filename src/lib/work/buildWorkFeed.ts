import { FeedItem } from '@/lib/feed/types'
import { toEventFeed } from '@/lib/feed/toEventFeed'
import type { WorkEvent } from '@/services/eventService'

const ts = (s?: string | null) => (s ? new Date(s).getTime() : 0)

// 작품홈 새 소식(Feed) — 여러 도메인을 FeedItem으로 합쳐 최신순.
// "이 작품에 지금 무슨 일이 일어나고 있는가" = 작품홈의 심장.
// 소스: 이벤트(팝업/카페/전시/굿즈입고, toEventFeed) + 새 입점 샵.
export function buildWorkFeed(
  events: WorkEvent[],
  shops: any[],
  limit = 12,
): FeedItem[] {
  const entries: { at: number; item: FeedItem }[] = []

  // 1) 이벤트 → FeedItem (toEventFeed 재사용, createdAt으로 정렬)
  for (const e of events) {
    entries.push({ at: ts(e.createdAt ?? e.startDate), item: toEventFeed(e) })
  }

  // 2) 새로 입점한 샵 (created_at 기준)
  for (const s of shops) {
    if (!s?.created_at) continue
    entries.push({
      at: ts(s.created_at),
      item: {
        kind: 'notice',
        tone: 'mint',
        icon: 'shop',
        title: `${s.name} 입점`,
        subtitle: '새로 등록된 샵',
        href: s.slug ? `/shop/${s.slug}` : undefined,
      },
    })
  }

  return entries
    .filter(e => e.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(e => e.item)
}
