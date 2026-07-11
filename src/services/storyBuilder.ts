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
  slug: string | null          // 샵/이벤트 slug — 클릭 시 이동용
  workName?: string | null
  pct?: number | null
}

/** Story 안의 장소 그룹 (Place 또는 독립샵) */
export interface StoryPlace {
  placeName: string | null     // 스타필드 수원 (없으면 독립샵)
  items: StoryItem[]
}

/**
 * Story 하이라이트 — "그래서 다음엔?"
 *
 * ⭐ 지역은 무대, 작품은 주인공.
 * 아무도 "수원을 모으려고" 오지 않는다. "블루아카를 좋아해서" 온다.
 * 그래서 대표 작품을 우선으로, 작품이 없을 때만 지역 탐험도로 폴백.
 */
export interface StoryHighlight {
  kind: 'work' | 'area'
  name: string                 // 블루아카 / 수원
  visited: number
  total: number
  pct: number
  nextShopName?: string | null // 다음 목표 — 아직 안 가본 샵
  nextPct?: number | null      // 거기 가면 몇 %
  slug?: string | null         // 작품 slug (링크용)
}

export interface Story {
  key: string                  // "2026-07-10|홍대"
  area: string                 // 덕질 지역 — 홍대·수원
  date: string                 // 2026-07-10
  places: StoryPlace[]         // Place별 그룹
  totalCount: number           // 이 Story의 활동 수
  shopIds: string[]            // 이 Story에서 방문한 샵 (하이라이트 계산용)
  highlight?: StoryHighlight | null
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
    .filter(a => SHOP_LIKE.has(a.type) && a.related_id &&
                 (!a.snapshot?.region || !a.snapshot?.shop_slug))   // 지역 또는 slug가 없으면 조회
    .map(a => a.related_id)

  const addrByShop = new Map<string, { area: string | null; placeName: string | null; slug: string | null }>()
  if (needAddr.length > 0) {
    const { data: shops } = await supabase
      .from('shops')
      .select('id, slug, addr, region, places ( name )')
      .in('id', [...new Set(needAddr)])

    for (const s of (shops ?? []) as any[]) {
      addrByShop.set(s.id, {
        area: s.region?.trim() || geekAreaFromAddr(s.addr),
        placeName: s.places?.name ?? null,
        slug: s.slug ?? null,
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
      map.set(key, { key, area, date: when, places: [], totalCount: 0, shopIds: [] })
    }
    const story = map.get(key)!
    if (a.related_type === 'shop' && a.related_id) story.shopIds.push(a.related_id)

    const placeName = snap.place_name ?? fallback?.placeName ?? null
    const item: StoryItem = {
      id: a.id,
      type: a.type,
      name: snap.shop_name ?? snap.event_name ?? snap.cafe_name ?? a.title ?? '방문',
      refType: a.related_type ?? null,
      refId: a.related_id ?? null,
      slug: snap.shop_slug ?? fallback?.slug ?? null,
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

  const stories = Array.from(map.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)

  // 각 Story에 하이라이트("그래서 다음엔?") 붙이기
  await attachHighlights(supabase, userId, stories)

  return stories
}

/**
 * Story 하이라이트 계산 — 대표 작품 우선, 없으면 지역.
 *
 * 1) Story에서 방문한 샵들이 취급하는 작품 중 가장 많이 등장한 것 = 대표 작품
 * 2) 그 작품의 전체 샵 vs 내가 방문한 샵 = 진행률
 * 3) 아직 안 가본 샵 하나 = 다음 목표
 * 4) 작품이 하나도 없으면 지역 탐험도로 폴백
 */
async function attachHighlights(supabase: any, userId: string, stories: Story[]): Promise<void> {
  if (stories.length === 0) return

  const allShopIds = [...new Set(stories.flatMap(s => s.shopIds))]
  if (allShopIds.length === 0) return

  // 내가 방문한 모든 샵 (진행률 계산의 기준)
  const { data: myVisits } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)
  const visitedSet = new Set((myVisits ?? []).map((v: any) => v.shop_id))

  // Story 샵들이 취급하는 작품
  const { data: storyTags } = await supabase
    .from('shop_tags')
    .select('shop_id, tag_id, tags ( id, name, slug )')
    .in('shop_id', allShopIds)

  // 작품별 전체 샵 (진행률의 분모)
  const tagIds = [...new Set((storyTags ?? []).map((r: any) => r.tag_id))]
  const shopsByTag = new Map<string, Set<string>>()
  if (tagIds.length > 0) {
    const { data: allTagShops } = await supabase
      .from('shop_tags')
      .select('tag_id, shop_id')
      .in('tag_id', tagIds)
    for (const r of (allTagShops ?? []) as any[]) {
      if (!shopsByTag.has(r.tag_id)) shopsByTag.set(r.tag_id, new Set())
      shopsByTag.get(r.tag_id)!.add(r.shop_id)
    }
  }

  // 샵 이름 (다음 목표 표시용)
  const nextShopIds = [...new Set([...shopsByTag.values()].flatMap(s => [...s]))]
    .filter(id => !visitedSet.has(id))
  const shopNames = new Map<string, string>()
  if (nextShopIds.length > 0) {
    const { data: shops } = await supabase
      .from('shops')
      .select('id, name')
      .in('id', nextShopIds.slice(0, 200))
      .eq('status', 'active')
    for (const s of (shops ?? []) as any[]) shopNames.set(s.id, s.name)
  }

  // 샵 → 작품들
  const tagsByShop = new Map<string, { id: string; name: string; slug: string }[]>()
  for (const r of (storyTags ?? []) as any[]) {
    if (!r.tags) continue
    if (!tagsByShop.has(r.shop_id)) tagsByShop.set(r.shop_id, [])
    tagsByShop.get(r.shop_id)!.push({ id: r.tags.id, name: r.tags.name, slug: r.tags.slug })
  }

  for (const story of stories) {
    // 이 Story에서 가장 많이 등장한 작품 = 대표 (주인공)
    const count = new Map<string, { meta: any; n: number }>()
    for (const shopId of story.shopIds) {
      for (const tag of tagsByShop.get(shopId) ?? []) {
        const cur = count.get(tag.id) ?? { meta: tag, n: 0 }
        cur.n++
        count.set(tag.id, cur)
      }
    }

    if (count.size > 0) {
      // 대표 작품 — 최다 등장 (동점이면 진행률 낮은 쪽이 "다음 목표"로 더 유의미)
      const top = [...count.entries()].sort((a, b) => b[1].n - a[1].n)[0]
      const [tagId, { meta }] = top

      const allShops = shopsByTag.get(tagId) ?? new Set()
      const total = allShops.size
      const visited = [...allShops].filter(id => visitedSet.has(id)).length
      const pct = total ? Math.round((visited / total) * 100) : 0

      // 다음 목표 — 아직 안 가본 샵 하나
      const notYet = [...allShops].filter(id => !visitedSet.has(id) && shopNames.has(id))
      const nextId = notYet[0] ?? null
      const nextPct = total && nextId ? Math.round(((visited + 1) / total) * 100) : null

      story.highlight = {
        kind: 'work',
        name: meta.name,
        slug: meta.slug,
        visited,
        total,
        pct,
        nextShopName: nextId ? shopNames.get(nextId) ?? null : null,
        nextPct,
      }
      continue
    }

    // 작품이 없으면 지역 탐험도로 폴백 (무대만 남은 Story)
    story.highlight = null
  }
}
