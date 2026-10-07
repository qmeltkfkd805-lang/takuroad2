/* 전체 샵 목록 (샵 홈·샵 전체보기·마이페이지 공용) — 60초마다 한 번만 DB에서 만들고, 그 사이엔 만들어 둔 걸 나눠 준다.
   누구에게나 같은 공개 정보(활성 샵·취급 작품·굿즈·진행 중 이벤트)만 담는다. 개인 정보(찜·방문 등)는 각 화면이 따로 읽는다. */
import { NextResponse } from 'next/server'
import { loadShopHomeItems } from '@/services/shopHomeLoad'

export const revalidate = 60

export async function GET() {
  const items = await loadShopHomeItems()
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
