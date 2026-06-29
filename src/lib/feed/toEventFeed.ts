import { FeedItem, FeedKind, FeedTone } from './types'
import type { WorkEvent } from '@/services/eventService'

// 이벤트 type → FeedItem 표현(kind/icon/tone + 동사). 매핑은 여기 한 곳.
const TYPE_MAP: Record<string, { kind: FeedKind; icon: string; tone: FeedTone; verb: string }> = {
  popup:       { kind: 'popup', icon: 'popup',      tone: 'blue',  verb: '팝업이 열렸어요' },
  collab_cafe: { kind: 'event', icon: 'cafe',       tone: 'coral', verb: '콜라보 카페가 열렸어요' },
  exhibition:  { kind: 'event', icon: 'exhibition', tone: 'lavender', verb: '전시가 시작됐어요' },
  goods_added: { kind: 'goods', icon: 'goods',      tone: 'gold',  verb: '새 굿즈가 입고됐어요' },
}
const FALLBACK = { kind: 'event' as FeedKind, icon: 'news', tone: 'coral' as FeedTone, verb: '새 소식이 있어요' }

// 날짜 'YYYY-MM-DD' → 'M.D'
function md(d?: string | null): string | null {
  if (!d) return null
  const m = d.slice(5, 7).replace(/^0/, '')
  const day = d.slice(8, 10).replace(/^0/, '')
  return m && day ? `${m}.${day}` : null
}

export function toEventFeed(event: WorkEvent): FeedItem {
  const map = TYPE_MAP[event.type] ?? FALLBACK

  // 부제: 샵 이름 + 기간 (있는 것만)
  const period = md(event.startDate) && md(event.endDate)
    ? `${md(event.startDate)} - ${md(event.endDate)}`
    : md(event.startDate) ?? null
  const sub = [event.shopName, period].filter(Boolean).join(' · ') || undefined

  return {
    kind: map.kind,
    title: event.title || map.verb,
    subtitle: sub,
    icon: map.icon,
    tone: map.tone,
    href: event.shopSlug ? `/shop/${event.shopSlug}` : undefined,
  }
}
