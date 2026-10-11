/* 전체 샵 목록 (샵 홈·샵 전체보기·마이페이지 공용) — 60초마다 한 번만 DB에서 만들고, 그 사이엔 만들어 둔 걸 나눠 준다.
   누구에게나 같은 공개 정보(활성 샵·취급 작품·굿즈·진행 중 이벤트)만 담는다. 개인 정보(찜·방문 등)는 각 화면이 따로 읽는다. */
import { NextResponse } from 'next/server'
import { loadShopHomeItems } from '@/services/shopHomeLoad'
import { slimShopForList } from '@/lib/shop/slimShop'

/* ⚡ 2026-10-11 60초 → 30분. 이 라우트의 '응답' 자체를 30분 동안 저장해 두고 나눠 준다(ISR).
   샵이 공개·수정되면 purgeShopLists()가 revalidatePath 로 바로 비운다 (lib/cache/shopListCache.ts).
   ⚠️ unstable_cache 로 감싸지 말 것 — 데이터 캐시는 항목당 2MB 제한이라 샵 목록(2MB+)은 저장이 실패하고 500이 난다. */
export const revalidate = 1800

export async function GET() {
  const items = (await loadShopHomeItems()).map(slimShopForList)   // 목록에서 안 쓰는 칸(소개글·SNS 등)은 빼고
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
