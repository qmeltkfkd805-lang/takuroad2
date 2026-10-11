/* 전체 샵 목록 (샵 홈·샵 전체보기·마이페이지 공용) — 60초마다 한 번만 DB에서 만들고, 그 사이엔 만들어 둔 걸 나눠 준다.
   누구에게나 같은 공개 정보(활성 샵·취급 작품·굿즈·진행 중 이벤트)만 담는다. 개인 정보(찜·방문 등)는 각 화면이 따로 읽는다. */
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { loadShopHomeItems } from '@/services/shopHomeLoad'
import { slimShopForList } from '@/lib/shop/slimShop'
import { SHOP_LIST_TAG, SHOP_LIST_REVALIDATE } from '@/lib/cache/shopListCache'

// ⚡ 2026-10-11 60초 → 30분. 샵이 공개·수정되면 purgeShopLists()가 바로 비운다 (lib/cache/shopListCache.ts)
export const revalidate = 1800

const getCached = unstable_cache(
  async () => (await loadShopHomeItems()).map(slimShopForList),   // 목록에서 안 쓰는 칸(소개글·SNS 등)은 빼고
  ['api-shops-home-items-v2'],
  { revalidate: SHOP_LIST_REVALIDATE, tags: [SHOP_LIST_TAG] },
)

export async function GET() {
  const items = await getCached()
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
