import { createClient } from '@/lib/supabase/client'
import { shopRegion } from '@/lib/utils/region'
import { resolveEventCover } from '@/lib/event/eventCover'

// 이벤트 홈이 다루는 타입. goods_added(굿즈 입고)는 "가볼 곳"이 아니라
// 작품 피드에 어울리는 소식이라 여기선 제외한다.
export type EventHomeType = 'popup' | 'collab_cafe' | 'exhibition' | 'official_event'
const HOME_TYPES: EventHomeType[] = ['popup', 'collab_cafe', 'exhibition', 'official_event']

export interface EventHomeItem {
  id: string
  type: EventHomeType
  title: string
  tagId: string | null
  workName: string | null
  workSlug: string | null
  coverUrl: string | null
  shopName: string | null
  shopSlug: string | null
  /** 화면에 보여줄 장소 — 샵 이름, 없으면 제보에 저장된 장소명 */
  placeName: string | null
  region: string | null
  startDate: string | null
  endDate: string | null
  reserveStart: string | null
  reserveEnd: string | null
  /** 여러 지점에서 하는 같은 이벤트를 묶는 키 (없으면 단독 이벤트) */
  seriesKey: string | null
}

const today = () => new Date().toISOString().slice(0, 10)

// events 행 + 작품/샵 정보를 붙여 EventHomeItem으로
async function hydrate(rows: any[]): Promise<EventHomeItem[]> {
  if (rows.length === 0) return []
  const supabase = createClient()

  const tagIds = [...new Set(rows.map(r => r.tag_id).filter(Boolean))]
  const shopIds = [...new Set(rows.map(r => r.shop_id).filter(Boolean))]

  const [tagRes, shopRes] = await Promise.all([
    tagIds.length
      ? supabase.from('tags').select('id, name, slug, cover_url').in('id', tagIds)
      : Promise.resolve({ data: [] as any[] }),
    shopIds.length
      ? supabase.from('shops').select('id, name, slug, addr, region').in('id', shopIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  for (const [label, res] of [['작품', tagRes], ['샵', shopRes]] as const) {
    if ((res as any).error) console.error(`[이벤트 홈] ${label} 조회 실패:`, (res as any).error.message)
  }

  const tagMap = new Map((tagRes.data ?? []).map((t: any) => [t.id, t]))
  const shopMap = new Map((shopRes.data ?? []).map((s: any) => [s.id, s]))


  return rows.map(r => {
    const tag = r.tag_id ? tagMap.get(r.tag_id) : null
    const shop = r.shop_id ? shopMap.get(r.shop_id) : null
    return {
      id: r.id,
      type: r.type as EventHomeType,
      title: r.title ?? '',
      tagId: r.tag_id ?? null,
      workName: tag?.name ?? null,
      workSlug: tag?.slug ?? null,
      coverUrl: resolveEventCover({ eventCoverUrl: r.cover_url ?? null, workCoverUrl: tag?.cover_url ?? null }),
      shopName: shop?.name ?? null,
      shopSlug: shop?.slug ?? null,
      placeName: shop?.name ?? r.place_name ?? null,
      region: shop
        ? shopRegion({ region: shop.region ?? null, addr: shop.addr ?? null })
        : (r.place_addr ? shopRegion({ region: null, addr: r.place_addr }) : null),
      startDate: r.start_date ?? null,
      endDate: r.end_date ?? null,
      reserveStart: r.reserve_start ?? null,
      reserveEnd: r.reserve_end ?? null,
      seriesKey: r.series_key ?? null,
    }
  })
}

/** 아직 안 끝난 이벤트 전부 (진행중 · 오늘 종료 · 곧 시작). 정렬은 rankEvents가 한다. */
export async function getEventHomeItems(): Promise<EventHomeItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, start_date, end_date, reserve_start, reserve_end, cover_url, place_name, place_addr, series_key')
    .in('type', HOME_TYPES)
    .or(`end_date.is.null,end_date.gte.${today()}`)
    .order('start_date', { ascending: true })

  if (error) { console.error('[이벤트 홈] 조회 실패:', error.message); return [] }
  return hydrate(data ?? [])
}

/** 최근 종료된 이벤트 — 종료 후 days일 이내만. 이벤트 홈 '종료' 탭용.
    (DB에서 지우는 게 아니라 목록 노출 기간만 제한한다. 그 이전 것도 상세 링크는 계속 살아있음) */
export async function getRecentlyEndedEventItems(days = 30): Promise<EventHomeItem[]> {
  const supabase = createClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, start_date, end_date, reserve_start, reserve_end, cover_url, place_name, place_addr, series_key')
    .in('type', HOME_TYPES)
    .lt('end_date', today())
    .gte('end_date', cutoff)
    .order('end_date', { ascending: false })

  if (error) { console.error('[이벤트 홈] 최근 종료 조회 실패:', error.message); return [] }
  return hydrate(data ?? [])
}

/** 지난 이벤트 — "더보기"를 눌렀을 때만 불러온다. */
export async function getPastEventItems(limit = 12): Promise<EventHomeItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, start_date, end_date, reserve_start, reserve_end, cover_url, place_name, place_addr, series_key')
    .in('type', HOME_TYPES)
    .lt('end_date', today())
    .order('end_date', { ascending: false })
    .limit(limit)

  if (error) { console.error('[이벤트 홈] 조회 실패:', error.message); return [] }
  return hydrate(data ?? [])
}

/** 내 최애 작품 id들 (user_favorite_tags.tier = 'favorite') */
/** 최애 + 관심을 한 번에 (카드 배지용). rankEvents 점수에는 최애만 쓴다 */
export async function getMyAffinityTagIds(userId: string): Promise<{ favorites: string[]; interests: string[] }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_favorite_tags')
    .select('tag_id, tier')
    .eq('user_id', userId)
    .in('tier', ['favorite', 'interest'])

  if (error) { console.error('[이벤트 홈] 최애/관심 조회 실패:', error.message); return { favorites: [], interests: [] } }

  const favorites: string[] = []
  const interests: string[] = []
  for (const r of (data ?? []) as any[]) {
    (r.tier === 'favorite' ? favorites : interests).push(r.tag_id)
  }
  return { favorites, interests }
}

export async function getMyFavoriteTagIds(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_favorite_tags')
    .select('tag_id')
    .eq('user_id', userId)
    .eq('tier', 'favorite')

  if (error) return []
  return (data ?? []).map((r: any) => r.tag_id)
}
