import { revalidatePath } from 'next/cache'

/* 장소(건물) 상세 페이지 캐시 (2026-10-24)
   /place/[slug] 는 5분 동안 한 번 만든 걸 그대로 보여준다 (app/place/[slug]/page.tsx).
   이 페이지에는 장소 정보 + 입점 샵 + 진행 중 이벤트가 서버에서 통째로 들어간다.
   → 장소·샵·이벤트 어느 쪽이 바뀌어도 내용이 달라지므로 그때마다 장소 페이지를 전부 비운다.
   장소가 60여 곳뿐이라 전부 비워도 다음 방문 때 한 번씩 다시 만드는 정도다.

   부르는 곳: purgeShopLists()(샵 변경), /api/revalidate/events(이벤트 변경), /api/admin/upsert(장소 변경) */
export function purgePlacePages() {
  revalidatePath('/place/[slug]', 'page')
}
