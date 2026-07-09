// 카카오 로컬 API로 주소 → 좌표 변환
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}`,
        },
      }
    )
    const data = await response.json()
    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0]
      return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) }
    }
    return null
  } catch {
    return null
  }
}

// 장소명으로 검색 (예: "수원 스타필드") → 후보 목록 반환
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
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}`,
        },
      }
    )
    const data = await response.json()
    if (!data.documents) return []

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