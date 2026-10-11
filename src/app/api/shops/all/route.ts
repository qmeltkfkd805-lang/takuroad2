/* 전체 샵 목록 (지도·루트 만들기 '샵 검색'에서 쓰는 getShops 결과) — 60초마다 한 번만 DB에서 만들고, 그 사이엔 만들어 둔 걸 나눠 준다.
   예전엔 지도를 열 때마다 사람마다 전체 샵(사진·장소·이벤트 포함)을 DB에서 새로 읽었다 — DB 사용 시간 1위였다.
   누구에게나 같은 공개 정보(운영 중인 샵)만 담는다. 찜·방문 같은 개인 정보는 각 화면이 따로 읽는다. */
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getShops } from '@/services/shopService'
import { slimShopForList } from '@/lib/shop/slimShop'
import { SHOP_LIST_TAG, SHOP_LIST_REVALIDATE } from '@/lib/cache/shopListCache'

// ⚡ 2026-10-11 60초 → 30분. 샵이 공개·수정되면 purgeShopLists()가 바로 비운다 (lib/cache/shopListCache.ts)
export const revalidate = 1800

const getCached = unstable_cache(
  async () => (await getShops()).map(slimShopForList),   // 목록에서 안 쓰는 칸(소개글·SNS 등)은 빼고
  ['api-shops-all-v2'],
  { revalidate: SHOP_LIST_REVALIDATE, tags: [SHOP_LIST_TAG] },
)

export async function GET() {
  const items = await getCached()
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
