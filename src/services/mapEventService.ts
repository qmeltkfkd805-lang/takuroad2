import { createClient } from '@/lib/supabase/client'
import { regionFromAddr, districtFromAddr } from '@/lib/utils/region'

// 지도에 핀으로 띄울 '진행중 이벤트' 최소 타입.
// 위치는 이벤트 자체 좌표(place_lat/place_lng) 우선, 없으면 연결된 샵 좌표.
export interface MapEvent {
  id: string
  title: string
  coverUrl: string | null
  lat: number
  lng: number
  tagId: string | null
  placeName: string | null
  address: string | null    // 표시용 (장소명 우선)
  region: string | null     // 지역 필터용 (주소에서 추출한 시/도)
  district: string | null   // 지역 필터용 (구/군)
  type: string | null       // 'popup' | 'collab_cafe' | 'exhibition' | 'official_event'
  startDate: string | null
  endDate: string | null
}

// 이벤트 type → 한글 라벨
export const MAP_EVENT_TYPE_LABEL: Record<string, string> = {
  popup: '팝업스토어',
  collab_cafe: '콜라보 카페',
  exhibition: '전시',
  official_event: '행사',
}

// 오늘 기준 진행중(시작<=오늘, 종료 없음 또는 종료>=오늘)인 이벤트 중 좌표가 있는 것만.
export async function getOngoingMapEvents(): Promise<MapEvent[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('events')
    .select('id, title, cover_url, tag_id, type, place_name, place_addr, place_lat, place_lng, start_date, end_date, shops ( lat, lng, addr, name )')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (error) {
    console.error('getOngoingMapEvents error:', error)
    return []
  }

  const out: MapEvent[] = []
  for (const e of (data ?? []) as any[]) {
    const lat = e.place_lat ?? e.shops?.lat ?? null
    const lng = e.place_lng ?? e.shops?.lng ?? null
    if (lat == null || lng == null) continue
    out.push({
      id: e.id,
      title: e.title ?? '이벤트',
      coverUrl: e.cover_url ?? null,
      lat: Number(lat),
      lng: Number(lng),
      tagId: e.tag_id ?? null,
      placeName: e.place_name ?? null,
      address: e.place_name ?? e.shops?.name ?? e.place_addr ?? e.shops?.addr ?? null,
      region: regionFromAddr(e.place_addr ?? e.shops?.addr ?? null),
      district: districtFromAddr(e.place_addr ?? e.shops?.addr ?? null),
      type: e.type ?? null,
      startDate: e.start_date ?? null,
      endDate: e.end_date ?? null,
    })
  }
  return out
}
