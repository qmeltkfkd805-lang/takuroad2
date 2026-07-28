/* 카카오 로컬 검색 — 서버 라우트(/api/kakao/search) 경유.
   ⭐ 브라우저에서 카카오 REST API를 직접 부르지 않는다. 키가 서버에만 있어 노출되지 않고,
      카카오 도메인(CORS) 등록 없이도 어느 배포 도메인에서든 동작한다. */

// 주소 → 좌표
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null
  try {
    const res = await fetch(`/api/kakao/search?type=address&query=${encodeURIComponent(address)}`)
    const data = await res.json()
    const doc = data?.documents?.[0]
    if (doc) return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) }
    return null
  } catch {
    return null
  }
}

// 장소명으로 검색 (예: "수원 스타필드") → 후보 목록
export interface PlaceSearchResult {
  name: string
  address: string
  roadAddress: string
  lat: number
  lng: number
  // 카카오 장소 식별 — Place 자동 연결/생성의 기준
  kakaoPlaceId: string | null
  categoryName: string | null       // 카카오 원본 카테고리 (예: "가정,생활 > 백화점")
  categoryGroupCode: string | null  // MT1, CT1, AT4 ...
}

export async function searchPlace(query: string): Promise<PlaceSearchResult[]> {
  if (!query.trim()) return []
  try {
    const res = await fetch(`/api/kakao/search?type=keyword&query=${encodeURIComponent(query)}`)
    const data = await res.json()
    if (!data?.documents) return []

    return data.documents.map((doc: any) => ({
      name: doc.place_name,
      address: doc.address_name,
      roadAddress: doc.road_address_name || doc.address_name,
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
      kakaoPlaceId: doc.id ?? null,
      categoryName: doc.category_name ?? null,
      categoryGroupCode: doc.category_group_code ?? null,
    }))
  } catch {
    return []
  }
}
