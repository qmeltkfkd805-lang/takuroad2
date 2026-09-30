import { createClient } from '@/lib/supabase/client'
import { shopRegion } from '@/lib/shop/quickCompleteness'

export interface RelatedRoute {
  id: string
  title: string
  share_token: string
  cover_image_url: string | null
  shop_count: number
  distance_m: number | null
  reason: '같은 작품·지역' | '같은 지역' | '같은 작품'
  stops: { lat: number; lng: number }[]   // 카드 미니 지도용 (방문 순서)
  raw: any   // 루트 홈 카드(RouteResultCard)에 그대로 넘기는 원본
}

// 우선순위: 1) 같은 작품 + 근처 지역  2) 같은 지역  3) 같은 작품
export async function getRelatedRoutes(
  routeId: string,
  primaryTagId: string | null,
  regions: string[],
  limit = 4
): Promise<RelatedRoute[]> {
  const supabase = createClient()
  // 지역은 시/도 단위까지 넓혀 매칭 ("경기 수원시" → "경기"도 함께)
  const uniqRegions = Array.from(new Set(
    regions.filter(Boolean).flatMap((r) => [r, r.split(' ')[0]]).filter(Boolean)
  ))

  type Cand = { id: string; title: string; share_token: string; cover_image_url: string | null; shop_count: number; distance_m: number | null; sameTag: boolean; sameRegion: boolean; stops: { lat: number; lng: number }[]; raw: any }
  const stopsOf = (r: any) => ((r.route_shops ?? []) as any[]).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(rs => rs.shops).filter((x: any) => x && typeof x.lat === 'number' && typeof x.lng === 'number').map((x: any) => ({ lat: x.lat, lng: x.lng }))
  const map = new Map<string, Cand>()

  // 후보 A: 같은 작품 공개 루트
  if (primaryTagId) {
    const { data } = await supabase
      .from('routes')
      .select('id, title, share_token, cover_image_url, likes, total_distance_m, total_duration_min, route_shops ( id, sort_order, shops ( name, region, addr, lat, lng ) )')
      .eq('primary_tag_id', primaryTagId)
      .eq('is_shared', true)
      .neq('id', routeId)
      .limit(30)
    for (const r of (data ?? []) as any[]) {
      map.set(r.id, { id: r.id, title: r.title, share_token: r.share_token, cover_image_url: r.cover_image_url, shop_count: r.route_shops?.length ?? 0, distance_m: r.total_distance_m ?? null, sameTag: true, sameRegion: false, stops: stopsOf(r), raw: r })
    }
  }

  // 후보 B: 근처 지역(샵 region 일치) 공개 루트
  //  공개 루트를 샵 지역과 함께 불러와서 여기서 비교한다 (route_shops 중첩 필터는 결과가 비는 경우가 있었음)
  if (uniqRegions.length) {
    const want = new Set(regions.filter(Boolean))   // 같은 시·구끼리만 ("경기 수원시" ↔ "경기 수원시")
    const { data } = await supabase
      .from('routes')
      .select('id, title, share_token, cover_image_url, likes, total_distance_m, total_duration_min, route_shops ( id, sort_order, shops ( name, region, addr, lat, lng ) )')
      .eq('is_shared', true)
      .neq('id', routeId)
      .limit(500)
    for (const r of (data ?? []) as any[]) {
      const hit = (r.route_shops ?? []).some((rs: any) => {
        // region 칸이 비어 있는 샵이 많아서 주소 앞부분("경기 수원시")으로 대신 — 루트 목록과 같은 방식
        return !!rs.shops && want.has(shopRegion(rs.shops))
      })
      if (!hit) continue
      const ex = map.get(r.id)
      if (ex) ex.sameRegion = true
      else map.set(r.id, { id: r.id, title: r.title, share_token: r.share_token, cover_image_url: r.cover_image_url, shop_count: r.route_shops?.length ?? 0, distance_m: r.total_distance_m ?? null, sameTag: false, sameRegion: true, stops: stopsOf(r), raw: r })
    }
  }

  // 점수: 같은 작품+근처(3) > 같은 지역(2) > 같은 작품(1)
  const scored = Array.from(map.values()).map((c) => {
    let score: number, reason: RelatedRoute['reason']
    if (c.sameTag && c.sameRegion) { score = 3; reason = '같은 작품·지역' }
    else if (c.sameRegion) { score = 2; reason = '같은 지역' }
    else { score = 1; reason = '같은 작품' }
    return { c, score, reason }
  })
  scored.sort((a, b) => b.score - a.score || b.c.shop_count - a.c.shop_count)

  return scored.slice(0, limit).map(({ c, reason }) => ({
    id: c.id, title: c.title, share_token: c.share_token, cover_image_url: c.cover_image_url, shop_count: c.shop_count, distance_m: c.distance_m, reason, stops: c.stops, raw: c.raw,
  }))
}
