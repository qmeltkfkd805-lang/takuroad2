import { revalidatePath, revalidateTag } from 'next/cache'

/* 공개 샵 목록 캐시 (2026-10-11)
   샵이 1,100곳을 넘으며 '전체 샵 목록'이 한 번에 1MB가 넘는다. 이걸 60초마다 DB에서 다시 받아서
   Supabase 데이터 전송량(Egress)의 대부분을 차지했다(하루 수백 MB, 99%가 PostgREST).
   → 30분마다만 새로 받고, 대신 샵이 공개·수정되면 그 순간 purgeShopLists()로 비워서 바로 반영한다.

   이 캐시를 쓰는 곳: /api/shops/all, /api/shops/home-items(+/v2), 홈(app/page.tsx)의 인기 샵·덕질 지도 */
export const SHOP_LIST_TAG = 'public-shop-lists'
/** 초 — route 의 `export const revalidate` 는 숫자 그대로 써야 해서 거기엔 1800 을 직접 적는다 */
export const SHOP_LIST_REVALIDATE = 1800

/** 서버 전용 — 샵 목록 캐시를 지금 비운다 (다음 요청 때 새로 만든다) */
export function purgeShopLists() {
  revalidateTag(SHOP_LIST_TAG, { expire: 0 })
  revalidatePath('/api/shops/all')
  revalidatePath('/api/shops/home-items')
  revalidatePath('/api/shops/home-items/v2')
  revalidatePath('/')
}
