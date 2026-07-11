import { createClient } from '@/lib/supabase/client'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'
import { AxisProgress, NextGoal, getWorkProgress } from '@/lib/work/workProgress'

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
  /** 이벤트 종류 — 아이콘·문구를 UI가 이걸로 고른다 (Activity Type은 event_visit 하나) */
  eventType?: string | null
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
  kind: 'work'
  name: string                 // 블루아카 / 원피스
  slug?: string | null         // 작품 slug (링크용)
  /** 종합 탐험도 — 0인 축 제외 + 가중치 재정규화 (정책은 lib/work/workProgress.ts) */
  overall: number
  /** 축별 진행률 — 종합만 보여주면 "왜 62%인지" 알 수 없다 */
  axes: Record<'shop' | 'event' | 'cafe' | 'route', AxisProgress>
  /** 가장 가까운 미완료 축에서 고른 다음 목표 */
  next: NextGoal | null
}

export interface Story {
  key: string                  // "2026-07-10|홍대"
  area: string                 // 덕질 지역 — 홍대·수원
  date: string                 // 2026-07-10
  places: StoryPlace[]         // Place별 그룹
  totalCount: number           // 이 Story의 활동 수
  shopIds: string[]            // 이 Story에서 방문한 샵 (대표 작품 계산용)
  workIds: string[]            // 이 Story 활동들에 붙은 작품 (이벤트·루트도 작품을 가진다)
  highlight?: StoryHighlight | null
}

/**
 * Story에 묶이는 활동 종류.
 * ⚠️ 루트는 'route_completed' (d 있음) — 옛 완주 기록이 이 이름으로 쌓여 있다.
 * work_progress·achievement_unlock은 여기 없다 — 그건 Story 아래 "다음 목표" 영역에서 표현한다.
 */
const STORY_TYPES = new Set(['shop_visit', 'event_visit', 'route_completed'])

/**
 * occurred_at(UTC ISO) → 사용자의 "그날" (YYYY-MM-DD).
 *
 * ⚠️ 예전엔 ISO 문자열을 그냥 slice(0,10) 했는데, 그러면 UTC 날짜가 나온다.
 *    한국에서 새벽 1시에 방문 기록을 누르면 UTC로는 전날이라 Story가 어제로 묶였다.
 *    브라우저의 로컬 시간대로 변환해서 날짜를 뽑는다.
 */
function localDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

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
    .filter(a => a.related_type === 'shop' && a.related_id &&      // ⚠️ 샵일 때만 (이벤트/루트 id로 shops를 뒤지면 안 됨)
                 (!a.snapshot?.region || !a.snapshot?.shop_slug))  // 지역 또는 slug가 없으면 조회
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
    const when = localDay(a.occurred_at ?? a.created_at)   // 사용자의 로컬 날짜 기준
    if (!when) continue

    // 덕질 지역 — snapshot 우선(그때의 지역), 없으면 현재 샵 주소로 폴백
    const fallback = a.related_type === 'shop' && a.related_id ? addrByShop.get(a.related_id) : undefined
    const area = snap.region ?? fallback?.area ?? null

    // 지역을 모르는 활동(작품 진행률·업적 등)은 Story에 안 묶는다
    // (그건 Story 아래 "현재/다음목표" 영역에서 따로 표현)
    if (!area || !STORY_TYPES.has(a.type)) continue

    const key = `${when}|${area}`
    if (!map.has(key)) {
      map.set(key, { key, area, date: when, places: [], totalCount: 0, shopIds: [], workIds: [] })
    }
    const story = map.get(key)!
    if (a.related_type === 'shop' && a.related_id) story.shopIds.push(a.related_id)
    if (a.work_id) story.workIds.push(a.work_id)   // 이벤트·루트도 작품을 데려온다

    const placeName = snap.place_name ?? fallback?.placeName ?? null
    const item: StoryItem = {
      id: a.id,
      type: a.type,
      // 그때의 이름 (snapshot). 옛 데이터는 title로 폴백
      name: snap.shop_name ?? snap.event_name ?? snap.route_name ?? snap.cafe_name ?? a.title ?? '방문',
      refType: a.related_type ?? null,
      refId: a.related_id ?? null,
      // 링크용 — 샵은 slug, 루트는 share_token (루트 상세가 /route/[token]이라서)
      slug: snap.shop_slug ?? snap.route_token ?? fallback?.slug ?? null,
      workName: snap.work_name ?? null,
      eventType: snap.event_type ?? null,
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
 * Story 하이라이트 계산 — 대표 작품 우선.
 *
 * ⭐ 지역은 무대, 작품은 주인공, 샵은 조연.
 * 아무도 "수원을 모으려고" 오지 않는다. "블루아카를 좋아해서" 온다.
 *
 * 1) Story의 활동들이 데려온 작품 중 가장 많이 등장한 것 = 대표 작품
 *    (샵은 shop_tags로, 이벤트·루트는 activity의 work_id로)
 * 2) 그 작품의 4축 진행률 = lib/work/workProgress.ts (정책은 한 곳)
 * 3) 다음 목표 = 가장 가까운 미완료 축에서 하나
 *
 * ⚠️ 진행률은 여기서 계산하지 않는다. 정책 모듈에 물어본다.
 */
async function attachHighlights(supabase: any, userId: string, stories: Story[]): Promise<void> {
  if (stories.length === 0) return

  const allShopIds = [...new Set(stories.flatMap(s => s.shopIds))]

  // 샵이 취급하는 작품 (샵 → 작품들)
  const tagsByShop = new Map<string, { id: string; name: string; slug: string }[]>()
  if (allShopIds.length > 0) {
    const { data: storyTags } = await supabase
      .from('shop_tags')
      .select('shop_id, tag_id, tags ( id, name, slug )')
      .in('shop_id', allShopIds)

    for (const r of (storyTags ?? []) as any[]) {
      if (!r.tags) continue
      if (!tagsByShop.has(r.shop_id)) tagsByShop.set(r.shop_id, [])
      tagsByShop.get(r.shop_id)!.push({ id: r.tags.id, name: r.tags.name, slug: r.tags.slug })
    }
  }

  // 이벤트·루트가 데려온 작품의 이름 (샵을 안 거치므로 따로 조회)
  const bareWorkIds = [...new Set(stories.flatMap(s => s.workIds))]
  const workMeta = new Map<string, { id: string; name: string; slug: string }>()
  if (bareWorkIds.length > 0) {
    const { data: tags } = await supabase
      .from('tags')
      .select('id, name, slug')
      .in('id', bareWorkIds)
    for (const t of (tags ?? []) as any[]) workMeta.set(t.id, t)
  }
  for (const list of tagsByShop.values()) {
    for (const t of list) if (!workMeta.has(t.id)) workMeta.set(t.id, t)
  }

  // 1) Story별 대표 작품
  const topByStory = new Map<string, string>()
  for (const story of stories) {
    const count = new Map<string, number>()
    for (const shopId of story.shopIds) {
      for (const tag of tagsByShop.get(shopId) ?? []) {
        count.set(tag.id, (count.get(tag.id) ?? 0) + 1)
      }
    }
    for (const wid of story.workIds) {
      count.set(wid, (count.get(wid) ?? 0) + 1)   // 이벤트·루트가 데려온 작품
    }
    if (count.size === 0) { story.highlight = null; continue }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0]
    topByStory.set(story.key, top)
  }

  // 2) 대표 작품들의 4축 진행률을 한 번에 (정책 모듈)
  const progress = await getWorkProgress(userId, [...new Set([...topByStory.values()])])

  // 3) 붙이기
  for (const story of stories) {
    const workId = topByStory.get(story.key)
    if (!workId) { story.highlight = null; continue }

    const p = progress.get(workId)
    const meta = workMeta.get(workId)
    if (!p || !meta) { story.highlight = null; continue }

    story.highlight = {
      kind: 'work',
      name: meta.name,
      slug: meta.slug ?? null,
      overall: p.overall,
      axes: p.axes,
      next: p.next,
    }
  }
}
