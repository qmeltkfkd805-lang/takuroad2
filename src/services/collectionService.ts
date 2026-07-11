import { createClient } from '@/lib/supabase/client'
import { AxisKey, AxisProgress, NextGoal, getWorkProgress } from '@/lib/work/workProgress'
import { getMyStories } from '@/services/storyBuilder'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'

/* 컬렉션 홈 — "나의 덕질 컬렉션"
   ⭐ 진행률은 계산하지 않는다. 정책(lib/work/workProgress)에 물어본다.
   ⭐ 카드의 얼굴 = Place 대표 이미지.
      컬렉션은 "어느 샵에 갔는가"가 아니라 "그날 어디서 덕질했는가"의 기록이므로,
      샵 사진이 아니라 장소(스타필드·코엑스·DDP…)의 얼굴을 쓴다.
      카드 안에는 실제 방문한 샵 목록이 따라온다. Place 이미지가 없으면 지역명+그라디언트로 폴백. */

export interface CountStat { total: number; thisMonth: number }

export interface CollectionSummary {
  areas: CountStat
  shops: CountStat
  events: CountStat
  routes: CountStat
}

export interface StoryCardSummary {
  key: string
  area: string           // 덕질 지역 (수원·홍대)
  date: string
  placeName: string | null   // 대표 장소 (스타필드 수원)
  imageUrl: string | null    // 그 Place의 cover_image
  spots: string[]            // 실제 방문한 샵·이벤트 이름
  moreCount: number          // spots에서 잘린 나머지 수
  pct: number                // 대표 작품 종합 탐험도
}

export interface WorkCollection {
  id: string
  name: string
  slug: string
  coverUrl: string | null
  overall: number
  axes: Record<AxisKey, AxisProgress>
  next: NextGoal | null
}

export interface EarnedBadge {
  id: string
  name: string
  condition: string | null
  iconUrl: string | null
}

export interface CollectionHome {
  summary: CollectionSummary
  stories: StoryCardSummary[]
  works: WorkCollection[]
  badges: EarnedBadge[]
  badgeMore: number
}

function monthStartISO(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

const STORY_LIMIT = 6
const BADGE_LIMIT = 5
const SPOT_LIMIT = 2

export async function getCollectionHome(userId: string): Promise<CollectionHome> {
  const supabase = createClient()
  const from = monthStartISO()

  const [checkRes, evRes, rcRes, favRes, badgeRes, stories] = await Promise.all([
    supabase.from('check_ins').select('shop_id, created_at, shops ( addr, region )').eq('user_id', userId),
    supabase.from('event_visits').select('event_id, created_at').eq('user_id', userId),
    supabase.from('route_completions').select('route_id').eq('user_id', userId),
    supabase.from('user_favorite_tags').select('tag_id, tier').eq('user_id', userId).in('tier', ['favorite', 'interest']),
    supabase.from('user_badge_tiers').select('badge_tier_id, earned_at, badge_tiers ( * )').eq('user_id', userId).order('earned_at', { ascending: false }),
    getMyStories(userId, STORY_LIMIT),
  ])

  // 방문한 샵 / 덕질 지역 (shops.region이 비어도 주소에서 뽑는다)
  const rows = (checkRes.data ?? []) as any[]
  const shops = new Set<string>(), shopsM = new Set<string>()
  const areas = new Set<string>(), areasM = new Set<string>()
  for (const r of rows) {
    if (!r.shop_id) continue
    const isMonth = (r.created_at ?? '') >= from
    shops.add(r.shop_id)
    if (isMonth) shopsM.add(r.shop_id)
    const area = r.shops?.region?.trim() || geekAreaFromAddr(r.shops?.addr ?? null)
    if (area) { areas.add(area); if (isMonth) areasM.add(area) }
  }

  const evRows = (evRes.data ?? []) as any[]
  const rcRows = (rcRes.data ?? []) as any[]

  // route_completions엔 시각 컬럼이 없다 → "이번 달"은 Activity에서 센다
  const { data: routeActs } = await supabase
    .from('activity_logs').select('id')
    .eq('user_id', userId).eq('type', 'route_completed').gte('created_at', from)

  const summary: CollectionSummary = {
    areas:  { total: areas.size, thisMonth: areasM.size },
    shops:  { total: shops.size, thisMonth: shopsM.size },
    events: { total: evRows.length, thisMonth: evRows.filter(r => (r.created_at ?? '') >= from).length },
    routes: { total: rcRows.length, thisMonth: (routeActs ?? []).length },
  }

  // 좋아하는 작품(최애·관심)의 탐험 현황
  const favIds = ((favRes.data ?? []) as any[]).map(r => r.tag_id)
  let works: WorkCollection[] = []
  if (favIds.length > 0) {
    const [progress, tagRes] = await Promise.all([
      getWorkProgress(userId, favIds),
      supabase.from('tags').select('id, name, slug, cover_url').in('id', favIds),
    ])
    const metaById = new Map(((tagRes.data ?? []) as any[]).map(t => [t.id, t]))
    works = favIds
      .map(id => {
        const p = progress.get(id)
        const m: any = metaById.get(id)
        if (!p || !m) return null
        return {
          id, name: m.name, slug: m.slug, coverUrl: m.cover_url ?? null,
          overall: p.overall, axes: p.axes, next: p.next,
        } as WorkCollection
      })
      .filter((w): w is WorkCollection => w !== null)
      .sort((a, b) => b.overall - a.overall)
  }

  // ⭐ Story 카드의 얼굴 = 대표 Place의 cover_image
  //    Story의 샵들이 어느 Place에 속하는지로 대표 Place를 정한다 (가장 많은 샵이 속한 곳)
  const allShopIds = [...new Set(stories.flatMap(s => s.shopIds))]
  const placeByShop = new Map<string, { name: string; cover: string | null }>()
  if (allShopIds.length > 0) {
    const { data: shopRows } = await supabase
      .from('shops')
      .select('id, places ( name, cover_image )')
      .in('id', allShopIds)
    for (const s of (shopRows ?? []) as any[]) {
      if (s.places?.name) placeByShop.set(s.id, { name: s.places.name, cover: s.places.cover_image ?? null })
    }
  }

  const storyCards: StoryCardSummary[] = stories.map(s => {
    // 대표 Place — 이 Story에서 가장 많은 샵이 속한 곳
    const count = new Map<string, { n: number; cover: string | null }>()
    for (const id of s.shopIds) {
      const p = placeByShop.get(id)
      if (!p) continue
      const cur = count.get(p.name) ?? { n: 0, cover: p.cover }
      cur.n++
      count.set(p.name, cur)
    }
    const top = [...count.entries()].sort((a, b) => b[1].n - a[1].n)[0]

    const names = s.places.flatMap(p => p.items.map(i => i.name))
    return {
      key: s.key,
      area: s.area,
      date: s.date,
      placeName: top?.[0] ?? null,
      imageUrl: top?.[1].cover ?? null,
      spots: names.slice(0, SPOT_LIMIT),
      moreCount: Math.max(0, names.length - SPOT_LIMIT),
      pct: s.highlight?.overall ?? 0,
    }
  })

  // 획득한 배지
  const badgeRows = (badgeRes.data ?? []) as any[]
  const badges: EarnedBadge[] = badgeRows.slice(0, BADGE_LIMIT).map(r => {
    const t: any = r.badge_tiers ?? {}
    return {
      id: r.badge_tier_id,
      name: t.name ?? '배지',
      condition: t.condition_text ?? t.description ?? null,
      iconUrl: t.icon_url ?? null,
    }
  })

  return { summary, stories: storyCards, works, badges, badgeMore: Math.max(0, badgeRows.length - BADGE_LIMIT) }
}
