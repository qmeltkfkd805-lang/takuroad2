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