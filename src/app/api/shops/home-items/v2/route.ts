/* 전체 샵 목록 — 가벼운 모양 (2026-10-17)
   /api/shops/home-items 와 같은 내용인데, 취급 작품을 샵마다 {id,name,slug}로 되풀이하던 것
   (응답의 약 30%, 670KB)을 작품 목록 한 번(works) + 샵마다 번호 목록(wi)으로 보낸다.
   받는 쪽(shopHomeService.getShopHomeItems)이 원래 모양으로 되돌린다.
   예전 주소(/api/shops/home-items)는 배포 직후 열려 있던 탭을 위해 그대로 둔다.
   ⚠️ searchParams 를 읽으면 ISR이 꺼져 매 요청마다 DB를 읽게 되므로 주소를 따로 만들었다. */
import { NextResponse } from 'next/server'
import { loadShopHomeItems } from '@/services/shopHomeLoad'
import { slimShopForList } from '@/lib/shop/slimShop'

// 30분 저장 — 샵이 공개·수정되면 purgeShopLists()가 바로 비운다 (lib/cache/shopListCache.ts)
export const revalidate = 1800

export async function GET() {
  const items = (await loadShopHomeItems()).map(slimShopForList)
  const works: [string, string, string][] = []
  const index = new Map<string, number>()
  const compact = items.map(({ works: list, ...rest }) => {
    const wi = (list ?? []).map(w => {
      let i = index.get(w.id)
      if (i === undefined) { i = works.length; index.set(w.id, i); works.push([w.id, w.name, w.slug]) }
      return i
    })
    return { ...rest, wi }
  })
  return NextResponse.json(
    { v: 2, works, items: compact },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
