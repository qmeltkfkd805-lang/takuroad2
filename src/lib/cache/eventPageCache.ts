import { revalidatePath } from 'next/cache'

/* 이벤트 상세 페이지 캐시 (2026-10-24)
   /event/[id] 는 5분 동안 한 번 만든 걸 그대로 보여준다 (app/event/[id]/page.tsx).
   서버에서 만드는 건 검색·공유 정보(제목·설명·대표 이미지)와 구조화 데이터뿐이고 화면은 브라우저가 그린다.
   이벤트를 만들거나 고치거나 지우면 그 이벤트 페이지만 바로 비운다 — 한 페이지라 비용이 거의 없다. */
const UUID_RE = /^[0-9a-f-]{36}$/i

/** 서버 전용 — 이벤트 상세 페이지 캐시를 지금 비운다 (다음 요청 때 새로 만든다) */
export function purgeEventPage(id: string): boolean {
  if (!UUID_RE.test(id)) return false
  revalidatePath(`/event/${id}`)
  return true
}
