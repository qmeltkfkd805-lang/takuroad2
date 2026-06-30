import { Shop } from '@/types/shop'

export interface HotMapData {
  center: { lat: number; lng: number } | null
  hotRegions: string[]
  hotShopCount: number
  shopCount: number
}

function activity(s: Shop): number {
  return (s.visit_count ?? 0) + (s.bookmark_count ?? 0) * 2 + (s.rating_count ?? 0)
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function pickHotMap(shops: Shop[]): HotMapData {
  // 좌표를 숫자로 강제 변환 (Supabase numeric은 문자열로 올 수 있음)
  const geo = shops
    .map(s => ({ s, lat: Number(s.lat), lng: Number(s.lng) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))

  // 지역별 활동성 합산
  const byRegion = new Map<string, { sum: number; pts: { lat: number; lng: number }[] }>()
  for (const { s, lat, lng } of geo) {
    const r = s.district ?? s.city ?? s.region
    if (!r) continue
    const cur = byRegion.get(r) ?? { sum: 0, pts: [] }
    cur.sum += activity(s)
    cur.pts.push({ lat, lng })
    byRegion.set(r, cur)
  }

  const ranked = [...byRegion.entries()].sort((a, b) => b[1].sum - a[1].sum)
  const hotRegions = ranked.slice(0, 2).map(([r]) => r)

  // 중심 = 가장 핫한 지역 좌표 평균 (없으면 전체 평균)
  const topPts = ranked[0]?.[1].pts ?? geo.map(p => ({ lat: p.lat, lng: p.lng }))
  const center = topPts.length
    ? { lat: avg(topPts.map(p => p.lat)), lng: avg(topPts.map(p => p.lng)) }
    : null

  return {
    center,
    hotRegions,
    hotShopCount: geo.filter(p => activity(p.s) > 0).length,
    shopCount: shops.length,
  }
}
