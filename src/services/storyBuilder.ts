import { createClient } from '@/lib/supabase/client'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'

/* ============================================================
   Story Builder — Activity를 "읽을 만한 이야기"로 재구성하는 계층

   원칙:
   - activities를 절대 바꾸지 않는다 (읽어서 조합만)
   - Story 단위 = 같은 날짜 + 같은 덕질 지역 (홍대·수원…)
     · 날짜별 묶기(오늘/어제)는 안 씀 — 굿즈샵은 한두 달에 한 번 가므로
     · 사용자는 "2026년 7월에 홍대에서" 처럼 지역으로 기억한다
   - Story 내부 = Place(장소)가 있으면 Place별로 한 번 더 묶음
     · 스타필드 안의 팝마트·가샤폰·펀스퀘어는 하나의 장면
     · Place 없는 독립샵은 샵 자체가 장소
   ============================================================ */

export interface StoryItem {
  id: string
  type: string                 // shop_visit · event_visit · route_complete …
  name: string                 // 그때의 이름 (snapshot)
  refType: string | null
  refId: string | null
  workName?: string | null
  pct?: number | null
}

/** Story 안의 장소 그룹 (Place 또는 독립샵) */
export interface StoryPlace {
  placeName: string | null     // 스타필드 수원 (없으면 독립샵)
  items: StoryItem[]
}

export interface Story {
  key: string                  // "2026-07-10|홍대"
  area: string                 // 덕질 지역 — 홍대·수원
  date: string                 // 2026-07-10
  places: StoryPlace[]         // Place별 그룹
  totalCount: number           // 이 Story의 활동 수
}

const SHOP_LIKE = new Set(['shop_visit', 'event_visit', 'cafe_visit'])

/**
 * 내 Activity들을 Story로 묶는다.
 * limit = 가져올 Story 개수 (컬렉션 홈은 3개, 연대기 전체는 더 많이)
 */
export async function getMyStories(userId: string, limit = 20): Promise<Story[]> {
  const supabase = createClient()

  const { data: acts, error } = await supabase
    .from('activity_logs')
    .select('id, type, snapshot, related_type, related_id, work_id, occurred_at, created_at, title')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .limit(300)

  if (error || !acts || acts.length === 0) return []

  // 덕질 지역이 snapshot에 없는 옛 Activity는 샵 주소로 폴백 조회
  const needAddr = (acts as any[])
    .filter(a => SHOP_LIKE.has(a.type) && !a.snapshot?.region && a.related_id)
    .map(a => a.related_id)

  const addrByShop = new Map<string, { area: string | null; placeName: string | null }>()
  if (needAddr.length > 0) {
    const { data: shops } = await supabase
      .from('shops')
      .select('id, addr, region, places ( name )')
      .in('id', [...new Set(needAddr)])

    for (const s of (shops ?? []) as any[]) {
      addrByShop.set(s.id, {
        area: s.region?.trim() || geekAreaFromAddr(s.addr),
        placeName: s.places?.name ?? null,
      })
    }
  }

  // 그룹핑: 날짜 + 덕질 지역
  const map = new Map<string, Story>()

  for (const a of acts as any[]) {
    const snap = a.snapshot ?? {}
    const when = (a.occurred_at ?? a.created_at ?? '').slice(0, 10)
    if (!when) continue

    // 덕질 지역 — snapshot 우선(그때의 지역), 없으면 현재 샵 주소로 폴백
    const fallback = a.related_id ? addrByShop.get(a.related_id) : undefined
    const area = snap.region ?? fallback?.area ?? null

    // 지역을 모르는 활동(작품 진행률·업적 등)은 Story에 안 묶는다
    // (그건 Story 아래 "현재/다음목표" 영역에서 따로 표현)
    if (!area || !SHOP_LIKE.has(a.type)) continue

    const key = `${when}|${area}`
    if (!map.has(key)) {
      map.set(key, { key, area, date: when, places: [], totalCount: 0 })
    }
    const story = map.get(key)!

    const placeName = snap.place_name ?? fallback?.placeName ?? null
    const item: StoryItem = {
      id: a.id,
      type: a.type,
      name: snap.shop_name ?? snap.event_name ?? snap.cafe_name ?? a.title ?? '방문',
      refType: a.related_type ?? null,
      refId: a.related_id ?? null,
      workName: snap.work_name ?? null,
    }

    // Place별 그룹 (Place 없으면 독립샵 = placeName null 그룹)
    let group = story.places.find(p => p.placeName === placeName)
    if (!group) {
      group = { placeName, items: [] }
      story.places.push(group)
    }
    group.items.push(item)
    story.totalCount++
  }

  // Place 있는 그룹을 위로 (장면이 더 크므로)
  for (const s of map.values()) {
    s.places.sort((a, b) => {
      if (!!a.placeName === !!b.placeName) return b.items.length - a.items.length
      return a.placeName ? -1 : 1
    })
  }

  return Array.from(map.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}
