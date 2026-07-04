import { createClient } from '@/lib/supabase/client'

export interface RelatedRoute {
  id: string
  title: string
  share_token: string
  cover_image_url: string | null
  shop_count: number
  distance_m: number | null
  reason: '같은 작품·근처' | '근처 지역' | '같은 작품'
}

// 우선순위: 1) 같은 작품 + 근처 지역  2) 같은 지역  3) 같은 작품
export async function getRelatedRoutes(
  routeId: string,
  primaryTagId: string | null,
  regions: string[],
  limit = 4
): Promise<RelatedRoute[]> {
  const supabase = createClient()
  const uniqRegions = Array.from(new Set(regions.filter(Boolean)))

  type Cand = { id: string; title: string; share_token: string; cover_image_url: string | null; shop_count: number; distance_m: number | null; sameTag: boolean; sameRegion: boolean }
  const map = new Map<string, Cand>()

  // 후보 A: 같은 작품 공개 루트
  if (primaryTagId) {
    const { data } = await supabase
      .from('routes')
      .select('id, title, share_token, cover_image_url, total_distance_m, route_shops(id)')
      .eq('primary_tag_id', primaryTagId)
      .eq('is_shared', true)
      .neq('id', routeId)
      .limit(30)
    for (const r of (data ?? []) as any[]) {
      map.set(r.id, { id: r.id, title: r.title, share_token: r.share_token, cover_image_url: r.cover_image_url, shop_count: r.route_shops?.length ?? 0, distance_m: r.total_distance_m ?? null, sameTag: true, sameRegion: false })
    }
  }

  // 후보 B: 근처 지역(샵 region 일치) 공개 루트
  if (uniqRegions.length) {
    const { data: rs } = await supabase
      .from('route_shops')
      .select('route_id, shops!inner(region)')
      .in('shops.region', uniqRegions)
      .limit(200)
    const regionIds = Array.from(new Set(((rs ?? []) as any[]).map((x) => x.route_id))).filter((id) => id !== routeId)
    if (regionIds.length) {
      const { data } = await supabase
        .from('routes')
        .select('id, title, share_token, cover_image_url, total_distance_m, route_shops(id)')
        .in('id', regionIds)
        .eq('is_shared', true)
        .neq('id', routeId)
        .limit(30)
      for (const r of (data ?? []) as any[]) {
        const ex = map.get(r.id)
        if (ex) ex.sameRegion = true
        else map.set(r.id, { id: r.id, title: r.title, share_token: r.share_token, cover_image_url: r.cover_image_url, shop_count: r.route_shops?.length ?? 0, distance_m: r.total_distance_m ?? null, sameTag: false, sameRegion: true })
      }
    }
  }

  // 점수: 같은 작품+근처(3) > 같은 지역(2) > 같은 작품(1)
  const scored = Array.from(map.values()).map((c) => {
    let score: number, reason: RelatedRoute['reason']
    if (c.sameTag && c.sameRegion) { score = 3; reason = '같은 작품·근처' }
    else if (c.sameRegion) { score = 2; reason = '근처 지역' }
    else { score = 1; reason = '같은 작품' }
    return { c, score, reason }
  })
  scored.sort((a, b) => b.score - a.score || b.c.shop_count - a.c.shop_count)

  return scored.slice(0, limit).map(({ c, reason }) => ({
    id: c.id, title: c.title, share_token: c.share_token, cover_image_url: c.cover_image_url, shop_count: c.shop_count, distance_m: c.distance_m, reason,
  }))
}
