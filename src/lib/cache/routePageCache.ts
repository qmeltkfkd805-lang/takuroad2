import { revalidatePath } from 'next/cache'

/* 루트 상세 페이지 캐시 (2026-10-24)
   /route/[token] 은 5분 동안 한 번 만든 걸 그대로 보여준다 (app/route/[token]/page.tsx).
   루트를 고치거나 공개 상태·작성자를 바꾸거나 지우면 루트 페이지를 전부 비운다.
   루트가 십여 개뿐이라 전부 비워도 다음 방문 때 한 번씩 다시 만드는 정도다.

   부르는 곳: /api/revalidate/routes(브라우저 저장 뒤), /api/admin/route-action(관리자 양도·삭제·공개) */
export function purgeRoutePages() {
  revalidatePath('/route/[token]', 'page')
}
