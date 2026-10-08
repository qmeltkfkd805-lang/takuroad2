/* 전체 샵 목록 (지도·루트 만들기 '샵 검색'에서 쓰는 getShops 결과) — 60초마다 한 번만 DB에서 만들고, 그 사이엔 만들어 둔 걸 나눠 준다.
   예전엔 지도를 열 때마다 사람마다 전체 샵(사진·장소·이벤트 포함)을 DB에서 새로 읽었다 — DB 사용 시간 1위였다.
   누구에게나 같은 공개 정보(운영 중인 샵)만 담는다. 찜·방문 같은 개인 정보는 각 화면이 따로 읽는다. */
import { NextResponse } from 'next/server'
import { getShops } from '@/services/shopService'

export const revalidate = 60

export async function GET() {
  const items = await getShops()
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
